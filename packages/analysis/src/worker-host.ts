import { Arc3DError, type Arc3DErrorCode } from "@arc3dlab/core"
import { executeAnalysisJob, type AnalysisJob, type AnalysisJobResult } from "./jobs"
import type { AnalysisTaskOptions } from "./scheduler"

export interface SerializedAnalysisError {
  code: string
  message: string
}

export function serializeAnalysisError(error: unknown): SerializedAnalysisError {
  if (error instanceof Arc3DError) {
    return { code: error.code, message: error.message }
  }
  return {
    code: "ENGINE_FAILURE",
    message: error instanceof Error ? error.message : String(error),
  }
}

export function restoreAnalysisError(payload: SerializedAnalysisError): Arc3DError {
  return new Arc3DError(payload.code as Arc3DErrorCode, payload.message)
}

export class AnalysisWorkerHost {
  private seq = 0
  private pending = new Map<number, { reject: (error: Arc3DError) => void }>()
  private terminated = false

  constructor(private readonly execute = executeAnalysisJob) {}

  async run(
    job: AnalysisJob,
    options?: AnalysisTaskOptions
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
              : restoreAnalysisError(serializeAnalysisError(error))
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

  destroy(): void {
    this.terminated = true
    for (const entry of this.pending.values()) {
      entry.reject(new Arc3DError("CANCELLED", "Analysis worker terminated"))
    }
    this.pending.clear()
  }
}
