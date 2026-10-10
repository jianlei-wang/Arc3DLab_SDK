import type { Arc3DContext, CameraPose, CameraState } from "@arc3dlab/core"
import {
  fromCartesian3,
  getCesiumViewer,
  toCartesian3,
  toRadians,
} from "@arc3dlab/engine-cesium"
import { HeadingPitchRange, Math as CesiumMath } from "cesium"
import { createFlyToPromise } from "./fly-to"

/**
 * 相机控制器，封装相机的飞行、视角设置、状态读取与快照恢复。
 */
export class CameraController {
  private home: CameraState | undefined

  /**
   * 创建相机控制器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use camera")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  /**
   * 以动画方式将相机飞行到指定位置。
   * @param position - 目标位置，可为经纬高对象或坐标数组。
   * @param duration - 飞行时长，单位为秒。
   * @returns 飞行完成或被取消时兑现的 Promise。
   */
  flyTo(
    position:
      CameraPose["position"] | [number, number] | [number, number, number],
    duration = 2,
  ): Promise<void> {
    const destination = Array.isArray(position)
      ? toCartesian3(position)
      : toCartesian3(position)
    const viewer = this.viewer()
    return createFlyToPromise(
      (callbacks) => {
        viewer.camera.flyTo({
          destination,
          duration,
          complete: callbacks.complete,
          cancel: callbacks.cancel,
        })
      },
      () => this.context.lifecycle.isTerminating,
    )
  }

  /**
   * 立即将相机切换到指定的位姿。
   * @param pose - 目标相机位姿，包含位置与朝向。
   */
  setView(pose: CameraPose): void {
    const viewer = this.viewer()
    viewer.camera.setView({
      destination: toCartesian3(pose.position),
      orientation: {
        heading: toRadians(pose.heading, pose.unit),
        pitch: toRadians(pose.pitch, pose.unit),
        roll: toRadians(pose.roll, pose.unit),
      },
    })
  }

  /**
   * 将相机以固定俯角对准目标位置。
   * @param target - 观察目标的位置。
   * @param range - 相机与目标之间的距离。
   */
  lookAt(
    target: CameraPose["position"] | [number, number, number],
    range = 1000,
  ): void {
    this.viewer().camera.lookAt(
      toCartesian3(target),
      new HeadingPitchRange(0, CesiumMath.toRadians(-45), range),
    )
  }

  /**
   * 读取当前相机的状态快照。
   * @returns 当前相机位姿与捕获时间。
   */
  getState(): CameraState {
    const camera = this.viewer().camera
    return {
      position: fromCartesian3(camera.positionWC),
      heading: CesiumMath.toDegrees(camera.heading),
      pitch: CesiumMath.toDegrees(camera.pitch),
      roll: CesiumMath.toDegrees(camera.roll),
      unit: "degrees",
      capturedAt: Date.now(),
    }
  }

  /**
   * 将相机切换到指定位姿。
   * @param state - 目标相机位姿。
   */
  setState(state: CameraPose): void {
    this.setView(state)
  }

  /**
   * 捕获当前相机状态，并在首次调用时记录为默认位置。
   * @returns 捕获到的相机状态。
   */
  capture(): CameraState {
    const state = this.getState()
    this.home = this.home ?? state
    return state
  }

  /**
   * 恢复到指定快照，未提供时恢复到默认位置或当前状态。
   * @param snapshot - 可选的相机状态快照。
   */
  restore(snapshot?: CameraState): void {
    this.setView(snapshot ?? this.home ?? this.getState())
  }

  /**
   * 将相机恢复到记录的默认位置。
   */
  reset(): void {
    this.restore(this.home)
  }

  /**
   * 将当前相机状态记录为默认位置。
   */
  rememberHome(): void {
    this.home = this.getState()
  }
}
