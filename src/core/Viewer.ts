import * as Cesium from "cesium"
import EventEmitter from "./EventEmitter"
import BaseLayer from "./layers/BaseLayer"
import { mapImg, mapSize } from "src/utils/Scene"
import { CesiumIcon } from "src/utils/def/Default"
import Terrain from "./Terrain"
import ReminderTip from "./PopupTip/ReminderTip"
import Layers from "./Layers"

/**
 * 设置 Cesium 应用的默认相机视图矩形。
 * 这定义了相机重置时显示的默认地理范围。
 */
Cesium.Camera.DEFAULT_VIEW_RECTANGLE = new Cesium.Rectangle(
  Cesium.Math.toRadians(70),
  Cesium.Math.toRadians(-15),
  Cesium.Math.toRadians(140),
  Cesium.Math.toRadians(80)
)

/**
 * Viewer 类的配置选项
 * @interface Option
 * @extends Cesium.Viewer.ConstructorOptions
 */
export interface Option extends Cesium.Viewer.ConstructorOptions {
  defaultKey?: string
  fpsShow?: boolean
  /** 是否使用 Mapbox 风格的控件 */
  mapboxController?: boolean
}

/**
 * 为 WebGIS 应用预配置设置的增强型 Cesium Viewer。
 * 此类扩展了标准 Cesium Viewer，具有针对 3D 地理空间可视化优化的默认设置。
 *
 * @class Viewer
 * @extends Cesium.Viewer
 * @example
 * ```typescript
 * import { Viewer } from "arc3dlab";
 * const viewer = new Viewer("containerId");
 * ```
 */
export class Viewer extends Cesium.Viewer {
  /**
   * Cesium事件发射器实例
   * @type {EventEmitter}
   */
  public EventHandler: EventEmitter = new EventEmitter(this)

  /**
   * 地形主类，地形相关方法
   * @type {Terrain}
   */
  public Terrain: Terrain = new Terrain(this)

  /**
   * 鼠标提示主类
   * @type {ReminderTip}
   */
  public ReminderTip: ReminderTip = new ReminderTip(this)

  /**
   * 图层管理类
   * @type {Layers}
   */
  public Layers: Layers = new Layers(this)

