import { describe, expect, it } from "vitest"
import { PostRenderController } from "../../packages/scene/src/post-render"

class FakeEvent {
  readonly listeners = new Set<() => void>()

  addEventListener(listener: () => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: () => void): void {
    this.listeners.delete(listener)
  }

  emit(): void {
    for (const listener of Array.from(this.listeners)) listener()
  }
}

describe("PostRenderController", () => {
  it("registers and forwards render callbacks", () => {
    const event = new FakeEvent()
    const controller = new PostRenderController(event)
    let calls = 0
    controller.on(() => {
      calls += 1
    })
    expect(event.listeners.size).toBe(1)
    event.emit()
    expect(calls).toBe(1)
  })

  it("removes a callback through the unsubscribe function", () => {
    const event = new FakeEvent()
    const controller = new PostRenderController(event)
    const unsubscribe = controller.on(() => {})
    unsubscribe()
    expect(event.listeners.size).toBe(0)
  })

  it("clears every callback on destroy", () => {
    const event = new FakeEvent()
    const controller = new PostRenderController(event)
    controller.on(() => {})
    controller.on(() => {})
    controller.destroy()
    expect(event.listeners.size).toBe(0)
  })

  it("deduplicates a listener that is registered twice", () => {
    const event = new FakeEvent()
    const controller = new PostRenderController(event)
    const listener = () => {}
    const first = controller.on(listener)
    const second = controller.on(listener)
    expect(event.listeners.size).toBe(1)
    first()
    expect(event.listeners.size).toBe(0)
    second()
    expect(event.listeners.size).toBe(0)
  })

  it("ignores removal of a listener that was never registered", () => {
    const event = new FakeEvent()
    const controller = new PostRenderController(event)
    expect(() => controller.off(() => {})).not.toThrow()
    expect(event.listeners.size).toBe(0)
  })
})
