import {
  Arc3DError,
  acquireContinuousRender,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3Array } from "@arc3dlab/engine-cesium"
import {
  Color,
  GeometryInstance,
  Material,
  MaterialAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  Primitive,
  Rectangle,
  RectangleGeometry,
  VertexFormat,
} from "cesium"

/** 洪水淹没网格计算选项。 */
export interface FloodGridOptions {
  /** 网格覆盖范围 `[west, south, east, north]`。 */
  extent: [number, number, number, number]
  /** 网格列数。 */
  width: number
  /** 网格行数。 */
  height: number
  /** 按行优先存储的地形高程，长度应为 `width * height`。 */
  heights: ArrayLike<number>
  /** 水位高程，单位为米。 */
  waterLevel: number
}

/** 洪水淹没网格计算结果。 */
export interface FloodGridResult {
  /** 网格列数。 */
  width: number
  /** 网格行数。 */
  height: number
  /** 淹没掩膜，`1` 表示被淹没，`0` 表示未淹没。 */
  flooded: Uint8Array
  /** 淹没单元占比，取值位于 `[0, 1]`。 */
  floodedRatio: number
  /** 最大淹没深度，单位为米。 */
  maxDepth: number
}

/** 水面渲染选项。 */
export interface FloodWaterOptions {
  /** 水面颜色（CSS 颜色）。 */
  color?: string
  /** 波纹频率。 */
  frequency?: number
  /** 动画速度。 */
  animationSpeed?: number
  /** 波纹振幅，取值位于 `[0, 1]`。 */
  amplitude?: number
}

/** 水面材质类型名。 */
export const FLOOD_WATER_MATERIAL = "Arc3DFloodWater"

/** 水面渲染默认选项。 */
export const FLOOD_WATER_DEFAULTS: Required<
  Pick<
    FloodWaterOptions,
    "color" | "frequency" | "animationSpeed" | "amplitude"
  >
> = {
  color: "#1890FF",
  frequency: 60,
  animationSpeed: 800,
  amplitude: 0.6,
}

const FLOOD_WATER_SHADER = `
uniform vec4 color;
uniform float frequency;
uniform float animationSpeed;
uniform float amplitude;
czm_material czm_getMaterial(czm_materialInput materialInput){
  czm_material material=czm_getDefaultMaterial(materialInput);
  vec2 st=materialInput.st;
  float t=czm_frameNumber*animationSpeed/1000.0;
  float wave=sin(st.x*frequency+t)*0.5+cos(st.y*frequency*1.3-t)*0.5;
  material.diffuse=mix(color.rgb*0.65,color.rgb,clamp(wave*amplitude,0.0,1.0));
  material.alpha=color.a;
  return material;
}
`

/**
 * 依据高程网格与水位计算各单元的淹没情况。
 * @param options - 洪水淹没网格计算选项。
 * @returns 淹没网格结果。
 * @throws {Arc3DError} 当维度非法或高程长度不匹配时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function computeFloodGrid(options: FloodGridOptions): FloodGridResult {
  const { width, height, heights, waterLevel } = options
  if (!(width > 0) || !(height > 0)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `flood grid dimensions must be positive: ${width}x${height}`,
    )
  }
  if (heights.length !== width * height) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `flood heights length mismatch: expected ${width * height}, got ${heights.length}`,
    )
  }
  const flooded = new Uint8Array(width * height)
  let floodedCells = 0
  let maxDepth = 0
  for (let i = 0; i < heights.length; i += 1) {
    const depth = waterLevel - heights[i]
    if (depth > 0) {
      flooded[i] = 1
      floodedCells += 1
      if (depth > maxDepth) maxDepth = depth
    }
  }
  return {
    width,
    height,
    flooded,
    floodedRatio: floodedCells / (width * height),
    maxDepth,
  }
}

/**
 * 洪水淹没分析，负责计算淹没范围并渲染带动画的水面。
 *
 * 水面以多边形或矩形的 `Primitive` 渲染，使用 `Arc3DFloodWater` 材质；
 * 水面足迹由 `setRegion`/`setExtent` 定义，可复用 `ClipAnalysis` 的裁剪多边形作为区域，实现区域裁剪协同。
 */
