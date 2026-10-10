import { Arc3DError, type RenderMode } from "@arc3dlab/core"

/**
 * 具体渲染模式，排除自动与缓冲区两种不确定取值。
 */
export type ConcreteRenderMode = Exclude<RenderMode, "auto" | "buffer">

/**
 * 图形种类，包含点、折线、多边形与模型。
 */
export type GraphicKind = "point" | "polyline" | "polygon" | "model"

/**
 * 自动切换为图元渲染的图形数量阈值。
 */
export const AUTO_PRIMITIVE_THRESHOLD = 64

/**
 * 渲染策略决策的输入参数。
 */
export interface RenderPolicyInput {
  /** 图形种类。 */
  type: GraphicKind
  /** 图形实例数量。 */
  count: number
  /** 坐标是否需要动态更新。 */
  dynamic?: boolean
  /** 是否贴合地面。 */
  clampToGround?: boolean
  /** 调用方期望的渲染模式。 */
  requestedMode?: RenderMode
}

/**
 * 渲染策略决策的结果。
 */
export interface RenderPolicyDecision {
  /** 选定的具体渲染模式。 */
  mode: ConcreteRenderMode
  /** 选择该模式的原因标识。 */
  reason: string
  /** 该模式下图形是否可编辑。 */
  editable: boolean
}

/**
 * 根据图形种类、数量与需求决定使用的渲染模式。
 * @param input - 渲染策略决策的输入参数。
 * @returns 渲染策略决策结果。
 * @throws {Arc3DError} 当请求的渲染模式为 buffer 时抛出。
 */
export function decideRenderPolicy(
  input: RenderPolicyInput,
): RenderPolicyDecision {
  if (input.requestedMode === "buffer") {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "RenderMode.buffer is not implemented",
    )
  }
  if (input.requestedMode === "entity" || input.requestedMode === "primitive") {
    return {
      mode: input.requestedMode,
      reason: "explicit-mode",
      editable: input.requestedMode === "entity",
    }
  }
  if (input.type === "model") {
    return { mode: "entity", reason: "model-entity-backend", editable: true }
  }
  if (input.dynamic) {
    return { mode: "entity", reason: "dynamic-editing", editable: true }
  }
  if (input.count > AUTO_PRIMITIVE_THRESHOLD) {
    return { mode: "primitive", reason: "batch-count", editable: false }
  }
  return { mode: "entity", reason: "small-count", editable: true }
}

/**
 * 将可选的渲染模式解析为确定的具体渲染模式。
 * @param mode - 期望的渲染模式，可为空。
 * @param count - 图形实例数量。
 * @returns 解析后的具体渲染模式。
 */
export function resolveRenderMode(
  mode: RenderMode | undefined,
  count: number,
): ConcreteRenderMode {
  return decideRenderPolicy({ type: "polyline", count, requestedMode: mode })
    .mode
}

/**
 * 根据父图形 ID 与子序号生成子图元 ID。
 * @param parentId - 父图形 ID。
 * @param child - 子图元序号或标识。
 * @returns 拼接后的子图元 ID。
 */
export function graphicChildId(
  parentId: string,
  child: string | number,
): string {
  return `${parentId}#${child}`
}

/**
 * 渲染后端开销估算结果。
 */
export interface BackendCost {
  /** 图形实例数量。 */
  count: number
  /** 实体渲染的估算操作数。 */
  entityOps: number
  /** 图元渲染的估算操作数。 */
  primitiveOps: number
  /** 推荐使用的渲染模式。 */
  prefer: ConcreteRenderMode
}

/**
 * 估算实体与图元两种渲染后端在给定数量下的开销。
 * @param count - 图形实例数量。
 * @returns 两种后端的开销估算与推荐模式。
 */
export function compareRenderBackends(count: number): BackendCost {
  const entityOps = count * 3
  const primitiveOps = 4 + count
  return {
    count,
    entityOps,
    primitiveOps,
    prefer: count > AUTO_PRIMITIVE_THRESHOLD ? "primitive" : "entity",
  }
}
