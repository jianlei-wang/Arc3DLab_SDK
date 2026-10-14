import type { Arc3DContext } from "@arc3dlab/core"
import {
  addBillboard,
  addCircleDiffusion,
  addDynamicPolyline,
  addPanel,
  addRadarNormal,
  addRiver,
  addSpreadPoint,
} from "./index"
import type {
  BillboardOptions,
  CircleDiffusionOptions,
  DynamicGraphicHandle,
  DynamicPolylineOptions,
  PanelOptions,
  RadarNormalOptions,
  RiverOptions,
  SpreadPointOptions,
} from "./types"

/**
 * 动态图形管理器，按运行时上下文创建扩散、雷达、尾迹等动态图形。
 */
export class DynamicGraphicManager {
  /**
   * 创建动态图形管理器实例。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 创建广告牌动态图形。
   * @param options - 广告牌选项。
   * @returns 动态图形句柄。
   */
  billboard(options: BillboardOptions): DynamicGraphicHandle {
    return addBillboard(this.context, options)
  }

  /**
   * 创建扩散点动态图形。
   * @param options - 扩散点选项。
   * @returns 动态图形句柄。
   */
  spreadPoint(options: SpreadPointOptions): DynamicGraphicHandle {
    return addSpreadPoint(this.context, options)
  }

  /**
   * 创建雷达扫描动态图形。
   * @param options - 雷达扫描选项。
   * @returns 动态图形句柄。
   */
  radarNormal(options: RadarNormalOptions): DynamicGraphicHandle {
    return addRadarNormal(this.context, options)
  }

  /**
   * 创建水系面动态图形。
   * @param options - 水系面选项。
   * @returns 动态图形句柄。
   */
  river(options: RiverOptions): DynamicGraphicHandle {
    return addRiver(this.context, options)
  }

  /**
   * 创建圆形扩散动态图形。
   * @param options - 圆形扩散选项。
   * @returns 动态图形句柄。
   */
  circleDiffusion(options: CircleDiffusionOptions): DynamicGraphicHandle {
    return addCircleDiffusion(this.context, options)
  }

  /**
   * 创建尾迹动态折线。
   * @param options - 动态折线选项。
   * @returns 动态图形句柄。
   */
  polyline(options: DynamicPolylineOptions): DynamicGraphicHandle {
    return addDynamicPolyline(this.context, options)
  }

  /**
   * 创建热点/流程面板动态图形。
   * @param options - 面板选项。
   * @returns 动态图形句柄。
   */
  panel(options: PanelOptions): DynamicGraphicHandle {
    return addPanel(this.context, options)
  }
}
