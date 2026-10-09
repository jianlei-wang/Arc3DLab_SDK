import { Arc3DError, type Arc3DErrorCode } from "./errors"

export type LoadFailureStage = "token" | "network" | "format" | "engine"

export interface ClassifiedLoadError {
  code: Arc3DErrorCode
  stage: LoadFailureStage
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
  if (/parse|json|xml|kml|czml|geojson|syntax|malformed|invalid format/.test(lower)) {
    return { code: "INVALID_FORMAT", stage: "format", message }
  }
  if (/webgl|gpu|context lost|engine/.test(lower)) {
    return { code: "ENGINE_FAILURE", stage: "engine", message }
  }
  return { code: "ENGINE_FAILURE", stage: "engine", message }
}

export function classifyLoadError(error: unknown): Arc3DError {
  if (error instanceof Arc3DError) return error
  const classified = classifyLoadFailure(error)
  return new Arc3DError(classified.code, classified.message, error)
}
