/**
 * Arc3D 屏幕事件的名称集合。
 *
 * 名称对 Cesium `ScreenSpaceEventType` 做了语义化封装，供交互层与迁移适配层统一使用。
 */
export type ScreenEventName =
  | "leftDown"
  | "leftUp"
  | "leftClick"
  | "leftDoubleClick"
  | "rightDown"
  | "rightUp"
  | "rightClick"
  | "middleDown"
  | "middleUp"
  | "middleClick"
  | "wheel"
  | "mouseMove"
  | "pinchStart"
  | "pinchMove"
  | "pinchEnd"

const SCREEN_EVENT_NAMES: readonly ScreenEventName[] = [
  "leftDown",
  "leftUp",
  "leftClick",
  "leftDoubleClick",
  "rightDown",
  "rightUp",
  "rightClick",
  "middleDown",
  "middleUp",
  "middleClick",
  "wheel",
  "mouseMove",
  "pinchStart",
  "pinchMove",
  "pinchEnd",
]

const NAME_SET = new Set<string>(SCREEN_EVENT_NAMES)

/**
 * 列出全部受支持的屏幕事件名称。
 * @returns 屏幕事件名称数组。
 */
export function listScreenEventNames(): ScreenEventName[] {
  return [...SCREEN_EVENT_NAMES]
}

/**
 * 判断给定字符串是否为受支持的屏幕事件名称。
 * @param value - 待判断的字符串。
 * @returns 是受支持的事件名称时返回 true。
 */
export function isScreenEventName(value: string): value is ScreenEventName {
  return NAME_SET.has(value)
}
