import {
  acquireContinuousRender,
  createId,
  type Arc3DContext,
} from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cartesian4,
  Color,
  DistanceDisplayCondition,
  EllipsoidSurfaceAppearance,
  GeometryInstance,
  GroundPrimitive,
  HeightReference,
  Material,
  Math as CesiumMath,
  Matrix4,
  PolygonGeometry,
  PolygonHierarchy,
  PostProcessStage,
  type Viewer,
} from "cesium"
import {
  DynamicSpreadMaterialProperty,
  PolylineTrailMaterialProperty,
  registerArc3DMaterials,
} from "@arc3dlab/effects"
import {
  RadarNormalMaterialProperty,
  registerRadarNormalMaterial,
} from "./materials"
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

function viewerOf(context: Arc3DContext): Viewer {
  return getCesiumViewer(context.engine.native.viewer) as Viewer
}

/**
 * 创建一个动态图形句柄，并将其销毁逻辑登记到上下文释放栈。
 * @param context - Arc3D 运行时上下文。
 * @param id - 图形标识。
 * @param native - 底层原生对象。
 * @param remove - 移除原生对象的回调。
 * @param animated - 是否为依赖逐帧推进的动画；为 true 时持有持续渲染需求，
 *   保证在静态场景下动画仍能刷新，销毁时自动释放。
 * @returns 动态图形句柄。
 */
function createHandle(
  context: Arc3DContext,
  id: string,
  native: unknown,
  remove: () => void,
  animated = false,
): DynamicGraphicHandle {
  let destroyed = false
  const releaseRender = animated
    ? acquireContinuousRender(context, `graphics:${id}`)
    : () => {}
  const release = context.disposers.push(() => {
    if (!destroyed) remove()
    releaseRender()
  })
  return {
    id,
    native,
    destroy(): void {
      if (destroyed) return
      destroyed = true
      releaseRender()
      release()
      remove()
    },
  }
}

/**
 * 添加随视距缩放的广告牌图标。
 * @param context - Arc3D 运行时上下文。
 * @param options - 广告牌配置。
 * @returns 动态图形句柄。
 */