  /**
   * 创建具有优化默认设置的 Viewer 实例
   *
   * @param container - 将创建查看器的 DOM 元素或 ID
   * @param options - 可选的配置选项
   */
  constructor(container: Element | string, public options?: Option) {
    //设置初始化默认参数
    super(container, {
      //是否创建动画小器件，左下角仪表
      animation: false,
      //是否显示全屏按钮
      fullscreenButton: false,
      //放大镜图标，查找位置工具，查找到之后会将镜头对准找到的地址，默认使用bing地图
      geocoder: false,
      //房子图标，是否显示Home按钮，视角返回初始位置
      homeButton: false,
      //是否显示信息框
      infoBox: false,
      //经纬网图标，选择视角的模式，有三种：3D，2D，哥伦布视图（2.5D)，是否显示3D/2D选择器
      sceneModePicker: false,
      //是否显示时间轴
      timeline: false,
      //设定3维地图的默认场景模式:Cesium.SceneMode.SCENE2D、Cesium.SceneMode.SCENE3D、Cesium.SceneMode.MORPHING
      sceneMode: Cesium.SceneMode.SCENE3D,
      //如果设置为true，则所有几何图形以3D模式绘制以节约GPU资源
      scene3DOnly: true,
      //是否显示图层选择器，可选择要显示的地图服务和地形服务
      baseLayerPicker: false,
      //问号图标，右上角导航帮助按钮，显示默认的地图控制帮助
      navigationHelpButton: false,
      //虚拟现实
      vrButton: false,
      //是否显示选取指示器组件[绿框]
      selectionIndicator: false,
      //设置背景透明,涉及透贴显示
      orderIndependentTranslucency: true,
      //开启时间动画
      shouldAnimate: true,
      //关闭默认底图以支持离线使用
      baseLayer: BaseLayer.DefaultSingleImg,

      contextOptions: {
        webgl: {
          preserveDrawingBuffer: false, //保留绘图缓冲区：通过canvas截图需要将该项设置为true
          failIfMajorPerformanceCaveat: true, //防止在性能不佳的设备上运行
          antialias: true, //抗锯齿,
          alpha: true, //透明度支持
          powerPreference: "high-performance", //cpu偏好：优先使用高性能cpu,
        },
        requestWebgl1: false,
      },
      shadows: false, //阴影
      ...options,
    })
    this.initBaseConfig()
    console.log("Viewer initialized", new Date())
  }
  //常见基础设置
  private initBaseConfig() {
    // Cesium Icon资源key
    Cesium.Ion.defaultAccessToken = this.options?.defaultKey || CesiumIcon

    //默认打开深度检测，那么在地形以下的对象不可见
    this.scene.globe.depthTestAgainstTerrain = true
    // 1.0代表真实时间速率，大于1则加速，小于1则减速
    this.clock.multiplier = 1
    //禁止相机进入地下 false允许，true禁止
    this.scene.screenSpaceCameraController.enableCollisionDetection = true
    //隐藏版本信息
    ;(this.cesiumWidget.creditContainer as any).style.display = "none"

    this.resolutionScale = window.devicePixelRatio //高分辨率设备适配
    // Mapbox控制模式
    if (this.options?.mapboxController) {
      // 设置中键用于缩放
      this.scene.screenSpaceCameraController.zoomEventTypes = [
        Cesium.CameraEventType.WHEEL, // 保留滚轮缩放
        Cesium.CameraEventType.MIDDLE_DRAG, // 添加中键拖动缩放
        Cesium.CameraEventType.PINCH, // 保留多点触控缩放
      ]
      //设置右键旋转
      this.scene.screenSpaceCameraController.tiltEventTypes = [
        Cesium.CameraEventType.RIGHT_DRAG,
        Cesium.CameraEventType.PINCH,
        {
          eventType: Cesium.CameraEventType.RIGHT_DRAG,
          modifier: Cesium.KeyboardEventModifier.CTRL,
        },

        {
          eventType: Cesium.CameraEventType.MIDDLE_DRAG,
          modifier: Cesium.KeyboardEventModifier.CTRL,
        },
      ]
    }
    // 显示帧率
    this.scene.debugShowFramesPerSecond = this.options?.fpsShow || false
  }

  /**
   * 控制帧率显示
   * @type {Boolean}
   */
  get fps() {
    return this.scene.debugShowFramesPerSecond
  }
  set fps(show: boolean) {
    this.scene.debugShowFramesPerSecond = show // 显示帧率
  }

  /**
   * 地球光源阴影
   * @type {Boolean}
   */
  set lightShadow(bool: boolean) {
    this.scene.globe.enableLighting = bool
    this.shadows = bool
  }

  /**
   * 地图画布大小，例如：{width:1920,height:1080}
   * @type {Object}
   * @readonly
   */
  get size() {
    return mapSize(this)
  }

  /**
   * 当前地图场景图片，base64格式
   * @type {String}
   * @readonly
   */
  get image() {
    return mapImg(this)
  }

  /**
   * 场景底图
   * Cesium机制是最底层的图层为_isBaseLayer，通过lowerToBottom来控制
   * @type {Cesium.ImageryLayer} imagery 参考Cesium的ImageryLayer
   */
  get baseImagery() {
    //@ts-ignore
    const layers = this.imageryLayers._layers
    const baseLayer = layers.find((layer: any) => layer._isBaseLayer)
    return baseLayer
  }
  set baseImagery(imagery: Cesium.ImageryLayer) {
    //@ts-ignore
    const baseLayer = this.imageryLayers._layers.find(
      (layer: any) => layer._isBaseLayer
    )
    baseLayer && this.imageryLayers.remove(baseLayer)
    this.imageryLayers.lowerToBottom(imagery)
  }
}