export class FloodAnalysis {
  private primitive: Primitive | undefined
  private region: PositionInput[] | undefined
  private extent: [number, number, number, number] | undefined
  private releaseRender: (() => void) | undefined

  /**
   * 创建洪水淹没分析。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 计算指定网格的淹没情况。
   * @param options - 洪水淹没网格计算选项。
   * @returns 淹没网格结果。
   */
  analyze(options: FloodGridOptions): FloodGridResult {
    this.context.lifecycle.assertUsable("analyze flood")
    return computeFloodGrid(options)
  }

  /**
   * 设置水面覆盖的多边形区域。
   * @param positions - 多边形顶点，至少需要 3 个。
   * @throws {Arc3DError} 顶点少于 3 个时抛出，错误码为 `INVALID_ARGUMENT`。
   */
  setRegion(positions: PositionInput[]): void {
    this.context.lifecycle.assertUsable("set flood region")
    if (positions.length < 3) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `flood region requires at least 3 positions, got ${positions.length}`,
      )
    }
    this.region = positions
    this.extent = undefined
  }

  /**
   * 设置水面覆盖的矩形范围。
   * @param extent - 范围 `[west, south, east, north]`。
   */
  setExtent(extent: [number, number, number, number]): void {
    this.context.lifecycle.assertUsable("set flood extent")
    this.extent = extent
    this.region = undefined
  }

  /**
   * 渲染指定水位的动画水面。
   * @param waterLevel - 水位高程，单位为米。
   * @param options - 水面渲染选项。
   * @throws {Arc3DError} 未设置区域或范围时抛出，错误码为 `INVALID_ARGUMENT`。
   */
  setWaterLevel(waterLevel: number, options: FloodWaterOptions = {}): void {
    this.context.lifecycle.assertUsable("set water level")
    if (!this.region && !this.extent) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        "setWaterLevel requires a region or extent",
      )
    }
    this.clear()
    const {
      color = FLOOD_WATER_DEFAULTS.color,
      frequency = FLOOD_WATER_DEFAULTS.frequency,
      animationSpeed = FLOOD_WATER_DEFAULTS.animationSpeed,
      amplitude = FLOOD_WATER_DEFAULTS.amplitude,
    } = options
    const material = new Material({
      fabric: {
        type: FLOOD_WATER_MATERIAL,
        uniforms: {
          color: Color.fromCssColorString(color),
          frequency,
          animationSpeed,
          amplitude,
        },
        source: FLOOD_WATER_SHADER,
      },
    })
    const geometry = this.region
      ? new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(
            toCartesian3Array(this.region),
          ),
          height: waterLevel,
          vertexFormat: VertexFormat.POSITION_AND_ST,
        })
      : new RectangleGeometry({
          rectangle: Rectangle.fromDegrees(...this.extent!),
          height: waterLevel,
          vertexFormat: VertexFormat.POSITION_AND_ST,
        })
    const primitive = new Primitive({
      geometryInstances: new GeometryInstance({ geometry }),
      appearance: new MaterialAppearance({
        material,
        translucent: true,
        flat: true,
      }),
      asynchronous: false,
    })
    getCesiumViewer(this.context.engine.native.viewer).scene.primitives.add(
      primitive,
    )
    this.primitive = primitive
    this.releaseRender = acquireContinuousRender(
      this.context,
      "analysis:floodWater",
    )
  }

  /** 清除已渲染的水面。 */
  clear(): void {
    this.releaseRender?.()
    this.releaseRender = undefined
    if (this.primitive === undefined) return
    getCesiumViewer(this.context.engine.native.viewer).scene.primitives.remove(
      this.primitive,
    )
    this.primitive = undefined
  }

  /** 销毁洪水淹没分析并释放图元。 */
  destroy(): void {
    this.clear()
    this.region = undefined
    this.extent = undefined
  }
}
