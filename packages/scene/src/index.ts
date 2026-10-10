import type {
  Arc3DContext,
  CameraPose,
  CameraState,
  SceneModeName,
} from "@arc3dlab/core"
import {
  fromCartesian3,
  getCesiumViewer,
  toCartesian3,
  toRadians,
} from "@arc3dlab/engine-cesium"
import { HeadingPitchRange, Math as CesiumMath, SceneMode } from "cesium"
import { createFlyToPromise } from "./fly-to"
import { scheduleSceneRestore } from "./morph"

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

export class RenderController {
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use render")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  setResolutionScale(value: number): void {
    this.viewer().resolutionScale = value
  }

  setRequestRenderMode(enabled: boolean): void {
    this.viewer().scene.requestRenderMode = enabled
  }
}

export class ViewportController {
  constructor(private readonly context: Arc3DContext) {}

  get size(): { width: number; height: number } {
    this.context.lifecycle.assertUsable("use viewport")
    const canvas = getCesiumViewer(this.context.engine.native.viewer).canvas
    return { width: canvas.width, height: canvas.height }
  }
}

export class ClockController {
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use clock")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  set multiplier(value: number) {
    this.viewer().clock.multiplier = value
  }

  get multiplier(): number {
    return this.viewer().clock.multiplier
  }

  set shouldAnimate(value: boolean) {
    this.viewer().clock.shouldAnimate = value
  }

  get shouldAnimate(): boolean {
    return this.viewer().clock.shouldAnimate
  }
}

export class EnvironmentController {
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use environment")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  setLighting(enabled: boolean): void {
    const viewer = this.viewer()
    viewer.scene.globe.enableLighting = enabled
    viewer.shadows = enabled
  }

  setAtmosphere(enabled: boolean): void {
    const atmosphere = this.viewer().scene.skyAtmosphere
    if (atmosphere) atmosphere.show = enabled
  }
}

export class SceneController {
  readonly camera: CameraController
  readonly render: RenderController
  readonly viewport: ViewportController
  readonly clock: ClockController
  readonly environment: EnvironmentController
  private cancelMorph: (() => void) | undefined

  constructor(private readonly context: Arc3DContext) {
    this.camera = new CameraController(context)
    this.render = new RenderController(context)
    this.viewport = new ViewportController(context)
    this.clock = new ClockController(context)
    this.environment = new EnvironmentController(context)
    this.context.disposers.push(() => this.destroy())
  }

  private viewer() {
    this.context.lifecycle.assertUsable("use scene")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  get mode(): SceneModeName {
    const mode = this.viewer().scene.mode
    if (mode === SceneMode.SCENE2D) return "2d"
    if (mode === SceneMode.COLUMBUS_VIEW) return "columbus"
    return "3d"
  }

  setMode(mode: SceneModeName): void {
    const snapshot = this.camera.capture()
    const viewer = this.viewer()
    this.cancelMorph?.()
    this.cancelMorph = scheduleSceneRestore(() => {
      this.cancelMorph = undefined
      if (this.context.lifecycle.isTerminating) return
      this.camera.restore(snapshot)
    }, viewer.scene.morphComplete)
    if (mode === "2d") viewer.scene.morphTo2D(1)
    else if (mode === "columbus") viewer.scene.morphToColumbusView(1)
    else viewer.scene.morphTo3D(1)
  }

  get size(): { width: number; height: number } {
    const canvas = this.viewer().canvas
    return { width: canvas.width, height: canvas.height }
  }

  captureImage(): string {
    const viewer = this.viewer()
    viewer.render()
    return viewer.scene.canvas.toDataURL("image/png")
  }

  setDepthTestAgainstTerrain(enabled: boolean): void {
    this.viewer().scene.globe.depthTestAgainstTerrain = enabled
  }

  setFpsVisible(visible: boolean): void {
    this.viewer().scene.debugShowFramesPerSecond = visible
  }

  setLighting(enabled: boolean): void {
    const viewer = this.viewer()
    viewer.scene.globe.enableLighting = enabled
    viewer.shadows = enabled
  }

  destroy(): void {
    this.cancelMorph?.()
    this.cancelMorph = undefined
  }
}
