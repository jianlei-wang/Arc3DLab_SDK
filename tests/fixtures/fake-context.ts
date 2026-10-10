import {
  Arc3DError,
  createContext,
  type Arc3DContext,
  type Engine,
  type EngineViewer,
  type EngineViewerOptions,
  type SceneReadyOptions,
  type SceneReadyResult,
} from "@arc3dlab/core"

class TestViewer implements EngineViewer {
  readonly canvas = {} as HTMLCanvasElement
  readonly container = { id: "test-container" } as Element
  readonly native = {}
  destroyed = false
  readyCalls = 0
  lastReadyOptions: SceneReadyOptions | undefined
  sceneReadyResult: SceneReadyResult = {
    ready: true,
    remainingTiles: 0,
    timedOut: false,
    destroyed: false,
    defaultBaseLayer: "disabled",
  }

  setCreditMode(): void {}

  requestRender(): void {}

  whenSceneReady(options?: SceneReadyOptions): Promise<SceneReadyResult> {
    this.readyCalls += 1
    this.lastReadyOptions = options
    return Promise.resolve(this.sceneReadyResult)
  }

  destroy(): void {
    this.destroyed = true
  }
}

export class TestEngine implements Engine {
  readonly type = "fake"
  viewer: TestViewer | undefined

  createViewer(_options: EngineViewerOptions): EngineViewer {
    this.viewer = new TestViewer()
    return this.viewer
  }

  hasCapability(name: string): boolean {
    return name === "engine:fake" || name === "render:entity"
  }

  mapError(error: unknown): { message: string; code?: string } {
    return {
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof Arc3DError ? error.code : "ENGINE_FAILURE",
    }
  }

  destroy(): void {
    this.viewer?.destroy()
    this.viewer = undefined
  }
}

export interface TestRuntime {
  engine: TestEngine
  context: Arc3DContext
}

export function createTestContext(): TestRuntime {
  const engine = new TestEngine()
  const viewer = engine.createViewer({ container: "test-container" })
  const context = createContext(
    { container: "test-container" },
    { type: engine.type, viewer, native: { viewer: viewer.native }, engine },
  )
  context.lifecycle.transition("initializing")
  context.lifecycle.transition("ready")
  return { engine, context }
}
