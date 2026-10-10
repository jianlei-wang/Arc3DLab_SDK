import {
  getRuntimeDiagnostics,
  type Arc3DConfig,
  type Arc3DContext,
  type CreditMode,
  type EngineContext,
  type Logger,
  type RuntimeDiagnostics,
  type Unsubscribe,
} from "@arc3dlab/core"
import { AnalysisManager } from "@arc3dlab/analysis"
import type { DataManager } from "@arc3dlab/data"
import { EffectsManager } from "@arc3dlab/effects"
import { GraphicManager } from "@arc3dlab/graphics"
import { InteractionManager } from "@arc3dlab/interaction"
import { BasemapManager, LayerManager, TerrainManager } from "@arc3dlab/layers"
import { CameraController, SceneController } from "@arc3dlab/scene"
import { UIManager } from "@arc3dlab/ui"
import { PluginManager, type Arc3DPlugin } from "./plugins"

/** 原生引擎上下文；advanced / unstable，不纳入 SemVer 保证。 */
export interface NativeContext {
  /** 原生引擎句柄；advanced / unstable，随引擎版本变化，不纳入 SemVer 保证。 */
  viewer: unknown
}

export type { Arc3DPlugin }
export { PluginManager }

/** 性能相关的运行时开关。 */
export class PerformanceManager {
  constructor(private readonly context: Arc3DContext) {}

  /** 是否显示帧率调试信息。 */
  get fpsVisible(): boolean {
    return Boolean(
      (
        this.context.engine.native.viewer as {
          scene: { debugShowFramesPerSecond: boolean }
        }
      ).scene.debugShowFramesPerSecond,
    )
  }

  /**
   * 切换帧率调试信息的显示。
   *
   * @param visible - 为 `true` 时显示帧率，为 `false` 时隐藏。
   */
  setFpsVisible(visible: boolean): void {
    this.context.lifecycle.assertUsable("toggle fps")
    ;(
      this.context.engine.native.viewer as {
        scene: { debugShowFramesPerSecond: boolean }
      }
    ).scene.debugShowFramesPerSecond = visible
  }
}

/** Credits 展示门面，用于切换合规标识的展示模式与容器。 */
export class CreditFacade {
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 设置 Credits 展示模式。
   *
   * @param mode - 展示模式。
   * @param container - 自定义容器，仅在 `mode` 为 `custom` 时使用。
   */
  setMode(mode: CreditMode, container?: Element): void {
    this.context.engine.viewer.setCreditMode(mode, container)
  }

  /**
   * 将 Credits 渲染到指定容器。
   *
   * @param element - 目标容器元素。
   */
  setContainer(element: Element): void {
    this.setMode("custom", element)
  }
}

/**
 * Arc3D 运行时门面，聚合全部功能域管理器。
 *
 * 由 {@link Arc3D.create} 创建，代表已接线的运行时；通过各只读属性访问场景、图层、
 * 图形、数据、分析与效果等能力。调用 {@link Arc3DApp.destroy} 释放全部原生资源。
 */
export class Arc3DApp {
  /** 场景控制器。 */
  readonly scene: SceneController
  /** 相机控制器。 */
  readonly camera: CameraController
  /** 底图管理器。 */
  readonly basemap: BasemapManager
  /** 地形管理器。 */
  readonly terrain: TerrainManager
  /** 图层管理器。 */
  readonly layers: LayerManager
  /** 图形管理器。 */
  readonly graphics: GraphicManager
  /** 数据管理器。 */
  readonly data: DataManager
  /** 拾取与交互管理器。 */
  readonly interaction: InteractionManager
  /** 分析管理器。 */
  readonly analysis: AnalysisManager
  /** 效果管理器。 */
  readonly effects: EffectsManager
  /** UI 管理器。 */
  readonly ui: UIManager
  /** 插件管理器。 */
  readonly plugins: PluginManager<Arc3DApp>
  /** 性能管理门面。 */
  readonly performance: PerformanceManager
  /** Credits 管理门面。 */
  readonly credits: CreditFacade
  /** 日志器。 */
  readonly logger: Logger
  /** 原生引擎上下文；advanced / unstable。 */
  readonly native: NativeContext
  private destroyTask: Promise<void> | undefined

