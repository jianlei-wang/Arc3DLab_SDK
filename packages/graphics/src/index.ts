import {
  createId,
  type Arc3DContext,
  type GraphicStyle,
  type PositionInput,
  type RenderMode,
  type ResourceHandle,
} from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3, toCartesian3Array } from "@arc3dlab/engine-cesium"
import {
  Color,
  ColorGeometryInstanceAttribute,
  Entity,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  HeightReference,
  PerInstanceColorAppearance,
  PointPrimitiveCollection,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  Primitive,
  type Viewer,
} from "cesium"

export interface Graphic extends ResourceHandle {
  readonly renderMode: Exclude<RenderMode, "auto">
  setStyle(style: GraphicStyle): void
  remove(): void
}

export interface GraphicCreateOptions {
  id?: string
  positions: PositionInput | PositionInput[]
  style?: GraphicStyle
  renderMode?: RenderMode
  properties?: Record<string, unknown>
}

function parseColor(value: string | undefined, fallback: string): Color {
  return Color.fromCssColorString(value ?? fallback)
}

function decideMode(mode: RenderMode | undefined, count: number): Exclude<RenderMode, "auto" | "buffer"> {
  if (mode === "entity" || mode === "primitive") return mode
  return count > 64 ? "primitive" : "entity"
}

function asList(positions: PositionInput | PositionInput[]): PositionInput[] {
  if (Array.isArray(positions) && positions.length > 0 && (Array.isArray(positions[0]) || typeof (positions[0] as PositionInput & { longitude?: number }).longitude === "number")) {
    return positions as PositionInput[]
  }
  return [positions as PositionInput]
}

class ManagedGraphic implements Graphic {
  owned = true
  native: unknown

  constructor(
    readonly id: string,
    readonly type: string,
    readonly renderMode: Exclude<RenderMode, "auto">,
    native: unknown,
    private readonly teardown: () => void,
    private readonly setVisible: (visible: boolean) => void,
    private readonly applyStyle: (style: GraphicStyle) => void
  ) {
    this.native = native
  }

  private _visible = true

  get visible(): boolean {
    return this._visible
  }

  set visible(value: boolean) {
    this._visible = value
    this.setVisible(value)
  }

  setStyle(style: GraphicStyle): void {
    this.applyStyle(style)
  }

  remove(): void {
    this.destroy()
  }

  destroy(): void {
    this.teardown()
  }
}

export class GraphicManager {
  private items = new Map<string, Graphic>()

  constructor(private readonly context: Arc3DContext) {}

  addPoint(options: GraphicCreateOptions): Graphic {
    const positions = asList(options.positions)
    return this.createPoints(positions, options)[0]
  }

  addPoints(options: GraphicCreateOptions): Graphic[] {
    return this.createPoints(asList(options.positions), options)
  }

