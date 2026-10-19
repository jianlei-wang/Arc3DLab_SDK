import { Arc3D, Arc3DError } from "../src/index"
import type { LngLat, SceneReadyResult } from "../src/index"
import { SwipeComparison } from "@arc3dlab/analysis"

declare global {
  interface Window {
    __ARC3D_READY__?: SceneReadyResult
    __ARC3D_REPORT__?: Record<string, unknown>
    __ARC3D_ERROR__?: string
  }
}

const POINT: [number, number, number] = [116.391, 39.906, 0]
const FAR_POINT: [number, number, number] = [116.401, 39.916, 0]

const PLOT_ANCHORS: LngLat[] = [
  { longitude: 116.386, latitude: 39.902 },
  { longitude: 116.396, latitude: 39.91 },
  { longitude: 116.402, latitude: 39.9 },
]

function nextFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number): void => {
      if (remaining <= 0) {
        resolve()
        return
      }
      window.requestAnimationFrame(() => step(remaining - 1))
    }
    step(count)
  })
}

function frameDurations(count: number): Promise<number[]> {
  return new Promise((resolve) => {
    const durations: number[] = []
    let last = performance.now()
    let remaining = count
    const step = (): void => {
      const now = performance.now()
      durations.push(now - last)
      last = now
      remaining -= 1
      if (remaining <= 0) {
        resolve(durations)
        return
      }
      window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  })
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))
  return sorted[index]
}

function errorCode(error: unknown): string {
  if (error instanceof Arc3DError) return error.code
  if (error instanceof Error) return error.name
  return "UNKNOWN"
}

async function scenarioRuntime(): Promise<Record<string, unknown>> {
  const app = await Arc3D.create({ container: "app" })
  const report: Record<string, unknown> = {}

  report.ready = await app.scene.whenSceneReady({ timeoutMs: 20000 })

  const graphic = app.graphics.addPoint({
    positions: POINT,
    style: { pixelSize: 14, color: "#ff2d55" },
  })
  report.graphicId = graphic.id

  app.camera.lookAt(POINT, 5000)
  await nextFrames(3)

  const canvas = document.querySelector<HTMLCanvasElement>("#app canvas")
  const center = {
    x: canvas ? canvas.clientWidth / 2 : 0,
    y: canvas ? canvas.clientHeight / 2 : 0,
  }
  let picked = app.interaction.pick(center)
  for (
    let attempt = 0;
    attempt < 30 && picked.graphicId !== graphic.id;
    attempt += 1
  ) {
    await nextFrames(1)
    picked = app.interaction.pick(center)
  }
  report.pickKind = picked.kind
  report.pickGraphicId = picked.graphicId

  const distance = await app.analysis.measure.distance({
    positions: [POINT, FAR_POINT],
  })
  report.distanceMeters = distance.meters

  const plot = app.plotting.draw("attackArrow", {
    positions: PLOT_ANCHORS,
    style: { color: "#00e5ff", fillColor: "#00e5ff" },
  })
  report.plotId = plot.id
  report.plotShapeCount = plot.shapes.length

  const radar = app.graphics.dynamic.radarNormal({
    position: POINT,
    radius: 1200,
    speed: 12,
  })
  const spread = app.graphics.dynamic.spreadPoint({
    position: FAR_POINT,
    radius: 800,
    duration: 800,
  })
  report.dynamicRadarId = radar.id
  report.dynamicSpreadId = spread.id
  await nextFrames(4)
  radar.destroy()
  spread.destroy()
  report.dynamicMaterialsRendered = true

  app.effects.weather.enable("rain")
  report.weatherEnabled = true
  app.effects.weather.disable("rain")
  report.weatherDisabled = true

  const swipe = new SwipeComparison(app.context, "vertical")
  swipe.setPosition(0.35)
  report.swipePosition = swipe.getPosition()
  swipe.setActive(false)
  swipe.setActive(true)
  swipe.destroy()
  report.swipeDestroyed = true

  await app.destroy()
  report.destroyed = true

  const rebuilt = await Arc3D.create({ container: "app" })
  report.rebuiltReady = (
    await rebuilt.scene.whenSceneReady({ timeoutMs: 20000 })
  ).ready

  window.__ARC3D_READY__ = report.ready as SceneReadyResult
  return report
}

