import { expect, test } from "@playwright/test"

test("runs the runtime path: create, add, pick, analyse, destroy, rebuild", async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto("/")

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

  const report = await page.evaluate(() => window.__ARC3D_REPORT__)
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
