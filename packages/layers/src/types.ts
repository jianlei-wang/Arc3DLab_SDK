import type { ResourceHandle } from "@arc3dlab/core"
import type { ProviderSpec } from "@arc3dlab/data"

/**
 * 图层句柄，在通用资源句柄基础上附加名称、层级与分组信息。
 */
export interface Layer extends ResourceHandle {
  /** 图层名称。 */
  name?: string
  /** 图层在渲染顺序中的层级。 */
  zIndex?: number
  /** 图层所属分组。 */
  group?: string
}

/**
 * 底图数据源规格，等同于数据包提供的 ProviderSpec。
 */
export type BasemapSpec = ProviderSpec

/**
 * 地形数据源的配置。
 */
export interface TerrainSpec {
  /** 地形类型，可选远程地址、Ion 资源或无地形。 */
  type: "url" | "ion" | "none"
  /** 地形服务的地址，type 为 url 时使用。 */
  url?: string
  /** Cesium Ion 地形资源 ID，type 为 ion 时使用。 */
  assetId?: number
}
