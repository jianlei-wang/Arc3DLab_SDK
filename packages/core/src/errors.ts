/** Arc3D 统一错误码。 */
export type Arc3DErrorCode =
  | "APP_DESTROYED"
  | "INVALID_CONTAINER"
  | "INVALID_ARGUMENT"
  | "RESOURCE_NOT_FOUND"
  | "DUPLICATE_RESOURCE"
  | "ENGINE_FAILURE"
  | "UNSUPPORTED_CAPABILITY"
  | "CANCELLED"
  | "AUTH_FAILED"
  | "NETWORK_FAILURE"
  | "INVALID_FORMAT"

/** Arc3D 统一错误类型，携带机器可读的 `code`。 */
export class Arc3DError extends Error {
  /** 机器可读错误码。 */
  readonly code: Arc3DErrorCode
  /** 原始错误。 */
  readonly cause?: unknown

  /**
   * 构造错误。
   *
   * @param code - 错误码。
   * @param message - 人类可读错误信息。
   * @param cause - 原始错误。
   */
  constructor(code: Arc3DErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = "Arc3DError"
    this.code = code
    this.cause = cause
  }
}
