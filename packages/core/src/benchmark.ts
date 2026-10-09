import { createContext, type Arc3DContext } from "./context"
import { registerCoreCapabilities } from "./capabilities"
import { createHandle } from "./resource"
import { getRuntimeDiagnostics } from "./diagnostics"
import type { Engine, EngineViewer, EngineViewerOptions } from "./types"

export const BENCHMARK_SCENE = {
  west: 104.0,
  south: 30.5,
  east: 104.2,
  north: 30.7,
  graphicCounts: [64, 256, 1024],
  cameraPath: [
    { longitude: 104.05, latitude: 30.55, height: 2500 },
    { longitude: 104.15, latitude: 30.55, height: 2500 },
    { longitude: 104.15, latitude: 30.65, height: 2500 },
    { longitude: 104.05, latitude: 30.65, height: 2500 },
  ],
} as const

export interface BenchmarkPhase {
  name: "init" | "firstFrame" | "pick" | "destroy"
  durationMs: number
}

export interface RuntimeBenchmarkReport {
  scene: typeof BENCHMARK_SCENE
  graphicCount: number
  phases: BenchmarkPhase[]
  picked: number
}

class BenchmarkViewer implements EngineViewer {
  readonly canvas = {} as HTMLCanvasElement
  readonly container = { id: "benchmark" } as Element
  readonly native = {}
  frames: string[] = []
  destroyed = false

  setCreditMode(): void {}
  requestRender(reason?: string): void {
    if (!this.destroyed) this.frames.push(reason ?? "frame")
  }
  destroy(): void {
    this.destroyed = true
  }
}

class BenchmarkEngine implements Engine {
  readonly type = "fake"
  viewer: BenchmarkViewer | undefined

  createViewer(_options: EngineViewerOptions): EngineViewer {
    this.viewer = new BenchmarkViewer()
    return this.viewer
  }

  hasCapability(): boolean {
    return true
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

function nowMs(): number {
  return performance.now()
}

function measure(name: BenchmarkPhase["name"], work: () => void): BenchmarkPhase {
  const started = nowMs()
  work()
  return { name, durationMs: nowMs() - started }
}

function pointInScene(
  longitude: number,
  latitude: number
): boolean {
  return (
    longitude >= BENCHMARK_SCENE.west &&
    longitude <= BENCHMARK_SCENE.east &&
    latitude >= BENCHMARK_SCENE.south &&
    latitude <= BENCHMARK_SCENE.north
  )
}

export function runRuntimeBenchmark(
  graphicCount = BENCHMARK_SCENE.graphicCounts[0]
): RuntimeBenchmarkReport {
  const engine = new BenchmarkEngine()
  let picked = 0
  const phases: BenchmarkPhase[] = []
  let context: Arc3DContext | undefined

  const init = measure("init", () => {
    const viewer = engine.createViewer({ container: "benchmark" })
    context = createContext(
      { container: "benchmark" },
      { type: engine.type, viewer, native: { viewer: viewer.native } }
    )
    context.lifecycle.transition("initializing")
    registerCoreCapabilities(context.capabilities)
    context.lifecycle.transition("ready")
    const spanLng = BENCHMARK_SCENE.east - BENCHMARK_SCENE.west
    const spanLat = BENCHMARK_SCENE.north - BENCHMARK_SCENE.south
    for (let i = 0; i < graphicCount; i += 1) {
      const handle = createHandle({
        id: `pt-${i}`,
        type: "point",
        native: {},
      })
      Object.assign(handle, {
        positions: [
          {
            longitude: BENCHMARK_SCENE.west + ((i % 16) / 15) * spanLng,
            latitude: BENCHMARK_SCENE.south + ((Math.floor(i / 16) % 16) / 15) * spanLat,
            height: 0,
          },
        ],
      })
      context.registry.add(handle)
    }
  })
  phases.push(init)
  if (!context) {
    throw new Error("benchmark context missing")
  }
  const runtime = context

  phases.push(
    measure("firstFrame", () => {
      engine.viewer?.requestRender("benchmark-first-frame")
      void getRuntimeDiagnostics(runtime)
    })
  )

  phases.push(
    measure("pick", () => {
      picked = runtime.registry.values().filter((item) => {
        const positions = (item as { positions?: Array<{ longitude: number; latitude: number }> })
          .positions
        const point = positions?.[0]
        return point ? pointInScene(point.longitude, point.latitude) : false
      }).length
    })
  )

  phases.push(
    measure("destroy", () => {
      runtime.registry.clear()
      runtime.lifecycle.transition("destroying")
      runtime.lifecycle.transition("destroyed")
      engine.destroy()
    })
  )

  return {
    scene: BENCHMARK_SCENE,
    graphicCount,
    phases,
    picked,
  }
}
