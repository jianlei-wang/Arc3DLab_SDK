import { Arc3DError, type Arc3DErrorCode } from "@arc3dlab/core"
import {
  executeAnalysisJob,
  type AnalysisJob,
  type AnalysisJobResult,
} from "./jobs"
import type { AnalysisTaskOptions } from "./scheduler"

/** 可跨线程传递的序列化错误信息。 */
export interface SerializedAnalysisError {
  /** 错误码。 */
  code: string
  /** 错误消息。 */
  message: string
}

/**
 * 将任意错误序列化为可传递的错误信息。
 * @param error - 待序列化的错误。
 * @returns 序列化后的错误信息。
 */
export function serializeAnalysisError(
  error: unknown,
): SerializedAnalysisError {
  if (error instanceof Arc3DError) {
    return { code: error.code, message: error.message }
  }
  return {
    code: "ENGINE_FAILURE",
    message: error instanceof Error ? error.message : String(error),
  }
}

/**
 * 将序列化的错误信息还原为 Arc3DError。
 * @param payload - 序列化的错误信息。
 * @returns 还原得到的 Arc3DError。
 */
export function restoreAnalysisError(
  payload: SerializedAnalysisError,
): Arc3DError {
  return new Arc3DError(payload.code as Arc3DErrorCode, payload.message)
}

/**
 * 在主线程内同步运行分析作业的宿主。
 *
 * 特意命名为 AnalysisJobHost：它以异步方式调度与取消作业，但尚未启动真正的
 * Web Worker。在真实工作线程实现完成前，此宿主即为该实现需要满足的契约。
 */
export class AnalysisJobHost {
  private seq = 0
  private pending = new Map<number, { reject: (error: Arc3DError) => void }>()
  private terminated = false

  /**
   * 创建分析作业宿主。
   * @param execute - 作业执行函数，默认为进程内执行器。
   */
  constructor(private readonly execute = executeAnalysisJob) {}

  /**
   * 异步运行一个分析作业，支持取消。
   * @param job - 待运行的分析作业。
   * @param options - 任务选项，包含取消信号。
   * @returns 作业执行结果。
   * @throws {Arc3DError} 宿主已终止或作业被取消时抛出。
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

    const id = (this.seq += 1)
    return new Promise((resolve, reject) => {
      const finish = (error?: unknown, result?: AnalysisJobResult) => {
        if (!this.pending.has(id)) return
        this.pending.delete(id)
        options?.signal?.removeEventListener("abort", onAbort)
        if (error) {
          reject(
            error instanceof Arc3DError
              ? error
              : restoreAnalysisError(serializeAnalysisError(error)),
          )
          return
        }
        resolve(result as AnalysisJobResult)
      }
      const onAbort = () => {
        finish(new Arc3DError("CANCELLED", "Cancelled analysis job"))
      }
      this.pending.set(id, { reject })
      options?.signal?.addEventListener("abort", onAbort, { once: true })
      queueMicrotask(() => {
        if (!this.pending.has(id)) return
        try {
          const result = this.execute(job)
          if (options?.signal?.aborted) {
            finish(new Arc3DError("CANCELLED", "Cancelled analysis job"))
            return
          }
          finish(undefined, result)
        } catch (error) {
          finish(error)
        }
      })
    })
  }

  /** 终止宿主并拒绝所有未完成的作业。 */
  destroy(): void {
    this.terminated = true
    for (const entry of this.pending.values()) {
      entry.reject(new Arc3DError("CANCELLED", "Analysis worker terminated"))
    }
    this.pending.clear()
  }
}
