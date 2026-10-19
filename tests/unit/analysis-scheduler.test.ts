import { describe, expect, it } from "vitest"
import { AnalysisSampleBudget, yieldToEventLoop } from "@arc3dlab/analysis"

function expectInvalidArgument(run: () => unknown): void {
  try {
    run()
    throw new Error("expected an INVALID_ARGUMENT error")
  } catch (error) {
    expect(error).toMatchObject({ code: "INVALID_ARGUMENT" })
  }
}

describe("AnalysisSampleBudget", () => {
  it("accumulates reservations within the budget", () => {
    const budget = new AnalysisSampleBudget(10)
    expect(budget.reserve(4)).toBe(4)
    expect(budget.reserve(6)).toBe(6)
    expect(budget.used).toBe(10)
    expect(budget.remaining).toBe(0)
  })

  it("rejects reservations that exceed the remaining budget", () => {
    const budget = new AnalysisSampleBudget(5)
    budget.reserve(3)
    expect(() => budget.reserve(3)).toThrowError(/budget exceeded/)
    expect(budget.used).toBe(3)
    expect(budget.remaining).toBe(2)
  })

  it("ignores zero reservations but rejects negative or fractional ones", () => {
    const budget = new AnalysisSampleBudget(2)
    expect(budget.reserve(0)).toBe(0)
    expect(budget.used).toBe(0)
    for (const count of [
      -5,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expectInvalidArgument(() => budget.reserve(count))
    }
    expect(budget.used).toBe(0)
  })

  it("rejects invalid explicit limits instead of substituting defaults", () => {
    for (const maxSamples of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 2,
      "10",
    ]) {
      expectInvalidArgument(
        () => new AnalysisSampleBudget(maxSamples as number),
      )
    }
  })

  it("uses the default limit only when the argument is omitted", () => {
    const implicit = new AnalysisSampleBudget()
    expect(implicit.maxSamples).toBe(10_000)
    expect(implicit.remaining).toBe(10_000)
  })

  it("accepts zero and the largest safe integer as limits", () => {
    const zero = new AnalysisSampleBudget(0)
    expect(zero.maxSamples).toBe(0)
    expect(zero.reserve(0)).toBe(0)

    const huge = new AnalysisSampleBudget(Number.MAX_SAFE_INTEGER)
    expect(huge.maxSamples).toBe(Number.MAX_SAFE_INTEGER)
    expect(huge.reserve(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
    expect(huge.used).toBe(Number.MAX_SAFE_INTEGER)
    expect(huge.remaining).toBe(0)
  })

  it("keeps the accumulated invariant across many reservations", () => {
    const budget = new AnalysisSampleBudget(1000)
    for (let index = 0; index < 500; index += 1) {
      budget.reserve(2)
      expect(budget.used).toBe((index + 1) * 2)
      expect(budget.used + budget.remaining).toBe(budget.maxSamples)
      expect(budget.used).toBeLessThanOrEqual(budget.maxSamples)
      expect(budget.remaining).toBeGreaterThanOrEqual(0)
    }
    expectInvalidArgument(() => budget.reserve(1))
    expect(budget.used).toBe(1000)
  })

  it("does not mutate state when a reservation is rejected", () => {
    const budget = new AnalysisSampleBudget(5)
    budget.reserve(4)
    expect(() => budget.reserve(2)).toThrowError(/budget exceeded/)
    expect(budget.used).toBe(4)
    expect(budget.remaining).toBe(1)
    expect(budget.reserve(1)).toBe(1)
    expect(budget.remaining).toBe(0)
  })

  it("treats an exhausted budget as unavailable", () => {
    const budget = new AnalysisSampleBudget(0)
    expect(budget.remaining).toBe(0)
    expect(() => budget.reserve(1)).toThrowError(/budget exceeded/)
  })
})

describe("yieldToEventLoop", () => {
  it("yields on a macrotask by default", async () => {
    const order: string[] = []
    const pending = yieldToEventLoop().then(() => order.push("resumed"))
    void Promise.resolve().then(() => order.push("microtask"))
    await pending
    expect(order).toEqual(["microtask", "resumed"])
  })

  it("yields on a microtask when requested", async () => {
    const order: string[] = []
    const pending = yieldToEventLoop("microtask").then(() =>
      order.push("resumed"),
    )
    void Promise.resolve().then(() => order.push("microtask"))
    await pending
    expect(order).toEqual(["resumed", "microtask"])
  })
})
