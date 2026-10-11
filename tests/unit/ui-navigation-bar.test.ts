import { describe, expect, it } from "vitest"
import { Arc3DError, LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { NavigationBar } from "@arc3dlab/ui"
import { SceneMode } from "cesium"

interface FakeElement {
  tagName: string
  children: FakeElement[]
  style: Record<string, string>
  attrs: Record<string, string>
  className: string
  textContent: string
  type: string
  removed: boolean
  parent?: FakeElement
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
  appendChild(child: FakeElement): FakeElement
  removeChild(child: FakeElement): void
  addEventListener(type: string, handler: EventListener): void
  removeEventListener(type: string, handler: EventListener): void
  dispatch(type: string): void
  listenerCount(type: string): number
  remove(): void
}

function makeElement(tag = "div"): FakeElement {
  const listeners: Record<string, EventListener[]> = {}
  const element: FakeElement = {
    tagName: tag.toUpperCase(),
    children: [],
    style: {},
    attrs: {},
    className: "",
    textContent: "",
    type: "",
    removed: false,
    setAttribute(name, value) {
      element.attrs[name] = value
    },
    getAttribute(name) {
      return element.attrs[name] ?? null
    },
    appendChild(child) {
      element.children.push(child)
      child.parent = element
      return child
    },
    removeChild(child) {
      const index = element.children.indexOf(child)
      if (index >= 0) element.children.splice(index, 1)
    },
    addEventListener(type, handler) {
      ;(listeners[type] ||= []).push(handler)
    },
    removeEventListener(type, handler) {
      const list = listeners[type] || []
      const index = list.indexOf(handler)
      if (index >= 0) list.splice(index, 1)
    },
    dispatch(type) {
      for (const handler of (listeners[type] || []).slice()) {
        handler(new Event(type))
      }
    },
    listenerCount(type) {
      return (listeners[type] || []).length
    },
    remove() {
      element.removed = true
      element.parent?.removeChild(element)
    },
  }
  return element
}

function makeViewer(container: FakeElement) {
  const calls: unknown[][] = []
  const camera = {
    positionCartographic: { height: 1000 },
    positionWC: { x: 1, y: 2, z: 3 },
    heading: 0.5,
    pitch: -0.5,
    roll: 0,
    zoomIn(amount: number) {
      calls.push(["zoomIn", amount])
    },
    setView(options: unknown) {
      calls.push(["setView", options])
    },
  }
  const scene = {
    mode: SceneMode.SCENE3D,
    morphTo2D(duration: number) {
      calls.push(["morphTo2D", duration])
    },
    morphTo3D(duration: number) {
      calls.push(["morphTo3D", duration])
    },
  }
  return { viewer: { camera, scene, container }, calls }
}

function makeDocument(created: FakeElement[]) {
  return {
    createElement(tag: string): HTMLElement {
      const element = makeElement(tag)
      created.push(element)
      return element as unknown as HTMLElement
    },
  }
}

function makeContext(viewer: unknown): Arc3DContext {
  return {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer } },
  } as unknown as Arc3DContext
}

function findControl(root: FakeElement, control: string): FakeElement {
  const button = root.children.find(
    (child) => child.attrs["data-arc3d-control"] === control,
  )
  if (!button) throw new Error(`control not found: ${control}`)
  return button
}

describe("NavigationBar", () => {
  it("mounts the default controls into the container", () => {
    const container = makeElement()
    const created: FakeElement[] = []
    const { viewer } = makeViewer(container)
    const bar = new NavigationBar(makeContext(viewer), {
      document: makeDocument(created),
      container: container as unknown as HTMLElement,
    })
    bar.mount()
    const root = created[0]
    expect(bar.mounted).toBe(true)
    expect(root.children).toHaveLength(5)
    expect(root.attrs["data-arc3d-owned"]).toBe("true")
    expect(container.children).toContain(root)
  })

  it("drives zoom, top and mode controls", () => {
    const container = makeElement()
    const created: FakeElement[] = []
    const { viewer, calls } = makeViewer(container)
    const bar = new NavigationBar(makeContext(viewer), {
      document: makeDocument(created),
      container: container as unknown as HTMLElement,
    })
    bar.mount()
    const root = created[0]

    findControl(root, "zoomIn").dispatch("click")
    findControl(root, "zoomOut").dispatch("click")
    expect(calls).toContainEqual(["zoomIn", 500])
    expect(calls).toContainEqual(["zoomIn", -500])

    findControl(root, "top").dispatch("click")
    const topCall = calls.find((call) => call[0] === "setView")
    expect(topCall).toBeDefined()

    findControl(root, "mode").dispatch("click")
    expect(calls).toContainEqual(["morphTo2D", 1])
  })

  it("supports a custom control subset", () => {
    const container = makeElement()
    const created: FakeElement[] = []
    const { viewer } = makeViewer(container)
    const bar = new NavigationBar(makeContext(viewer), {
      document: makeDocument(created),
      container: container as unknown as HTMLElement,
      controls: ["zoomIn", "zoomOut"],
    })
    bar.mount()
    expect(created[0].children).toHaveLength(2)
  })

  it("removes DOM and listeners on destroy", () => {
    const container = makeElement()
    const created: FakeElement[] = []
    const { viewer } = makeViewer(container)
    const bar = new NavigationBar(makeContext(viewer), {
      document: makeDocument(created),
      container: container as unknown as HTMLElement,
    })
    bar.mount()
    const root = created[0]
    const button = findControl(root, "home")
    expect(button.listenerCount("click")).toBe(1)
    bar.destroy()
    expect(bar.mounted).toBe(false)
    expect(button.listenerCount("click")).toBe(0)
    expect(root.removed).toBe(true)
  })

  it("requires a DOM factory to mount", () => {
    const container = makeElement()
    const { viewer } = makeViewer(container)
    const bar = new NavigationBar(makeContext(viewer), {
      container: container as unknown as HTMLElement,
    })
    let code: string | undefined
    try {
      bar.mount()
    } catch (error) {
      code = (error as Arc3DError).code
    }
    expect(code).toBe("INVALID_CONTAINER")
  })
})
