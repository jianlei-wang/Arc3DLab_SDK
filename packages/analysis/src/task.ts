import {
  Arc3DError,
  createId,
  type Arc3DContext,
  type SpatialReference,
  type VerticalReference,
} from "@arc3dlab/core"
import { DEFAULT_MAX_SAMPLES, type AnalysisProgress } from "./scheduler"

/** 分析任务的生命周期状态。 */
export type AnalysisTaskStatus =
  "pending" | "running" | "succeeded" | "failed" | "cancelled"

/** 分析结果使用的单位描述。 */
export interface AnalysisUnits {
  /** 长度单位。 */
  length?: string
  /** 面积单位。 */
  area?: string
  /** 体积单位。 */
  volume?: string
  /** 角度单位。 */
  angle?: string
}

/** 分析产出物的类型。 */
export type ArtifactKind =
  "volume" | "profile" | "viewshed" | "sample-grid" | "report" | "geometry"

/** 分析任务产出的附加产物描述。 */
export interface ResultArtifact {
  /** 产物标识。 */
  id: string
  /** 产物类型。 */
  kind: ArtifactKind
  /** 产物的资源地址。 */
  uri?: string
  /** 产物的几何数据。 */
  geometry?: unknown
  /** 产物说明。 */
  description?: string
}

/** 分析任务记录，描述任务的输入、状态与时序信息。 */
export interface AnalysisTask<TInput = unknown> {
  /** 任务唯一标识。 */
  id: string
  /** 算法名称。 */
  algorithm: string
  /** 算法版本。 */
  algorithmVersion: string
  /** 任务输入。 */
  input: TInput
  /** 任务参数。 */
  params?: Record<string, unknown>
  /** 任务状态。 */
  status: AnalysisTaskStatus
  /** 任务创建时间戳。 */
  createdAt: number
  /** 任务开始时间戳。 */
  startedAt?: number
  /** 任务结束时间戳。 */
  finishedAt?: number
  /** 任务进度。 */
  progress?: AnalysisProgress
  /** 最大采样数量。 */
  maxSamples?: number
  /** 任务错误信息。 */
  error?: { code?: string; message: string }
}

/** 分析任务结果，包含任务元信息、结果值与产物。 */
export interface AnalysisResult<TResult = unknown> {
  /** 对应的任务标识。 */
  taskId: string
  /** 算法名称。 */
  algorithm: string
  /** 算法版本。 */
  algorithmVersion: string
  /** 结果状态。 */
  status: AnalysisTaskStatus
  /** 结果值。 */
  value?: TResult
  /** 结果单位。 */
  units?: AnalysisUnits
  /** 空间参考。 */
  spatialReference?: SpatialReference
  /** 垂直参考。 */
  verticalReference?: VerticalReference
  /** 结果范围，格式为最小经度、最小纬度、最大经度、最大纬度。 */
  extent?: [number, number, number, number]
  /** 警告信息列表。 */
  warnings: string[]
  /** 结果置信度。 */
  confidence?: number
  /** 输入快照。 */
  inputSnapshot?: unknown
  /** 结果来源。 */
  source?: string
  /** 结果产物列表。 */
  artifacts: ResultArtifact[]
  /** 错误信息。 */
  error?: { code?: string; message: string }
  /** 任务开始时间戳。 */
  startedAt?: number
  /** 任务结束时间戳。 */
  finishedAt?: number
}

/** 执行回调需要返回的结果内容。 */
export interface AnalysisExecution<TResult = unknown> {
  /** 结果值。 */
  value: TResult
  /** 结果单位。 */
  units?: AnalysisUnits
  /** 警告信息列表。 */
  warnings?: string[]
  /** 结果产物列表。 */
  artifacts?: ResultArtifact[]
  /** 结果范围，格式为最小经度、最小纬度、最大经度、最大纬度。 */
  extent?: [number, number, number, number]
  /** 结果置信度。 */
  confidence?: number
}

/** 任务运行器，向执行回调提供标识、进度上报与取消检查能力。 */
export interface AnalysisTaskRunner {
  /** 任务唯一标识。 */
  readonly id: string
  /** 最大采样数量。 */
  readonly maxSamples: number
  /**
   * 上报进度。
   *
   * @param completed - 已完成数量。
   * @param total - 总数量。
   * @param stage - 当前阶段名称。
   */
  report(completed: number, total: number, stage: string): void
  /**
   * 检查任务是否已取消。
   *
   * @param action - 正在执行的操作名称。
   */
  throwIfCancelled(action: string): void
}

