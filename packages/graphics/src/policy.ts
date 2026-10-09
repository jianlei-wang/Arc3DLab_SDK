import { Arc3DError, type RenderMode } from "@arc3dlab/core"

export type ConcreteRenderMode = Exclude<RenderMode, "auto" | "buffer">

export type GraphicKind = "point" | "polyline" | "polygon" | "model"

export const AUTO_PRIMITIVE_THRESHOLD = 64

export interface RenderPolicyInput {
  type: GraphicKind
  count: number
  dynamic?: boolean
  clampToGround?: boolean
  requestedMode?: RenderMode
}

export interface RenderPolicyDecision {
  mode: ConcreteRenderMode
  reason: string
  editable: boolean
}

export function decideRenderPolicy(input: RenderPolicyInput): RenderPolicyDecision {
  if (input.requestedMode === "buffer") {
    throw new Arc3DError("UNSUPPORTED_CAPABILITY", "RenderMode.buffer is not implemented")
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

export function resolveRenderMode(mode: RenderMode | undefined, count: number): ConcreteRenderMode {
  return decideRenderPolicy({ type: "polyline", count, requestedMode: mode }).mode
}

export function graphicChildId(parentId: string, child: string | number): string {
  return `${parentId}#${child}`
}

export interface BackendCost {
  count: number
  entityOps: number
  primitiveOps: number
  prefer: ConcreteRenderMode
}

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
