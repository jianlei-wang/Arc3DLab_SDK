import {
  createContext,
  registerCoreCapabilities,
  type Arc3DContext,
  type Engine,
  type EngineViewer,
  type EngineViewerOptions,
} from "@arc3dlab/core"
import { executeAnalysisJob } from "@arc3dlab/analysis"
import { PluginManager } from "../../packages/sdk/src/plugins"

class HarnessViewer implements EngineViewer {
  readonly canvas = {} as HTMLCanvasElement
  readonly container = { id: "plugin-harness" } as Element
  readonly native = {}
  destroyed = false

  setCreditMode(): void {}
  requestRender(): void {}
  destroy(): void {
    this.destroyed = true
  }
}

class HarnessEngine implements Engine {
  readonly type = "fake"
  viewer: HarnessViewer | undefined

  createViewer(_options: EngineViewerOptions): EngineViewer {
    this.viewer = new HarnessViewer()
    return this.viewer
  }

  hasCapability(name: string): boolean {
    return name === "engine:fake" || name === "render:entity"
  }

  mapError(error: unknown): { message: string; code?: string } {
    return {
      message: error instanceof Error ? error.message : String(error),
      code: "ENGINE_FAILURE",
    }
  }

  destroy(): void {
    this.viewer?.destroy()
    this.viewer = undefined
  }
}

export interface PluginHarness {
  id: string
  context: Arc3DContext
  engine: HarnessEngine
  viewer: EngineViewer
  graphics: {
    add(id: string, kind: string): void
    remove(id: string): void
    list(): string[]
  }
  layers: {
    add(id: string): void
    remove(id: string): void
    list(): string[]
  }
  analysis: {
    area(positions: Array<[number, number]>): number
  }
  ui: {
    status: string
    setStatus(text: string): void
    clearStatus(): void
  }
  plugins: PluginManager<PluginHarness>
  destroy(): Promise<void>
}

export function createPluginHarness(): PluginHarness {
  const engine = new HarnessEngine()
  const viewer = engine.createViewer({ container: "plugin-harness" })
  const context = createContext(
    { container: "plugin-harness" },
    { type: engine.type, viewer, native: { viewer: viewer.native }, engine },
  )
  registerCoreCapabilities(context.capabilities, engine)
  context.lifecycle.transition("initializing")
  context.lifecycle.transition("ready")

  const graphics = new Map<string, string>()
  const layers = new Set<string>()
  let status = ""

  const host: PluginHarness = {
    id: "harness",
    context,
    engine,
    viewer,
    graphics: {
      add(id, kind) {
        graphics.set(id, kind)
      },
      remove(id) {
        graphics.delete(id)
      },
      list() {
        return Array.from(graphics.keys())
      },
    },
    layers: {
      add(id) {
        layers.add(id)
      },
      remove(id) {
        layers.delete(id)
      },
      list() {
        return Array.from(layers)
      },
    },
    analysis: {
      area(positions) {
        const result = executeAnalysisJob({ type: "area", positions })
        return result.type === "area" ? result.squareMeters : 0
      },
    },
    ui: {
      get status() {
        return status
      },
      setStatus(text) {
        status = text
      },
      clearStatus() {
        status = ""
      },
    },
    plugins: undefined as unknown as PluginManager<PluginHarness>,
    async destroy() {
      await host.plugins.destroy()
      if (context.lifecycle.current !== "destroying") {
        context.lifecycle.transition("destroying")
      }
      if (context.lifecycle.current !== "destroyed") {
        context.lifecycle.transition("destroyed")
      }
      engine.destroy()
    },
  }
  host.plugins = new PluginManager(host, context)
  return host
}
