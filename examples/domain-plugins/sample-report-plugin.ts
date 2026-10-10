import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import type { Arc3DPlugin } from "@arc3dlab/sdk"
import { executeAnalysisJob, runAnalysisTask } from "@arc3dlab/analysis"

export interface ReportHost {
  ui: {
    setStatus(text: string): void
    clearStatus(): void
  }
}

export interface ReportAreaInput {
  positions?: PositionInput[]
}

export interface SampleReportPlugin extends Arc3DPlugin<ReportHost> {
  lastTaskId?: string
}

/**
 * Example domain plugin proving the public contracts are sufficient: it only
 * uses `Arc3DPlugin`, `Arc3DContext`, commands and the analysis task runner.
 * Adding a plugin like this requires no changes to `@arc3dlab/core`.
 */
export function createSampleReportPlugin(): SampleReportPlugin {
  const plugin: SampleReportPlugin = {
    name: "sample-report",
    version: "1.0.0",
    requiresCapabilities: [],
    async install(app, context: Arc3DContext) {
      context.capabilities.register({
        name: "plugin:sample-report",
        provider: "sample-report",
        version: "1.0.0",
        available: true,
      })
      context.commands.register({
        name: "report.area",
        version: "1.0.0",
        plugin: "sample-report",
        execute: (input) => {
          const positions = (input as ReportAreaInput).positions ?? []
          return buildAreaReport(app, context, positions)
        },
      })
      app.ui.setStatus("sample-report ready")
    },
    async uninstall(app) {
      app.ui.clearStatus()
    },
  }
  return plugin
}

async function buildAreaReport(
  app: ReportHost,
  context: Arc3DContext,
  positions: PositionInput[],
) {
  const result = await runAnalysisTask<PositionInput[], number>({
    context,
    algorithm: "report.area",
    input: positions,
    execute: () => {
      const job = executeAnalysisJob({ type: "area", positions })
      return {
        value: job.type === "area" ? job.squareMeters : 0,
        units: { area: "squareMeters" },
      }
    },
  })
  app.ui.setStatus(`report ${result.status}`)
  return result
}
