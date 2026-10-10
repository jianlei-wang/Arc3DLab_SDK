import { Arc3DError, afterAwait, type Arc3DContext } from "@arc3dlab/core"

export const DEFAULT_MAX_SAMPLES = 10_000
export const DEFAULT_CHUNK_SIZE = 256

export interface AnalysisProgress {
  completed: number
  total: number
  stage: string
}

export interface AnalysisTaskOptions {
  signal?: AbortSignal
  onProgress?: (progress: AnalysisProgress) => void
  maxSamples?: number
}

export function throwIfCancelled(
  context: Arc3DContext,
  signal: AbortSignal | undefined,
  action: string,
): void {
  context.lifecycle.assertUsable(action)
  if (signal?.aborted) {
    throw new Arc3DError("CANCELLED", `Cancelled ${action}`)
  }
}

export async function afterAnalysisAwait<T>(
  context: Arc3DContext,
  signal: AbortSignal | undefined,
  action: string,
  value: T,
): Promise<T> {
  await afterAwait(context.lifecycle, action, value)
  throwIfCancelled(context, signal, action)
  return value
}

export function clampSampleCount(
  requested: number,
  maxSamples = DEFAULT_MAX_SAMPLES,
): number {
  if (!Number.isFinite(requested)) return 1
  return Math.min(Math.max(1, Math.floor(requested)), maxSamples)
}

export function reportProgress(
  onProgress: ((progress: AnalysisProgress) => void) | undefined,
  completed: number,
  total: number,
  stage: string,
): void {
  onProgress?.({ completed, total, stage })
}

export async function mapInChunks<T, R>(
  items: T[],
  chunkSize: number,
  mapper: (item: T, index: number) => Promise<R>,
  context: Arc3DContext,
  action: string,
  options?: AnalysisTaskOptions,
): Promise<R[]> {
  const size = Math.max(1, chunkSize)
  const out: R[] = []
  for (let offset = 0; offset < items.length; offset += size) {
    throwIfCancelled(context, options?.signal, action)
    const end = Math.min(items.length, offset + size)
    for (let i = offset; i < end; i += 1) {
      out.push(await mapper(items[i], i))
    }
    reportProgress(options?.onProgress, end, items.length, action)
    await Promise.resolve()
  }
  return out
}
