import { describe, expect, it } from "vitest"
import type { Viewer } from "cesium"
import { CreditManager } from "../../packages/engine-cesium/src/credits"

interface FakeStyle {
  display: string
  fontSize: string
  lineHeight: string
  padding: string
}

interface FakeElement {
  style: FakeStyle
  parentNode: FakeElement | null
  readonly children: FakeElement[]
  appendChild(child: FakeElement): FakeElement
  removeChild(child: FakeElement): FakeElement
}

function createElement(): FakeElement {
  const element: FakeElement = {
    style: { display: "", fontSize: "", lineHeight: "", padding: "" },
    parentNode: null,
    children: [],
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child)
      child.parentNode = element
      element.children.push(child)
      return child
    },
    removeChild(child) {
      const index = element.children.indexOf(child)
      if (index >= 0) element.children.splice(index, 1)
      if (child.parentNode === element) child.parentNode = null
      return child
    },
  }
  return element
}

function asElement(element: FakeElement): Element {
  return element as unknown as Element
}

function createViewer(creditContainer: FakeElement): Viewer {
  return { cesiumWidget: { creditContainer } } as unknown as Viewer
}

describe("CreditManager", () => {
  it("keeps credits visible and compresses layout in compact mode", () => {
    const parent = createElement()
    const container = createElement()
    parent.appendChild(container)
    const manager = new CreditManager(createViewer(container))

    manager.setMode("compact")

    expect(manager.getMode()).toBe("compact")
    expect(container.style.display).not.toBe("none")
    expect(container.style.fontSize).toBe("10px")
    expect(container.parentNode).toBe(parent)
  })

  it("mounts the container in custom mode and restores it on default", () => {
    const parent = createElement()
    const container = createElement()
    const custom = createElement()
    parent.appendChild(container)
    const manager = new CreditManager(createViewer(container))

    manager.setMode("custom", asElement(custom))
    expect(container.parentNode).toBe(custom)
    expect(manager.getContainer()).toBe(custom)

    manager.setMode("default")
    expect(container.parentNode).toBe(parent)
    expect(manager.getContainer()).toBe(container)
    expect(container.style.fontSize).toBe("")
  })

  it("recovers the original position across default -> custom -> compact -> default", () => {
    const parent = createElement()
    const container = createElement()
    const custom = createElement()
    parent.appendChild(container)
    const manager = new CreditManager(createViewer(container))

    manager.setMode("default")
    expect(container.parentNode).toBe(parent)

    manager.setMode("custom", asElement(custom))
    expect(container.parentNode).toBe(custom)

    manager.setMode("compact")
    expect(container.parentNode).toBe(parent)
    expect(container.style.display).not.toBe("none")
    expect(container.style.fontSize).toBe("10px")

    manager.setMode("default")
    expect(container.parentNode).toBe(parent)
    expect(container.style.fontSize).toBe("")
    expect(container.style.display).toBe("")
  })

  it("restores a pre-existing baseline display", () => {
    const parent = createElement()
    const container = createElement()
    container.style.display = "block"
    parent.appendChild(container)
    const manager = new CreditManager(createViewer(container))

    manager.setMode("compact")
    manager.setMode("default")

    expect(container.style.display).toBe("block")
  })

  it("falls back to the original position when no custom container is given", () => {
    const parent = createElement()
    const container = createElement()
    parent.appendChild(container)
    const manager = new CreditManager(createViewer(container))

    manager.setMode("custom")

    expect(container.parentNode).toBe(parent)
    expect(manager.getContainer()).toBe(container)
  })
})
