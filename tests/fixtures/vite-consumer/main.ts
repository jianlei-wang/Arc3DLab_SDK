import {
  AnalysisJobHost,
  type AnalysisJobHostDiagnostics,
  type AnalysisJobResult,
} from "arc3dlab"

declare global {
  interface Window {
    __ARC3D_CONSUMER_REPORT__?: Record<string, unknown>
    __ARC3D_CONSUMER_ERROR__?: string
  }
}

const POSITIONS: Array<[number, number, number]> = [
  [116.39, 39.9, 0],
  [116.391, 39.9, 0],
]

function diagnosticsOf(host: AnalysisJobHost): AnalysisJobHostDiagnostics {
  return host.getDiagnostics()
}

function distanceOf(result: AnalysisJobResult): number {
  if (result.type !== "distance") {
    throw new Error(`unexpected result type: ${result.type}`)
  }
  return result.meters
}

async function run(): Promise<void> {
  const report: Record<string, unknown> = { reportKind: "packaged-consumer" }

  const workerHost = new AnalysisJobHost({ idleTimeoutMs: 10_000 })
  try {
    const distance = await workerHost.run({
      type: "distance",
      positions: POSITIONS,
    })
    const diagnostics = diagnosticsOf(workerHost)
    report.workerMeters = distanceOf(distance)
    report.workerUnavailable = diagnostics.workerUnavailable
    report.workerCreated = diagnostics.createdWorkers
    report.workerCompleted = diagnostics.completedJobs
    report.workerPending = diagnostics.pendingJobs
    report.workerProtocolErrors = diagnostics.protocolErrors
  } finally {
    workerHost.destroy()
  }

  const fallbackHost = new AnalysisJobHost({
    createWorker: () => undefined,
    idleTimeoutMs: 10_000,
  })
  try {
    const distance = await fallbackHost.run({
      type: "distance",
      positions: POSITIONS,
    })
    const diagnostics = diagnosticsOf(fallbackHost)
    report.fallbackMeters = distanceOf(distance)
    report.fallbackUnavailable = diagnostics.workerUnavailable
    report.fallbackCreated = diagnostics.createdWorkers
    report.fallbackCompleted = diagnostics.completedJobs
    report.fallbackPending = diagnostics.pendingJobs
  } finally {
    fallbackHost.destroy()
  }

  window.__ARC3D_CONSUMER_REPORT__ = report
  document.querySelector("#status")!.textContent = "packaged consumer ok"
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  window.__ARC3D_CONSUMER_ERROR__ = message
  document.querySelector("#status")!.textContent = `failed: ${message}`
})
