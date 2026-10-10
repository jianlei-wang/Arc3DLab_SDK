import { describe, expect, it } from "vitest"
import { Arc3DError } from "@arc3dlab/core"
import {
  AnalysisTaskRegistry,
  runAnalysisTask,
  type AnalysisProgress,
} from "@arc3dlab/analysis"
import { createTestContext } from "../fixtures/fake-context"

describe("Analysis task contract", () => {
  it("records a successful task with value, units and timing", async () => {
    const { context } = createTestContext()
    const registry = new AnalysisTaskRegistry()
    const result = await runAnalysisTask<{ n: number }, number>({
      context,
      registry,
      algorithm: "double",
      input: { n: 21 },
      execute: () => ({ value: 42, units: { area: "squareMeters" } }),
    })

    expect(result.status).toBe("succeeded")
    expect(result.value).toBe(42)
    expect(result.units).toEqual({ area: "squareMeters" })
    expect(result.warnings).toEqual([])
    expect(result.artifacts).toEqual([])
    expect(typeof result.startedAt).toBe("number")
    expect(typeof result.finishedAt).toBe("number")
    expect(result.taskId).toBeTruthy()
    expect(registry.get(result.taskId)?.status).toBe("succeeded")
  })

  it("captures failures without throwing", async () => {
    const { context } = createTestContext()
    const result = await runAnalysisTask({
      context,
      algorithm: "boom",
      input: {},
      execute: () => {
        throw new Error("kaboom")
      },
    })
    expect(result.status).toBe("failed")
    expect(result.error).toEqual({ code: "ENGINE_FAILURE", message: "kaboom" })
  })

  it("propagates stable error codes on failure", async () => {
    const { context } = createTestContext()
    const result = await runAnalysisTask({
      context,
      algorithm: "invalid",
      input: {},
      execute: () => {
        throw new Arc3DError("INVALID_ARGUMENT", "bad input")
      },
    })
    expect(result.status).toBe("failed")
    expect(result.error?.code).toBe("INVALID_ARGUMENT")
  })

  it("marks a pre-aborted task as cancelled", async () => {
    const { context } = createTestContext()
    const controller = new AbortController()
    controller.abort()
    const result = await runAnalysisTask({
      context,
      algorithm: "cancellable",
      input: {},
      signal: controller.signal,
      execute: () => ({ value: 1 }),
    })
    expect(result.status).toBe("cancelled")
    expect(result.error?.code).toBe("CANCELLED")
  })

  it("reports progress to the callback and registry", async () => {
    const { context } = createTestContext()
    const registry = new AnalysisTaskRegistry()
    const seen: AnalysisProgress[] = []
    const result = await runAnalysisTask({
      context,
      registry,
      algorithm: "scan",
      input: {},
      onProgress: (progress) => seen.push(progress),
      execute: (runner) => {
        runner.report(1, 4, "stage-1")
        runner.report(4, 4, "stage-2")
        return { value: "done" }
      },
    })
    expect(seen).toEqual([
      { completed: 1, total: 4, stage: "stage-1" },
      { completed: 4, total: 4, stage: "stage-2" },
    ])
    expect(registry.get(result.taskId)?.progress).toEqual({
      completed: 4,
      total: 4,
      stage: "stage-2",
    })
  })
})
