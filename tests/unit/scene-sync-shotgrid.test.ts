import { describe, expect, it } from "vitest"
import {
  LifecycleManager,
  type Arc3DContext,
  type Extent,
} from "@arc3dlab/core"
import {
  SceneController,
  SyncViewer,
  subdivideExtent,
  captureGrid,
  type CameraChangeEvent,
  type SyncableCamera,
} from "@arc3dlab/scene"

class FakeEvent implements CameraChangeEvent {
  private listeners = new Set<() => void>()
  addEventListener(listener: () => void): void {
    this.listeners.add(listener)
  }
  removeEventListener(listener: () => void): void {
    this.listeners.delete(listener)
  }
  raise(): void {
    for (const listener of this.listeners) listener()
  }
  get size(): number {
    return this.listeners.size
  }
}

class FakeCamera implements SyncableCamera {
  position: unknown = { x: 0 }
  direction: unknown = { x: 1 }
  up: unknown = { z: 1 }
  readonly changed = new FakeEvent()
  views: unknown[] = []
  setView(options: {
    destination: unknown
    orientation: { direction: unknown; up: unknown }
  }): void {
    this.position = options.destination
    this.direction = options.orientation.direction
    this.up = options.orientation.up
    this.views.push(options)
  }
}

describe("SyncViewer", () => {
  it("registers a single listener and syncs cameras", () => {
    const primary = new FakeCamera()
    const follower = new FakeCamera()
    const sync = new SyncViewer({ camera: primary }, [{ camera: follower }])
    expect(primary.changed.size).toBe(1)
    primary.position = { x: 42 }
    primary.changed.raise()
    expect(follower.views).toHaveLength(1)
    expect(follower.position).toEqual({ x: 42 })
    expect(sync.size).toBe(1)
  })

  it("releases the listener on destroy", () => {
    const primary = new FakeCamera()
    const sync = new SyncViewer({ camera: primary }, [
      { camera: new FakeCamera() },
    ])
    sync.destroy()
    expect(primary.changed.size).toBe(0)
    sync.destroy()
    expect(primary.changed.size).toBe(0)
  })
})

describe("captureGrid", () => {
  it("subdivides an extent in row-major order", () => {
    const cells = subdivideExtent([0, 0, 2, 2], 2, 2)
    expect(cells).toHaveLength(4)
    expect(cells[0]).toEqual([0, 1, 1, 2])
    expect(cells[3]).toEqual([1, 0, 2, 1])
  })

  it("captures one image per grid cell", async () => {
    const setViewCalls: unknown[] = []
    const viewer = {
      scene: { canvas: { toDataURL: () => "data:image/png;base64,aaa" } },
      camera: {
        setView(options: unknown): void {
          setViewCalls.push(options)
        },
      },
    }
    const context = {
      engine: { native: { viewer } },
    } as unknown as Arc3DContext
    const extent: Extent = [116, 39, 117, 40]
    const shots = await captureGrid(context, { rows: 2, columns: 3, extent })
    expect(shots).toHaveLength(6)
    expect(setViewCalls).toHaveLength(6)
    expect(shots[0]).toMatchObject({ row: 0, column: 0 })
    expect(shots[5]).toMatchObject({ row: 1, column: 2 })
    expect(shots[0]!.image).toContain("data:image/png")
  })

  it("fails when the viewer has no canvas", async () => {
    const context = {
      engine: { native: { viewer: {} } },
    } as unknown as Arc3DContext
    await expect(
      captureGrid(context, { rows: 1, columns: 1, extent: [0, 0, 1, 1] }),
    ).rejects.toThrow(/canvas/)
  })
})

function sceneRuntime(viewer: unknown): Arc3DContext {
  const lifecycle = new LifecycleManager()
  lifecycle.transition("initializing")
  lifecycle.transition("ready")
  return {
    lifecycle,
    disposers: { push: () => {} },
    engine: { native: { viewer } },
  } as unknown as Arc3DContext
}

describe("SceneController facade", () => {
  it("syncs the current viewer camera with follower views", () => {
    const camera = {
      position: {},
      direction: { x: 1 },
      up: { z: 1 },
      setView: () => {},
    }
    const scene = new SceneController(sceneRuntime({ camera }))
    const follower = new FakeCamera()
    const sync = scene.sync([{ camera: follower }])
    expect(sync.size).toBe(1)
    sync.sync()
    expect(follower.views).toHaveLength(1)
    sync.destroy()
  })

  it("captures a grid through the scene facade", async () => {
    const viewer = {
      camera: { setView: () => {} },
      scene: { canvas: { toDataURL: () => "data:image/png;base64,aaa" } },
    }
    const scene = new SceneController(sceneRuntime(viewer))
    const shots = await scene.captureGrid({
      rows: 1,
      columns: 2,
      extent: [0, 0, 1, 1],
    })
    expect(shots).toHaveLength(2)
    expect(shots[0]!.image).toContain("data:image/png")
  })
})
