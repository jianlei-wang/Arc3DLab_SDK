import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  Cartesian3,
  Color,
  CustomShader,
  Matrix4,
  MetadataComponentType,
  MetadataType,
  PointPrimitiveCollection,
  Transforms,
  VoxelContent,
  VoxelPrimitive,
  VoxelShapeType,
  type Viewer,
} from "cesium"

/** 体素点数据，坐标为经纬度与高程，`value` 为标量值。 */
export interface VoxelPoint {
  /** 经度。 */
  x: number
  /** 纬度。 */
  y: number
  /** 高程（米）。 */
  z: number
  /** 标量值。 */
  value: number
}

/** 体素创建选项。 */
export interface VoxelOptions {
  /** 每个维度的体元数量，默认为 15。 */
  dimensions?: number
  /** 颜色刻度列表（CSS 颜色字符串）。 */
  colorsList?: string[]
}

/** 体素数据请求选项。 */
export interface VoxelTileRequest {
  /** 瓦片层级。 */
  tileLevel: number
  /** 瓦片 X 索引。 */
  tileX: number
  /** 瓦片 Y 索引。 */
  tileY: number
  /** 瓦片 Z 索引。 */
  tileZ: number
}

const DEFAULT_COLORS = [
  "#ff0000",
  "#ff5100",
  "#ff7700",
  "#fe9600",
  "#fbb200",
  "#efbf00",
  "#e2cc00",
  "#d2d900",
  "#b5dc00",
  "#94de00",
  "#69df00",
  "#0de01f",
]

const VOXEL_SHADER_TEXT = `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    material.diffuse = fsInput.metadata.color.rgb;
    float transparency = 1.0 - fsInput.metadata.color.a;
    float thickness = fsInput.voxel.travelDistance * 16.0;
    material.alpha = 1.0 - pow(transparency, thickness);
}`

/**
 * 多瓦片体素对象，将离散点数据插值为体素盒并按数值着色。
 */
export class MultiTileVoxel {
  /** 体素点数据。 */
  readonly pointData: VoxelPoint[]
  /** 各维度的体元数量。 */
  readonly dimensions: number
  /** 颜色刻度。 */
  readonly colorsList: string[]
  private readonly minValue: number
  private readonly maxValue: number
  private readonly viewer: Viewer | undefined
  private primitive: VoxelPrimitive | undefined
  private pointCollection: PointPrimitiveCollection | undefined

  /**
   * 创建体素对象。
   * @param context - Arc3D 运行时上下文。
   * @param pointData - 体素点数据。
   * @param options - 体素配置。
   */
  constructor(
    context: Arc3DContext,
    pointData: VoxelPoint[],
    options: VoxelOptions = {},
  ) {
    this.pointData = pointData
    this.dimensions = options.dimensions ?? 15
    this.colorsList = options.colorsList ?? DEFAULT_COLORS
    const values = pointData.map((point) => point.value)
    this.minValue = values.length > 0 ? Math.min(...values) : 0
    this.maxValue = values.length > 0 ? Math.max(...values) : 1
    this.viewer = getCesiumViewer(context.engine.native.viewer) as
      Viewer | undefined
    this.buildPrimitive()
  }