async function scenarioInitFailure(): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = { reportKind: "init-failure" }
  try {
    await Arc3D.create({ container: "missing-container" })
    report.initFailed = false
  } catch (error) {
    report.initFailed = true
    report.errorCode = errorCode(error)
  }
  return report
}

async function scenarioCleanupFailure(): Promise<Record<string, unknown>> {
  const app = await Arc3D.create({ container: "app" })
  await app.scene.whenSceneReady({ timeoutMs: 20000 })
  const registry = app.context.registry
  let destroyAttempted = false
  registry.add({
    id: "e2e:cleanup-failing",
    type: "test",
    native: null,
    visible: true,
    owned: true,
    destroy: () => {
      destroyAttempted = true
      throw new Error("intentional destroy failure")
    },
  })
  registry.add({
    id: "e2e:cleanup-sibling",
    type: "test",
    native: null,
    visible: true,
    owned: true,
    destroy: () => undefined,
  })
  await app.destroy()
  return {
    reportKind: "cleanup-failure",
    destroyAttempted,
    registryEmpty: registry.ids().length === 0,
    hasFailing: registry.has("e2e:cleanup-failing"),
    hasSibling: registry.has("e2e:cleanup-sibling"),
  }
}

async function scenarioMultiInstance(): Promise<Record<string, unknown>> {
  const second = document.createElement("div")
  second.id = "app2"
  second.style.width = "100vw"
  second.style.height = "100vh"
  document.body.appendChild(second)

  const first = await Arc3D.create({ container: "app" })
  const other = await Arc3D.create({ container: "app2" })
  const [firstReady, otherReady] = await Promise.all([
    first.scene.whenSceneReady({ timeoutMs: 20000 }),
    other.scene.whenSceneReady({ timeoutMs: 20000 }),
  ])

  first.graphics.addPoint({
    positions: POINT,
    style: { pixelSize: 12, color: "#ff2d55" },
  })
  other.graphics.addPoint({
    positions: FAR_POINT,
    style: { pixelSize: 12, color: "#00e5ff" },
  })

  await first.destroy()
  const secondAliveAfterFirstDestroyed =
    document.querySelector("#app2 canvas") !== null
  await other.destroy()
  const bothGone =
    document.querySelector("#app canvas") === null &&
    document.querySelector("#app2 canvas") === null

  return {
    reportKind: "multi-instance",
    firstReady: firstReady.ready,
    otherReady: otherReady.ready,
    secondAliveAfterFirstDestroyed,
    bothGone,
  }
}

async function scenarioTaskCancel(): Promise<Record<string, unknown>> {
  const app = await Arc3D.create({ container: "app" })
  const controller = new AbortController()
  const result = await app.analysis.run<{ steps: number }, number>({
    algorithm: "e2e.long",
    input: { steps: 1000 },
    signal: controller.signal,
    execute: (runner) => {
      for (let index = 0; index < 1000; index++) {
        runner.throwIfCancelled("e2e.long")
        runner.report(index, 1000, "loop")
        if (index === 5) controller.abort()
      }
      return { value: 1 }
    },
  })
  const registered = app.analysis.tasks.get(result.taskId)
  await app.destroy()
  return {
    reportKind: "task-cancel",
    status: result.status,
    errorCode: result.error?.code,
    registeredStatus: registered?.status,
  }
}