export function addBillboard(
  context: Arc3DContext,
  options: BillboardOptions,
): DynamicGraphicHandle {
  const viewer = viewerOf(context)
  const id = options.id ?? createId("billboard")
  const entity = viewer.entities.add({
    id,
    position: toCartesian3(options.position),
    billboard: {
      image: options.image,
      scale: options.scale ?? 1,
      heightReference:
        options.clampToGround === false
          ? HeightReference.NONE
          : HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  return createHandle(context, id, entity, () => {
    if (viewer.entities) viewer.entities.remove(entity)
  })
}

/**
 * 添加带扩散动画的点符号。
 * @param context - Arc3D 运行时上下文。
 * @param options - 扩散点配置。
 * @returns 动态图形句柄。
 */
export function addSpreadPoint(
  context: Arc3DContext,
  options: SpreadPointOptions,
): DynamicGraphicHandle {
  registerArc3DMaterials()
  const viewer = viewerOf(context)
  const id = options.id ?? createId("spread")
  const entity = viewer.entities.add({
    id,
    position: toCartesian3(options.position),
    ellipse: {
      semiMajorAxis: options.radius,
      semiMinorAxis: options.radius,
      granularity: CesiumMath.RADIANS_PER_DEGREE / 3,
      material: new DynamicSpreadMaterialProperty({
        color: options.color ?? "#ff0000",
        duration: options.duration ?? 1000,
        gradient: options.gradient ?? 4,
      }),
      heightReference:
        options.onGround === false
          ? HeightReference.NONE
          : HeightReference.CLAMP_TO_GROUND,
    },
  })
  return createHandle(
    context,
    id,
    entity,
    () => {
      if (viewer.entities) viewer.entities.remove(entity)
    },
    true,
  )
}

/**
 * 添加雷达扫描符号。
 * @param context - Arc3D 运行时上下文。
 * @param options - 雷达配置。
 * @returns 动态图形句柄。
 */
export function addRadarNormal(
  context: Arc3DContext,
  options: RadarNormalOptions,
): DynamicGraphicHandle {
  registerRadarNormalMaterial()
  const viewer = viewerOf(context)
  const id = options.id ?? createId("radar")
  const entity = viewer.entities.add({
    id,
    position: toCartesian3(options.position),
    ellipse: {
      semiMajorAxis: options.radius,
      semiMinorAxis: options.radius,
      rotation: 0,
      granularity: CesiumMath.RADIANS_PER_DEGREE / 3,
      material: new RadarNormalMaterialProperty({
        color: options.color ?? "#ff0000",
        speed: options.speed ?? 15,
      }),
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  })
  return createHandle(
    context,
    id,
    entity,
    () => {
      if (viewer.entities) viewer.entities.remove(entity)
    },
    true,
  )
}

/**
 * 添加带动态水纹材质的水系面。
 * @param context - Arc3D 运行时上下文。
 * @param options - 水系配置。
 * @returns 动态图形句柄。
 */
export function addRiver(
  context: Arc3DContext,
  options: RiverOptions,
): DynamicGraphicHandle {
  const viewer = viewerOf(context)
  const id = options.id ?? createId("river")
  const positions = options.positions.map((input) => toCartesian3(input))
  const uniforms: Record<string, unknown> = {
    blendColor: new Color(1, 0, 0, 0.3),
    frequency: 200,
    animationSpeed: 0.01,
    amplitude: 10,
  }
  if (options.image) uniforms.normalMap = options.image
  const primitive = new GroundPrimitive({
    allowPicking: false,
    asynchronous: true,
    geometryInstances: new GeometryInstance({
      id,
      geometry: new PolygonGeometry({
        polygonHierarchy: new PolygonHierarchy(positions),
        vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT,
      }),
    }),
    appearance: new EllipsoidSurfaceAppearance({
      aboveGround: true,
      material: new Material({
        fabric: { type: "Water", uniforms },
      }),
    }),
  })
  viewer.scene.primitives.add(primitive)
  return createHandle(
    context,
    id,
    primitive,
    () => {
      if (viewer.scene?.primitives) viewer.scene.primitives.remove(primitive)
    },
    true,
  )
}

/**
 * 添加圆形扩散动画扫描对象。
 * @param context - Arc3D 运行时上下文。
 * @param options - 圆形扩散配置。
 * @returns 动态图形句柄。
 */
export function addCircleDiffusion(
  context: Arc3DContext,
  options: CircleDiffusionOptions,
): DynamicGraphicHandle {
  const viewer = viewerOf(context)
  const id = options.id ?? createId("diffusion")
  const center = toCartesian3(options.position)
  const carto = Cartographic.fromCartesian(center)
  const center1 = Cartographic.toCartesian(
    new Cartographic(carto.longitude, carto.latitude, carto.height + 500),
  )
  const center4 = new Cartesian4(center.x, center.y, center.z, 1)
  const center14 = new Cartesian4(center1.x, center1.y, center1.z, 1)
  const scratch = new Cartesian4()
  const scratch1 = new Cartesian4()
  const normal = new Cartesian3()
  const stage = new PostProcessStage({
    fragmentShader: CIRCLE_DIFFUSION_SHADER,
    uniforms: {
      u_scanCenterEC: () =>
        Matrix4.multiplyByVector(viewer.camera.viewMatrix, center4, scratch),
      u_scanPlaneNormalEC: () => {
        const a = Matrix4.multiplyByVector(
          viewer.camera.viewMatrix,
          center4,
          scratch,
        )
        const b = Matrix4.multiplyByVector(
          viewer.camera.viewMatrix,
          center14,
          scratch1,
        )
        normal.x = b.x - a.x
        normal.y = b.y - a.y
        normal.z = b.z - a.z
        Cartesian3.normalize(normal, normal)
        return normal
      },
      u_radius: options.radius,
      u_scanColor:
        Color.fromCssColorString(options.color ?? "rgba(255,255,0,0.4)") ??
        Color.YELLOW,
    },
  })
  viewer.scene.postProcessStages.add(stage)
  return createHandle(
    context,
    id,
    stage,
    () => {
      if (viewer.scene?.postProcessStages)
        viewer.scene.postProcessStages.remove(stage)
    },
    true,
  )
}

/**
 * 添加按时间流动的动态折线。
 * @param context - Arc3D 运行时上下文。
 * @param options - 动态折线配置。
 * @returns 动态图形句柄。
 */
export function addDynamicPolyline(
  context: Arc3DContext,
  options: DynamicPolylineOptions,
): DynamicGraphicHandle {
  registerArc3DMaterials()
  const viewer = viewerOf(context)
  const id = options.id ?? createId("polyline")
  const entity = viewer.entities.add({
    id,
    polyline: {
      positions: options.positions.map((input) => toCartesian3(input)),
      width: options.width ?? 6,
      clampToGround: true,
      material: new PolylineTrailMaterialProperty({
        color: options.color ?? "#00ff00",
        duration: options.duration ?? 2000,
      }),
    },
  })
  return createHandle(
    context,
    id,
    entity,
    () => {
      if (viewer.entities) viewer.entities.remove(entity)
    },
    true,
  )
}

/**
 * 添加随视距显隐的热点面板。
 * @param context - Arc3D 运行时上下文。
 * @param options - 面板配置。
 * @returns 动态图形句柄。
 */
export function addPanel(
  context: Arc3DContext,
  options: PanelOptions,
): DynamicGraphicHandle {
  const viewer = viewerOf(context)
  const id = options.id ?? createId("panel")
  const color = options.type === "process" ? Color.ORANGE : Color.RED
  const entity = viewer.entities.add({
    id,
    position: toCartesian3(options.position),
    point: {
      color: color.withAlpha(0.5),
      pixelSize: 10,
      distanceDisplayCondition: new DistanceDisplayCondition(
        options.near ?? 100,
        options.far ?? 100000,
      ),
      disableDepthTestDistance: 100000,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: options.text,
      font: "14px sans-serif",
      pixelOffset: new Cartesian2(0, -24),
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: color.withAlpha(0.6),
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  })
  return createHandle(context, id, entity, () => {
    if (viewer.entities) viewer.entities.remove(entity)
  })
}

const CIRCLE_DIFFUSION_SHADER = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
in vec2 v_textureCoordinates;
uniform vec4 u_scanCenterEC;
uniform vec3 u_scanPlaneNormalEC;
uniform float u_radius;
uniform vec4 u_scanColor;
vec4 toEye(in vec2 uv, in float depth){
  vec2 xy = vec2((uv.x * 2.0 - 1.0),(uv.y * 2.0 - 1.0));
  vec4 posInCamera = czm_inverseProjection * vec4(xy, depth, 1.0);
  posInCamera = posInCamera / posInCamera.w;
  return posInCamera;
}
vec3 pointProjectOnPlane(in vec3 planeNormal, in vec3 planeOrigin, in vec3 point){
  vec3 v01 = point - planeOrigin;
  float d = dot(planeNormal, v01);
  return (point - planeNormal * d);
}
float getDepth(in vec4 depth){
  float z_window = czm_unpackDepth(depth);
  z_window = czm_reverseLogDepth(z_window);
  float n_range = czm_depthRange.near;
  float f_range = czm_depthRange.far;
  return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
}
void main(){
  out_FragColor = texture(colorTexture, v_textureCoordinates);
  float depth = getDepth(texture(depthTexture, v_textureCoordinates));
  vec4 viewPos = toEye(v_textureCoordinates, depth);
  vec3 scanCenterEC = u_scanCenterEC.xyz + vec3(cos(czm_frameNumber * 0.05) * 300.0, sin(czm_frameNumber * 0.05) * 300.0, sin(czm_frameNumber * 0.01) * 300.0);
  vec3 prjOnPlane = pointProjectOnPlane(u_scanPlaneNormalEC.xyz, scanCenterEC.xyz, viewPos.xyz);
  float dis = length(prjOnPlane.xyz - scanCenterEC.xyz);
  if(dis < u_radius){
    out_FragColor += pow(150.0/max(dis,150.0),2.0) * u_scanColor;
  }
}
`
