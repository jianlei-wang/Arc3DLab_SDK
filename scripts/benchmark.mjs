import { writeFileSync } from "node:fs"

// 稳定、无外部依赖的性能基准与趋势报告。CI 无 GPU，因此以确定性纯 JS 工作负载
// 建模渲染规模、分析负载、地形采样与创建/销毁循环，并给出宽松的绝对预算上限：
// 预算用于捕获数量级回归（例如意外的 O(n^2)），趋势数值用于人工对比与归档。

const AUTO_PRIMITIVE_THRESHOLD = 64

const BENCHMARK_SCENE = {
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
}

/** 各场景的宽松绝对预算（毫秒）；超过视为数量级回归。 */
const BUDGETS_MS = {
  renderScale: 3000,
  analysisLoad: 3000,
  terrainSampling: 3000,
  lifecycleChurn: 3000,
}

const EARTH_RADIUS_M = 6378137

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function haversine(a, b) {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

function interpolate(a, b, t) {
  return {
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    latitude: a.latitude + (b.latitude - a.latitude) * t,
  }
}

function compareRenderBackends(count) {
  return {
    count,
    entityOps: count * 3,
    primitiveOps: 4 + count,
    prefer: count > AUTO_PRIMITIVE_THRESHOLD ? "primitive" : "entity",
  }
}

function measure(name, work) {
  const started = performance.now()
  const value = work()
  return { name, durationMs: performance.now() - started, value }
}

function scenarioRenderScale() {
  const spanLng = BENCHMARK_SCENE.east - BENCHMARK_SCENE.west
  const spanLat = BENCHMARK_SCENE.north - BENCHMARK_SCENE.south
  const runs = BENCHMARK_SCENE.graphicCounts.map((graphicCount) => {
    const graphics = []
    const init = measure("init", () => {
      for (let i = 0; i < graphicCount; i += 1) {
        graphics.push({
          id: `pt-${i}`,
          longitude: BENCHMARK_SCENE.west + ((i % 16) / 15) * spanLng,
          latitude:
            BENCHMARK_SCENE.south + ((Math.floor(i / 16) % 16) / 15) * spanLat,
        })
      }
      return graphics.length
    })
    let picked = 0
    const pick = measure("pick", () => {
      picked = graphics.filter(
        (item) =>
          item.longitude >= BENCHMARK_SCENE.west &&
          item.longitude <= BENCHMARK_SCENE.east &&
          item.latitude >= BENCHMARK_SCENE.south &&
          item.latitude <= BENCHMARK_SCENE.north,
      ).length
      return picked
    })
    const destroy = measure("destroy", () => {
      graphics.length = 0
      return graphics.length
    })
    const pan = measure("cameraPan", () => {
      let distance = 0
      for (let i = 1; i < BENCHMARK_SCENE.cameraPath.length; i += 1) {
        distance += haversine(
          BENCHMARK_SCENE.cameraPath[i - 1],
          BENCHMARK_SCENE.cameraPath[i],
        )
      }
      return distance
    })
    return {
      graphicCount,
      backend: compareRenderBackends(graphicCount),
      phases: [init, pick, destroy, pan],
      picked,
    }
  })
  const totalMs = runs.reduce(
    (sum, run) => sum + run.phases.reduce((s, p) => s + p.durationMs, 0),
    0,
  )
  const backends = runs.map((run) => run.backend.prefer)
  return {
    runs,
    totalMs,
    assertions: {
      primitiveAboveThreshold: backends[backends.length - 1] === "primitive",
      entityBelowThreshold: backends[0] === "entity",
    },
  }
}

function scenarioAnalysisLoad() {
  const vertexCount = 5000
  const polyline = Array.from({ length: vertexCount }, (_, i) => ({
    longitude: 104 + (i / vertexCount) * 0.2,
    latitude: 30.5 + Math.sin(i / 50) * 0.01,
  }))
  const samplesPerSegment = 4

  const length = measure("polylineLength", () => {
    let total = 0
    for (let i = 1; i < polyline.length; i += 1) {
      total += haversine(polyline[i - 1], polyline[i])
    }
    return total
  })

  const interpolateOp = measure("interpolate", () => {
    let produced = 0
    for (let i = 1; i < polyline.length; i += 1) {
      for (let s = 0; s < samplesPerSegment; s += 1) {
        interpolate(polyline[i - 1], polyline[i], s / samplesPerSegment)
        produced += 1
      }
    }
    return produced
  })

  const centroid = measure("centroid", () => {
    let x = 0
    let y = 0
    for (const point of polyline) {
      x += point.longitude
      y += point.latitude
    }
    return { longitude: x / polyline.length, latitude: y / polyline.length }
  })

  return {
    vertexCount,
    samplesPerSegment,
    phases: [length, interpolateOp, centroid],
    totalMs: length.durationMs + interpolateOp.durationMs + centroid.durationMs,
    assertions: {
      sampleCount:
        interpolateOp.value === (vertexCount - 1) * samplesPerSegment,
    },
  }
}

function scenarioTerrainSampling() {
  const gridSize = 300
  const heightGrid = new Float64Array(gridSize * gridSize)
  for (let i = 0; i < heightGrid.length; i += 1) {
    heightGrid[i] = Math.sin(i / 97) * 50 + ((i * 13) % 37)
  }
  const sampleTarget = 20000

  const sampling = measure("bilinearSample", () => {
    let accumulator = 0
    for (let i = 0; i < sampleTarget; i += 1) {
      const gx = ((i * 7) % (gridSize - 1)) + 0.5
      const gy = ((i * 11) % (gridSize - 1)) + 0.5
      const x0 = Math.floor(gx)
      const y0 = Math.floor(gy)
      const fx = gx - x0
      const fy = gy - y0
      const top =
        heightGrid[y0 * gridSize + x0] * (1 - fx) +
        heightGrid[y0 * gridSize + x0 + 1] * fx
      const bottom =
        heightGrid[(y0 + 1) * gridSize + x0] * (1 - fx) +
        heightGrid[(y0 + 1) * gridSize + x0 + 1] * fx
      accumulator += top * (1 - fy) + bottom * fy
    }
    return accumulator
  })

  return {
    gridSize,
    sampleTarget,
    phases: [sampling],
    totalMs: sampling.durationMs,
    assertions: { finite: Number.isFinite(sampling.value) },
  }
}

function scenarioLifecycleChurn() {
  const cycles = 5000
  const resourcesPerCycle = 4

  const churn = measure("createDestroy", () => {
    let destroyed = 0
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const registry = new Map()
      for (let r = 0; r < resourcesPerCycle; r += 1) {
        const id = `res-${cycle}-${r}`
        registry.set(id, { id, owned: true, destroyed: false })
      }
      for (const id of Array.from(registry.keys()).reverse()) {
        const handle = registry.get(id)
        if (handle && handle.owned && !handle.destroyed) {
          handle.destroyed = true
          destroyed += 1
        }
        registry.delete(id)
      }
    }
    return destroyed
  })

  return {
    cycles,
    resourcesPerCycle,
    phases: [churn],
    totalMs: churn.durationMs,
    assertions: { destroyedAll: churn.value === cycles * resourcesPerCycle },
  }
}