async function scenarioExternalService(): Promise<Record<string, unknown>> {
  const app = await Arc3D.create({ container: "app" })
  const report: Record<string, unknown> = { reportKind: "external-service" }

  try {
    await app.data.web.geocode("no provider")
    report.providerMissingThrew = false
  } catch (error) {
    report.providerMissingThrew = true
    report.providerMissingCode = errorCode(error)
  }

  app.data.web.setProvider({
    driving: async (origin, destination) => ({
      origin,
      destination,
      paths: [],
    }),
    poi: async () => [],
    geocode: async (address) => [
      {
        province: "北京市",
        city: "北京市",
        district: "东城区",
        street: address,
        number: "1",
        location: { longitude: 116.391, latitude: 39.906 },
      },
    ],
    reverseGeocode: async () => ({
      province: "北京市",
      city: "北京市",
      district: "东城区",
      township: "东华门街道",
      address: "模拟地址",
    }),
  })

  const results = await app.data.web.geocode("天安门")
  report.geocodeCount = results.length
  report.geocodeStreet = results[0]?.street

  await app.destroy()
  return report
}

function restoreGlobalWorker(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(window, "Worker", descriptor)
    return
  }
  delete (window as Window & { Worker?: typeof Worker }).Worker
}

function workerReport(app: Arc3D): Record<string, unknown> {
  const diagnostics = app.analysis.getDiagnostics()
  return {
    workerUnavailable: diagnostics.workerUnavailable,
    activeWorkers: diagnostics.activeWorkers,
    idleWorkers: diagnostics.idleWorkers,
    createdWorkers: diagnostics.createdWorkers,
    pendingJobs: diagnostics.pendingJobs,
    completedJobs: diagnostics.completedJobs,
  }
}

async function scenarioWorkerFallback(): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = { reportKind: "worker-fallback" }
  const descriptor = Object.getOwnPropertyDescriptor(window, "Worker")
  const positions: Array<[number, number, number]> = [
    [116.391, 39.906, 0],
    [116.401, 39.916, 0],
  ]

  const app = await Arc3D.create({ container: "app" })
  try {
    report.disabledReady = (
      await app.scene.whenSceneReady({ timeoutMs: 20000 })
    ).ready
    Object.defineProperty(window, "Worker", {
      configurable: true,
      writable: true,
      value: undefined,
    })
    const distance = await app.analysis.measure.distance({ positions })
    report.disabledDistanceMeters = distance.meters
    Object.assign(report, {
      disabledWorkerUnavailable: workerReport(app).workerUnavailable,
      disabledCreatedWorkers: workerReport(app).createdWorkers,
      disabledPendingJobs: workerReport(app).pendingJobs,
      disabledCompletedJobs: workerReport(app).completedJobs,
    })
  } finally {
    restoreGlobalWorker(descriptor)
  }
  await app.destroy()

  const failing = await Arc3D.create({ container: "app" })
  try {
    report.failingReady = (
      await failing.scene.whenSceneReady({ timeoutMs: 20000 })
    ).ready
    class ThrowingWorker {
      constructor() {
        throw new Error("worker creation blocked by e2e")
      }
    }
    Object.defineProperty(window, "Worker", {
      configurable: true,
      writable: true,
      value: ThrowingWorker,
    })
    const area = await failing.analysis.measure.area({
      positions: [
        [104, 30.5],
        [104.2, 30.5],
        [104.2, 30.7],
        [104, 30.7],
      ],
    })
    report.failingSquareMeters = area.squareMeters
    const diagnostics = workerReport(failing)
    report.failingWorkerUnavailable = diagnostics.workerUnavailable
    report.failingCreatedWorkers = diagnostics.createdWorkers
    report.failingPendingJobs = diagnostics.pendingJobs
    report.failingCompletedJobs = diagnostics.completedJobs
  } finally {
    restoreGlobalWorker(descriptor)
  }
  await failing.destroy()
  return report
}

