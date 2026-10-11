import { describe, expect, it } from "vitest"
import { Arc3DContext, DisposerStack, LifecycleManager } from "@arc3dlab/core"
import {
  addBillboard,
  addCircleDiffusion,
  addDynamicPolyline,
  addPanel,
  addRadarNormal,
  addRiver,
  addSpreadPoint,
} from "@arc3dlab/graphics"

function installDomStubs(): void {
  const scope = globalThis as Record<string, unknown>
  for (const name of [
    "HTMLCanvasElement",
    "HTMLImageElement",
    "ImageBitmap",
    "OffscreenCanvas",
  ]) {
    scope[name] ??= class {}
  }
}

installDomStubs()

interface FakeViewer {
  entities: {
    added: unknown[]
    add(e: unknown): unknown
    remove(e: unknown): void
  }
  scene: {
    primitives: {
      added: unknown[]
      add(p: unknown): unknown
      remove(p: unknown): void
    }
    postProcessStages: {
      added: unknown[]
      add(s: unknown): unknown
      remove(s: unknown): void
    }
    canvas: { toDataURL(): string }
  }
  camera: { viewMatrix: unknown; setView(): void }
}

function makeCollection(): {
  added: unknown[]
  add(value: unknown): unknown
  remove(value: unknown): void
} {
  const added: unknown[] = []
  return {
    added,
    add(value: unknown): unknown {
      added.push(value)
      return value
    },
    remove(value: unknown): void {
      const index = added.indexOf(value)
      if (index >= 0) added.splice(index, 1)
    },
  }
}

function makeContext(): { context: Arc3DContext; viewer: FakeViewer } {
  const scene = {
    primitives: makeCollection(),
    postProcessStages: makeCollection(),
    canvas: { toDataURL: () => "data:image/png;base64," },
  }
  const viewer: FakeViewer = {
    entities: makeCollection(),
    scene,
    camera: { viewMatrix: {}, setView: () => {} },
  }
  const context = {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer } },
    disposers: new DisposerStack(),
  } as unknown as Arc3DContext
  return { context, viewer }
}

const center: [number, number] = [116.39, 39.9]

describe("dynamic graphics", () => {
  it("adds and removes a billboard", () => {
    const { context, viewer } = makeContext()
    const handle = addBillboard(context, {
      position: center,
      image: "icon.png",
    })
    expect(viewer.entities.added).toHaveLength(1)
    expect(context.disposers.size).toBe(1)
    handle.destroy()
    expect(viewer.entities.added).toHaveLength(0)
    expect(context.disposers.size).toBe(0)
  })

  it("adds a spread point and clears its animation listener", () => {
    const { context, viewer } = makeContext()
    const handle = addSpreadPoint(context, { position: center, radius: 500 })
    expect(viewer.entities.added).toHaveLength(1)
    expect(context.disposers.size).toBe(1)
    handle.destroy()
    handle.destroy()
    expect(viewer.entities.added).toHaveLength(0)
    expect(context.disposers.size).toBe(0)
  })

  it("adds a radar normal symbol and a panel", () => {
    const { context, viewer } = makeContext()
    const radar = addRadarNormal(context, { position: center, radius: 800 })
    const panel = addPanel(context, { position: center, text: "热点" })
    expect(viewer.entities.added).toHaveLength(2)
    radar.destroy()
    panel.destroy()
    expect(viewer.entities.added).toHaveLength(0)
  })

  it("adds a dynamic polyline with trail material", () => {
    const { context, viewer } = makeContext()
    const handle = addDynamicPolyline(context, {
      positions: [center, [116.4, 39.9]],
    })
    expect(viewer.entities.added).toHaveLength(1)
    handle.destroy()
    expect(context.disposers.size).toBe(0)
  })

  it("adds a river primitive and releases it", () => {
    const { context, viewer } = makeContext()
    const handle = addRiver(context, {
      positions: [center, [116.4, 39.9], [116.4, 39.91]],
    })
    expect(viewer.scene.primitives.added).toHaveLength(1)
    handle.destroy()
    expect(viewer.scene.primitives.added).toHaveLength(0)
  })

  it("adds a circle diffusion post-process stage and releases it", () => {
    const { context, viewer } = makeContext()
    const handle = addCircleDiffusion(context, {
      position: center,
      radius: 800,
    })
    expect(viewer.scene.postProcessStages.added).toHaveLength(1)
    handle.destroy()
    expect(viewer.scene.postProcessStages.added).toHaveLength(0)
  })
})
