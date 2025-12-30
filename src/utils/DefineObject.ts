import { ScreenSpaceEventType } from "cesium"

/**
 * Cesium 事件类型映射表（自定义事件名称到 Cesium 原生事件类型的映射）
 * @readonly
 * @enum {number}
 * @property {ScreenSpaceEventType} leftDown - 鼠标左键按下事件
 * @property {ScreenSpaceEventType} leftUp - 鼠标左键释放事件
 * @property {ScreenSpaceEventType} leftClick - 鼠标左键单击事件
 * @property {ScreenSpaceEventType} leftDblClick - 鼠标左键双击事件
 * @property {ScreenSpaceEventType} rightDown - 鼠标右键按下事件
 * @property {ScreenSpaceEventType} rightUp - 鼠标右键释放事件
 * @property {ScreenSpaceEventType} rightClick - 鼠标右键单击事件
 * @property {ScreenSpaceEventType} middleDown - 鼠标中键按下事件
 * @property {ScreenSpaceEventType} middleUp - 鼠标中键释放事件
 * @property {ScreenSpaceEventType} middleClick - 鼠标中键单击事件
 * @property {ScreenSpaceEventType} mouseMove - 鼠标移动事件
 * @property {ScreenSpaceEventType} wheel - 鼠标滚轮滚动事件
 * @property {ScreenSpaceEventType} pinchStart - 触摸屏双指手势开始事件
 * @property {ScreenSpaceEventType} pinchEnd - 触摸屏双指手势结束事件
 * @property {ScreenSpaceEventType} pinchMove - 触摸屏双指手势移动事件
 */
export const EventNameMap = {
  leftDown: ScreenSpaceEventType.LEFT_DOWN,
  leftUp: ScreenSpaceEventType.LEFT_UP,
  leftClick: ScreenSpaceEventType.LEFT_CLICK,
  leftDblClick: ScreenSpaceEventType.LEFT_DOUBLE_CLICK,

  rightDown: ScreenSpaceEventType.RIGHT_DOWN,
  rightUp: ScreenSpaceEventType.RIGHT_UP,
  rightClick: ScreenSpaceEventType.RIGHT_CLICK,

  middleDown: ScreenSpaceEventType.MIDDLE_DOWN,
  middleUp: ScreenSpaceEventType.MIDDLE_UP,
  middleClick: ScreenSpaceEventType.MIDDLE_CLICK,

  mouseMove: ScreenSpaceEventType.MOUSE_MOVE,
  wheel: ScreenSpaceEventType.WHEEL,

  pinchStart: ScreenSpaceEventType.PINCH_START,
  pinchEnd: ScreenSpaceEventType.PINCH_END,
  pinchMove: ScreenSpaceEventType.PINCH_MOVE,
}
