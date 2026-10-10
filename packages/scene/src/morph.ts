/**
 * 场景形变完成事件源的抽象接口，仅要求可注册事件监听。
 */
export interface MorphCompleteLike {
  /** 注册完成回调，返回可选的取消订阅函数。 */
  addEventListener?: (callback: () => void) => (() => void) | void
}

/**
 * 安排一次场景恢复：优先监听形变完成事件，否则在超时后执行。
 * @param restore - 场景形变完成后要执行的恢复函数。
 * @param morphComplete - 可选的形变完成事件源。
 * @param timeoutMs - 未提供事件源时的兜底超时毫秒数。
 * @returns 取消本次安排的函数。
 */
export function scheduleSceneRestore(
  restore: () => void,
  morphComplete?: MorphCompleteLike,
  timeoutMs = 1100,
): () => void {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let remove: (() => void) | undefined

  const run = (): void => {
    if (cancelled) return
    cancelled = true
    restore()
  }

  if (typeof morphComplete?.addEventListener === "function") {
    const unsubscribe = morphComplete.addEventListener(run)
    if (typeof unsubscribe === "function") remove = unsubscribe
  } else {
    timer = setTimeout(run, timeoutMs)
  }

  return () => {
    if (cancelled) return
    cancelled = true
    if (timer !== undefined) clearTimeout(timer)
    remove?.()
  }
}