function withBudget(name, scenario) {
  const budgetMs = BUDGETS_MS[name]
  const withinBudget = scenario.totalMs <= budgetMs
  const assertionsPassed = Object.values(scenario.assertions).every(Boolean)
  return {
    name,
    budgetMs,
    durationMs: Number(scenario.totalMs.toFixed(3)),
    withinBudget,
    assertionsPassed,
    detail: scenario,
  }
}

const scenarios = [
  withBudget("renderScale", scenarioRenderScale()),
  withBudget("analysisLoad", scenarioAnalysisLoad()),
  withBudget("terrainSampling", scenarioTerrainSampling()),
  withBudget("lifecycleChurn", scenarioLifecycleChurn()),
]

const failing = scenarios.filter(
  (scenario) => !scenario.withinBudget || !scenario.assertionsPassed,
)

const report = {
  scene: BENCHMARK_SCENE,
  autoPrimitiveThreshold: AUTO_PRIMITIVE_THRESHOLD,
  budgets: BUDGETS_MS,
  generatedAt: new Date().toISOString(),
  scenarios,
  ok: failing.length === 0,
}

const json = `${JSON.stringify(report, null, 2)}\n`
process.stdout.write(json)

const out = process.argv.find(
  (arg) => arg.endsWith(".json") && !arg.startsWith("--"),
)
if (out) writeFileSync(out, json)

if (process.argv.includes("--check")) {
  for (const scenario of scenarios) {
    const flags = `${scenario.withinBudget ? "budget ok" : "BUDGET EXCEEDED"} / ${
      scenario.assertionsPassed ? "assertions ok" : "ASSERTIONS FAILED"
    }`
    process.stderr.write(
      `${scenario.name}: ${scenario.durationMs}ms (<= ${scenario.budgetMs}ms) ${flags}\n`,
    )
  }
  if (failing.length > 0) {
    process.stderr.write(
      `bench:check failed for ${failing.map((s) => s.name).join(", ")}\n`,
    )
    process.exitCode = 1
  } else {
    process.stderr.write("bench:check ok\n")
  }
}
