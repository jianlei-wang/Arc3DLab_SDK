import { Arc3DError, type Arc3DErrorCode } from "./errors"

/** 加载失败的阶段分类。 */
export type LoadFailureStage = "token" | "network" | "format" | "engine"

/** 对加载错误分类后的结果。 */
export interface ClassifiedLoadError {
  /** 错误码。 */
  code: Arc3DErrorCode
  /** 失败阶段。 */
  stage: LoadFailureStage
  /** 错误信息。 */
  message: string
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as { status?: unknown; statusCode?: unknown }
  if (typeof record.status === "number") return record.status
  if (typeof record.statusCode === "number") return record.statusCode
  return undefined
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * 将任意加载错误归类为错误码与失败阶段。
 *
 * @param error - 待分类的错误。
 * @returns 包含错误码、阶段与信息的分类结果。
 */
export function classifyLoadFailure(error: unknown): ClassifiedLoadError {
  if (error instanceof Arc3DError) {
    const stage: LoadFailureStage =
      error.code === "AUTH_FAILED"
        ? "token"
        : error.code === "NETWORK_FAILURE"
          ? "network"
          : error.code === "INVALID_FORMAT"
            ? "format"
            : "engine"
    return { code: error.code, stage, message: error.message }
  }

  const message = readMessage(error)
  const lower = message.toLowerCase()
  const status = readStatus(error)

  if (
    status === 401 ||
    status === 403 ||
    /token|unauthorized|forbidden|access denied|ion access/.test(lower)
  ) {
    return { code: "AUTH_FAILED", stage: "token", message }
  }
  if (
    status === 404 ||
    (status !== undefined && status >= 500) ||
    /network|fetch failed|econn|enotfound|etimedout|dns|offline/.test(lower)
  ) {
    return { code: "NETWORK_FAILURE", stage: "network", message }
  }
  if (
    /parse|json|xml|kml|czml|geojson|syntax|malformed|invalid format/.test(
      lower,
    )
  ) {
    return { code: "INVALID_FORMAT", stage: "format", message }
  }
  if (/webgl|gpu|context lost|engine/.test(lower)) {
    return { code: "ENGINE_FAILURE", stage: "engine", message }
  }
  return { code: "ENGINE_FAILURE", stage: "engine", message }
}

/**
 * 将任意加载错误转换为 Arc3DError。
 *
 * @param error - 待转换的错误。
 * @returns 统一后的 Arc3DError。
 */
export function classifyLoadError(error: unknown): Arc3DError {
  if (error instanceof Arc3DError) return error
  const classified = classifyLoadFailure(error)
  return new Arc3DError(classified.code, classified.message, error)
}
