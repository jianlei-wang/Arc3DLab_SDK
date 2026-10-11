import { describe, expect, it } from "vitest"
import {
  DEFAULT_ROUTE_COLORS,
  formatDistance,
  formatDuration,
  formatRouteSummary,
  routeStatusColor,
} from "../../packages/analysis/src/path"

describe("route helpers", () => {
  it("formats distances in metres and kilometres", () => {
    expect(formatDistance(500)).toBe("500 米")
    expect(formatDistance(1500)).toBe("1.5 公里")
    expect(formatDistance(-1)).toBe("0 米")
  })

  it("formats durations in seconds, minutes and hours", () => {
    expect(formatDuration(30)).toBe("30 秒")
    expect(formatDuration(90)).toBe("2 分钟")
    expect(formatDuration(7200)).toBe("2.0 小时")
  })

  it("resolves route status colours with overrides", () => {
    expect(routeStatusColor("smooth")).toBe(DEFAULT_ROUTE_COLORS.smooth)
    expect(routeStatusColor("congested", { congested: "#000000" })).toBe(
      "#000000",
    )
  })

  it("summarises distance and duration", () => {
    const summary = formatRouteSummary({
      distance: 1500,
      duration: 90,
      segments: [],
    })
    expect(summary).toBe("1.5 公里 · 约 2 分钟")
  })
})
