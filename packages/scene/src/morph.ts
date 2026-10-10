export interface MorphCompleteLike {
  addEventListener?: (callback: () => void) => (() => void) | void
}

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
