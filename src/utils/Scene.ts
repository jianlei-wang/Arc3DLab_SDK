import { Viewer } from "src/core"

/**
 * 获取地图尺寸
 */
export function mapSize(viewer: Viewer) {
  const { width, height } = viewer.canvas
  return { width, height }
}

/**
 * 获取地图图片
 */
export function mapImg(viewer: Viewer) {
  viewer.render() //避免出现导出是一张黑乎乎的图片
  return viewer.scene.canvas.toDataURL("image/png")
}
