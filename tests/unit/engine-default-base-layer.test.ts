import { describe, expect, it } from "vitest"
import type { ImageryLayer } from "cesium"
import { DefaultBaseLayerController } from "../../packages/engine-cesium/src/default-base-layer"

function makeLayer(): ImageryLayer {
  return { show: true } as unknown as ImageryLayer
}

function makeController(): {
  controller: DefaultBaseLayerController
  added: ImageryLayer[]
  lowered: ImageryLayer[]
  renders: () => number
} {
  const added: ImageryLayer[] = []
  const lowered: ImageryLayer[] = []
  let renderCount = 0
  const controller = new DefaultBaseLayerController({
    addToBottom: (layer) => added.push(layer),
    lowerToBottom: (layer) => lowered.push(layer),
    requestRender: () => {
      renderCount += 1
    },
  })
  return { controller, added, lowered, renders: () => renderCount }
}

describe("DefaultBaseLayerController", () => {
  it("shows the placeholder by default when it loads", () => {
    const { controller, added } = makeController()
    controller.markLoading()
    const layer = makeLayer()
    controller.attach(layer)
    expect(layer.show).toBe(true)
    expect(added).toEqual([layer])
    expect(controller.state).toBe("ready")
  })

  it("keeps the placeholder hidden when it loads after a custom basemap", () => {
    const { controller, added } = makeController()
    controller.markLoading()
    controller.setVisible(false)
    const layer = makeLayer()
    controller.attach(layer)
    expect(layer.show).toBe(false)
    expect(added).toEqual([layer])
    expect(controller.state).toBe("ready")
  })

  it("hides an already loaded placeholder without reordering", () => {
    const { controller, lowered } = makeController()
    const layer = makeLayer()
    controller.attach(layer)
    controller.setVisible(false)
    expect(layer.show).toBe(false)
    expect(lowered).toEqual([])
  })

  it("restores the placeholder to the bottom when shown again", () => {
    const { controller, lowered, renders } = makeController()
    const layer = makeLayer()
    controller.attach(layer)
    controller.setVisible(false)
    controller.setVisible(true)
    expect(layer.show).toBe(true)
    expect(lowered).toEqual([layer])
    expect(renders()).toBe(2)
  })

  it("reports failure state", () => {
    const { controller } = makeController()
    controller.markLoading()
    controller.markFailed()
    expect(controller.state).toBe("failed")
  })

  it("drops the layer reference on clear", () => {
    const { controller } = makeController()
    controller.attach(makeLayer())
    controller.clear()
    expect(controller.imagery).toBeUndefined()
    controller.setVisible(false)
    expect(controller.state).toBe("ready")
  })
})
