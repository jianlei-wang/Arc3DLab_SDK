import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  CapabilityRegistry,
  createContext,
  getRuntimeDiagnostics,
  registerCoreCapabilities,
  type Engine,
  type EngineViewer,
  type EngineViewerOptions,
} from "@arc3dlab/core"

class FakeViewer implements EngineViewer {
  readonly canvas = {} as HTMLCanvasElement
  readonly container = { id: "fake-container" } as Element
  readonly native = {}
  destroyed = false
  renders: string[] = []

  setCreditMode(): void {}

  requestRender(reason?: string): void {
    if (this.destroyed) return
    this.renders.push(reason ?? "unspecified")
  }

  destroy(): void {
    this.destroyed = true
  }
}

class FakeEngine implements Engine {
  readonly type = "fake"
  viewer: FakeViewer | undefined
  private readonly capabilities = new Set(["engine:fake", "render:entity"])

  createViewer(_options: EngineViewerOptions): EngineViewer {
    this.viewer = new FakeViewer()
    return this.viewer
  }

  hasCapability(name: string): boolean {
    return this.capabilities.has(name)
  }

  mapError(error: unknown): { message: string; code?: string } {
    if (error instanceof Arc3DError) {
      return { message: error.message, code: error.code }
    }
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

describe("Fake Engine adapter", () => {
  it("creates a viewer that records render invalidation until destroy", () => {
    const engine = new FakeEngine()
    const viewer = engine.createViewer({ container: "app" })
    viewer.requestRender("graphic-added")
    viewer.requestRender("graphic-style")
    expect(engine.viewer?.renders).toEqual(["graphic-added", "graphic-style"])
    engine.destroy()
    viewer.requestRender("after-destroy")
    expect(engine.viewer).toBeUndefined()
    expect((viewer as FakeViewer).destroyed).toBe(true)
    expect((viewer as FakeViewer).renders).toEqual(["graphic-added", "graphic-style"])
  })

  it("reports capabilities and maps errors without a renderer", () => {
    const engine = new FakeEngine()
    expect(engine.hasCapability("render:entity")).toBe(true)
    expect(engine.hasCapability("graphic:model")).toBe(false)
    expect(engine.mapError(new Arc3DError("UNSUPPORTED_CAPABILITY", "no model"))).toEqual({
      message: "no model",
      code: "UNSUPPORTED_CAPABILITY",
    })
    expect(engine.mapError(new Error("boom"))).toEqual({
      message: "boom",
      code: "ENGINE_FAILURE",
    })
  })
})

describe("CapabilityRegistry", () => {
  it("allows require() when nothing is registered", () => {
    const registry = new CapabilityRegistry()
    expect(() => registry.require("graphic:model", "add model")).not.toThrow()
  })

  it("rejects unregistered capabilities after core registration", () => {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    expect(registry.has("engine:cesium")).toBe(true)
    expect(registry.has("graphic:model")).toBe(true)
    expect(() => registry.require("graphic:model", "add model")).not.toThrow()
    expect(() => registry.require("engine:fake", "use fake engine")).toThrow(Arc3DError)
    try {
      registry.require("engine:fake", "use fake engine")
    } catch (error) {
      expect(error).toMatchObject({ code: "UNSUPPORTED_CAPABILITY" })
    }
  })
})

describe("Runtime with Fake Engine", () => {
  it("wires context diagnostics and blocks work after destroy", () => {
    const engine = new FakeEngine()
    const viewer = engine.createViewer({ container: "app" })
    const context = createContext(
      { container: "app" },
      { type: engine.type, viewer, native: { viewer: viewer.native } }
    )
    context.lifecycle.transition("initializing")
    context.lifecycle.transition("ready")
    expect(() => context.lifecycle.assertUsable("add polyline")).not.toThrow()

    const snapshot = getRuntimeDiagnostics(context)
    expect(snapshot.lifecycle).toBe("ready")
    expect(snapshot.resources).toEqual({})

    context.lifecycle.transition("destroying")
    context.lifecycle.transition("destroyed")
    engine.destroy()
    expect(() => context.lifecycle.assertUsable("add polyline")).toThrow(Arc3DError)
  })
})
