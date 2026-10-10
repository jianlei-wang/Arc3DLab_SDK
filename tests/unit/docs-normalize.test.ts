import { describe, expect, it } from "vitest"

import { normalize } from "../../scripts/api-docs/normalize.mjs"
import { fixtureProject } from "../fixtures/typedoc-model"

describe("docs normalize", () => {
  const model = normalize(fixtureProject) as any

  it("按包生成命名空间", () => {
    const names = model.packages.map((p: { name: string }) => p.name)
    expect(new Set(names)).toEqual(new Set(["core", "other"]))
  })

  it("跨包同名符号追加包前缀", () => {
    const widgets = model.symbols.filter(
      (s: { name: string }) => s.name === "Widget",
    )
    const pages = widgets.map((s: { page: string }) => s.page).sort()
    expect(pages).toEqual(["core.Widget.html", "other.Widget.html"])
  })

  it("唯一符号使用默认页面名", () => {
    const options = model.symbols.find(
      (s: { name: string }) => s.name === "WidgetOptions",
    )
    expect(options.page).toBe("WidgetOptions.html")
  })

  it("类成员、方法、构造签名被归一化", () => {
    const widget = model.symbols.find(
      (s: { package: string; name: string }) =>
        s.package === "core" && s.name === "Widget",
    )
    expect(widget.kind).toBe("class")
    expect(widget.members.map((m: { name: string }) => m.name)).toContain(
      "title",
    )
    expect(widget.methods.map((m: { name: string }) => m.name)).toContain("run")
    expect(widget.construct.signature).toBe("(options?)")
    expect(widget.construct.params[0].description).toBe("控件选项。")
  })

  it("函数方法带返回值与异常", () => {
    const widget = model.symbols.find(
      (s: { package: string; name: string }) =>
        s.package === "core" && s.name === "Widget",
    )
    const run = widget.methods.find((m: { name: string }) => m.name === "run")
    expect(run.returns.description).toBe("运行结果。")
    expect(run.throws[0].type.text).toBe("Error")
  })

  it("类型别名保留联合类型", () => {
    const status = model.symbols.find(
      (s: { name: string }) => s.name === "Status",
    )
    expect(status.kind).toBe("type-alias")
    expect(status.typeAlias.kind).toBe("union")
    expect(
      status.typeAlias.types.map((t: { value: string }) => t.value),
    ).toEqual(["idle", "ready"])
  })
})
