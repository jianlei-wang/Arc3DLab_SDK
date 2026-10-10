import {
  Arc3DError,
  assertGraphicStyle,
  assertNewResourceId,
  assertPositions,
  createId,
  parsePosition,
  registerAtomically,
  type Arc3DContext,
  type GraphicStyle,
  type LngLatHeight,
  type PositionInput,
  type RenderMode,
  type ResourceHandle,
} from "@arc3dlab/core"
import {
  fromCartesian3,
  getCesiumViewer,
  toCartesian3,
  toCartesian3Array,
} from "@arc3dlab/engine-cesium"
import { applyPositionUpdates } from "./pool"
import {
  Color,
  ColorGeometryInstanceAttribute,
  ConstantPositionProperty,
  ConstantProperty,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  HeadingPitchRoll,
  HeightReference,
  Math as CesiumMath,
  PerInstanceColorAppearance,
  PointPrimitiveCollection,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  Primitive,
  Transforms,
  type Viewer,
} from "cesium"
import {
  decideRenderPolicy,
  graphicChildId,
  type ConcreteRenderMode,
} from "./policy"
import {
  applyNativeStyle,
  assertMutableStyle,
  mergeGraphicStyle,
} from "./style"

export interface Graphic extends ResourceHandle {
  readonly renderMode: ConcreteRenderMode
  readonly positions: LngLatHeight[]
  readonly editable: boolean
  setStyle(style: GraphicStyle): void
  setPositions(positions: PositionInput | PositionInput[]): void
  remove(): void
}

export interface GraphicCreateOptions {
  id?: string
  positions: PositionInput | PositionInput[]
  style?: GraphicStyle
  renderMode?: RenderMode
  dynamic?: boolean
  properties?: Record<string, unknown>
}

export interface ModelCreateOptions {
  id?: string
  url: string
  position: PositionInput
  scale?: number
  minimumPixelSize?: number
  heading?: number
  pitch?: number
  roll?: number
  properties?: Record<string, unknown>
}

export {
  decideRenderPolicy,
  graphicChildId,
  resolveRenderMode,
  AUTO_PRIMITIVE_THRESHOLD,
  compareRenderBackends,
} from "./policy"
export {
  applyNativeStyle,
  assertMutableStyle,
  mergeGraphicStyle,
} from "./style"
export {
  createPositionPool,
  diffPositions,
  applyPositionUpdates,
  type PositionPool,
} from "./pool"

