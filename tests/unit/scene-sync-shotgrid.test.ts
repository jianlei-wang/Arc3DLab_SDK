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

class FrameCamera {
  positionWC = { x: 1, y: 2, z: 3 }
  heading = 0.1
  pitch = -0.2
  roll = 0.05
  readonly calls: Array<Record<string, unknown>> = []
  setView(options: {
    destination: unknown
    orientation?: { heading: number; pitch: number; roll: number }
  }): void {
    this.calls.push(options)
    const destination = options.destination as
      Record<string, unknown> | undefined
    if (
      destination &&
      typeof destination === "object" &&
      "x" in destination &&
      "y" in destination &&
      "z" in destination
    ) {
      this.positionWC = destination as { x: number; y: number; z: number }
    }
    if (options.orientation) {
      this.heading = options.orientation.heading
      this.pitch = options.orientation.pitch
      this.roll = options.orientation.roll
    }
  }
}

function makeFrameScene(fire: boolean): {
  scene: Record<string, unknown>
  requests: () => number
  captures: () => number
} {
  const listeners = new Set<() => void>()
  let requestCount = 0
  let captureCount = 0
  const scene = {
    canvas: {
      toDataURL(): string {
        captureCount += 1
        return "data:image/png;base64,frame"
      },
    },
    postRender: {
      addEventListener(listener: () => void): void {
        listeners.add(listener)
      },
      removeEventListener(listener: () => void): void {
        listeners.delete(listener)
      },
    },
    requestRender(): void {
      requestCount += 1
      if (!fire) return
      for (const listener of [...listeners]) listener()
    },
  }
  return {
    scene,
    requests: () => requestCount,
    captures: () => captureCount,
  }
}

describe("captureGrid rendering and state", () => {
  function runtime(viewer: unknown): Arc3DContext {
    return { engine: { native: { viewer } } } as unknown as Arc3DContext
  }

  it("requests and awaits a frame before every capture", async () => {
    const camera = new FrameCamera()
    const frame = makeFrameScene(true)
    const renderSpy = { count: 0 }
    const viewer = {
      camera,
      scene: frame.scene,
      render(): void {
        renderSpy.count += 1
      },
    }
    const shots = await captureGrid(runtime(viewer), {
      rows: 2,
      columns: 1,
      extent: [116, 39, 117, 40],
    })
    expect(shots).toHaveLength(2)
    expect(renderSpy.count).toBe(2)
    expect(frame.requests()).toBeGreaterThanOrEqual(2)
    expect(frame.captures()).toBe(2)
  })

  it("restores the camera after a successful capture", async () => {
    const camera = new FrameCamera()
    const original = { ...camera.positionWC }
    const originalPose = {
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll,
    }
    const frame = makeFrameScene(true)
    await captureGrid(runtime({ camera, scene: frame.scene }), {
      rows: 2,
      columns: 2,
      extent: [116, 39, 117, 40],
    })
    expect(camera.positionWC).toEqual(original)
    expect(camera.heading).toBeCloseTo(originalPose.heading, 6)
    expect(camera.pitch).toBeCloseTo(originalPose.pitch, 6)
    expect(camera.roll).toBeCloseTo(originalPose.roll, 6)
  })

  it("restores the camera when a capture throws", async () => {
    const camera = new FrameCamera()
    const original = { ...camera.positionWC }
    let calls = 0
    const scene = {
      canvas: {
        toDataURL(): string {
          calls += 1
          if (calls > 1) throw new Error("encode failed")
          return "data:image/png;base64,frame"
        },
      },
    }
    await expect(
      captureGrid(runtime({ camera, scene }), {
        rows: 1,
        columns: 3,
        extent: [116, 39, 117, 40],
      }),
    ).rejects.toThrow(/encode failed/)
    expect(camera.positionWC).toEqual(original)
  })

  it("rejects invalid grid dimensions before touching the camera", async () => {
    const camera = new FrameCamera()
    const frame = makeFrameScene(true)
    const context = runtime({ camera, scene: frame.scene })
    await expect(
      captureGrid(context, { rows: 0, columns: 1, extent: [0, 0, 1, 1] }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
    await expect(
      captureGrid(context, { rows: 1.5, columns: 1, extent: [0, 0, 1, 1] }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
    await expect(
      captureGrid(context, { rows: 1, columns: -1, extent: [0, 0, 1, 1] }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
    expect(camera.calls).toHaveLength(0)
  })

  it("enforces the shot limit and allows overriding it", async () => {
    const camera = new FrameCamera()
    const frame = makeFrameScene(true)
    const context = runtime({ camera, scene: frame.scene })
    await expect(
      captureGrid(context, { rows: 10, columns: 10, extent: [0, 0, 1, 1] }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
    const shots = await captureGrid(context, {
      rows: 10,
      columns: 10,
      extent: [0, 0, 1, 1],
      maxShots: 100,
    })
    expect(shots).toHaveLength(100)
  })

  it("falls back to the frame timeout when no signal arrives", async () => {
    const camera = new FrameCamera()
    const frame = makeFrameScene(false)
    const shots = await captureGrid(runtime({ camera, scene: frame.scene }), {
      rows: 1,
      columns: 1,
      extent: [0, 0, 1, 1],
      renderTimeoutMs: 5,
    })
    expect(shots).toHaveLength(1)
    expect(frame.captures()).toBe(1)
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

  it("releases tracked sync viewers when the scene is destroyed", () => {
    const primary = new FakeCamera()
    const scene = new SceneController(sceneRuntime({ camera: primary }))
    scene.sync([{ camera: new FakeCamera() }])
    expect(primary.changed.size).toBe(1)
    scene.destroy()
    expect(primary.changed.size).toBe(0)
    expect(() => scene.destroy()).not.toThrow()
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
