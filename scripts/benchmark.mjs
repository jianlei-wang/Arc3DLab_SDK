import { writeFileSync } from "node:fs"

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

function compareRenderBackends(count) {
  const entityOps = count * 3
  const primitiveOps = 4 + count
  return {
    count,
    entityOps,
    primitiveOps,
    prefer: count > AUTO_PRIMITIVE_THRESHOLD ? "primitive" : "entity",
  }
}

function measure(name, work) {
  const started = performance.now()
  work()
  return { name, durationMs: performance.now() - started }
}

function runCount(graphicCount) {
  const graphics = []
  const spanLng = BENCHMARK_SCENE.east - BENCHMARK_SCENE.west
  const spanLat = BENCHMARK_SCENE.north - BENCHMARK_SCENE.south
  const init = measure("init", () => {
    for (let i = 0; i < graphicCount; i += 1) {
      graphics.push({
        id: `pt-${i}`,
        longitude: BENCHMARK_SCENE.west + ((i % 16) / 15) * spanLng,
        latitude:
          BENCHMARK_SCENE.south + ((Math.floor(i / 16) % 16) / 15) * spanLat,
      })
    }
  })
  const firstFrame = measure("firstFrame", () => {
    void graphics.length
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
  })
  const destroy = measure("destroy", () => {
    graphics.length = 0
  })
  return {
    graphicCount,
    backend: compareRenderBackends(graphicCount),
    phases: [init, firstFrame, pick, destroy],
    picked,
  }
}

const report = {
  scene: BENCHMARK_SCENE,
  threshold: AUTO_PRIMITIVE_THRESHOLD,
  runs: BENCHMARK_SCENE.graphicCounts.map(runCount),
}

const json = `${JSON.stringify(report, null, 2)}\n`
process.stdout.write(json)

const out = process.argv[2]
if (out) writeFileSync(out, json)
