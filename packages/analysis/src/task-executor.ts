import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"
import {
  executeAnalysisJob,
  type AnalysisJob,
  type AnalysisJobResult,
} from "./jobs"
import type { AnalysisTaskOptions } from "./scheduler"
import {
  runAnalysisTask,
  type AnalysisResult,
  type AnalysisTaskRegistry,
  type RunAnalysisTaskOptions,
} from "./task"
import { AnalysisJobHost } from "./worker-host"

/** 创建任务执行器的配置。 */
export interface CreateTaskExecutorOptions {
  /** 共享任务注册表；调用方仍可在单次调用中覆盖。 */
  registry?: AnalysisTaskRegistry
  /** 纯数值作业宿主；省略时在进程内执行。 */
  host?: AnalysisJobHost
}

/**
 * 绑定到某个上下文的执行器。
 *
 * 直接调用会把 `execute` 回调统一转换为 `AnalysisResult`；`runJob` 则把
 * 可结构化克隆的纯数值作业交给共享的 {@link AnalysisJobHost}，由宿主决定
 * 投递 Worker 还是降级到进程内执行。
 */
export interface AnalysisTaskExecutor {
  <TInput, TResult>(
    options: Omit<RunAnalysisTaskOptions<TInput, TResult>, "context">,
  ): Promise<AnalysisResult<TResult>>
  /**
   * 运行一个纯数值分析作业。
   * @param job - 不依赖 Cesium 场景的分析作业。
   * @param options - 任务选项，包含取消信号。
   * @returns 作业执行结果。
   */
  runJob<TResult extends AnalysisJobResult = AnalysisJobResult>(
    job: AnalysisJob,
    options?: AnalysisTaskOptions,
  ): Promise<TResult>
}

/**
 * 基于给定上下文创建任务执行器。
 * @param context - Arc3D 运行上下文。
 * @param options - 共享注册表与作业宿主；省略宿主时作业在进程内执行。
 * @returns 绑定该上下文的任务执行器。
 */
export function createTaskExecutor(
  context: Arc3DContext,
  options: CreateTaskExecutorOptions = {},
): AnalysisTaskExecutor {
  const { host, registry } = options
  const runJob = async <TResult extends AnalysisJobResult>(
    job: AnalysisJob,
    taskOptions?: AnalysisTaskOptions,
  ): Promise<TResult> => {
    if (host) {
      return (await host.run(job, taskOptions)) as TResult
    }
    if (taskOptions?.signal?.aborted) {
      throw new Arc3DError("CANCELLED", "Cancelled analysis job")
    }
    return executeAnalysisJob(job) as TResult
  }
  const executor = (<TInput, TResult>(
    taskOptions: Omit<RunAnalysisTaskOptions<TInput, TResult>, "context">,
  ) =>
    runAnalysisTask({
      ...taskOptions,
      context,
      registry: taskOptions.registry ?? registry,
    })) as AnalysisTaskExecutor
  executor.runJob = runJob
  return executor
}
