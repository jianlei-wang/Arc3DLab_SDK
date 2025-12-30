import * as Cesium from "cesium"
import { CesiumEventEmitter } from "./EventEmitter"

//默认相机范围
Cesium.Camera.DEFAULT_VIEW_RECTANGLE = new Cesium.Rectangle(
  Cesium.Math.toRadians(70),
  Cesium.Math.toRadians(-15),
  Cesium.Math.toRadians(140),
  Cesium.Math.toRadians(80)
)

interface Option extends Cesium.Viewer.ConstructorOptions {
  allowCameraUnderground?: boolean
  asMapboxControl?: boolean
}

export class Viewer extends Cesium.Viewer {
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
      baseLayer: false,
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
      shadows: true, //阴影
      ...options,
    })
    this.initBaseConfig()
  }
  //常见基础设置
  private initBaseConfig() {
    //默认打开深度检测，那么在地形以下的对象不可见
    this.scene.globe.depthTestAgainstTerrain = true
    //全球光照
    this.scene.globe.enableLighting = true
    // 1.0代表真实时间速率，大于1则加速，小于1则减速
    this.clock.multiplier = 1
    //禁止相机进入地下 false允许，true禁止
    this.scene.screenSpaceCameraController.enableCollisionDetection = true
    //隐藏版本信息
    ;(this.cesiumWidget.creditContainer as any).style.display = "none"

    this.resolutionScale = window.devicePixelRatio //高分辨率设备适配
  }
}
