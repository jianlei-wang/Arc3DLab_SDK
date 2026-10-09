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

export interface NativeContext {
  viewer: unknown
}

export type { Arc3DPlugin }
export { PluginManager }

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
  readonly plugins: PluginManager<Arc3DApp>
  readonly performance: PerformanceManager
  readonly credits: CreditFacade
  readonly logger: Logger
  readonly native: NativeContext
  private destroyTask: Promise<void> | undefined

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

  async use(plugin: Arc3DPlugin<Arc3DApp>): Promise<void> {
    await this.plugins.use(plugin)
  }

  getDiagnostics(): RuntimeDiagnostics & { postprocess: number; plugins: string[] } {
    return {
      ...getRuntimeDiagnostics(this.context),
      postprocess: this.effects.postprocess.list().length,
      plugins: this.plugins.list(),
    }
  }

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
    await this.runDestroyStep("registry", () => this.context.registry.clear(this.context.tracker))
    await this.runDestroyStep("tracker", () => this.context.tracker.clear())
    await this.runDestroyStep("engine", () => this.context.engine.viewer.destroy())
    this.context.events.emit("destroy", {})
    this.context.events.clear()
    this.context.lifecycle.transition("destroyed")
  }

  private async runDestroyStep(label: string, step: () => void | Promise<void>): Promise<void> {
    try {
      await step()
    } catch (error) {
      this.logger.error(`Destroy step failed: ${label}`, error)
    }
  }
}

export function createApp(config: Arc3DConfig, engine: EngineContext, context: Arc3DContext): Arc3DApp {
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
