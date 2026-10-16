import { Arc3DError } from "@arc3dlab/core"
import {
  executeAnalysisJob,
  type AnalysisJob,
  type AnalysisJobResult,
} from "./jobs"
import type { AnalysisTaskOptions } from "./scheduler"
import {
  restoreAnalysisError,
  serializeAnalysisError,
  type AnalysisWorkerFactory,
  type AnalysisWorkerLike,
  type AnalysisWorkerResponse,
} from "./worker-protocol"

export {
  serializeAnalysisError,
  restoreAnalysisError,
  type SerializedAnalysisError,
  type AnalysisWorkerLike,
  type AnalysisWorkerFactory,
} from "./worker-protocol"

/** 未完成的作业条目。 */
interface PendingEntry {
  /** 以结果兑现 Promise。 */
  resolve: (result: AnalysisJobResult) => void
  /** 以错误拒绝 Promise。 */
  reject: (error: Arc3DError) => void
  /** 移除该条目的取消监听等副作用。 */
  cleanup: () => void
}

/** 创建分析作业宿主的配置。 */
export interface AnalysisJobHostOptions {
  /** 进程内执行器，缺省为 {@link executeAnalysisJob}。 */
  execute?: (job: AnalysisJob) => AnalysisJobResult
  /** Worker 工厂，缺省在运行环境支持时创建独立线程 Worker。 */
  createWorker?: AnalysisWorkerFactory
}

/**
 * 在支持的环境创建独立线程 Worker。
 * @returns Worker 实例；运行环境不具备 `Worker` 或创建失败时返回 undefined。
 */
function createDefaultWorker(): AnalysisWorkerLike | undefined {
  if (typeof Worker === "undefined") return undefined
  try {
    return new Worker(new URL("./analysis-worker-entry.ts", import.meta.url), {
      type: "module",
    }) as unknown as AnalysisWorkerLike
  } catch {
    return undefined
  }
}

/**
 * 校验作业是否可结构化克隆。
 * @param job - 待校验的作业。
 * @throws {Arc3DError} 作业不可克隆时抛出。
 */
function assertCloneableJob(job: AnalysisJob): void {
  if (typeof structuredClone !== "function") return
  try {
    structuredClone(job)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Arc3DError(
      "INVALID_FORMAT",
      `Analysis job must be structured-cloneable: ${detail}`,
    )
  }
}

/**
 * 运行纯数值分析作业的宿主。
 *
 * 当运行环境提供 `Worker` 时，作业被投递到独立线程执行；否则降级为进程内
 * 执行，两者遵循相同的调度与取消契约：
 * 1. 作业与结果必须可结构化克隆，不可克隆的输入在 `run` 前以
 *    `INVALID_FORMAT` 拒绝。
 * 2. 取消通过 `Worker.terminate()`（Worker 路径）或协作式检查（进程内路径）
 *    实现，语义保持为抛出 `Arc3DError("CANCELLED")`。
 * 3. 跨线程错误沿用 {@link serializeAnalysisError} / {@link restoreAnalysisError}，
 *    保持 `Arc3DError` 错误码不丢失。
 */
export class AnalysisJobHost {
  private seq = 0
  private pending = new Map<number, PendingEntry>()
  private terminated = false
  private worker: AnalysisWorkerLike | undefined
  private workerUnavailable = false
  private readonly execute: (job: AnalysisJob) => AnalysisJobResult
  private readonly createWorker: AnalysisWorkerFactory

  /**
   * 创建分析作业宿主。
   * @param options - 宿主配置，缺省使用进程内执行器与默认 Worker 工厂。
   */
  constructor(options: AnalysisJobHostOptions = {}) {
    this.execute = options.execute ?? executeAnalysisJob
    this.createWorker = options.createWorker ?? createDefaultWorker
  }