  /**
   * 使用已接线的上下文构造运行时门面。
   *
   * @param context - Arc3D 运行时上下文；通常在 {@link Arc3D.create} 内部创建。
   */
  constructor(readonly context: Arc3DContext) {
    this.scene = new SceneController(context)
    this.camera = this.scene.camera
    this.basemap = new BasemapManager(context)
    this.terrain = new TerrainManager(context)
    this.layers = new LayerManager(context)
    this.graphics = new GraphicManager(context)
    this.data = this.layers.data
    this.interaction = new InteractionManager(context)
    this.analysis = new AnalysisManager(context)
    this.effects = new EffectsManager(context)
    this.ui = new UIManager(context)
    this.plugins = new PluginManager(this, context)
    this.performance = new PerformanceManager(context)
    this.credits = new CreditFacade(context)
    this.logger = context.logger
    this.native = context.engine.native
    this.camera.rememberHome()
  }

  /**
   * 订阅运行时事件。
   *
   * @param event - 事件名称，见 `Arc3DEvents`。
   * @param handler - 事件处理函数。
   * @returns 取消订阅的函数。
   */
  on: Arc3DContext["events"]["on"] = (event, handler) =>
    this.context.events.on(event, handler)

  /**
   * 安装并启动一个插件。
   *
   * @param plugin - 插件定义。
   */
  async use(plugin: Arc3DPlugin<Arc3DApp>): Promise<void> {
    await this.plugins.use(plugin)
  }

  /**
   * 获取运行时诊断快照。
   *
   * @returns 运行时诊断信息，含后处理阶段数量与已安装插件名。
   */
  getDiagnostics(): RuntimeDiagnostics & {
    postprocess: number
    plugins: string[]
  } {
    return {
      ...getRuntimeDiagnostics(this.context),
      postprocess: this.effects.postprocess.list().length,
      plugins: this.plugins.list(),
    }
  }

  /**
   * 销毁运行时并释放全部原生资源。
   *
   * 该方法是幂等的：重复调用返回同一个销毁 Promise。销毁后运行时不可再使用。
   */
  async destroy(): Promise<void> {
    if (this.context.lifecycle.current === "destroyed") return
    if (this.destroyTask) return this.destroyTask
    this.destroyTask = this.performDestroy()
    return this.destroyTask
  }

  private async performDestroy(): Promise<void> {
    if (this.context.lifecycle.current !== "destroying") {
      this.context.lifecycle.transition("destroying")
    }
    await this.plugins.destroy()
    await this.context.disposers.disposeAll((error) => {
      this.logger.error("Disposer failed during destroy", error)
    })
    await this.runDestroyStep("ui", () => this.ui.destroy())
    await this.runDestroyStep("interaction", () => this.interaction.destroy())
    await this.runDestroyStep("effects", () => this.effects.destroy())
    await this.runDestroyStep("analysis", () => this.analysis.destroy())
    await this.runDestroyStep("scene", () => this.scene.destroy())
    await this.runDestroyStep("graphics", () => this.graphics.clear())
    await this.runDestroyStep("registry", () =>
      this.context.registry.clear(this.context.tracker),
    )
    await this.runDestroyStep("tracker", () => this.context.tracker.clear())
    await this.runDestroyStep("engine", () => {
      if (this.context.engineAdapter) {
        this.context.engineAdapter.destroy()
      } else {
        this.context.engine.viewer.destroy()
      }
    })
    this.context.events.emit("destroy", {})
    this.context.events.clear()
    this.context.lifecycle.transition("destroyed")
  }

  private async runDestroyStep(
    label: string,
    step: () => void | Promise<void>,
  ): Promise<void> {
    try {
      await step()
    } catch (error) {
      this.logger.error(`Destroy step failed: ${label}`, error)
    }
  }
}

/**
 * 使用已创建的上下文组装运行时门面，并把生命周期推进到 `ready`。
 *
 * @param config - 运行时配置。
 * @param engine - 引擎上下文。
 * @param context - 已接线的运行时上下文。
 * @returns 就绪的 {@link Arc3DApp} 实例。
 */
export function createApp(
  config: Arc3DConfig,
  engine: EngineContext,
  context: Arc3DContext,
): Arc3DApp {
  void config
  void engine
  const app = new Arc3DApp(context)
  if (context.lifecycle.current === "created") {
    context.lifecycle.transition("initializing")
  }
  context.lifecycle.transition("ready")
  context.events.emit("ready", {})
  return app
}

export type { Unsubscribe }
