import { Arc3DError, type GraphicStyle } from "@arc3dlab/core"
import type { ConcreteRenderMode } from "./policy"

/**
 * 样式适配器接口，用于把 CSS 颜色转换为具体渲染后端可用的颜色值。
 */
export interface StyleAdapters {
  /**
   * 将 CSS 颜色字符串转换为渲染后端颜色。
   * @param css - CSS 颜色字符串。
   * @returns 转换后的颜色值。
   */
  color(css: string): unknown
  /**
   * 将 CSS 颜色字符串转换为几何实例颜色属性。
   * @param css - CSS 颜色字符串。
   * @returns 转换后的几何实例颜色属性值。
   */
  colorAttribute(css: string): unknown
}

/**
 * 合并当前样式与新的样式，新样式覆盖同名属性。
 * @param current - 当前样式。
 * @param next - 待合并的新样式。
 * @returns 合并后的样式。
 */
export function mergeGraphicStyle(
  current: GraphicStyle,
  next: GraphicStyle,
): GraphicStyle {
  return { ...current, ...next }
}

/**
 * 校验样式更新是否合法，阻止创建后不可变更的样式修改。
 * @param type - 图形类型。
 * @param mode - 图形采用的渲染模式。
 * @param current - 当前样式。
 * @param next - 待应用的样式。
 * @throws {Arc3DError} 当更新的样式不被当前图形或渲染模式支持时抛出。
 */
export function assertMutableStyle(
  type: string,
  mode: ConcreteRenderMode,
  current: GraphicStyle,
  next: GraphicStyle,
): void {
  if (
    next.clampToGround !== undefined &&
    next.clampToGround !== (current.clampToGround ?? true)
  ) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "clampToGround cannot be changed after create",
    )
  }
  if (type === "point" && next.width !== undefined) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Point graphic does not support width",
    )
  }
  if (type === "polyline" && next.pixelSize !== undefined) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Polyline graphic does not support pixelSize",
    )
  }
  if (type === "polygon" && next.pixelSize !== undefined) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Polygon graphic does not support pixelSize",
    )
  }
  if (
    type === "model" &&
    (next.pixelSize !== undefined ||
      next.width !== undefined ||
      next.outlineWidth !== undefined ||
      next.outline !== undefined)
  ) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Model graphic only supports color style updates",
    )
  }
  if (
    mode === "primitive" &&
    type === "polyline" &&
    next.width !== undefined &&
    next.width !== current.width
  ) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Primitive polyline width cannot be changed after create",
    )
  }
  if (
    mode === "primitive" &&
    type === "polygon" &&
    next.outlineWidth !== undefined &&
    next.outlineWidth !== current.outlineWidth
  ) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Primitive polygon outlineWidth cannot be changed after create",
    )
  }
}

interface PointAppearance {
  color?: unknown
  outlineColor?: unknown
  outlineWidth?: unknown
  pixelSize?: unknown
}

interface EntityLike {
  point?: PointAppearance
  polyline?: { width?: unknown; material?: unknown; show?: boolean }
  polygon?: { material?: unknown }
  model?: { color?: unknown }
}

interface PrimitiveLike {
  getGeometryInstanceAttributes?: (
    id: string,
  ) => { color?: unknown } | undefined
}

interface PointCollectionLike {
  length: number
  get(index: number): PointAppearance
}

interface PolygonPrimitiveBundle {
  fillPrimitive: PrimitiveLike
  outlinePrimitive?: PrimitiveLike & { show?: boolean }
}

function fillColor(style: GraphicStyle): string | undefined {
  return style.color ?? style.fill
}

function setPrimitiveColor(
  primitive: PrimitiveLike,
  id: string,
  css: string,
  adapters: StyleAdapters,
): void {
  const attrs = primitive.getGeometryInstanceAttributes?.(id)
  if (!attrs) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      `Primitive color cannot be updated: ${id}`,
    )
  }
  attrs.color = adapters.colorAttribute(css)
}

/**
 * 将样式应用到图元或实体的原生渲染对象。
 * @param target - 目标渲染对象及其类型、模式信息。
 * @param style - 待应用的图形样式。
 * @param adapters - 颜色转换适配器。
 */
