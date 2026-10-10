import {
  Arc3DError,
  assertGraphicStyle,
  assertNewResourceId,
  assertPositions,
  createId,
  registerAtomically,
  type Arc3DContext,
  type GraphicStyle,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import {
  fromCartesian3,
  getCesiumViewer,
  toCartesian3,
  toCartesian3Array,
} from "@arc3dlab/engine-cesium"
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
import { applyPositionUpdates } from "./pool"
import { asList, parseColor, toLngLatHeights } from "./helpers"
import { syncPointCollection } from "./points"
import { ManagedGraphic } from "./managed-graphic"
import type { Graphic, GraphicCreateOptions, ModelCreateOptions } from "./types"

/**
 * 图形管理器，负责各种图形的创建、查询、可见性控制、批量更新与销毁。
 */
export class GraphicManager {
  private items = new Map<string, Graphic>()

  /**
   * 创建图形管理器。
   * @param context - Arc3D 运行时上下文。
   */
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

  /**
   * 添加单个点图形。
   * @param options - 点图形创建选项。
   * @returns 新建的点图形。
   */
  addPoint(options: GraphicCreateOptions): Graphic {
    const positions = asList(options.positions)
    return this.createPoints(positions, options)[0]
  }

  /**
   * 批量添加点图形。
   * @param options - 点图形创建选项，positions 为坐标数组。
   * @returns 新建的点图形数组。
   */
  addPoints(options: GraphicCreateOptions): Graphic[] {
    return this.createPoints(asList(options.positions), options)
  }

  /**
   * 添加一个折线图形。
   * @param options - 折线图形创建选项。
   * @returns 新建的折线图形。
   */
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

  /**
   * 添加一个多边形图形。
   * @param options - 多边形图形创建选项。
   * @returns 新建的多边形图形。
   */
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

  /**
   * 添加一个模型图形。
   * @param options - 模型图形创建选项。
   * @returns 新建的模型图形。
   */
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

  /**
   * 根据 ID 获取图形。
   * @param id - 图形 ID。
   * @returns 对应的图形，未找到时返回 undefined。
   */
  get(id: string): Graphic | undefined {
    return this.items.get(id)
  }

  /**
   * 移除指定图形。
   * @param id - 图形 ID。
   * @returns 图形存在并被移除时返回 true。
   */
  remove(id: string): boolean {
    const graphic = this.items.get(id)
    if (!graphic) return false
    graphic.destroy()
    return true
  }

  /**
   * 设置指定图形的可见性。
   * @param id - 图形 ID。
   * @param visible - 是否可见。
   * @returns 图形存在并设置成功时返回 true。
   */
  show(id: string, visible: boolean): boolean {
    const graphic = this.items.get(id)
    if (!graphic) return false
    graphic.visible = visible
    return true
  }

  /**
   * 列出全部图形。
   * @returns 当前管理的所有图形数组。
   */
  list(): Graphic[] {
    return Array.from(this.items.values())
  }

  /**
   * 批量添加折线图形，并按整体数量统一选择渲染模式。
   * @param items - 折线图形创建选项数组。
   * @returns 新建的折线图形数组。
   */
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

  /**
   * 批量添加多边形图形，并按整体数量统一选择渲染模式。
   * @param items - 多边形图形创建选项数组。
   * @returns 新建的多边形图形数组。
   */
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

  /**
   * 批量移除图形。
   * @param ids - 待移除的图形 ID 数组。
   * @returns 实际移除的图形数量。
   */
  removeMany(ids: string[]): number {
    let removed = 0
    for (const id of ids) {
      if (this.remove(id)) removed += 1
    }
    return removed
  }

  /**
   * 批量设置图形可见性。
   * @param ids - 目标图形 ID 数组。
   * @param visible - 是否可见。
   * @returns 实际更新成功的图形数量。
   */
  showMany(ids: string[], visible: boolean): number {
    let updated = 0
    for (const id of ids) {
      if (this.show(id, visible)) updated += 1
    }
    return updated
  }

  /**
   * 批量更新图形坐标。
   * @param updates - 包含图形 ID 与新坐标的更新列表。
   * @returns 实际更新成功的图形数量。
   */
  updatePositionsBatch(
    updates: Array<{ id: string; positions: PositionInput | PositionInput[] }>,
  ): number {
    this.context.lifecycle.assertUsable("update graphic positions")
    return applyPositionUpdates((id) => this.items.get(id), updates)
  }

  /**
   * 销毁并清空所有图形。
   */
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
