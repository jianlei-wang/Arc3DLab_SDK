import type { Arc3DContext } from "@arc3dlab/core"
import {
  runAnalysisTask,
  type AnalysisResult,
  type RunAnalysisTaskOptions,
} from "./task"

/**
 * Executor bound to a context (and optionally a shared task registry) that
 * turns an `execute` callback into a uniform `AnalysisResult`.
 */
export type AnalysisTaskExecutor = <TInput, TResult>(
  options: Omit<RunAnalysisTaskOptions<TInput, TResult>, "context">,
) => Promise<AnalysisResult<TResult>>

export function createTaskExecutor(
  context: Arc3DContext,
): AnalysisTaskExecutor {
  return (options) => runAnalysisTask({ ...options, context })
}
