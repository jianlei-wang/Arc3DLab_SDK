import { describe, expect, it } from "vitest"
import { createImageryProvider, tdtUrl } from "@arc3dlab/data"

describe("createImageryProvider", () => {
  it("requires a runtime token for tianditu", async () => {
    await expect(createImageryProvider({ type: "tdt" })).rejects.toMatchObject({
      code: "AUTH_FAILED",
    })
  })

  it("requires assetId for ion imagery", async () => {
    await expect(createImageryProvider({ type: "ion" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
  })

  it("builds a tianditu wmts url with the token", () => {
    const url = tdtUrl("img", "runtime-token")
    expect(url).toContain("tianditu.gov.cn/img_w/wmts")
    expect(url).toContain("tk=runtime-token")
  })
})
