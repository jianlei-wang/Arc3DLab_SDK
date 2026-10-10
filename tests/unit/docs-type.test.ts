import { describe, expect, it } from "vitest"

import { normalizeType, typeToText } from "../../scripts/api-docs/normalize.mjs"
import { renderType, typeToPlain } from "../../scripts/api-docs/render/html.mjs"

describe("docs type expressions", () => {
  const ctx = { resolveTarget: () => undefined }

  it("数组归一化并渲染为 Array.<T>", () => {
    const type = {
      type: "array",
      elementType: { type: "intrinsic", name: "string" },
    }
    expect(normalizeType(type, ctx).kind).toBe("array")
    expect(typeToText(type, ctx)).toBe("Array.<string>")
  })

  it("引用类型解析到页面", () => {
    const ctxWithPage = {
      resolveTarget: (id: number) =>
        id === 20 ? { page: "WidgetOptions.html" } : undefined,
    }
    expect(
      normalizeType(
        { type: "reference", name: "WidgetOptions", target: 20 },
        ctxWithPage,
      ),
    ).toEqual({
      kind: "reference",
      name: "WidgetOptions",
      page: "WidgetOptions.html",
      args: [],
    })
  })

  it("无法解析的引用退化为纯文本且不建链", () => {
    const expr = normalizeType(
      { type: "reference", name: "Missing", target: 999 },
      ctx,
    )
    expect(expr.page).toBeUndefined()
    expect(
      typeToText({ type: "reference", name: "Missing", target: 999 }, ctx),
    ).toBe("Missing")
    expect(renderType(expr, { linkNames: {} })).toBe("Missing")
  })

  it("联合类型渲染带转义分隔符", () => {
    const expr = normalizeType(
      {
        type: "union",
        types: [
          { type: "literal", value: "a" },
          { type: "literal", value: "b" },
        ],
      },
      ctx,
    )
    expect(renderType(expr, { linkNames: {} })).toBe('"a" | "b"')
    expect(typeToPlain(expr)).toBe('"a" | "b"')
  })
})
