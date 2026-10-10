import type { Arc3DContext, CameraPose, CameraState } from "@arc3dlab/core"
import {
  fromCartesian3,
  getCesiumViewer,
  toCartesian3,
  toRadians,
} from "@arc3dlab/engine-cesium"
import { HeadingPitchRange, Math as CesiumMath } from "cesium"
import { createFlyToPromise } from "./fly-to"

export class CameraController {
  private home: CameraState | undefined

  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use camera")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

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

  lookAt(
    target: CameraPose["position"] | [number, number, number],
    range = 1000,
  ): void {
    this.viewer().camera.lookAt(
      toCartesian3(target),
      new HeadingPitchRange(0, CesiumMath.toRadians(-45), range),
    )
  }

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

  setState(state: CameraPose): void {
    this.setView(state)
  }

  capture(): CameraState {
    const state = this.getState()
    this.home = this.home ?? state
    return state
  }

  restore(snapshot?: CameraState): void {
    this.setView(snapshot ?? this.home ?? this.getState())
  }

  reset(): void {
    this.restore(this.home)
  }

  rememberHome(): void {
    this.home = this.getState()
  }
}
