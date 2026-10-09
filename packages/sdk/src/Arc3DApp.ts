import type { Arc3DConfig, Arc3DContext, CreditMode, EngineContext, Logger, Unsubscribe } from "@arc3dlab/core"
import { AnalysisManager } from "@arc3dlab/analysis"
import type { DataManager } from "@arc3dlab/data"
import { EffectsManager } from "@arc3dlab/effects"
import { GraphicManager } from "@arc3dlab/graphics"
import { InteractionManager } from "@arc3dlab/interaction"
import { BasemapManager, LayerManager, TerrainManager } from "@arc3dlab/layers"
import { CameraController, SceneController } from "@arc3dlab/scene"
import { UIManager } from "@arc3dlab/ui"

export interface NativeContext {
  viewer: unknown
}

export interface Arc3DPlugin {
  name: string
  install(app: Arc3DApp, context: Arc3DContext): void | Promise<void>
}

export class PluginManager {
  private plugins: Arc3DPlugin[] = []

  constructor(private readonly app: Arc3DApp, private readonly context: Arc3DContext) {}

  async use(plugin: Arc3DPlugin): Promise<void> {
    this.context.lifecycle.assertUsable("install plugin")
    await plugin.install(this.app, this.context)
    this.plugins.push(plugin)
  }

  list(): string[] {
    return this.plugins.map((plugin) => plugin.name)
  }
}

export class PerformanceManager {
  constructor(private readonly context: Arc3DContext) {}

  get fpsVisible(): boolean {
    return Boolean((this.context.engine.native.viewer as { scene: { debugShowFramesPerSecond: boolean } }).scene.debugShowFramesPerSecond)
  }

  setFpsVisible(visible: boolean): void {
    this.context.lifecycle.assertUsable("toggle fps")
    ;(this.context.engine.native.viewer as { scene: { debugShowFramesPerSecond: boolean } }).scene.debugShowFramesPerSecond = visible
  }
}

export class CreditFacade {
  constructor(private readonly context: Arc3DContext) {}

  setMode(mode: CreditMode, container?: Element): void {
    this.context.engine.viewer.setCreditMode(mode, container)
  }

  setContainer(element: Element): void {
    this.setMode("custom", element)
  }
}

export class Arc3DApp {
  readonly scene: SceneController
  readonly camera: CameraController
  readonly basemap: BasemapManager
  readonly terrain: TerrainManager
  readonly layers: LayerManager
  readonly graphics: GraphicManager
  readonly data: DataManager
  readonly interaction: InteractionManager
  readonly analysis: AnalysisManager
  readonly effects: EffectsManager
  readonly ui: UIManager
  readonly plugins: PluginManager
  readonly performance: PerformanceManager
  readonly credits: CreditFacade
  readonly logger: Logger
  readonly native: NativeContext

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

  on: Arc3DContext["events"]["on"] = (event, handler) => this.context.events.on(event, handler)

  async use(plugin: Arc3DPlugin): Promise<void> {
    await this.plugins.use(plugin)
  }

  async destroy(): Promise<void> {
    if (this.context.lifecycle.isDestroyed) return
    this.context.lifecycle.transition("destroying")
    this.ui.destroy()
    this.interaction.destroy()
    this.effects.destroy()
    this.analysis.destroy()
    this.graphics.clear()
    this.context.registry.clear()
    this.context.tracker.clear()
    this.context.engine.viewer.destroy()
    this.context.events.emit("destroy", {})
    this.context.events.clear()
    this.context.lifecycle.transition("destroyed")
  }
}

export function createApp(config: Arc3DConfig, engine: EngineContext, context: Arc3DContext): Arc3DApp {
  void config
  void engine
  const app = new Arc3DApp(context)
  context.lifecycle.transition("ready")
  context.events.emit("ready", {})
  return app
}

export type { Unsubscribe }
