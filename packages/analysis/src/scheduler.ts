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

/** 分块计算之间的让出策略。 */
export type YieldStrategy = "macrotask" | "microtask"

/** 分析任务的通用可选配置。 */
export interface AnalysisTaskOptions {
  /** 用于取消任务的信号。 */
  signal?: AbortSignal
  /** 进度回调。 */
  onProgress?: (progress: AnalysisProgress) => void
  /** 最大采样数量。 */
  maxSamples?: number
  /** 任务级共享采样预算；省略时由调用方按单次 maxSamples 自行构造。 */
  sampleBudget?: AnalysisSampleBudget
  /** 块间让出策略，缺省为宏任务让出。 */
  yieldStrategy?: YieldStrategy
}

/**
 * 校验并解析累计采样上限。
 *
 * 省略时返回默认值；显式传入时必须是非负安全整数，单位为「采样点数量」。
 * 零值表示预算为零，允许创建但无法再预留任何采样点。
 *
 * @param value - 调用方传入的累计采样上限。
 * @param fallback - 省略时采用的默认值。
 * @returns 校验后的累计采样上限。
 * @throws {Arc3DError} 参数不是非负安全整数时抛出。
 */
export function resolveSampleLimit(
  value: number | undefined,
  fallback = DEFAULT_MAX_SAMPLES,
): number {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `maxSamples must be a non-negative safe integer: ${value}`,
    )
  }
  return value
}

/**
 * 任务级累计采样预算，由一次分析任务内所有子操作共同分摊。
 *
 * 以「累计已消耗采样点数量」为口径：每次 {@link reserve} 请求的采样会先与
 * 剩余额度比较，超限时抛错且不改变已消耗量。上限与单次预留均要求为非负
 * 安全整数；零预算合法，但任何正数预留都会因超出额度而失败。预算只增不减，
 * 不提供 release；需要重新分配额度时应创建新的预算实例。
 */
export class AnalysisSampleBudget {
  /** 允许消耗的累计采样点上限，单位为采样点数量。 */
  readonly maxSamples: number
  private consumed = 0

  /**
   * 创建采样预算。
   *
   * `maxSamples` 省略时使用默认上限；显式传入的 `NaN`、`Infinity`、负数、
   * 小数或非法类型会抛出 `INVALID_ARGUMENT`，不会被替换为默认值。
   *
   * @param maxSamples - 允许消耗的累计采样点上限，单位为采样点数量。
   * @throws {Arc3DError} 上限不是非负安全整数时抛出。
   */
  constructor(maxSamples?: number) {
    this.maxSamples = resolveSampleLimit(maxSamples)
  }

  /** 已消耗的采样点数量。 */
  get used(): number {
    return this.consumed
  }

  /** 剩余可消耗的采样点数量。 */
  get remaining(): number {
    return Math.max(0, this.maxSamples - this.consumed)
  }

  /**
   * 请求消耗指定数量的采样点。
   *
   * 零值表示不消耗并返回 0；负数、小数及非有限数值均视为非法输入，避免
   * 静默截断后掩盖调用方的参数错误。
   *
   * @param count - 请求消耗的采样点数量，单位为采样点。
   * @returns 被接受的采样点数量。
   * @throws {Arc3DError} 数量不是非负安全整数，或超出剩余额度时抛出。
   */
  reserve(count: number): number {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Analysis sample reservation must be a non-negative safe integer: ${count}`,
      )
    }
    if (count === 0) return 0
    if (count > this.remaining) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Analysis sample budget exceeded: requested ${count}, remaining ${this.remaining} of ${this.maxSamples}`,
      )
    }
    this.consumed += count
    return count
  }
}

/**
 * 在分块计算之间让出控制权，使待处理的其它任务得以运行。
 *
 * 缺省采用宏任务让出：优先使用 `MessageChannel`，不可用时回退
 * `setTimeout(0)`，两者都会进入下一轮事件循环，从而允许渲染帧、输入与
 * 超时回调执行。传入 `"microtask"` 时仅让出到微任务队列。
 *
 * @param strategy - 让出策略，缺省为宏任务。
 * @returns 让出完成后的 Promise。
 */
export function yieldToEventLoop(
  strategy: YieldStrategy = "macrotask",
): Promise<void> {
  if (strategy === "microtask") {
    return Promise.resolve()
  }
  if (typeof MessageChannel !== "undefined") {
    return new Promise<void>((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => {
        channel.port1.close()
        resolve()
      }
      channel.port2.postMessage(undefined)
    })
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
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
 * 校验并解析采样数量参数。
 *
 * 省略时返回默认值；显式传入时必须为大于等于 1 的有限数值，否则抛出
 * `INVALID_ARGUMENT`，避免非法数量进入后续几何计算。默认值只用于可省略
 * 的参数；必填参数应传入 `undefined` 作为默认值，以便拒绝缺失输入。
 *
 * @param value - 调用方传入的采样数量。
 * @param fallback - 省略时采用的默认值；必填参数传 `undefined`。
 * @param name - 参数名称，用于错误提示。
 * @returns 向下取整后的采样数量。
 * @throws {Arc3DError} 参数不是大于等于 1 的有限数值时抛出。
 */
export function resolveSampleCount(
  value: number | undefined,
  fallback: number | undefined,
  name: string,
): number {
  if (value === undefined) {
    if (fallback === undefined) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `${name} must be a finite number greater than or equal to 1: ${value}`,
      )
    }
    return fallback
  }
  if (!Number.isFinite(value) || value < 1) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${name} must be a finite number greater than or equal to 1: ${value}`,
    )
  }
  return Math.floor(value)
}

/**
 * 将请求的采样数量限制在合法范围内。
 *
 * 请求数量必须是有限数值；上限必须是大于等于 1 的有限数值，否则抛出
 * `INVALID_ARGUMENT`。请求数量小于 1 时按 1 处理。
 *
 * @param requested - 请求的采样数量。
 * @param maxSamples - 允许的最大采样数量，默认取默认上限。
 * @returns 限制后的采样数量。
 * @throws {Arc3DError} 请求数量或上限不是有限数值，或上限小于 1 时抛出。
 */
export function clampSampleCount(
  requested: number,
  maxSamples = DEFAULT_MAX_SAMPLES,
): number {
  if (!Number.isFinite(maxSamples) || maxSamples < 1) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `maxSamples must be a finite number greater than or equal to 1: ${maxSamples}`,
    )
  }
  if (!Number.isFinite(requested)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Requested sample count must be a finite number: ${requested}`,
    )
  }
  return Math.min(Math.max(1, Math.floor(requested)), Math.floor(maxSamples))
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
    await yieldToEventLoop(options?.yieldStrategy)
  }
  return out
}
