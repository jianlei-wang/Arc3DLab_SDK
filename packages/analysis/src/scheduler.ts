import { Arc3DError, afterAwait, type Arc3DContext } from "@arc3dlab/core"

/** 默认允许的最大采样数量。 */
export const DEFAULT_MAX_SAMPLES = 10_000
/** 默认的分块处理大小。 */
export const DEFAULT_CHUNK_SIZE = 256

/** 分析进度信息。 */
export interface AnalysisProgress {
  /** 已完成的采样数量。 */
  completed: number
  /** 采样总数。 */
  total: number
  /** 当前所处的阶段描述。 */
  stage: string
}

/** 分析任务的通用可选配置。 */
export interface AnalysisTaskOptions {
  /** 用于取消任务的信号。 */
  signal?: AbortSignal
  /** 进度回调。 */
  onProgress?: (progress: AnalysisProgress) => void
  /** 最大采样数量。 */
  maxSamples?: number
}

/**
 * 在任务执行前检查上下文可用性并处理取消。
 * @param context - Arc3D 运行上下文。
 * @param signal - 取消信号，可为空。
 * @param action - 操作描述，用于错误提示。
 * @throws {Arc3DError} 任务被取消时抛出。
 */
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

/**
 * 在异步等待后检查任务的取消状态。
 * @param context - Arc3D 运行上下文。
 * @param signal - 取消信号，可为空。
 * @param action - 操作描述，用于错误提示。
 * @param value - 等待完成后需要返回的值。
 * @returns 原样返回的等待结果。
 * @throws {Arc3DError} 任务被取消时抛出。
 */
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

/**
 * 将请求的采样数量限制在合法范围内。
 * @param requested - 请求的采样数量。
 * @param maxSamples - 允许的最大采样数量，默认取默认上限。
 * @returns 限制后的采样数量。
 */
export function clampSampleCount(
  requested: number,
  maxSamples = DEFAULT_MAX_SAMPLES,
): number {
  if (!Number.isFinite(requested)) return 1
  return Math.min(Math.max(1, Math.floor(requested)), maxSamples)
}

/**
 * 通过回调上报当前分析进度。
 * @param onProgress - 进度回调，可为空。
 * @param completed - 已完成的采样数量。
 * @param total - 采样总数。
 * @param stage - 当前阶段描述。
 */
export function reportProgress(
  onProgress: ((progress: AnalysisProgress) => void) | undefined,
  completed: number,
  total: number,
  stage: string,
): void {
  onProgress?.({ completed, total, stage })
}

/**
 * 将列表分块后逐项异步映射，并在块间汇报进度与检查取消。
 * @param items - 待处理的项目列表。
 * @param chunkSize - 每块包含的项目数量。
 * @param mapper - 针对单个项目的异步映射函数。
 * @param context - Arc3D 运行上下文。
 * @param action - 操作描述，用于错误提示。
 * @param options - 任务选项，包含取消信号与进度回调。
 * @returns 映射结果列表。
 */
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
