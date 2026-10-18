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

/** 同时执行分析作业的最大 Worker 数量。 */
const MAX_WORKERS = 4

/** 一个可复用的 Worker 槽位，同一时刻最多承载一个作业。 */
interface WorkerSlot {
  /** 底层 Worker 实例。 */
  worker: AnalysisWorkerLike
  /** 当前正在执行的作业标识；空闲时为空。 */
  jobId?: number
}

/** 未完成的作业条目。 */
interface PendingEntry {
  /** 待执行的作业。 */
  job: AnalysisJob
  /** 本次调用的任务选项。 */
  options?: AnalysisTaskOptions
  /** 作业占用的 Worker 槽位；进程内执行或排队时为空。 */
  slot?: WorkerSlot
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
 * 宿主维护一个最多 4 个 Worker 的池，每个在途作业独占一个 Worker 槽位；
 * 作业完成后槽位回到空闲池复用，超出容量的作业排队等待。
 * 因此取消一个作业只会终止它自己的 Worker，不会影响其他并发作业。
 *
 * 调度与取消契约：
 * 1. 作业与结果必须可结构化克隆，不可克隆的输入在 `run` 前以
 *    `INVALID_FORMAT` 拒绝。
 * 2. 取消会终止该作业独占的 Worker，并以 `Arc3DError("CANCELLED")` 拒绝；
 *    其他在途作业继续运行，排队作业由释放的槽位继续调度。
 * 3. 运行环境不提供 `Worker` 或 Worker 创建失败时，作业降级为进程内执行，
 *    取消语义保持不变。
 * 4. 跨线程错误沿用 {@link serializeAnalysisError} / {@link restoreAnalysisError}，
 *    保持 `Arc3DError` 错误码不丢失。
 */
export class AnalysisJobHost {
  private seq = 0
  private pending = new Map<number, PendingEntry>()
  private queue: number[] = []
  private slots = new Set<WorkerSlot>()
  private idle: WorkerSlot[] = []
  private terminated = false
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
   *
   * 每个在途作业独占一个 Worker 槽位，取消信号只影响传入它的作业。
   *
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
    const id = (this.seq += 1)
    return new Promise<AnalysisJobResult>((resolve, reject) => {
      const entry: PendingEntry = {
        job,
        options,
        resolve,
        reject,
        cleanup: () => undefined,
      }
      const onAbort = () => this.cancel(id)
      entry.cleanup = () =>
        options?.signal?.removeEventListener("abort", onAbort)
      this.pending.set(id, entry)
      options?.signal?.addEventListener("abort", onAbort, { once: true })
      this.dispatch(id)
    })
  }

  /** 终止宿主、终止全部 Worker 并拒绝所有未完成的作业。 */
  destroy(): void {
    if (this.terminated) return
    this.terminated = true
    this.queue = []
    this.rejectAll(new Arc3DError("CANCELLED", "Analysis worker terminated"))
    for (const slot of Array.from(this.slots)) {
      this.dropSlot(slot)
    }
  }

  /**
   * 调度一个待执行作业。
   * @param id - 作业标识。
   */
  private dispatch(id: number): void {
    const entry = this.pending.get(id)
    if (!entry) return
    if (this.workerUnavailable) {
      this.runInProcess(id)
      return
    }
    const slot = this.acquireSlot()
    if (slot === null) {
      this.queue.push(id)
      return
    }
    if (slot === undefined) {
      this.runInProcess(id)
      return
    }
    this.post(id, slot)
  }

  /**
   * 从空闲池获取槽位，或在容量允许时创建新 Worker。
   * @returns 可用槽位；`null` 表示池已满；`undefined` 表示 Worker 不可用。
   */
  private acquireSlot(): WorkerSlot | null | undefined {
    const reused = this.idle.pop()
    if (reused) return reused
    if (this.slots.size >= MAX_WORKERS) return null
    let worker: AnalysisWorkerLike | undefined
    try {
      worker = this.createWorker()
    } catch {
      worker = undefined
    }
    if (!worker) {
      this.workerUnavailable = true
      return undefined
    }
    const slot: WorkerSlot = { worker }
    worker.onmessage = (event) => this.handleMessage(slot, event.data)
    worker.onerror = (event) => this.handleWorkerError(slot, event)
    this.slots.add(slot)
    return slot
  }

  /**
   * 把作业投递到指定槽位。
   * @param id - 作业标识。
   * @param slot - 已分配的空闲槽位。
   */
  private post(id: number, slot: WorkerSlot): void {
    const entry = this.pending.get(id)
    if (!entry) {
      this.releaseSlot(slot)
      return
    }
    entry.slot = slot
    slot.jobId = id
    try {
      slot.worker.postMessage({ id, job: entry.job })
    } catch (error) {
      entry.slot = undefined
      this.dropSlot(slot)
      this.settle(id, error)
      this.pump()
    }
  }

