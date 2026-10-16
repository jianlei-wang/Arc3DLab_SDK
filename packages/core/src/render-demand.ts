import type { Arc3DContext } from "./context"

/**
 * 声明一段需要持续渲染的动画需求。
 *
 * 该函数是 `EngineViewer.acquireContinuousRender` 的容错封装：当引擎未实现
 * 该方法（或在无引擎的测试环境中）时，返回一个不产生副作用的空释放函数，
 * 使效果代码无需判断底层渲染能力。
 *
 * @param context - Arc3D 运行时上下文。
 * @param reason - 需求来源说明，便于诊断。
 * @returns 释放该需求的函数。
 */
export function acquireContinuousRender(
  context: Pick<Arc3DContext, "engine">,
  reason = "animation",
): () => void {
  const viewer = context.engine?.viewer
  if (viewer?.acquireContinuousRender) {
    return viewer.acquireContinuousRender(reason)
  }
  return () => {}
}
