import type { SceneModeName } from "@arc3dlab/core"
import { SceneMode } from "cesium"
import { getCesiumViewer } from "./CesiumEngine"

/**
 * 读取 Cesium 场景当前的投影模式名称。
 * @param viewer - 原生 Viewer 或引擎原生视图。
 * @returns 场景投影模式名称，取值 `2d`、`columbus` 或 `3d`。
 */
export function getNativeSceneModeName(viewer: unknown): SceneModeName {
  const mode = getCesiumViewer(viewer).scene.mode
  if (mode === SceneMode.SCENE2D) return "2d"
  if (mode === SceneMode.COLUMBUS_VIEW) return "columbus"
  return "3d"
}

/**
 * 将 Cesium 场景切换到指定投影模式。
 * @param viewer - 原生 Viewer 或引擎原生视图。
 * @param mode - 目标场景投影模式。
 * @param duration - 形变过渡时长（秒），缺省为 1。
 */
export function morphNativeScene(
  viewer: unknown,
  mode: SceneModeName,
  duration = 1,
): void {
  const scene = getCesiumViewer(viewer).scene
  if (mode === "2d") scene.morphTo2D(duration)
  else if (mode === "columbus") scene.morphToColumbusView(duration)
  else scene.morphTo3D(duration)
}
