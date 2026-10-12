import { describe, expect, it, vi } from "vitest"
import type { PluginScope } from "@arc3dlab/core"
import { PluginManager } from "../../packages/sdk/src/plugins"
import { createTestContext } from "../fixtures/fake-context"

function resource(destroy = vi.fn()) {
  return { destroy }
}

describe("PluginScope managed resources", () => {
  it("destroys plugin-owned resources on uninstall exactly once", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const graphic = resource()
    const layer = resource()
    const task = resource()

    await manager.use({
      name: "res",
      install: (_app, _ctx, scope) => {
        scope.manage(graphic)
        scope.manage(layer)
        scope.manage(task)
        expect(scope.size).toBe(3)
      },
    })

    await manager.uninstall("res")
    expect(graphic.destroy).toHaveBeenCalledTimes(1)
    expect(layer.destroy).toHaveBeenCalledTimes(1)
    expect(task.destroy).toHaveBeenCalledTimes(1)
    expect(context.scopes.get("res")).toBeUndefined()
  })

  it("rolls back managed resources when install fails", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const partial = resource()

    await expect(
      manager.use({
        name: "boom",
        install: (_app, _ctx, scope) => {
          scope.manage(partial)
          throw new Error("install failed")
        },
      }),
    ).rejects.toThrow("install failed")

    expect(partial.destroy).toHaveBeenCalledTimes(1)
    expect(context.scopes.get("boom")).toBeUndefined()
  })

  it("awaits async resource destroy and continues past failures", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const order: string[] = []
    const failing = {
      destroy: vi.fn(() => {
        order.push("failing")
        throw new Error("destroy failed")
      }),
    }
    const tail = {
      destroy: vi.fn(async () => {
        order.push("tail")
      }),
    }

    await manager.use({
      name: "mixed",
      install: (_app, _ctx, scope) => {
        scope.manage(failing)
        scope.manage(tail)
      },
    })

    await manager.uninstall("mixed")
    expect(order).toContain("failing")
    expect(order).toContain("tail")
    expect(tail.destroy).toHaveBeenCalledTimes(1)
  })

  it("rejects manage after the scope is closed", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    let captured: PluginScope | undefined
    await manager.use({
      name: "closed",
      install: (_app, _ctx, scope) => {
        captured = scope
      },
    })
    await manager.uninstall("closed")
    expect(() => captured?.manage(resource())).toThrow()
  })

  it("skips destroy for resources released early via unmanage", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const released = resource()
    const kept = resource()

    await manager.use({
      name: "early",
      install: (_app, _ctx, scope) => {
        scope.manage(released)
        scope.manage(kept)
        expect(scope.size).toBe(2)
        expect(scope.unmanage(released)).toBe(true)
        expect(scope.size).toBe(1)
      },
    })

    await manager.uninstall("early")
    expect(released.destroy).not.toHaveBeenCalled()
    expect(kept.destroy).toHaveBeenCalledTimes(1)
  })

  it("returns false when unmanaging an untracked resource", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    await manager.use({
      name: "loose",
      install: (_app, _ctx, scope) => {
        expect(scope.unmanage(resource())).toBe(false)
      },
    })
    await manager.uninstall("loose")
  })
})