  /**
   * 在进程内执行作业，用于 Worker 不可用的降级路径。
   * @param id - 作业标识。
   */
  private runInProcess(id: number): void {
    queueMicrotask(() => {
      const entry = this.pending.get(id)
      if (!entry) return
      try {
        const result = this.execute(entry.job)
        if (entry.options?.signal?.aborted) {
          this.settle(id, new Arc3DError("CANCELLED", "Cancelled analysis job"))
          return
        }
        this.settle(id, undefined, result)
      } catch (error) {
        this.settle(id, error)
      }
    })
  }

  /**
   * 处理 Worker 返回的消息。
   * @param slot - 消息所属槽位。
   * @param data - Worker 回传的响应。
   */
  private handleMessage(slot: WorkerSlot, data: unknown): void {
    const message = data as AnalysisWorkerResponse
    if (typeof message?.id !== "number") return
    const entry = this.pending.get(message.id)
    if (!entry || entry.slot !== slot) return
    if ("error" in message) {
      this.settle(message.id, restoreAnalysisError(message.error))
    } else {
      this.settle(message.id, undefined, message.result)
    }
    this.pump()
  }

  /**
   * 处理 Worker 错误，只拒绝该槽位上的作业。
   * @param slot - 出错的槽位。
   * @param event - Worker 错误事件。
   */
  private handleWorkerError(slot: WorkerSlot, event: unknown): void {
    const jobId = slot.jobId
    const detail =
      event instanceof Error ? event.message : "Analysis worker failed"
    this.dropSlot(slot)
    if (jobId !== undefined) {
      const entry = this.pending.get(jobId)
      if (entry) {
        entry.slot = undefined
        this.settle(jobId, new Arc3DError("ENGINE_FAILURE", detail))
      }
    }
    this.pump()
  }

  /**
   * 取消单个作业；仅终止该作业独占的 Worker。
   * @param id - 作业标识。
   */
  private cancel(id: number): void {
    const entry = this.pending.get(id)
    if (!entry) return
    const slot = entry.slot
    entry.slot = undefined
    if (slot) this.dropSlot(slot)
    this.settle(id, new Arc3DError("CANCELLED", "Cancelled analysis job"))
    this.pump()
  }

  /**
   * 继续调度排队中的作业。
   */
  private pump(): void {
    while (this.queue.length > 0) {
      const id = this.queue.shift() as number
      if (!this.pending.has(id)) continue
      if (this.workerUnavailable) {
        this.runInProcess(id)
        continue
      }
      const slot = this.acquireSlot()
      if (slot === null) {
        this.queue.unshift(id)
        return
      }
      if (slot === undefined) {
        this.runInProcess(id)
        continue
      }
      this.post(id, slot)
    }
  }

  /**
   * 完成一个作业并释放其槽位。
   * @param id - 作业标识。
   * @param error - 可选错误；省略时按成功处理。
   * @param result - 成功时的结果。
   */
  private settle(
    id: number,
    error?: unknown,
    result?: AnalysisJobResult,
  ): void {
    const entry = this.pending.get(id)
    if (!entry) return
    this.pending.delete(id)
    entry.cleanup()
    if (entry.slot) {
      this.releaseSlot(entry.slot)
      entry.slot = undefined
    }
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

  /**
   * 将槽位标记为空闲，供后续作业复用。
   * @param slot - 待释放的槽位。
   */
  private releaseSlot(slot: WorkerSlot): void {
    slot.jobId = undefined
    if (!this.slots.has(slot)) return
    if (!this.idle.includes(slot)) this.idle.push(slot)
  }

  /**
   * 终止并移除一个槽位。
   * @param slot - 待移除的槽位。
   */
  private dropSlot(slot: WorkerSlot): void {
    this.slots.delete(slot)
    this.idle = this.idle.filter((item) => item !== slot)
    slot.jobId = undefined
    slot.worker.onmessage = null
    slot.worker.onerror = null
    try {
      slot.worker.terminate()
    } catch {
      // 终止失败不影响宿主状态。
    }
  }

  /**
   * 拒绝所有未完成的作业，用于宿主销毁。
   * @param error - 拒绝原因。
   */
  private rejectAll(error: Arc3DError): void {
    const entries = Array.from(this.pending.values())
    this.pending.clear()
    for (const entry of entries) {
      entry.cleanup()
      entry.reject(error)
    }
  }
}
