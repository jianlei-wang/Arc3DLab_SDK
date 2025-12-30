import { EventNameMap } from "src/utils/DefineObject"
import { Cartesian3 } from "./CesiumTypes"

/**
 * 事件回调列表类型（事件类型到回调函数数组的映射）
 * @type
 * @typedef {Map<EventType, Function[]>} Events
 */
export type Events = Map<EventType, Function[]>

/**
 * 可用的事件类型（eventNameMap 的键名集合）
 * @type
 */
export type EventType = keyof typeof EventNameMap

/**
 * 3D WGS84坐标点
 * @interface
 * @property {number} x 经度X
 * @property {number} y 纬度y
 * @property {number} [z] 高度z，单位米
 */
export interface DegreePos {
  x: number
  y: number
  z?: number
}

/**
 * 屏幕坐标
 * @interface
 * @property {number} x 屏幕位置X
 * @property {number} y 屏幕位置y
 */
export interface WindowPos {
  x: number
  y: number
}

/**
 * 欧拉角
 * @interface
 * @property {Number} heading - 偏航角，绕Z周
 * @property {Number} pitch - 俯仰角，绕Y轴
 * @property {Number} roll - 滚动角，绕X轴
 */
export interface H_P_R {
  heading: number
  pitch: number
  roll: number
}

/**
 * 相机状态参数
 * @interface
 * @property {DegreePos} degrees - WGS84坐标值
 * @property {Cartesian3} position - 笛卡尔坐标值
 * @property {H_P_R} hpr - 欧拉角
 */
export interface CameraStatus {
  degrees: DegreePos
  position: Cartesian3
  hpr: H_P_R
}

/**
 * 视角参数
 * @interface
 * @property {Cartesian3 | DegreePos} position - 笛卡尔Or经纬度 坐标值
 * @property {H_P_R} hpr - 欧拉角
 */
export interface ViewStatus {
  position: Cartesian3 | DegreePos
  hpr: H_P_R
}