/** 分析任务注册表，用于登记、更新与查询任务。 */
export class AnalysisTaskRegistry {
  private readonly tasks = new Map<string, AnalysisTask<unknown>>()

  /**
   * 注册一个分析任务。
   *
   * 登记时会存储输入的独立副本，调用方随后修改传入对象不会影响注册表内部状态。
   *
   * @param task - 待注册的任务。
   * @returns 注册后的任务（防御性副本，与内部存储相互独立）。
   * @throws {Arc3DError} 任务标识已存在时抛出。
   */
  add(task: AnalysisTask<unknown>): AnalysisTask<unknown> {
    if (this.tasks.has(task.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Analysis task already registered: ${task.id}`,
      )
    }
    const stored = cloneTask(task)
    this.tasks.set(task.id, stored)
    return cloneTask(stored)
  }

  /**
   * 按标识更新任务的局部字段。
   *
   * 更新时会对合并后的任务再次做防御性复制，`patch` 中嵌套对象的引用不会
   * 与注册表内部状态共享。
   *
   * @param id - 任务标识。
   * @param patch - 需要更新的字段。
   * @returns 更新后的任务（防御性副本），任务不存在时返回 undefined。
   */
  update(
    id: string,
    patch: Partial<AnalysisTask<unknown>>,
  ): AnalysisTask<unknown> | undefined {
    const current = this.tasks.get(id)
    if (!current) return undefined
    const next = cloneTask({ ...current, ...patch, id })
    this.tasks.set(id, next)
    return cloneTask(next)
  }

  /**
   * 按标识查询任务。
   * @param id - 任务标识。
   * @returns 对应的任务（防御性副本），任务不存在时返回 undefined。
   */
  get(id: string): AnalysisTask<unknown> | undefined {
    const task = this.tasks.get(id)
    return task ? cloneTask(task) : undefined
  }

  /**
   * 列出当前注册的所有任务。
   * @returns 任务列表（防御性副本）。
   */
  list(): AnalysisTask<unknown>[] {
    return Array.from(this.tasks.values(), (task) => cloneTask(task))
  }

  /** 清空注册表中的所有任务。 */
  clear(): void {
    this.tasks.clear()
  }
}

/** 对任务做防御性复制；不可结构化克隆时降级为浅拷贝。 */
function cloneTask(task: AnalysisTask<unknown>): AnalysisTask<unknown> {
  try {
    return structuredClone(task)
  } catch {
    return { ...task }
  }
}

function cloneInput<TInput>(input: TInput): {
  value: TInput
  cloned: boolean
} {
  if (input === null || input === undefined) {
    return { value: input, cloned: true }
  }
  try {
    return { value: structuredClone(input), cloned: true }
  } catch {
    return { value: input, cloned: false }
  }
}

/** 运行分析任务的配置选项。 */
export interface RunAnalysisTaskOptions<TInput, TResult> {
  /** Arc3D 运行上下文。 */
  context: Arc3DContext
  /** 算法名称。 */
  algorithm: string
  /** 算法版本。 */
  algorithmVersion?: string
  /** 任务输入。 */
  input: TInput
  /** 任务参数。 */
  params?: Record<string, unknown>
  /** 取消信号。 */
  signal?: AbortSignal
  /** 进度回调。 */
  onProgress?: (progress: AnalysisProgress) => void
  /** 最大采样数量。 */
  maxSamples?: number
  /** 空间参考。 */
  spatialReference?: SpatialReference
  /** 垂直参考。 */
  verticalReference?: VerticalReference
  /** 结果来源。 */
  source?: string
  /** 任务注册表。 */
  registry?: AnalysisTaskRegistry
  /**
   * 输入快照钩子。省略时使用 `structuredClone` 生成快照；
   * 当输入包含函数、DOM 或引擎对象等不可克隆内容时提供该钩子。
   */
  snapshot?: (input: TInput) => unknown
  /** 执行回调，接收任务运行器并返回执行结果。 */
  execute: (
    runner: AnalysisTaskRunner,
  ) => Promise<AnalysisExecution<TResult>> | AnalysisExecution<TResult>
}

function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Arc3DError) {
    return { code: error.code, message: error.message }
  }
  return {
    code: "ENGINE_FAILURE",
    message: error instanceof Error ? error.message : String(error),
  }
}

/**
 * 以统一的任务与结果契约执行一次分析：状态转移、进度、取消、计时与错误
 * 都会被记录到任务条目并反映在返回结果上。
 *
 * 取消是协作式的：`execute` 完成前后都会检查 `AbortSignal` 与运行时生命周期，
 * 因此执行期间触发的取消会被记录为 `cancelled`；但同步计算无法被强制中断，
 * 长循环需主动调用 `runner.throwIfCancelled()` 检查点。输入默认经
 * `structuredClone` 生成独立快照，不可克隆输入可通过 `snapshot` 钩子覆盖。
 *
 * @param options - 运行分析任务的配置选项。
 * @returns 分析结果。
 */
export async function runAnalysisTask<TInput, TResult>(
  options: RunAnalysisTaskOptions<TInput, TResult>,
): Promise<AnalysisResult<TResult>> {
  const id = createId("task")
  const algorithmVersion = options.algorithmVersion ?? "1.0.0"
  const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES

  const warnings: string[] = []
  let inputSnapshot: unknown
  if (options.snapshot) {
    const cloned = cloneInput(options.snapshot(options.input))
    inputSnapshot = cloned.value
    if (!cloned.cloned) {
      warnings.push(
        "Custom input snapshot could not be structured-cloned; it may share references with the caller.",
      )
    }
  } else {
    const cloned = cloneInput(options.input)
    inputSnapshot = cloned.value
    if (!cloned.cloned) {
      warnings.push(
        "Input could not be structured-cloned; inputSnapshot references the original object.",
      )
    }
  }
  let paramsSnapshot: Record<string, unknown> | undefined
  if (options.params) {
    const cloned = cloneInput(options.params)
    paramsSnapshot = cloned.value
    if (!cloned.cloned) {
      warnings.push(
        "Task params could not be structured-cloned; params may share references with the caller.",
      )
    }
  }

  const task: AnalysisTask<TInput> = {
    id,
    algorithm: options.algorithm,
    algorithmVersion,
    input: inputSnapshot as TInput,
    params: paramsSnapshot as Record<string, unknown> | undefined,
    status: "pending",
    createdAt: Date.now(),
    maxSamples,
  }
  options.registry?.add(task as AnalysisTask<unknown>)

  const assertActive = (action: string): void => {
    if (options.context.lifecycle.isTerminating) {
      throw new Arc3DError(
        "CANCELLED",
        `Cancelled ${action}: runtime destroyed`,
      )
    }
    if (options.signal?.aborted) {
      throw new Arc3DError("CANCELLED", `Cancelled ${action}`)
    }
  }

  const runner: AnalysisTaskRunner = {
    id,
    maxSamples,
    report(completed, total, stage) {
      const progress: AnalysisProgress = { completed, total, stage }
      task.progress = progress
      options.registry?.update(id, { progress })
      options.onProgress?.({ ...progress })
    },
    throwIfCancelled(action) {
      assertActive(action)
    },
  }

  const startedAt = Date.now()
  task.status = "running"
  task.startedAt = startedAt
  options.registry?.update(id, { status: "running", startedAt })

  try {
    assertActive(options.algorithm)
    const execution = await options.execute(runner)
    assertActive(options.algorithm)
    const finishedAt = Date.now()
    task.status = "succeeded"
    task.finishedAt = finishedAt
    options.registry?.update(id, { status: "succeeded", finishedAt })
    return {
      taskId: id,
      algorithm: options.algorithm,
      algorithmVersion,
      status: "succeeded",
      value: execution.value,
      units: execution.units,
      spatialReference: options.spatialReference,
      verticalReference: options.verticalReference,
      extent: execution.extent,
      warnings: [...warnings, ...(execution.warnings ?? [])],
      confidence: execution.confidence,
      inputSnapshot,
      source: options.source,
      artifacts: execution.artifacts ?? [],
      startedAt,
      finishedAt,
    }
  } catch (error) {
    const finishedAt = Date.now()
    const cancelled = error instanceof Arc3DError && error.code === "CANCELLED"
    const status: AnalysisTaskStatus = cancelled ? "cancelled" : "failed"
    const description = describeError(error)
    task.status = status
    task.finishedAt = finishedAt
    task.error = description
    options.registry?.update(id, {
      status,
      finishedAt,
      error: description,
    })
    return {
      taskId: id,
      algorithm: options.algorithm,
      algorithmVersion,
      status,
      warnings: [...warnings],
      artifacts: [],
      inputSnapshot,
      error: description,
      startedAt,
      finishedAt,
    }
  }
}
