import { Cartesian3 } from "cesium"

/**
 * 从XYZ坐标创建位置
 * @param x X坐标
 * @param y Y坐标
 * @param z Z坐标
 * @returns 创建的位置
 */
export const PosFromXYZ = (x: number, y: number, z: number = 0) =>
  Cartesian3.fromDegrees(x, y, z)