  addPolyline(options: GraphicCreateOptions): Graphic {
    this.context.lifecycle.assertUsable("add polyline")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = options.id ?? createId("polyline")
    const cartesians = toCartesian3Array(asList(options.positions))
    const style = options.style ?? {}
    const onGround = style.clampToGround ?? true
    const mode = decideMode(options.renderMode, 1)
    const color = parseColor(style.color ?? style.fill, "#ff0f40")
    const width = style.width ?? 2

    let native: unknown
    let teardown: () => void
    let setVisible: (visible: boolean) => void

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
            appearance: new PerInstanceColorAppearance({ flat: true, translucent: color.alpha < 1 }),
          })
        : new Primitive({
            geometryInstances: instance,
            appearance: new PerInstanceColorAppearance({ flat: true, translucent: color.alpha < 1 }),
          })
      viewer.scene.primitives.add(primitive)
      native = primitive
      teardown = () => viewer.scene.primitives.remove(primitive)
      setVisible = (visible) => {
        primitive.show = visible
      }
    }

    return this.register(id, "polyline", mode, native, teardown, setVisible)
  }

  addPolygon(options: GraphicCreateOptions): Graphic {
    this.context.lifecycle.assertUsable("add polygon")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = options.id ?? createId("polygon")
    const cartesians = toCartesian3Array(asList(options.positions))
    const style = options.style ?? {}
    const onGround = style.clampToGround ?? true
    const mode = decideMode(options.renderMode, 1)
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
          heightReference: onGround ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
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
        }
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
    })
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

  clear(): void {
    for (const graphic of Array.from(this.items.values())) graphic.destroy()
  }

  private createPoints(positions: PositionInput[], options: GraphicCreateOptions): Graphic[] {
    this.context.lifecycle.assertUsable("add point")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const mode = decideMode(options.renderMode, positions.length)
    const style = options.style ?? {}
    const color = parseColor(style.color ?? style.fill, "#ff0000")
    const outlineColor = parseColor(style.outlineColor, "#ffff00")
    const pixelSize = style.pixelSize ?? 10
    const onGround = style.clampToGround ?? true
    const graphics: Graphic[] = []

    if (mode === "entity") {
      positions.forEach((position, index) => {
        const id = options.id && positions.length === 1 ? options.id : createId("point")
        const entity = viewer.entities.add({
          id,
          position: toCartesian3(position),
          point: {
            color,
            outlineColor,
            pixelSize,
            outlineWidth: style.outlineWidth ?? 1,
            heightReference: onGround ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
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
            }
          )
        )
        void index
      })
      return graphics
    }

    const collection = new PointPrimitiveCollection()
    viewer.scene.primitives.add(collection)
    const groupId = options.id ?? createId("points")
    positions.forEach((position) => {
      collection.add({
        id: createId("point"),
        position: toCartesian3(position),
        color,
        outlineColor,
        pixelSize,
        outlineWidth: style.outlineWidth ?? 1,
        show: true,
      })
    })
    graphics.push(
      this.register(
        groupId,
        "point",
        mode,
        collection,
        () => viewer.scene.primitives.remove(collection),
        (visible) => {
          collection.show = visible
        }
      )
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
    }
  ): Graphic {
    const fillInstance = new GeometryInstance({
      geometry: new PolygonGeometry({
        polygonHierarchy: new PolygonHierarchy(options.cartesians),
        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        height: options.onGround ? undefined : 0,
      }),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(options.fill) },
      id: `${options.id}#fill`,
    })
    const fillPrimitive = options.onGround
      ? new GroundPrimitive({
          geometryInstances: fillInstance,
          appearance: new PerInstanceColorAppearance({ translucent: true, flat: true }),
        })
      : new Primitive({
          geometryInstances: fillInstance,
          appearance: new PerInstanceColorAppearance({ translucent: true, flat: true }),
        })
    viewer.scene.primitives.add(fillPrimitive)

    let outlinePrimitive: GroundPolylinePrimitive | Primitive | undefined
    if (options.outline) {
      const lineInstance = new GeometryInstance({
        geometry: options.onGround
          ? new GroundPolylineGeometry({ positions: options.cartesians, width: options.outlineWidth })
          : new PolylineGeometry({ positions: options.cartesians, width: options.outlineWidth }),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(options.outlineColor) },
        id: `${options.id}#outline`,
      })
      outlinePrimitive = options.onGround
        ? new GroundPolylinePrimitive({
            geometryInstances: lineInstance,
            appearance: new PerInstanceColorAppearance({ flat: true, translucent: false }),
          })
        : new Primitive({
            geometryInstances: lineInstance,
            appearance: new PerInstanceColorAppearance({ flat: true, translucent: false }),
          })
      viewer.scene.primitives.add(outlinePrimitive)
    }

    this.context.tracker.link(options.id, `${options.id}#fill`)
    if (outlinePrimitive) this.context.tracker.link(options.id, `${options.id}#outline`)

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
      }
    )
  }

  private register(
    id: string,
    type: string,
    renderMode: Exclude<RenderMode, "auto">,
    native: unknown,
    teardown: () => void,
    setVisible: (visible: boolean) => void
  ): Graphic {
    if (this.items.has(id)) this.remove(id)
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
      () => undefined
    )
    this.items.set(id, graphic)
    this.context.registry.add(graphic)
    this.context.events.emit("graphicAdded", { id, type })
    return graphic
  }
}
