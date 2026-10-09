import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import { Cartographic } from "cesium"

export function toCartographic(input: PositionInput): Cartographic {
  return Cartographic.fromCartesian(toCartesian3(input))
}

export async function sampleCartographics(
  context: Arc3DContext,
  cartos: Cartographic[]
): Promise<Cartographic[]> {
  const viewer = getCesiumViewer(context.engine.native.viewer)
  const clones = cartos.map((item) => item.clone())
  if (viewer.scene.sampleHeightSupported) {
    const detailed = await viewer.scene.sampleHeightMostDetailed(clones)
    return detailed.map((item, index) => {
      if (item) return item
      const fallback = clones[index].clone()
      const globeHeight = viewer.scene.globe.getHeight(fallback)
      if (globeHeight !== undefined) fallback.height = globeHeight
      return fallback
    })
  }
  return clones.map((item) => {
    const globeHeight = viewer.scene.globe.getHeight(item)
    if (globeHeight !== undefined) item.height = globeHeight
    return item
  })
}

export function sampleSource(context: Arc3DContext): "sampleHeight" | "globe" {
  const viewer = getCesiumViewer(context.engine.native.viewer)
  return viewer.scene.sampleHeightSupported ? "sampleHeight" : "globe"
}
