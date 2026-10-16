import { describe, expect, it } from "vitest"
import { AnalysisSampleBudget, yieldToEventLoop } from "@arc3dlab/analysis"

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

  it("ignores non-positive reservations", () => {
    const budget = new AnalysisSampleBudget(2)
    expect(budget.reserve(0)).toBe(0)
    expect(budget.reserve(-5)).toBe(0)
    expect(budget.used).toBe(0)
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
