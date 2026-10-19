import { expect, test, type Page } from "@playwright/test"

async function waitForReport(
  page: Page,
): Promise<Record<string, unknown> | undefined> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__ARC3D_ERROR__
            ? `error:${window.__ARC3D_ERROR__}`
            : window.__ARC3D_REPORT__
              ? "report"
              : "pending",
        ),
      { timeout: 60_000 },
    )
    .toBe("report")
  const error = await page.evaluate(() => window.__ARC3D_ERROR__)
  expect(error).toBeUndefined()
  return page.evaluate(() => window.__ARC3D_REPORT__)
}

test("runs the runtime path: create, add, pick, analyse, destroy, rebuild", async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto("/")
  const report = await waitForReport(page)
  expect(report).toBeDefined()

  const readiness = report?.ready as {
    ready: boolean
    timedOut: boolean
    destroyed: boolean
    defaultBaseLayer: string
  }
  expect(readiness.ready).toBe(true)
  expect(readiness.timedOut).toBe(false)
  expect(readiness.destroyed).toBe(false)
  expect(readiness.defaultBaseLayer).toBe("ready")

  expect(typeof report?.graphicId).toBe("string")
  expect(report?.pickKind).toBe("graphic")
  expect(report?.pickGraphicId).toBe(report?.graphicId)
  expect(report?.distanceMeters as number).toBeGreaterThan(0)
  expect(typeof report?.plotId).toBe("string")
  expect(report?.plotShapeCount as number).toBeGreaterThan(0)
  expect(typeof report?.dynamicRadarId).toBe("string")
  expect(typeof report?.dynamicSpreadId).toBe("string")
  expect(report?.dynamicMaterialsRendered).toBe(true)
  expect(report?.weatherEnabled).toBe(true)
  expect(report?.weatherDisabled).toBe(true)
  expect(report?.swipePosition).toBeCloseTo(0.35, 5)
  expect(report?.swipeDestroyed).toBe(true)
  expect(report?.destroyed).toBe(true)
  expect(report?.rebuiltReady).toBe(true)

  const canvas = page.locator("#app canvas").first()
  await expect(canvas).toBeVisible()
  const size = await canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
  }))
  expect(size.width).toBeGreaterThan(0)
  expect(size.height).toBeGreaterThan(0)

  expect(pageErrors).toEqual([])
})

test("reports initialization failure without throwing out of the harness", async ({
  page,
}) => {
  await page.goto("/?scenario=init-failure")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("init-failure")
  expect(report?.initFailed).toBe(true)
  expect(typeof report?.errorCode).toBe("string")
})

test("keeps cleaning up resources when one destroy throws", async ({
  page,
}) => {
  await page.goto("/?scenario=cleanup-failure")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("cleanup-failure")
  expect(report?.destroyAttempted).toBe(true)
  expect(report?.registryEmpty).toBe(true)
  expect(report?.hasFailing).toBe(false)
  expect(report?.hasSibling).toBe(false)
})

test("runs two app instances concurrently without cross-talk", async ({
  page,
}) => {
  await page.goto("/?scenario=multi-instance")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("multi-instance")
  expect(report?.firstReady).toBe(true)
  expect(report?.otherReady).toBe(true)
  expect(report?.secondAliveAfterFirstDestroyed).toBe(true)
  expect(report?.bothGone).toBe(true)
})

test("cancels a long-running analysis task", async ({ page }) => {
  await page.goto("/?scenario=task-cancel")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("task-cancel")
  expect(report?.status).toBe("cancelled")
  expect(report?.registeredStatus).toBe("cancelled")
})

test("falls back in-process when Worker is disabled or creation fails", async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto("/?scenario=worker-fallback")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("worker-fallback")
  expect(report?.disabledReady).toBe(true)
  expect(report?.disabledDistanceMeters as number).toBeGreaterThan(0)
  expect(report?.disabledWorkerUnavailable).toBe(true)
  expect(report?.disabledCreatedWorkers).toBe(0)
  expect(report?.disabledPendingJobs).toBe(0)
  expect(report?.disabledCompletedJobs).toBe(1)

  expect(report?.failingReady).toBe(true)
  expect(report?.failingSquareMeters as number).toBeGreaterThan(0)
  expect(report?.failingWorkerUnavailable).toBe(true)
  expect(report?.failingCreatedWorkers).toBe(0)
  expect(report?.failingPendingJobs).toBe(0)
  expect(report?.failingCompletedJobs).toBe(1)
  expect(pageErrors).toEqual([])
})

test("returns to the resource baseline across repeated create/destroy cycles", async ({
  page,
}) => {
  await page.goto("/?scenario=lifecycle-baseline")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("lifecycle-baseline")
  const cycles = report?.cycles as Array<Record<string, unknown>>
  expect(cycles).toHaveLength(3)
  for (const cycle of cycles) {
    expect(cycle.ready).toBe(true)
    expect(cycle.graphics).toBe(0)
    expect(cycle.registry).toBe(0)
    expect(cycle.tracker).toBe(0)
    expect(cycle.pendingJobsBefore).toBe(0)
    expect(cycle.activeWorkersAfter).toBe(0)
    expect(cycle.idleWorkersAfter).toBe(0)
    expect(cycle.pendingJobsAfter).toBe(0)
    expect(cycle.terminated).toBe(true)
    expect(cycle.peakWorkersBefore).toBeLessThanOrEqual(1)
  }
})

test("simulates external service failure and success", async ({ page }) => {
  await page.goto("/?scenario=external-service")
  const report = await waitForReport(page)
  expect(report?.reportKind).toBe("external-service")
  expect(report?.providerMissingThrew).toBe(true)
  expect(typeof report?.providerMissingCode).toBe("string")
  expect(report?.geocodeCount).toBe(1)
  expect(report?.geocodeStreet).toBe("天安门")
})
