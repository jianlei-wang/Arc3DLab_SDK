import { Viewer } from "src/core"

/**
 * 判断是否已经加载地形数据
 * @param viewer - 地图场景
 * @returns 是否已经加载地形
 */
export function boolTerrain(viewer: Viewer) {
  return viewer.terrainProvider !== undefined && viewer.terrainProvider !== null
}
