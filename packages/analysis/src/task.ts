import {
  Arc3DError,
  createId,
  type Arc3DContext,
  type SpatialReference,
  type VerticalReference,
} from "@arc3dlab/core"
import { DEFAULT_MAX_SAMPLES, type AnalysisProgress } from "./scheduler"

export type AnalysisTaskStatus =
  "pending" | "running" | "succeeded" | "failed" | "cancelled"

export interface AnalysisUnits {
  length?: string
  area?: string
  volume?: string
  angle?: string
}

export type ArtifactKind =
  "volume" | "profile" | "viewshed" | "sample-grid" | "report" | "geometry"

export interface ResultArtifact {
  id: string
  kind: ArtifactKind
  uri?: string
  geometry?: unknown
  description?: string
}

export interface AnalysisTask<TInput = unknown> {
  id: string
  algorithm: string
  algorithmVersion: string
  input: TInput
  params?: Record<string, unknown>
  status: AnalysisTaskStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  progress?: AnalysisProgress
  maxSamples?: number
  error?: { code?: string; message: string }
}

export interface AnalysisResult<TResult = unknown> {
  taskId: string
  algorithm: string
  algorithmVersion: string
  status: AnalysisTaskStatus
  value?: TResult
  units?: AnalysisUnits
  spatialReference?: SpatialReference
  verticalReference?: VerticalReference
  extent?: [number, number, number, number]
  warnings: string[]
  confidence?: number
  inputSnapshot?: unknown
  source?: string
  artifacts: ResultArtifact[]
  error?: { code?: string; message: string }
  startedAt?: number
  finishedAt?: number
}

export interface AnalysisExecution<TResult = unknown> {
  value: TResult
  units?: AnalysisUnits
  warnings?: string[]
  artifacts?: ResultArtifact[]
  extent?: [number, number, number, number]
  confidence?: number
}

export interface AnalysisTaskRunner {
  readonly id: string
  readonly maxSamples: number
  report(completed: number, total: number, stage: string): void
  throwIfCancelled(action: string): void
}

export class AnalysisTaskRegistry {
  private readonly tasks = new Map<string, AnalysisTask<unknown>>()

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

  get(id: string): AnalysisTask<unknown> | undefined {
    return this.tasks.get(id)
  }

  list(): AnalysisTask<unknown>[] {
    return Array.from(this.tasks.values())
  }

  clear(): void {
    this.tasks.clear()
  }
}

export interface RunAnalysisTaskOptions<TInput, TResult> {
  context: Arc3DContext
  algorithm: string
  algorithmVersion?: string
  input: TInput
  params?: Record<string, unknown>
  signal?: AbortSignal
  onProgress?: (progress: AnalysisProgress) => void
  maxSamples?: number
  spatialReference?: SpatialReference
  verticalReference?: VerticalReference
  source?: string
  registry?: AnalysisTaskRegistry
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
 * Executes an analysis with a uniform task/result contract: status
 * transitions, progress, cancellation, timing and error capture are recorded
 * on a task entry and surfaced on the returned result.
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
