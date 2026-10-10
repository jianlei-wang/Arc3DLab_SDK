import { describe, expect, it } from "vitest"

import { normalize } from "../../scripts/api-docs/normalize.mjs"
import { renderSite } from "../../scripts/api-docs/render/index.mjs"
import { fixtureProject } from "../fixtures/typedoc-model"

describe("docs render", () => {
  const model = normalize(fixtureProject) as any
  const pages = renderSite(model) as Map<string, string>

  it("生成首页、包页与符号页", () => {
    expect(pages.has("index.html")).toBe(true)
    expect(pages.has("core.html")).toBe(true)
    expect(pages.has("other.html")).toBe(true)
    expect(pages.has("WidgetOptions.html")).toBe(true)
    expect(pages.has("core.Widget.html")).toBe(true)
    expect(pages.has("other.Widget.html")).toBe(true)
  })

  it("页面使用 Cesium/JSDoc 默认结构类名", () => {
    const html = pages.get("core.Widget.html")!
    for (const cls of [
      "container-overview",
      "nameContainer",
      "signature",
      "params",
      "subsection-title",
    ]) {
      expect(html).toContain(cls)
    }
    expect(html).toContain("param-type")
  })

  it("方法渲染参数表、返回值与异常", () => {
    const html = pages.get("core.Widget.html")!
    expect(html).toContain("times")
    expect(html).toContain("Returns:")
    expect(html).toContain("Throws:")
  })

  it("交叉链接全部指向已生成页面", () => {
    const known = new Set(pages.keys())
    const hrefPattern = /href="([A-Za-z0-9_.\-]+\.html)"/g
    for (const [file, html] of pages) {
      let match
      while ((match = hrefPattern.exec(html)) !== null) {
        expect(known.has(match[1]), `${file} -> ${match[1]}`).toBe(true)
      }
    }
  })
})
