import {
  WGS84_3D,
  type Arc3DContext,
  type LngLatHeight,
  type PositionInput,
  type ResourceHandle,
} from "@arc3dlab/core"
import {
  geometryMatchesDistance,
  geometryMatchesPolygon,
  geometryMatchesRect,
  toMeasurePoint,
  type QueryRelation,
  type RectQuery,
} from "./geometry"
import type { AnalysisResult } from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"

const GRAPHIC_TYPES = new Set(["point", "polyline", "polygon", "model"])

/** 空间查询命中的图形信息。 */
export interface QueryHit {
  /** 图形标识。 */
  id: string
  /** 图形类型。 */
  type: string
}

function graphicPositions(item: ResourceHandle): LngLatHeight[] {
  const positions = (item as ResourceHandle & { positions?: LngLatHeight[] })
    .positions
  return Array.isArray(positions) ? positions : []
}

/** 空间查询服务，基于上下文中的图形资源执行矩形、多边形与距离查询。 */
export class SpatialQueryService {
  /**
   * 创建空间查询服务。
   * @param context - Arc3D 运行上下文。
   * @param runTask - 任务执行器，默认绑定当前上下文。
   */
  constructor(
    private readonly context: Arc3DContext,
    private readonly runTask: AnalysisTaskExecutor = createTaskExecutor(
      context,
    ),
  ) {}

  /**
   * 查询与矩形满足指定空间关系的图形。
   * @param rect - 矩形范围及可选空间关系。
   * @returns 命中的图形列表。
   */
  async rectangle(
    rect: RectQuery & { relation?: QueryRelation },
  ): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query rectangle")
    const relation = rect.relation ?? "intersect"
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesRect(type, positions, rect, relation),
      ),
    }
  }

  /**
   * 查询与多边形满足指定空间关系的图形。
   * @param options - 查询选项，包含多边形顶点与空间关系。
   * @returns 命中的图形列表。
   */
  async polygon(options: {
    positions: PositionInput[]
    relation?: QueryRelation
  }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query polygon")
    const ring = options.positions.map(toMeasurePoint)
    const relation = options.relation ?? "intersect"
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesPolygon(type, positions, ring, relation),
      ),
    }
  }

  /**
   * 查询位于指定中心点给定距离范围内的图形。
   * @param options - 查询选项，包含中心点与距离阈值。
   * @returns 命中的图形列表。
   */
  async distance(options: {
    position: PositionInput
    meters: number
  }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query distance")
    const center = toMeasurePoint(options.position)
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesDistance(type, positions, center, options.meters),
      ),
    }
  }

  /**
   * 以任务形式执行矩形查询。
   * @param rect - 矩形范围及可选空间关系。
   * @returns 分析结果，结果值为命中的图形列表。
   */
  rectangleTask(
    rect: RectQuery & { relation?: QueryRelation },
  ): Promise<AnalysisResult<{ graphics: QueryHit[] }>> {
    return this.runTask<typeof rect, { graphics: QueryHit[] }>({
      algorithm: "query.rectangle",
      input: rect,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("query rectangle")
        return { value: await this.rectangle(rect) }
      },
    })
  }

  /**
   * 以任务形式执行多边形查询。
   * @param options - 查询选项，包含多边形顶点与空间关系。
   * @returns 分析结果，结果值为命中的图形列表。
   */
  polygonTask(options: {
    positions: PositionInput[]
    relation?: QueryRelation
  }): Promise<AnalysisResult<{ graphics: QueryHit[] }>> {
    return this.runTask<typeof options, { graphics: QueryHit[] }>({
      algorithm: "query.polygon",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("query polygon")
        return { value: await this.polygon(options) }
      },
    })
  }

  /**
   * 以任务形式执行距离查询。
   * @param options - 查询选项，包含中心点与距离阈值。
   * @returns 分析结果，结果值为命中的图形列表。
   */
  distanceTask(options: {
    position: PositionInput
    meters: number
  }): Promise<AnalysisResult<{ graphics: QueryHit[] }>> {
    return this.runTask<typeof options, { graphics: QueryHit[] }>({
      algorithm: "query.distance",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("query distance")
        return { value: await this.distance(options) }
      },
    })
  }

  private collect(
    match: (type: string, positions: LngLatHeight[]) => boolean,
  ): QueryHit[] {
    return this.context.registry
      .values()
      .filter(
        (item) =>
          GRAPHIC_TYPES.has(item.type) &&
          match(item.type, graphicPositions(item)),
      )
      .map((item) => ({ id: item.id, type: item.type }))
  }
}
