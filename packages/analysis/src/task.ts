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
  /** 上报进度。 */
  report(completed: number, total: number, stage: string): void
  /** 检查任务是否已取消。 */
  throwIfCancelled(action: string): void
}

/** 分析任务注册表，用于登记、更新与查询任务。 */
export class AnalysisTaskRegistry {
  private readonly tasks = new Map<string, AnalysisTask<unknown>>()

  /**
   * 注册一个分析任务。
   * @param task - 待注册的任务。
   * @returns 注册后的任务。
   * @throws {Arc3DError} 任务标识已存在时抛出。
   */
  add(task: AnalysisTask<unknown>): AnalysisTask<unknown> {
    if (this.tasks.has(task.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Analysis task already registered: ${task.id}`,
      )
    }
    this.tasks.set(task.id, task)
    return task
  }

  /**
   * 按标识更新任务的局部字段。
   * @param id - 任务标识。
   * @param patch - 需要更新的字段。
   * @returns 更新后的任务，任务不存在时返回 undefined。
   */
  update(
    id: string,
    patch: Partial<AnalysisTask<unknown>>,
  ): AnalysisTask<unknown> | undefined {
    const current = this.tasks.get(id)
    if (!current) return undefined
    const next = { ...current, ...patch, id }
    this.tasks.set(id, next)
    return next
  }

  /**
   * 按标识查询任务。
   * @param id - 任务标识。
   * @returns 对应的任务，任务不存在时返回 undefined。
   */
  get(id: string): AnalysisTask<unknown> | undefined {
    return this.tasks.get(id)
  }

  /**
   * 列出当前注册的所有任务。
   * @returns 任务列表。
   */
  list(): AnalysisTask<unknown>[] {
    return Array.from(this.tasks.values())
  }

  /** 清空注册表中的所有任务。 */
  clear(): void {
    this.tasks.clear()
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
 * @param options - 运行分析任务的配置选项。
 * @returns 分析结果。
 */
export async function runAnalysisTask<TInput, TResult>(
  options: RunAnalysisTaskOptions<TInput, TResult>,
): Promise<AnalysisResult<TResult>> {
  const id = createId("task")
  const algorithmVersion = options.algorithmVersion ?? "1.0.0"
  const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES
  const task: AnalysisTask<TInput> = {
    id,
    algorithm: options.algorithm,
    algorithmVersion,
    input: options.input,
    params: options.params,
    status: "pending",
    createdAt: Date.now(),
    maxSamples,
  }
  options.registry?.add(task as AnalysisTask<unknown>)

  const runner: AnalysisTaskRunner = {
    id,
    maxSamples,
    report(completed, total, stage) {
      const progress: AnalysisProgress = { completed, total, stage }
      task.progress = progress
      options.registry?.update(id, { progress })
      options.onProgress?.(progress)
    },
    throwIfCancelled(action) {
      options.context.lifecycle.assertUsable(action)
      if (options.signal?.aborted) {
        throw new Arc3DError("CANCELLED", `Cancelled ${action}`)
      }
    },
  }

  const startedAt = Date.now()
  task.status = "running"
  task.startedAt = startedAt
  options.registry?.update(id, { status: "running", startedAt })

  try {
    runner.throwIfCancelled(options.algorithm)
    const execution = await options.execute(runner)
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
      warnings: execution.warnings ?? [],
      confidence: execution.confidence,
      inputSnapshot: options.input,
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
      warnings: [],
      artifacts: [],
      inputSnapshot: options.input,
      error: description,
      startedAt,
      finishedAt,
    }
  }
}