export function applyNativeStyle(
  target: {
    id: string
    type: string
    renderMode: ConcreteRenderMode
    native: unknown
  },
  style: GraphicStyle,
  adapters: StyleAdapters,
): void {
  if (target.renderMode === "entity") {
    applyEntityStyle(target.native as EntityLike, target.type, style, adapters)
    return
  }
  applyPrimitiveStyle(target, style, adapters)
}

function applyEntityStyle(
  entity: EntityLike,
  type: string,
  style: GraphicStyle,
  adapters: StyleAdapters,
): void {
  const fill = fillColor(style)
  if (type === "point") {
    if (!entity.point)
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        "Point entity is missing point graphics",
      )
    if (fill !== undefined) entity.point.color = adapters.color(fill)
    if (style.outlineColor !== undefined)
      entity.point.outlineColor = adapters.color(style.outlineColor)
    if (style.outlineWidth !== undefined)
      entity.point.outlineWidth = style.outlineWidth
    if (style.pixelSize !== undefined) entity.point.pixelSize = style.pixelSize
    return
  }
  if (type === "polyline") {
    if (!entity.polyline)
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        "Polyline entity is missing polyline graphics",
      )
    if (fill !== undefined) entity.polyline.material = adapters.color(fill)
    if (style.width !== undefined) entity.polyline.width = style.width
    return
  }
  if (type === "polygon") {
    if (!entity.polygon)
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        "Polygon entity is missing polygon graphics",
      )
    if (fill !== undefined) entity.polygon.material = adapters.color(fill)
    if (entity.polyline) {
      if (style.outlineColor !== undefined)
        entity.polyline.material = adapters.color(style.outlineColor)
      if (style.outlineWidth !== undefined)
        entity.polyline.width = style.outlineWidth
      if (style.outline !== undefined) entity.polyline.show = style.outline
    } else if (
      style.outline !== undefined ||
      style.outlineColor !== undefined ||
      style.outlineWidth !== undefined
    ) {
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        "Polygon outline cannot be added after create",
      )
    }
    return
  }
  if (type === "model") {
    if (!entity.model)
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        "Model entity is missing model graphics",
      )
    if (fill !== undefined) entity.model.color = adapters.color(fill)
    return
  }
  throw new Arc3DError(
    "UNSUPPORTED_CAPABILITY",
    `Unsupported graphic type: ${type}`,
  )
}

function applyPrimitiveStyle(
  target: { id: string; type: string; native: unknown },
  style: GraphicStyle,
  adapters: StyleAdapters,
): void {
  const fill = fillColor(style)
  if (target.type === "point") {
    const collection = target.native as PointCollectionLike
    for (let index = 0; index < collection.length; index += 1) {
      const point = collection.get(index)
      if (fill !== undefined) point.color = adapters.color(fill)
      if (style.outlineColor !== undefined)
        point.outlineColor = adapters.color(style.outlineColor)
      if (style.outlineWidth !== undefined)
        point.outlineWidth = style.outlineWidth
      if (style.pixelSize !== undefined) point.pixelSize = style.pixelSize
    }
    return
  }
  if (target.type === "polyline") {
    if (fill !== undefined)
      setPrimitiveColor(
        target.native as PrimitiveLike,
        target.id,
        fill,
        adapters,
      )
    return
  }
  if (target.type === "polygon") {
    const bundle = target.native as PolygonPrimitiveBundle
    if (fill !== undefined)
      setPrimitiveColor(
        bundle.fillPrimitive,
        `${target.id}#fill`,
        fill,
        adapters,
      )
    if (style.outlineColor !== undefined) {
      if (!bundle.outlinePrimitive) {
        throw new Arc3DError(
          "UNSUPPORTED_CAPABILITY",
          "Polygon outline cannot be added after create",
        )
      }
      setPrimitiveColor(
        bundle.outlinePrimitive,
        `${target.id}#outline`,
        style.outlineColor,
        adapters,
      )
    }
    if (style.outline !== undefined && bundle.outlinePrimitive) {
      bundle.outlinePrimitive.show = style.outline
    }
    return
  }
  throw new Arc3DError(
    "UNSUPPORTED_CAPABILITY",
    `Unsupported primitive graphic type: ${target.type}`,
  )
}