async function scenarioLifecycleBaseline(): Promise<Record<string, unknown>> {
  const cycles: Array<Record<string, unknown>> = []
  for (let index = 0; index < 3; index += 1) {
    const app = await Arc3D.create({ container: "app" })
    const ready = (await app.scene.whenSceneReady({ timeoutMs: 20000 })).ready
    await app.analysis.measure.distance({
      positions: [
        [116.391, 39.906, 0],
        [116.401, 39.916, 0],
      ],
    })
    const before = app.analysis.getDiagnostics()
    await app.destroy()
    const after = app.analysis.getDiagnostics()
    cycles.push({
      ready,
      graphics: app.graphics.list().length,
      registry: app.context.registry.ids().length,
      tracker: app.context.tracker.size,
      activeWorkersBefore: before.activeWorkers,
      peakWorkersBefore: before.peakWorkers,
      pendingJobsBefore: before.pendingJobs,
      activeWorkersAfter: after.activeWorkers,
      idleWorkersAfter: after.idleWorkers,
      pendingJobsAfter: after.pendingJobs,
      terminated: after.terminated,
    })
  }
  return { reportKind: "lifecycle-baseline", cycles }
}

async function scenarioPerf(): Promise<Record<string, unknown>> {
  const app = await Arc3D.create({ container: "app" })
  const report: Record<string, unknown> = { reportKind: "perf" }
  report.ready = (await app.scene.whenSceneReady({ timeoutMs: 20000 })).ready

  const COUNT = 300
  const ROUNDS = 3
  const positions: Array<[number, number, number]> = []
  for (let index = 0; index < COUNT; index += 1) {
    positions.push([
      POINT[0] + ((index % 20) - 10) * 0.0008,
      POINT[1] + (Math.floor(index / 20) - 8) * 0.0008,
      0,
    ])
  }

  const createStart = performance.now()
  const ids: string[] = []
  for (const position of positions) {
    ids.push(app.graphics.addPoint({ positions: position }).id)
  }
  report.createMs = performance.now() - createStart
  report.createdCount = ids.length
  report.registryBefore = app.context.registry.ids().length

  const churnStart = performance.now()
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const id of ids) app.graphics.remove(id)
    for (let index = 0; index < COUNT; index += 1) {
      ids[index] = app.graphics.addPoint({ positions: positions[index] }).id
    }
  }
  report.churnMs = performance.now() - churnStart
  report.churnOps = COUNT * ROUNDS * 2

  app.camera.lookAt(POINT, 8000)
  const durations = await frameDurations(60)
  const sorted = [...durations].sort((a, b) => a - b)
  report.frameCount = durations.length
  report.avgFrameMs =
    durations.reduce((total, value) => total + value, 0) / durations.length
  report.p95FrameMs = percentile(sorted, 0.95)

  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize: number } }
  ).memory
  if (memory) report.heapUsedMb = memory.usedJSHeapSize / (1024 * 1024)

  await app.destroy()
  report.graphicsRemaining = app.graphics.list().length
  report.registryAfterDestroy = app.context.registry.ids().length
  report.trackerAfterDestroy = app.context.tracker.size
  return report
}

const SCENARIOS: Record<string, () => Promise<Record<string, unknown>>> = {
  runtime: scenarioRuntime,
  "init-failure": scenarioInitFailure,
  "cleanup-failure": scenarioCleanupFailure,
  "multi-instance": scenarioMultiInstance,
  "task-cancel": scenarioTaskCancel,
  "external-service": scenarioExternalService,
  "worker-fallback": scenarioWorkerFallback,
  "lifecycle-baseline": scenarioLifecycleBaseline,
  perf: scenarioPerf,
}

async function boot(): Promise<void> {
  const requested =
    new URLSearchParams(window.location.search).get("scenario") ?? "runtime"
  const scenario = SCENARIOS[requested]
  try {
    if (!scenario) throw new Error(`Unknown scenario: ${requested}`)
    window.__ARC3D_REPORT__ = await scenario()
  } catch (error) {
    window.__ARC3D_ERROR__ =
      error instanceof Error ? error.message : String(error)
  }
}

void boot()
