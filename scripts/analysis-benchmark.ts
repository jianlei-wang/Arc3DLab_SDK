import {
  AnalysisJobHost,
  buildCutFillGrid,
} from "../packages/analysis/src/index"
import { WGS84_A } from "../packages/analysis/src/units"

const BUDGET_MS = 5000
const ring = [
  { longitude: 120, latitude: 30 },
  { longitude: 120.2, latitude: 30 },
  { longitude: 120.2, latitude: 30.2 },
  { longitude: 120, latitude: 30.2 },
]
const sizes = [
  { name: "small", samples: 8 },
  { name: "medium", samples: 64 },
  { name: "large", samples: 192 },
]

function analyticArea(): number {
  const width =
    (ring[1].longitude - ring[0].longitude) *
    (Math.PI / 180) *
    WGS84_A *
    Math.cos((ring[0].latitude * Math.PI) / 180)
  const height =
    (ring[2].latitude - ring[0].latitude) * (Math.PI / 180) * WGS84_A
  return width * height
}

function heapPeak(): { rss: number; heapUsed: number } {
  const usage = process.memoryUsage()
  return { rss: usage.rss, heapUsed: usage.heapUsed }
}

function areaOf(cells: Array<{ areaSquareMeters: number }>): number {
  return cells.reduce((sum, cell) => sum + cell.areaSquareMeters, 0)
}

function runSize(size: { name: string; samples: number }) {
  const before = heapPeak()
  const started = performance.now()
  const grid = buildCutFillGrid(ring, size.samples)
  const durationMs = performance.now() - started
  const after = heapPeak()
  const area = areaOf(grid.cells)
  const error = Math.abs(analyticArea() - area) / analyticArea()
  return {
    name: `cutfill-${size.name}`,
    mode: "direct",
    samples: size.samples,
    sampleCount: grid.cells.length,
    durationMs: Number(durationMs.toFixed(3)),
    rssPeakBytes: after.rss,
    heapUsedPeakBytes: after.heapUsed,
    rssGrowthBytes: after.rss - before.rss,
    relativeAreaError: Number(error.toFixed(6)),
    withinBudget: durationMs <= BUDGET_MS,
    assertionsPassed:
      grid.cells.length === size.samples * size.samples &&
      Number.isFinite(grid.resolutionMeters),
  }
}

const host = new AnalysisJobHost({
  createWorker: () => {
    throw new Error(
      "benchmark runs in Node; Worker mode is covered by browser E2E",
    )
  },
})

async function runFallback() {
  const before = heapPeak()
  const started = performance.now()
  const result = await host.run({
    type: "cutfill-grid",
    polygon: ring,
    samples: 64,
  })
  const durationMs = performance.now() - started
  const after = heapPeak()
  const grid = (
    result as {
      type: "cutfill-grid"
      grid: ReturnType<typeof buildCutFillGrid>
    }
  ).grid
  const area = areaOf(grid.cells)
  return {
    name: "cutfill-medium",
    mode: "fallback",
    samples: 64,
    sampleCount: grid.cells.length,
    durationMs: Number(durationMs.toFixed(3)),
    rssPeakBytes: after.rss,
    heapUsedPeakBytes: after.heapUsed,
    rssGrowthBytes: after.rss - before.rss,
    relativeAreaError: Number(
      (Math.abs(analyticArea() - area) / analyticArea()).toFixed(6),
    ),
    withinBudget: durationMs <= BUDGET_MS,
    assertionsPassed:
      result.type === "cutfill-grid" &&
      Number.isFinite(grid.resolutionMeters) &&
      host.getDiagnostics().workerUnavailable,
  }
}

const scenarios = sizes.map(runSize)
scenarios.push(await runFallback())
host.destroy()

const failing = scenarios.filter(
  (scenario) => !scenario.withinBudget || !scenario.assertionsPassed,
)
const report = {
  generatedAt: new Date().toISOString(),
  budgetMs: BUDGET_MS,
  workerMode:
    "Node benchmark uses the in-process fallback; real Worker mode is covered by browser E2E.",
  scenarios,
  ok: failing.length === 0,
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

if (process.argv.includes("--check")) {
  for (const scenario of scenarios) {
    process.stderr.write(
      `${scenario.name} (${scenario.mode}): ${scenario.durationMs}ms (<= ${BUDGET_MS}ms), samples=${scenario.sampleCount}, areaError=${scenario.relativeAreaError}\n`,
    )
  }
  if (failing.length > 0) {
    process.stderr.write(
      `analysis bench:check failed for ${failing.map((s) => s.name).join(", ")}\n`,
    )
    process.exitCode = 1
  } else {
    process.stderr.write("analysis bench:check ok\n")
  }
}