  /**
   * 异步运行一个分析作业，支持取消。
   * @param job - 待运行的分析作业。
   * @param options - 任务选项，包含取消信号。
   * @returns 作业执行结果。
   * @throws {Arc3DError} 宿主已终止、作业被取消或输入不可克隆时抛出。
   */
  async run(
    job: AnalysisJob,
    options?: AnalysisTaskOptions,
  ): Promise<AnalysisJobResult> {
    if (this.terminated) {
      throw new Arc3DError("CANCELLED", "Analysis worker terminated")
    }
    if (options?.signal?.aborted) {
      throw new Arc3DError("CANCELLED", "Cancelled analysis job")
    }
    assertCloneableJob(job)
    const worker = this.ensureWorker()
    const id = (this.seq += 1)
    return new Promise<AnalysisJobResult>((resolve, reject) => {
      const settle = (error?: unknown, result?: AnalysisJobResult) => {
        const entry = this.pending.get(id)
        if (!entry) return
        this.pending.delete(id)
        entry.cleanup()
        if (error !== undefined) {
          entry.reject(
            error instanceof Arc3DError
              ? error
              : restoreAnalysisError(serializeAnalysisError(error)),
          )
          return
        }
        entry.resolve(result as AnalysisJobResult)
      }
      const onAbort = () => {
        if (worker) this.abortWorker()
        settle(new Arc3DError("CANCELLED", "Cancelled analysis job"))
      }
      const cleanup = () =>
        options?.signal?.removeEventListener("abort", onAbort)
      this.pending.set(id, { resolve, reject, cleanup })
      options?.signal?.addEventListener("abort", onAbort, { once: true })
      if (worker) {
        try {
          worker.postMessage({ id, job })
        } catch (error) {
          settle(error)
        }
        return
      }
      queueMicrotask(() => {
        if (!this.pending.has(id)) return
        try {
          const result = this.execute(job)
          if (options?.signal?.aborted) {
            settle(new Arc3DError("CANCELLED", "Cancelled analysis job"))
            return
          }
          settle(undefined, result)
        } catch (error) {
          settle(error)
        }
      })
    })
  }

  /** 终止宿主并拒绝所有未完成的作业。 */
  destroy(): void {
    this.terminated = true
    this.rejectAll(new Arc3DError("CANCELLED", "Analysis worker terminated"))
    this.resetWorker()
  }

  private ensureWorker(): AnalysisWorkerLike | undefined {
    if (this.worker) return this.worker
    if (this.workerUnavailable) return undefined
    let created: AnalysisWorkerLike | undefined
    try {
      created = this.createWorker()
    } catch {
      created = undefined
    }
    if (!created) {
      this.workerUnavailable = true
      return undefined
    }
    created.onmessage = (event) => this.handleMessage(event.data)
    created.onerror = (event) => this.handleWorkerError(event)
    this.worker = created
    return this.worker
  }

  private handleMessage(data: unknown): void {
    const message = data as AnalysisWorkerResponse
    if (typeof message?.id !== "number") return
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    entry.cleanup()
    if ("error" in message) {
      entry.reject(restoreAnalysisError(message.error))
    } else {
      entry.resolve(message.result)
    }
  }

  private handleWorkerError(event: unknown): void {
    this.workerUnavailable = true
    const detail =
      event instanceof Error ? event.message : "Analysis worker failed"
    this.rejectAll(new Arc3DError("ENGINE_FAILURE", detail))
    this.resetWorker()
  }

  private abortWorker(): void {
    this.rejectAll(new Arc3DError("CANCELLED", "Cancelled analysis job"))
    this.resetWorker()
  }

  private rejectAll(error: Arc3DError): void {
    const entries = Array.from(this.pending.values())
    this.pending.clear()
    for (const entry of entries) {
      entry.cleanup()
      entry.reject(error)
    }
  }

  private resetWorker(): void {
    if (!this.worker) return
    this.worker.onmessage = null
    this.worker.onerror = null
    try {
      this.worker.terminate()
    } catch {
      // 终止失败不影响宿主状态。
    }
    this.worker = undefined
  }
}
