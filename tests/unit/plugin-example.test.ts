import { describe, expect, it } from "vitest"
import type { AnalysisResult } from "@arc3dlab/analysis"
import { createPluginHarness } from "../fixtures/plugin-harness"
import { createSampleReportPlugin } from "../../examples/domain-plugins/sample-report-plugin"

const SQUARE: Array<[number, number]> = [
  [0, 0],
  [0.01, 0],
  [0.01, 0.01],
  [0, 0.01],
]

describe("Sample domain plugin", () => {
  it("installs, runs a task, and cleans up via the public contracts", async () => {
    const host = createPluginHarness()
    const plugin = createSampleReportPlugin()
    await host.plugins.use(plugin)

    expect(host.context.commands.has("report.area")).toBe(true)
    expect(host.context.capabilities.has("plugin:sample-report")).toBe(true)

    const result = await host.context.commands.execute<AnalysisResult<number>>(
      "report.area",
      { positions: SQUARE },
    )
    expect(result.status).toBe("succeeded")
    expect(result.value).toBeGreaterThan(0)
    expect(result.units).toEqual({ area: "squareMeters" })

    await host.plugins.uninstall("sample-report")
    expect(host.context.commands.has("report.area")).toBe(false)
    expect(host.context.capabilities.has("plugin:sample-report")).toBe(false)
    await host.destroy()
  })
})
