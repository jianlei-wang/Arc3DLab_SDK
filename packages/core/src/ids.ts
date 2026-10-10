let sequence = 0

/**
 * 生成唯一标识符。
 *
 * @param prefix - 回退标识前缀。
 * @returns 唯一标识字符串。
 */
export function createId(prefix = "arc3d"): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID()
  }
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`
}
