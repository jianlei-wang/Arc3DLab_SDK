import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { BENCHMARK_SCENE, runRuntimeBenchmark } from "@arc3dlab/core"
import {
  AUTO_PRIMITIVE_THRESHOLD,
  compareRenderBackends,
} from "../../packages/graphics/src/policy"

describe("runRuntimeBenchmark", () => {
  it("records init, firstFrame, pick, and destroy for a fixed scene", () => {
    const report = runRuntimeBenchmark(BENCHMARK_SCENE.graphicCounts[0])
    expect(report.scene).toEqual(BENCHMARK_SCENE)
    expect(report.graphicCount).toBe(64)
    expect(report.phases.map((phase) => phase.name)).toEqual([
      "init",
      "firstFrame",
      "pick",
      "destroy",
    ])
    expect(report.picked).toBe(64)
    for (const phase of report.phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("compareRenderBackends", () => {
  it("writes the auto primitive threshold from backend cost", () => {
    expect(AUTO_PRIMITIVE_THRESHOLD).toBe(64)
    expect(compareRenderBackends(64).prefer).toBe("entity")
    expect(compareRenderBackends(65).prefer).toBe("primitive")
    expect(compareRenderBackends(256).primitiveOps).toBeLessThan(
      compareRenderBackends(256).entityOps,
    )
  })
})

describe("scripts/benchmark.mjs", () => {
  it("prints a budgeted JSON trend report covering all scenarios", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..")
    const output = execFileSync("node", ["scripts/benchmark.mjs"], {
      cwd: root,
      encoding: "utf8",
    })
    const report = JSON.parse(output)
    expect(report.autoPrimitiveThreshold).toBe(AUTO_PRIMITIVE_THRESHOLD)
    expect(report.scene.graphicCounts).toEqual([
      ...BENCHMARK_SCENE.graphicCounts,
    ])
    expect(
      report.scenarios.map((scenario: { name: string }) => scenario.name),
    ).toEqual([
      "renderScale",
      "analysisLoad",
      "terrainSampling",
      "lifecycleChurn",
    ])
    expect(report.ok).toBe(true)

    const renderScale = report.scenarios[0]
    expect(renderScale.detail.runs).toHaveLength(3)
    expect(renderScale.detail.runs[0].picked).toBe(64)
    expect(renderScale.detail.runs[2].backend.prefer).toBe("primitive")
    for (const scenario of report.scenarios) {
      expect(scenario.withinBudget).toBe(true)
      expect(scenario.assertionsPassed).toBe(true)
    }
  })
})

describe("scripts/analysis-benchmark.ts", () => {
  it("prints repeatable volume baselines with budgets and sampling error", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..")
    const output = execFileSync(
      process.execPath,
      [
        join(root, "node_modules/vite-node/vite-node.mjs"),
        "--root",
        root,
        join(root, "scripts/analysis-benchmark.ts"),
        "--check",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
    const report = JSON.parse(output)
    expect(report.budgetMs).toBe(5000)
    expect(report.ok).toBe(true)
    expect(
      report.scenarios.map((scenario: { name: string; mode: string }) => [
        scenario.name,
        scenario.mode,
      ]),
    ).toEqual([
      ["cutfill-small", "direct"],
      ["cutfill-medium", "direct"],
      ["cutfill-large", "direct"],
      ["cutfill-medium", "fallback"],
    ])
    for (const scenario of report.scenarios) {
      expect(scenario.withinBudget).toBe(true)
      expect(scenario.assertionsPassed).toBe(true)
      expect(scenario.sampleCount).toBe(scenario.samples * scenario.samples)
      if (scenario.samples >= 64) {
        expect(scenario.relativeAreaError).toBeLessThan(0.05)
      }
      expect(scenario.rssPeakBytes).toBeGreaterThan(0)
    }
  }, 30_000)
})
