import type { Arc3DContext } from "@arc3dlab/core"
import {
  runAnalysisTask,
  type AnalysisResult,
  type RunAnalysisTaskOptions,
} from "./task"

/**
 * 绑定到某个上下文（以及可选共享任务注册表）的执行器，可将 execute 回调
 * 统一转换为 AnalysisResult。
 */
export type AnalysisTaskExecutor = <TInput, TResult>(
  options: Omit<RunAnalysisTaskOptions<TInput, TResult>, "context">,
) => Promise<AnalysisResult<TResult>>

/**
 * 基于给定上下文创建任务执行器。
 * @param context - Arc3D 运行上下文。
 * @returns 绑定该上下文的任务执行器。
 */
export function createTaskExecutor(
  context: Arc3DContext,
): AnalysisTaskExecutor {
  return (options) => runAnalysisTask({ ...options, context })
}
