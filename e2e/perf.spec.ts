import { expect, test, type Page } from "@playwright/test"

// 真实浏览器性能趋势场景：默认跳过，仅由 nightly workflow 或手动设置
// PERF=1 时运行，避免把单次毫秒数当作 PR 阻断门禁。
const PERF_ENABLED = process.env.PERF === "1"

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
      { timeout: 90_000 },
    )
    .toBe("report")
  const error = await page.evaluate(() => window.__ARC3D_ERROR__)
  expect(error).toBeUndefined()
  return page.evaluate(() => window.__ARC3D_REPORT__)
}

test.describe("browser performance trend", () => {
  test.skip(!PERF_ENABLED, "set PERF=1 to run the performance trend scenario")

  test("collects real SDK create/churn/frame metrics and reclaims resources", async ({
    page,
  }) => {
    await page.goto("/?scenario=perf")
    const report = await waitForReport(page)
    expect(report?.reportKind).toBe("perf")
    expect(report?.ready).toBe(true)
    expect(report?.createdCount).toBe(300)
    expect(report?.frameCount).toBe(60)

    // 仅做结构性断言，时间数值仅作为趋势归档。
    expect(report?.p95FrameMs as number).toBeGreaterThan(0)
    expect(report?.graphicsRemaining).toBe(0)
    expect(report?.registryAfterDestroy).toBe(0)
    expect(report?.trackerAfterDestroy).toBe(0)

    // 便于 nightly 归档趋势数据。
    console.log(`[perf] ${JSON.stringify(report)}`)
  })
})
