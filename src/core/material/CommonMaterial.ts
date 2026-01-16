import { Color, Material } from "cesium"

/**
 *
 * @param color 颜色值
 * @param cssColor 是否为css颜色字符串，如果为true，则color参数为css颜色字符串，否则为Cesium.Color类型
 * @returns
 */
export const ColorMaterial = (
  color: string | Color,
  cssColor: boolean = true
) =>
  new Material({
    fabric: {
      type: "Color",
      uniforms: {
        color: cssColor ? Color.fromCssColorString(color as string) : color,
      },
    },
  })
