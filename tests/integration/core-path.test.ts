import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  LifecycleManager,
  ResourceRegistry,
  createContext,
  createHandle,
  createId,
  getRuntimeDiagnostics,
  registerCoreCapabilities,
  type Arc3DContext,
  type Engine,
  type EngineViewer,
  type EngineViewerOptions,
} from "@arc3dlab/core"
import { MeasurementService, SpatialQueryService } from "@arc3dlab/analysis"
import { mapInChunks } from "../../packages/analysis/src/scheduler"
import { decideRenderPolicy } from "../../packages/graphics/src/policy"
import {
  TOOLTIP_OWNED_ATTR,
  hostRelativePosition,
  removeOwnedTooltip,
} from "../../packages/ui/src/tooltip-dom"
import { PluginManager } from "../../packages/sdk/src/plugins"
import {
  Arc3D,
  Arc3DApp,
  Arc3DError as PublicError,
  CesiumEngine,
  Viewer,
  createId as publicCreateId,
} from "../../src/index"

class FakeViewer implements EngineViewer {
  readonly canvas = {} as HTMLCanvasElement
  readonly container = { id: "fake-container" } as Element
  readonly native = {}
  destroyed = false

  setCreditMode(): void {}
  requestRender(): void {}
  destroy(): void {
    this.destroyed = true
  }
}

class FakeEngine implements Engine {
  readonly type = "fake"
  viewer: FakeViewer | undefined

  createViewer(_options: EngineViewerOptions): EngineViewer {
    this.viewer = new FakeViewer()
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

function analysisContext(): Arc3DContext {
  const registry = new ResourceRegistry()
  const point = createHandle({
    id: "pt-1",
    type: "point",
    native: {},
    owned: true,
  })
  Object.assign(point, {
    positions: [{ longitude: 120.5, latitude: 30.5, height: 0 }],
  })
  registry.add(point)
  return {
    lifecycle: new LifecycleManager(),
    registry,
  } as unknown as Arc3DContext
}

const canCreateViewer =
  typeof document !== "undefined" &&
  typeof WebGLRenderingContext !== "undefined"

describe("public SDK surface", () => {
  it("exports the documented runtime constructors", () => {
    expect(typeof Arc3D.create).toBe("function")
    expect(typeof Arc3D.createSync).toBe("function")
    expect(Arc3DApp).toBeTypeOf("function")
    expect(CesiumEngine).toBeTypeOf("function")
    expect(Viewer).toBeTypeOf("function")
    expect(typeof publicCreateId()).toBe("string")
    expect(new PublicError("INVALID_ARGUMENT", "bad")).toMatchObject({
      code: "INVALID_ARGUMENT",
    })
  })
})

describe("Fake Engine runtime path", () => {
  it("creates, diagnoses, and destroys without a GPU", () => {
    const engine = new FakeEngine()
    const viewer = engine.createViewer({ container: "app" })
    const context = createContext(
      { container: "app" },
      { type: engine.type, viewer, native: { viewer: viewer.native } }
    )
    context.lifecycle.transition("initializing")
    registerCoreCapabilities(context.capabilities)
    context.lifecycle.transition("ready")

    const snapshot = getRuntimeDiagnostics(context)
    expect(snapshot.lifecycle).toBe("ready")
    expect(context.capabilities.has("engine:cesium")).toBe(true)
    expect(() =>
      context.capabilities.require("graphic:model", "add model")
    ).not.toThrow()

    context.lifecycle.transition("destroying")
    context.lifecycle.transition("destroyed")
    engine.destroy()
    expect(engine.viewer).toBeUndefined()
    expect((viewer as FakeViewer).destroyed).toBe(true)
    expect(() => context.lifecycle.assertUsable("add graphic")).toThrow(
      Arc3DError
    )
  })
})

describe("analysis and graphic core path", () => {
  it("measures, queries, and cancels scheduled work", async () => {
    const ctx = analysisContext()
    const measure = new MeasurementService(ctx)
    const query = new SpatialQueryService(ctx)
    const length = await measure.distance({
      positions: [
        [120, 30, 0],
        [120, 30, 100],
      ],
    })
    expect(length.meters).toBeGreaterThan(90)
    const hits = await query.rectangle({
      west: 120,
      south: 30,
      east: 121,
      north: 31,
    })
    expect(hits.graphics.map((hit) => hit.id)).toEqual(["pt-1"])

    const controller = new AbortController()
    controller.abort()
    await expect(
      mapInChunks(
        [1, 2, 3],
        1,
        async (value) => value,
        ctx,
        "chunk",
        { signal: controller.signal }
      )
    ).rejects.toMatchObject({ code: "CANCELLED" })
  })

  it("keeps explicit graphic policy and buffer rejection", () => {
    expect(
      decideRenderPolicy({
        type: "polyline",
        count: 2,
        dynamic: true,
        requestedMode: "entity",
      })
    ).toMatchObject({ mode: "entity", editable: true })
    expect(() =>
      decideRenderPolicy({ type: "point", count: 1, requestedMode: "buffer" })
    ).toThrow(Arc3DError)
  })
})

describe("plugin, tooltip, and identifier path", () => {
  it("installs then uninstalls a plugin", async () => {
    const ctx = {
      lifecycle: new LifecycleManager(),
    } as unknown as Arc3DContext
    const manager = new PluginManager({ id: "app" }, ctx)
    let installed = false
    await manager.use({
      name: "probe",
      install: () => {
        installed = true
      },
      uninstall: () => {
        installed = false
      },
    })
    expect(manager.list()).toEqual(["probe"])
    expect(installed).toBe(true)
    await manager.uninstall("probe")
    expect(manager.list()).toEqual([])
    expect(installed).toBe(false)
  })

  it("owns tooltip DOM nodes and generates ids", () => {
    expect(typeof createId("graphic")).toBe("string")
    const removed: string[] = []
    const node = {
      getAttribute(name: string) {
        return name === TOOLTIP_OWNED_ATTR ? "true" : null
      },
      remove() {
        removed.push("owned")
      },
    }
    expect(hostRelativePosition(50, 40, { left: 10, top: 10 })).toEqual({
      x: 40,
      y: 30,
    })
    expect(removeOwnedTooltip(node)).toBe(true)
    expect(removed).toEqual(["owned"])
  })
})

describe.skipIf(!canCreateViewer)("browser Viewer", () => {
  it("creates a Viewer, adds a graphic, and destroys the app", async () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const app = await Arc3D.create({ container: host })
    app.graphics.addPoints({
      positions: [[120, 30, 0]],
    })
    expect(app.getDiagnostics().lifecycle).toBe("ready")
    await app.destroy()
    await app.destroy()
  })
})
