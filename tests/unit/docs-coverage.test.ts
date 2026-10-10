import { describe, expect, it } from "vitest"

import { normalize } from "../../scripts/api-docs/normalize.mjs"
import { checkCoverage } from "../../scripts/api-docs/check.mjs"
import { fixtureProject } from "../fixtures/typedoc-model"

describe("docs coverage", () => {
  it("统计公共符号摘要与参数覆盖率", () => {
    const model = normalize(fixtureProject) as any
    const report = checkCoverage(model, { summary: 0, params: 0 })
    expect(report.totals.symbols).toBe(4)
    expect(report.totals.documented).toBe(4)
    expect(report.coverage.summary).toBe(1)
    expect(report.totals.paramsDocumented).toBe(report.totals.params)
    expect(report.pass).toBe(true)
  })

  it("缺失摘要的符号进入未文档化清单", () => {
    const model = normalize(fixtureProject) as any
    model.symbols[0].summaryText = ""
    const report = checkCoverage(model, { summary: 0, params: 0 })
    expect(report.undocumented).toContain(
      `${model.symbols[0].package}.${model.symbols[0].name}`,
    )
    expect(report.totals.documented).toBe(3)
  })

  it("低于阈值时判定失败", () => {
    const model = normalize(fixtureProject) as any
    const report = checkCoverage(model, { summary: 1.1, params: 1.1 })
    expect(report.pass).toBe(false)
  })
})
