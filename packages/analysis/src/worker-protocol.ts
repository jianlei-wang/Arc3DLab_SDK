import { Arc3DError, type Arc3DErrorCode } from "@arc3dlab/core"
import type { AnalysisJob, AnalysisJobResult } from "./jobs"

/** 宿主接受的错误码集合，用于拒绝工作线程伪造的未知错误码。 */
const ANALYSIS_ERROR_CODES: ReadonlySet<string> = new Set<Arc3DErrorCode>([
  "APP_DESTROYED",
  "INVALID_CONTAINER",
  "INVALID_ARGUMENT",
  "RESOURCE_NOT_FOUND",
  "DUPLICATE_RESOURCE",
  "ENGINE_FAILURE",
  "UNSUPPORTED_CAPABILITY",
  "CANCELLED",
  "AUTH_FAILED",
  "NETWORK_FAILURE",
  "PROVIDER_UNAVAILABLE",
  "MISSING_CREDENTIALS",
  "INVALID_FORMAT",
  "QUEUE_FULL",
])

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
  /**
   * 消息反序列化失败处理器；环境不支持时可省略。
   *
   * 触发时视为 Worker 基础设施故障，宿主会终止该槽位并按降级路径重放
   * 当前作业。
   */
  onmessageerror?: ((event: unknown) => void) | null
}

/** 创建 Worker 的工厂；返回 `undefined` 表示当前环境不支持。 */
export type AnalysisWorkerFactory = () => AnalysisWorkerLike | undefined

/** 单条 Worker 响应的解析结果。 */
export type ParsedAnalysisWorkerResponse =
  | { kind: "invalid"; id?: number; reason: string }
  | { kind: "response"; response: AnalysisWorkerResponse }

/**
 * 判断值是否为普通对象。
 * @param value - 待判断的值。
 * @returns 是否为非数组对象。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * 判断值是否为有限数值。
 * @param value - 待判断的值。
 * @returns 是否为有限数值。
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/**
 * 解析并校验单条 Worker 响应。
 *
 * 无法归属到任何任务的畸形消息返回 `invalid` 且不带 `id`；带有合法任务
 * `id` 但字段非法的消息返回 `invalid` 并携带该 `id`，由宿主终止对应槽位
 * 并以 `INVALID_FORMAT` 结算任务。
 *
 * @param data - Worker 回传的消息载荷。
 * @returns 解析结果。
 */
export function parseAnalysisWorkerResponse(
  data: unknown,
): ParsedAnalysisWorkerResponse {
  if (!isRecord(data)) {
    return { kind: "invalid", reason: "response must be an object" }
  }
  const id = data.id
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) {
    return { kind: "invalid", reason: "response id must be a positive integer" }
  }
  const hasResult = Object.prototype.hasOwnProperty.call(data, "result")
  const hasError = Object.prototype.hasOwnProperty.call(data, "error")
  if (hasResult === hasError) {
    return {
      kind: "invalid",
      id,
      reason: "response must contain exactly one of result or error",
    }
  }
  if (hasError) {
    const error = data.error
    if (!isRecord(error)) {
      return { kind: "invalid", id, reason: "error must be an object" }
    }
    if (typeof error.code !== "string" || error.code.length === 0) {
      return {
        kind: "invalid",
        id,
        reason: "error.code must be a non-empty string",
      }
    }
    if (!ANALYSIS_ERROR_CODES.has(error.code)) {
      return {
        kind: "invalid",
        id,
        reason: `unknown error code: ${error.code}`,
      }
    }
    if (typeof error.message !== "string") {
      return { kind: "invalid", id, reason: "error.message must be a string" }
    }
    return {
      kind: "response",
      response: {
        id,
        error: { code: error.code, message: error.message },
      },
    }
  }
  return {
    kind: "response",
    response: { id, result: data.result as AnalysisJobResult },
  }
}

/**
 * 校验 Worker 返回的结果是否与请求的作业类型匹配。
 * @param value - Worker 返回的结果。
 * @param job - 对应的分析作业。
 * @returns 结果结构合法且类型匹配时为 true。
 */
export function isAnalysisJobResult(
  value: unknown,
  job: AnalysisJob,
): value is AnalysisJobResult {
  if (!isRecord(value)) return false
  if (value.type !== expectedResultType(job)) return false
  if (value.type === "query") {
    return (
      Array.isArray(value.graphics) &&
      value.graphics.every(
        (item) =>
          isRecord(item) &&
          typeof item.id === "string" &&
          typeof item.type === "string",
      )
    )
  }
  if (value.type === "cutfill-grid") {
    const grid = value.grid
    if (!isRecord(grid)) return false
    if (
      !isFiniteNumber(grid.resolutionMeters) ||
      !isFiniteNumber(grid.cellWidthMeters) ||
      !isFiniteNumber(grid.cellHeightMeters) ||
      !Array.isArray(grid.cells)
    ) {
      return false
    }
    return grid.cells.every(
      (cell) =>
        isRecord(cell) &&
        isFiniteNumber(cell.longitude) &&
        isFiniteNumber(cell.latitude) &&
        isFiniteNumber(cell.coverage) &&
        cell.coverage >= 0 &&
        cell.coverage <= 1 &&
        isFiniteNumber(cell.areaSquareMeters),
    )
  }
  if (value.type === "area" || value.type === "triangle-area") {
    return isFiniteNumber(value.squareMeters)
  }
  if (value.type === "distance") {
    return isFiniteNumber(value.meters)
  }
  if (value.type === "height") {
    return isFiniteNumber(value.meters)
  }
  if (value.type === "slope") {
    return isFiniteNumber(value.degrees)
  }
  if (value.type === "heading") {
    return isFiniteNumber(value.degrees)
  }
  if (value.type === "space-angle") {
    return isFiniteNumber(value.degrees)
  }
  if (value.type === "projected-distance") {
    return isFiniteNumber(value.meters)
  }
  if (value.type === "surface-distance") {
    return isFiniteNumber(value.meters)
  }
  return false
}

/**
 * 推导作业对应的结果类型。
 * @param job - 分析作业。
 * @returns 期望的结果类型。
 */
function expectedResultType(job: AnalysisJob): AnalysisJobResult["type"] {
  if (
    job.type === "rect-query" ||
    job.type === "polygon-query" ||
    job.type === "distance-query"
  ) {
    return "query"
  }
  return job.type
}

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
