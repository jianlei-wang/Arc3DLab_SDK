import { beforeEach, describe, expect, it, vi } from "vitest"
import { createContext } from "@arc3dlab/core"

const providers = vi.hoisted(() => ({ created: 0, fail: false }))

vi.mock("@arc3dlab/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@arc3dlab/data")>()
  return {
    ...actual,
    createImageryProvider: async () => {
      providers.created += 1
      if (providers.fail) throw new Error("provider boom")
      return { isFakeProvider: true }
    },
  }
})

import { BasemapManager } from "@arc3dlab/layers"

interface FakeLayer {
  show: boolean
  provider: unknown
}

function makeRuntime(): {
  manager: BasemapManager
  order: FakeLayer[]
  setDefaultBaseLayerVisible: ReturnType<typeof vi.fn>
} {
  const order: FakeLayer[] = []
  const imageryLayers = {
    addImageryProvider(provider: unknown, index?: number) {
      const layer: FakeLayer = { show: true, provider }
      if (index === undefined) order.push(layer)
      else order.splice(index, 0, layer)
      return layer
    },
    lowerToBottom(layer: FakeLayer) {
      const i = order.indexOf(layer)
      if (i > 0) {
        order.splice(i, 1)
        order.unshift(layer)
      }
    },
    remove(layer: FakeLayer) {
      const i = order.indexOf(layer)
      if (i >= 0) order.splice(i, 1)
    },
  }
  const setDefaultBaseLayerVisible = vi.fn()
  const context = createContext(
    { container: "test" },
    {
      type: "cesium",
      viewer: { setDefaultBaseLayerVisible } as never,
      native: { viewer: { imageryLayers } as never },
    },
  )
  context.lifecycle.transition("initializing")
  context.lifecycle.transition("ready")
  return {
    manager: new BasemapManager(context),
    order,
    setDefaultBaseLayerVisible,
  }
}

describe("BasemapManager placeholder coordination", () => {
  beforeEach(() => {
    providers.created = 0
    providers.fail = false
  })

  it("hides the default placeholder when a custom basemap is set", async () => {
    const { manager, order, setDefaultBaseLayerVisible } = makeRuntime()
    await manager.set({ type: "xyz", url: "https://tiles/{z}/{x}/{y}.png" })
    expect(order).toHaveLength(1)
    expect(setDefaultBaseLayerVisible).toHaveBeenCalledWith(false)
  })

  it("restores the default placeholder when the basemap is destroyed", async () => {
    const { manager, setDefaultBaseLayerVisible } = makeRuntime()
    const layer = await manager.set({ type: "xyz" })
    setDefaultBaseLayerVisible.mockClear()
    layer.destroy()
    expect(setDefaultBaseLayerVisible).toHaveBeenCalledWith(true)
    expect(manager.get()).toBeUndefined()
  })

  it("keeps the placeholder visible when the provider fails", async () => {
    const { manager, order, setDefaultBaseLayerVisible } = makeRuntime()
    providers.fail = true
    await expect(manager.set({ type: "xyz" })).rejects.toThrow()
    expect(order).toHaveLength(0)
    expect(setDefaultBaseLayerVisible).not.toHaveBeenCalled()
  })

  it("does not re-show the placeholder while replacing the basemap", async () => {
    const { manager, order, setDefaultBaseLayerVisible } = makeRuntime()
    await manager.set({ type: "xyz" })
    const replacement = await manager.set({ type: "xyz" })
    expect(order).toHaveLength(1)
    expect(setDefaultBaseLayerVisible.mock.calls).toEqual([[false], [false]])
    expect(manager.get()).toBe(replacement)
  })
})
