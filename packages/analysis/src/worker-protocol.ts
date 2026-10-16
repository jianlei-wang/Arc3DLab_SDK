import { Arc3DError, type Arc3DErrorCode } from "@arc3dlab/core"
import type { AnalysisJob, AnalysisJobResult } from "./jobs"

/** 可跨线程传递的序列化错误信息。 */
export interface SerializedAnalysisError {
  /** 错误码。 */
  code: string
  /** 错误消息。 */
  message: string
}

/** 主线程投递给工作线程的请求。 */
export interface AnalysisWorkerRequest {
  /** 请求标识，用于匹配回复。 */
  id: number
  /** 待执行的分析作业。 */
  job: AnalysisJob
}

/** 工作线程回传给主线程的响应。 */
export type AnalysisWorkerResponse =
  | { id: number; result: AnalysisJobResult }
  | { id: number; error: SerializedAnalysisError }

/**
 * 宿主消费的最小 Worker 接口。
 *
 * 真实 `Worker` 与测试注入的假实现都满足该形状，便于在不具备 Worker 的环境
 * 下验证消息路由与取消语义。
 */
export interface AnalysisWorkerLike {
  /** 向工作线程投递消息。 */
  postMessage(message: unknown): void
  /** 终止工作线程。 */
  terminate(): void
  /** 工作线程消息处理器。 */
  onmessage: ((event: { data: unknown }) => void) | null
  /** 工作线程错误处理器。 */
  onerror: ((event: unknown) => void) | null
}

/** 创建 Worker 的工厂；返回 `undefined` 表示当前环境不支持。 */
export type AnalysisWorkerFactory = () => AnalysisWorkerLike | undefined

/**
 * 将任意错误序列化为可传递的错误信息。
 * @param error - 待序列化的错误。
 * @returns 序列化后的错误信息。
 */
export function serializeAnalysisError(
  error: unknown,
): SerializedAnalysisError {
  if (error instanceof Arc3DError) {
    return { code: error.code, message: error.message }
  }
  return {
    code: "ENGINE_FAILURE",
    message: error instanceof Error ? error.message : String(error),
  }
}

/**
 * 将序列化的错误信息还原为 Arc3DError。
 * @param payload - 序列化的错误信息。
 * @returns 还原得到的 Arc3DError。
 */
export function restoreAnalysisError(
  payload: SerializedAnalysisError,
): Arc3DError {
  return new Arc3DError(payload.code as Arc3DErrorCode, payload.message)
}