function parseColor(value: string | undefined, fallback: string): Color {
  const parsed = Color.fromCssColorString(value ?? fallback)
  if (!parsed) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Invalid color: ${value ?? fallback}`,
    )
  }
  return parsed
}

function asList(positions: PositionInput | PositionInput[]): PositionInput[] {
  if (
    Array.isArray(positions) &&
    positions.length > 0 &&
    (Array.isArray(positions[0]) ||
      typeof (positions[0] as PositionInput & { longitude?: number })
        .longitude === "number")
  ) {
    return positions as PositionInput[]
  }
  return [positions as PositionInput]
}

function toLngLatHeights(inputs: PositionInput[]): LngLatHeight[] {
  return inputs.map((input) => parsePosition(input))
}

export function syncPointCollection(
  collection: {
    length: number
    get(index: number): { position?: unknown }
    add(options: Record<string, unknown>): unknown
    remove(item: unknown): boolean
  },
  groupId: string,
  positions: PositionInput[],
  style: {
    color: unknown
    outlineColor: unknown
    pixelSize: number
    outlineWidth: number
  },
): void {
  const cartesians = positions.map((position) => toCartesian3(position))
  while (collection.length > cartesians.length) {
    collection.remove(collection.get(collection.length - 1))
  }
  cartesians.forEach((cartesian, index) => {
    if (index < collection.length) {
      collection.get(index).position = cartesian
      return
    }
    collection.add({
      id: graphicChildId(groupId, index),
      position: cartesian,
      color: style.color,
      outlineColor: style.outlineColor,
      pixelSize: style.pixelSize,
      outlineWidth: style.outlineWidth,
      show: true,
    })
  })
}

class ManagedGraphic implements Graphic {
  owned = true
  native: unknown
  private destroyed = false
  private currentPositions: LngLatHeight[]

  constructor(
    readonly id: string,
    readonly type: string,
    readonly renderMode: ConcreteRenderMode,
    native: unknown,
    private readonly teardown: () => void,
    private readonly setVisible: (visible: boolean) => void,
    positions: LngLatHeight[],
    private currentStyle: GraphicStyle,
    private readonly applyPositions?: (positions: PositionInput[]) => void,
    private readonly onChange?: (reason: string) => void,
  ) {
    this.native = native
    this.currentPositions = positions
  }

  private _visible = true

  get positions(): LngLatHeight[] {
    return this.currentPositions
  }

  get editable(): boolean {
    return this.renderMode === "entity"
  }

  get visible(): boolean {
    return this._visible
  }

  set visible(value: boolean) {
    this._visible = value
    this.setVisible(value)
    this.onChange?.("graphic-visible")
  }

  setStyle(style: GraphicStyle): void {
    assertGraphicStyle(style)
    assertMutableStyle(this.type, this.renderMode, this.currentStyle, style)
    applyNativeStyle(
      {
        id: this.id,
        type: this.type,
        renderMode: this.renderMode,
        native: this.native,
      },
      style,
      {
        color: (css) => parseColor(css, "#ffffff"),
        colorAttribute: (css) =>
          ColorGeometryInstanceAttribute.toValue(parseColor(css, "#ffffff")),
      },
    )
    this.currentStyle = mergeGraphicStyle(this.currentStyle, style)
    this.onChange?.("graphic-style")
  }

  setPositions(positions: PositionInput | PositionInput[]): void {
    const list = asList(positions)
    const min = this.type === "polygon" ? 3 : this.type === "polyline" ? 2 : 1
    assertPositions(list, min, this.type)
    if (!this.applyPositions) {
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        `${this.renderMode} ${this.type} positions cannot be changed after create`,
      )
    }
    this.applyPositions(list)
    this.currentPositions = toLngLatHeights(list)
    this.onChange?.("graphic-positions")
  }

  remove(): void {
    this.destroy()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.teardown()
    this.onChange?.("graphic-removed")
  }
}

export class GraphicManager {
  private items = new Map<string, Graphic>()

  constructor(private readonly context: Arc3DContext) {}

  private claimId(id: string): void {
    assertNewResourceId(this.context.registry, id)
    if (this.items.has(id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Resource already exists: ${id}`,
      )
    }
  }

  addPoint(options: GraphicCreateOptions): Graphic {
    const positions = asList(options.positions)
    return this.createPoints(positions, options)[0]
  }

  addPoints(options: GraphicCreateOptions): Graphic[] {
    return this.createPoints(asList(options.positions), options)
  }

  addPolyline(options: GraphicCreateOptions): Graphic {
    this.context.lifecycle.assertUsable("add polyline")
    const positions = asList(options.positions)
    assertPositions(positions, 2, "polyline")
    assertGraphicStyle(options.style)
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = options.id ?? createId("polyline")
    this.claimId(id)
    const cartesians = toCartesian3Array(positions)
    const style = options.style ?? {}
    const onGround = style.clampToGround ?? true
    const mode = decideRenderPolicy({
      type: "polyline",
      count: 1,
      dynamic: options.dynamic,
      clampToGround: onGround,
      requestedMode: options.renderMode,
    }).mode
    const color = parseColor(style.color ?? style.fill, "#ff0f40")
    const width = style.width ?? 2

    let native: unknown
    let teardown: () => void
    let setVisible: (visible: boolean) => void
    let applyPositions: ((positions: PositionInput[]) => void) | undefined

    if (mode === "entity") {
      const entity = viewer.entities.add({
        id,
        polyline: {
          positions: cartesians,
          width,
          material: color,
          clampToGround: onGround,
        },
        properties: options.properties,
      })
      native = entity
      teardown = () => viewer.entities.remove(entity)
      setVisible = (visible) => {
        entity.show = visible
      }
      applyPositions = (next) => {
        if (entity.polyline)
          entity.polyline.positions = new ConstantProperty(
            toCartesian3Array(next),
          )
      }
    } else {
      const instance = new GeometryInstance({
        geometry: onGround
          ? new GroundPolylineGeometry({ positions: cartesians, width })
          : new PolylineGeometry({ positions: cartesians, width }),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
        id,
      })
      const primitive = onGround
        ? new GroundPolylinePrimitive({
            geometryInstances: instance,
            appearance: new PerInstanceColorAppearance({
              flat: true,
              translucent: color.alpha < 1,
            }),
          })
        : new Primitive({
            geometryInstances: instance,
            appearance: new PerInstanceColorAppearance({
              flat: true,
              translucent: color.alpha < 1,
            }),
          })
      viewer.scene.primitives.add(primitive)
      native = primitive
      teardown = () => viewer.scene.primitives.remove(primitive)
      setVisible = (visible) => {
        primitive.show = visible
      }
    }

    return this.register(
      id,
      "polyline",
      mode,
      native,
      teardown,
      setVisible,
      toLngLatHeights(positions),
      style,
      applyPositions,
    )
  }

  addPolygon(options: GraphicCreateOptions): Graphic {
    this.context.lifecycle.assertUsable("add polygon")
    const positions = asList(options.positions)
    assertPositions(positions, 3, "polygon")
    assertGraphicStyle(options.style)
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = options.id ?? createId("polygon")
    this.claimId(id)
    const cartesians = toCartesian3Array(positions)
    const style = options.style ?? {}
    const onGround = style.clampToGround ?? true
    const mode = decideRenderPolicy({
      type: "polygon",
      count: 1,
      dynamic: options.dynamic,
      clampToGround: onGround,
      requestedMode: options.renderMode,
    }).mode
    const fill = parseColor(style.fill ?? style.color, "#ff0000")
    const outline = style.outline ?? true
    const outlineColor = parseColor(style.outlineColor, "#00ff00")
    const outlineWidth = style.outlineWidth ?? 1

    if (mode === "entity") {
      const entity = viewer.entities.add({
        id,
        polygon: {
          hierarchy: cartesians,
          material: fill,
          heightReference: onGround
            ? HeightReference.CLAMP_TO_GROUND
            : HeightReference.NONE,
        },
        polyline: outline
          ? {
              positions: cartesians,
              width: outlineWidth,
              material: outlineColor,
              clampToGround: onGround,
            }
          : undefined,
        properties: options.properties,
      })
      return this.register(
        id,
        "polygon",
        mode,
        entity,
        () => viewer.entities.remove(entity),
        (visible) => {
          entity.show = visible
        },
        toLngLatHeights(asList(options.positions)),
        style,
        (next) => {
          const nextCartesians = toCartesian3Array(next)
          if (entity.polygon) {
            entity.polygon.hierarchy = new ConstantProperty(
              new PolygonHierarchy(nextCartesians),
            )
          }
          if (entity.polyline)
            entity.polyline.positions = new ConstantProperty(nextCartesians)
        },
      )
    }

    return this.createPolygonPrimitive(viewer, {
      id,
      cartesians,
      fill,
      outline,
      outlineColor,
      outlineWidth,
      onGround,
      style,
    })
  }

  addModel(options: ModelCreateOptions): Graphic {
    this.context.lifecycle.assertUsable("add model")
    this.context.capabilities.require("graphic:model", "add model")
    if (!options.url) {
      throw new Arc3DError("INVALID_ARGUMENT", "Model url is required")
    }
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = options.id ?? createId("model")
    this.claimId(id)
    const position = toCartesian3(options.position)
    const orientation = Transforms.headingPitchRollQuaternion(
      position,
      new HeadingPitchRoll(
        CesiumMath.toRadians(options.heading ?? 0),
        CesiumMath.toRadians(options.pitch ?? 0),
        CesiumMath.toRadians(options.roll ?? 0),
      ),
    )
    const entity = viewer.entities.add({
      id,
      position,
      orientation,
      model: {
        uri: options.url,
        scale: options.scale ?? 1,
        minimumPixelSize: options.minimumPixelSize ?? 64,
      },
      properties: options.properties,
    })
    return this.register(
      id,
      "model",
      "entity",
      entity,
      () => viewer.entities.remove(entity),
      (visible) => {
        entity.show = visible
      },
      toLngLatHeights([options.position]),
      {},
      (next) => {
        entity.position = new ConstantPositionProperty(toCartesian3(next[0]))
      },
    )
  }

  get(id: string): Graphic | undefined {
    return this.items.get(id)
  }

  remove(id: string): boolean {
    const graphic = this.items.get(id)
    if (!graphic) return false
    graphic.destroy()
    return true
  }

  show(id: string, visible: boolean): boolean {
    const graphic = this.items.get(id)
    if (!graphic) return false
    graphic.visible = visible
    return true
  }

  list(): Graphic[] {
    return Array.from(this.items.values())
  }

  addPolylines(items: GraphicCreateOptions[]): Graphic[] {
    this.context.lifecycle.assertUsable("add polylines")
    const policy = decideRenderPolicy({
      type: "polyline",
      count: items.length,
      dynamic: items.some((item) => item.dynamic),
    })
    return items.map((item) =>
      this.addPolyline({
        ...item,
        renderMode: item.renderMode ?? policy.mode,
        dynamic: item.dynamic,
      }),
    )
  }

  addPolygons(items: GraphicCreateOptions[]): Graphic[] {
    this.context.lifecycle.assertUsable("add polygons")
    const policy = decideRenderPolicy({
      type: "polygon",
      count: items.length,
      dynamic: items.some((item) => item.dynamic),
    })
    return items.map((item) =>
      this.addPolygon({
        ...item,
        renderMode: item.renderMode ?? policy.mode,
        dynamic: item.dynamic,
      }),
    )
  }

  removeMany(ids: string[]): number {
    let removed = 0
    for (const id of ids) {
      if (this.remove(id)) removed += 1
    }
    return removed
  }

  showMany(ids: string[], visible: boolean): number {
    let updated = 0
    for (const id of ids) {
      if (this.show(id, visible)) updated += 1
    }
    return updated
  }

  updatePositionsBatch(
    updates: Array<{ id: string; positions: PositionInput | PositionInput[] }>,
  ): number {
    this.context.lifecycle.assertUsable("update graphic positions")
    return applyPositionUpdates((id) => this.items.get(id), updates)
  }

  clear(): void {
    for (const graphic of Array.from(this.items.values())) graphic.destroy()
  }

  private createPoints(
    positions: PositionInput[],
    options: GraphicCreateOptions,
  ): Graphic[] {
    this.context.lifecycle.assertUsable("add point")
    assertPositions(positions, 1, "point")
    assertGraphicStyle(options.style)
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const mode = decideRenderPolicy({
      type: "point",
      count: positions.length,
      dynamic: options.dynamic,
      clampToGround: options.style?.clampToGround,
      requestedMode: options.renderMode,
    }).mode
    const style = options.style ?? {}
    const color = parseColor(style.color ?? style.fill, "#ff0000")
    const outlineColor = parseColor(style.outlineColor, "#ffff00")
    const pixelSize = style.pixelSize ?? 10
    const onGround = style.clampToGround ?? true
    const graphics: Graphic[] = []

    if (mode === "entity") {
      positions.forEach((position, index) => {
        const id =
          options.id && positions.length === 1 ? options.id : createId("point")
        this.claimId(id)
        const entity = viewer.entities.add({
          id,
          position: toCartesian3(position),
          point: {
            color,
            outlineColor,
            pixelSize,
            outlineWidth: style.outlineWidth ?? 1,
            heightReference: onGround
              ? HeightReference.CLAMP_TO_GROUND
              : HeightReference.NONE,
            show: true,
          },
          properties: options.properties,
        })
        graphics.push(
          this.register(
            id,
            "point",
            mode,
            entity,
            () => viewer.entities.remove(entity),
            (visible) => {
              entity.show = visible
            },
            toLngLatHeights([position]),
            style,
            (next) => {
              entity.position = new ConstantPositionProperty(
                toCartesian3(next[0]),
              )
            },
          ),
        )
        void index
      })
      return graphics
    }

    const groupId = options.id ?? createId("points")
    this.claimId(groupId)
    const collection = new PointPrimitiveCollection()
    viewer.scene.primitives.add(collection)
    positions.forEach((position, index) => {
      const childId = graphicChildId(groupId, index)
      collection.add({
        id: childId,
        position: toCartesian3(position),
        color,
        outlineColor,
        pixelSize,
        outlineWidth: style.outlineWidth ?? 1,
        show: true,
      })
      this.context.tracker.link(groupId, childId)
    })
    graphics.push(
      this.register(
        groupId,
        "point",
        mode,
        collection,
        () => {
          viewer.scene.primitives.remove(collection)
          this.context.tracker.unlink(groupId)
        },
        (visible) => {
          collection.show = visible
        },
        toLngLatHeights(positions),
        style,
        (next) => {
          syncPointCollection(collection, groupId, next, {
            color,
            outlineColor,
            pixelSize,
            outlineWidth: style.outlineWidth ?? 1,
          })
        },
      ),
    )
    return graphics
  }

  private createPolygonPrimitive(
    viewer: Viewer,
    options: {
      id: string
      cartesians: ReturnType<typeof toCartesian3Array>
      fill: Color
      outline: boolean
      outlineColor: Color
      outlineWidth: number
      onGround: boolean
      style: GraphicStyle
    },
  ): Graphic {
    const fillInstance = new GeometryInstance({
      geometry: new PolygonGeometry({
        polygonHierarchy: new PolygonHierarchy(options.cartesians),
        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        height: options.onGround ? undefined : 0,
      }),
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(options.fill),
      },
      id: graphicChildId(options.id, "fill"),
    })
    const fillPrimitive = options.onGround
      ? new GroundPrimitive({
          geometryInstances: fillInstance,
          appearance: new PerInstanceColorAppearance({
            translucent: true,
            flat: true,
          }),
        })
      : new Primitive({
          geometryInstances: fillInstance,
          appearance: new PerInstanceColorAppearance({
            translucent: true,
            flat: true,
          }),
        })
    viewer.scene.primitives.add(fillPrimitive)

    let outlinePrimitive: GroundPolylinePrimitive | Primitive | undefined
    if (options.outline) {
      const lineInstance = new GeometryInstance({
        geometry: options.onGround
          ? new GroundPolylineGeometry({
              positions: options.cartesians,
              width: options.outlineWidth,
            })
          : new PolylineGeometry({
              positions: options.cartesians,
              width: options.outlineWidth,
            }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(options.outlineColor),
        },
        id: graphicChildId(options.id, "outline"),
      })
      outlinePrimitive = options.onGround
        ? new GroundPolylinePrimitive({
            geometryInstances: lineInstance,
            appearance: new PerInstanceColorAppearance({
              flat: true,
              translucent: false,
            }),
          })
        : new Primitive({
            geometryInstances: lineInstance,
            appearance: new PerInstanceColorAppearance({
              flat: true,
              translucent: false,
            }),
          })
      viewer.scene.primitives.add(outlinePrimitive)
    }

    this.context.tracker.link(options.id, graphicChildId(options.id, "fill"))
    if (outlinePrimitive)
      this.context.tracker.link(
        options.id,
        graphicChildId(options.id, "outline"),
      )

    return this.register(
      options.id,
      "polygon",
      "primitive",
      { fillPrimitive, outlinePrimitive },
      () => {
        viewer.scene.primitives.remove(fillPrimitive)
        if (outlinePrimitive) viewer.scene.primitives.remove(outlinePrimitive)
        this.context.tracker.unlink(options.id)
      },
      (visible) => {
        fillPrimitive.show = visible
        if (outlinePrimitive) outlinePrimitive.show = visible
      },
      options.cartesians.map((item) => fromCartesian3(item)),
      options.style,
    )
  }

  private register(
    id: string,
    type: string,
    renderMode: ConcreteRenderMode,
    native: unknown,
    teardown: () => void,
    setVisible: (visible: boolean) => void,
    positions: LngLatHeight[] = [],
    style: GraphicStyle = {},
    applyPositions?: (positions: PositionInput[]) => void,
  ): Graphic {
    const graphic = new ManagedGraphic(
      id,
      type,
      renderMode,
      native,
      () => {
        teardown()
        this.items.delete(id)
        this.context.registry.unregister(id)
        this.context.events.emit("graphicRemoved", { id, type })
      },
      (visible) => {
        setVisible(visible)
      },
      positions,
      style,
      applyPositions,
      (reason) => this.invalidate(reason),
    )
    this.items.set(id, graphic)
    registerAtomically(this.context.registry, graphic, () => {
      this.items.delete(id)
      teardown()
    })
    this.context.events.emit("graphicAdded", { id, type })
    this.invalidate("graphic-added")
    return graphic
  }

  private invalidate(reason: string): void {
    this.context.engine.viewer.requestRender?.(reason)
  }
}
