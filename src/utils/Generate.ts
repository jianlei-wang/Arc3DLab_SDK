/**
 * 生成唯一id
 * @returns 例：936e0deb-c208-4098-9959-327e519e63e2
 */
export function randomId() {
  const tempUrl = URL.createObjectURL(new Blob())
  const uuid = tempUrl.toString()
  URL.revokeObjectURL(tempUrl)
  return uuid.substring(uuid.lastIndexOf("/") + 1)
}

/**
 * 安全执行回调
 */
export function safeCallback<T>(callback: ((data: T) => T) | undefined, data: T): T {
  if (callback && typeof callback === "function") {
    const result = callback(data);
    return result !== undefined ? result : data;
  }
  return data;
}