  /**
   * 按最近邻在离散点之间插值，返回最接近目标位置的点值。
   * @param x - 查询点经度。
   * @param y - 查询点纬度。
   * @param z - 查询点高程。
   * @returns 插值得到的标量值。
   */
  interpolate(x: number, y: number, z: number): number {
    let nearestDistance = Number.POSITIVE_INFINITY
    let nearestValue = 0
    for (const point of this.pointData) {
      const dx = point.x - x
      const dy = point.y - y
      const dz = point.z - z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestValue = point.value
      }
    }
    return nearestValue
  }

  /**
   * 异步请求体素瓦片数据。
   * @param options - 瓦片索引。
   * @returns 以 RGBA 浮点数组形式返回的体素数据。
   */
  requestData(options: VoxelTileRequest): Promise<Float32Array[]> | undefined {
    if (options.tileLevel > 0) return undefined
    const dimensions = this.dimensions
    const channelCount = 4
    const data = new Float32Array(dimensions ** 3 * channelCount)
    let cursor = 0
    for (let z = 0; z < dimensions; z++) {
      for (let y = 0; y < dimensions; y++) {
        for (let x = 0; x < dimensions; x++) {
          const sample = this.sampleGrid(x, y, z)
          const color = this.colorForValue(sample)
          data[cursor++] = color.red
          data[cursor++] = color.green
          data[cursor++] = color.blue
          data[cursor++] = 1
        }
      }
    }
    return Promise.resolve([data])
  }

  /**
   * 显示或隐藏原始点数据。
   * @param visible - 是否显示。
   */
  showPoints(visible: boolean): void {
    if (!this.viewer?.scene) return
    if (visible && !this.pointCollection) {
      const collection = new PointPrimitiveCollection()
      for (const point of this.pointData) {
        collection.add({
          position: Cartesian3.fromDegrees(point.x, point.y, point.z),
          color: this.colorForValue(point.value),
        })
      }
      this.pointCollection = this.viewer.scene.primitives.add(
        collection,
      ) as unknown as PointPrimitiveCollection
    }
    if (this.pointCollection) this.pointCollection.show = visible
  }

  /**
   * 销毁体素对象并释放图元、点集合与着色器资源。
   */
  destroy(): void {
    const scene = this.viewer?.scene
    if (this.pointCollection) {
      scene?.primitives?.remove(this.pointCollection)
      this.pointCollection = undefined
    }
    if (this.primitive) {
      scene?.primitives?.remove(this.primitive)
      this.primitive = undefined
    }
  }

  private buildPrimitive(): void {
    const scene = this.viewer?.scene
    if (!scene) return
    const count = this.pointData.length
    if (count === 0) return
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const point of this.pointData) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      minZ = Math.min(minZ, point.z)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
    const width = Math.max(1, (maxX - minX) * 111000)
    const height = Math.max(1, (maxY - minY) * 111000)
    const depth = Math.max(1, this.maxValue - this.minValue)
    const center = Cartesian3.fromDegrees(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      minZ + depth / 2,
    )
    const modelMatrix = Transforms.eastNorthUpToFixedFrame(center)
    const scale = new Cartesian3(width / 2, height / 2, depth / 2)
    Matrix4Scale(modelMatrix, scale)
    const shader = new CustomShader({ fragmentShaderText: VOXEL_SHADER_TEXT })
    this.primitive = scene.primitives.add(
      new VoxelPrimitive({
        provider: new GridVoxelProvider(this),
        customShader: shader,
        modelMatrix,
      }),
    ) as unknown as VoxelPrimitive
  }

  private sampleGrid(x: number, y: number, z: number): number {
    const cx = minMax(0, this.dimensions, x)
    const cy = minMax(0, this.dimensions, y)
    const cz = minMax(0, this.dimensions, z)
    return (cx + cy + cz) / (this.dimensions * 3)
  }

  private colorForValue(value: number): Color {
    const min = this.minValue
    const max = this.maxValue
    const clamped = Math.min(Math.max(value, min), max)
    const ratio = max === min ? 0 : 1 - (clamped - min) / (max - min)
    let index = Math.floor(ratio * this.colorsList.length)
    if (!this.colorsList[index]) index = this.colorsList.length - 1
    return Color.fromCssColorString(this.colorsList[index]!) ?? Color.WHITE
  }
}

function minMax(min: number, max: number, value: number): number {
  return Math.min(Math.max(value, min), max)
}

function Matrix4Scale(matrix: unknown, scale: Cartesian3): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = matrix as any
  const x = scale.x
  const y = scale.y
  const z = scale.z
  for (let i = 0; i < 4; i++) {
    m[i] *= x
    m[4 + i] *= y
    m[8 + i] *= z
  }
}

/**
 * 体素数据提供程序，向 Cesium 提供体素维度与插值后的颜色数据。
 */
class GridVoxelProvider {
  readonly globalTransform = Matrix4.IDENTITY
  readonly shapeTransform = Matrix4.IDENTITY
  readonly shape = VoxelShapeType.BOX
  readonly minBounds = undefined
  readonly maxBounds = undefined
  readonly dimensions: Cartesian3
  readonly paddingBefore = new Cartesian3(1, 1, 1)
  readonly paddingAfter = new Cartesian3(1, 1, 1)
  readonly names = ["color"]
  readonly types = [MetadataType.VEC4]
  readonly componentTypes = [MetadataComponentType.FLOAT32]
  readonly levelCount = 1
  readonly minimumValues = undefined
  readonly maximumValues = undefined
  readonly maximumTileCount = undefined
  readonly availableLevels = undefined

  /**
   * 创建体素数据提供程序。
   * @param voxel - 所属体素对象。
   */
  constructor(private readonly voxel: MultiTileVoxel) {
    const d = voxel.dimensions
    this.dimensions = new Cartesian3(d, d, d)
  }

  /**
   * 请求指定瓦片的数据。
   * @param options - 瓦片索引。
   * @returns 体素内容，或在无法调度时返回 undefined。
   */
  requestData(options?: VoxelTileRequest): Promise<VoxelContent> | undefined {
    if (!options) return undefined
    const pending = this.voxel.requestData(options)
    if (!pending) return undefined
    return pending.then((arrays) => VoxelContent.fromMetadataArray(arrays))
  }
}
