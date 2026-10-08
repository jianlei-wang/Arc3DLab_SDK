export type Arc3DErrorCode =
  | "APP_DESTROYED"
  | "INVALID_CONTAINER"
  | "INVALID_ARGUMENT"
  | "RESOURCE_NOT_FOUND"
  | "DUPLICATE_RESOURCE"
  | "ENGINE_FAILURE"
  | "UNSUPPORTED_CAPABILITY"

export class Arc3DError extends Error {
  readonly code: Arc3DErrorCode
  readonly cause?: unknown

  constructor(code: Arc3DErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = "Arc3DError"
    this.code = code
    this.cause = cause
  }
}
