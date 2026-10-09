import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  classifyLoadError,
  classifyLoadFailure,
} from "@arc3dlab/core"

describe("classifyLoadFailure", () => {
  it("maps token and auth failures", () => {
    expect(classifyLoadFailure({ status: 401, message: "nope" })).toMatchObject({
      code: "AUTH_FAILED",
      stage: "token",
    })
    expect(classifyLoadFailure(new Error("Ion access denied"))).toMatchObject({
      code: "AUTH_FAILED",
      stage: "token",
    })
  })

  it("maps network and format failures", () => {
    expect(classifyLoadFailure(new Error("fetch failed"))).toMatchObject({
      code: "NETWORK_FAILURE",
      stage: "network",
    })
    expect(classifyLoadFailure({ status: 500, message: "bad gateway" })).toMatchObject({
      code: "NETWORK_FAILURE",
      stage: "network",
    })
    expect(classifyLoadFailure(new Error("malformed geojson"))).toMatchObject({
      code: "INVALID_FORMAT",
      stage: "format",
    })
  })

  it("maps engine failures and preserves Arc3DError codes", () => {
    expect(classifyLoadFailure(new Error("WebGL context lost"))).toMatchObject({
      code: "ENGINE_FAILURE",
      stage: "engine",
    })
    const original = new Arc3DError("CANCELLED", "stopped")
    expect(classifyLoadFailure(original)).toEqual({
      code: "CANCELLED",
      stage: "engine",
      message: "stopped",
    })
  })
})

describe("classifyLoadError", () => {
  it("returns Arc3DError instances and wraps unknown errors", () => {
    const original = new Arc3DError("AUTH_FAILED", "missing token")
    expect(classifyLoadError(original)).toBe(original)
    const wrapped = classifyLoadError(new Error("parse kml failed"))
    expect(wrapped).toBeInstanceOf(Arc3DError)
    expect(wrapped.code).toBe("INVALID_FORMAT")
    expect(wrapped.cause).toBeInstanceOf(Error)
  })
})
