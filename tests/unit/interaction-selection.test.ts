import { describe, expect, it } from "vitest"
import { LifecycleManager, ResourceRegistry, createHandle, type Arc3DContext } from "@arc3dlab/core"
import { SelectionController } from "@arc3dlab/interaction"

function selection(): { controller: SelectionController; registry: ResourceRegistry } {
  const registry = new ResourceRegistry()
  const controller = new SelectionController({
    lifecycle: new LifecycleManager(),
    registry,
  } as Arc3DContext)
  return { controller, registry }
}

describe("SelectionController", () => {
  it("stores and clears the selected graphic id", () => {
    const { controller, registry } = selection()
    registry.add(createHandle({ id: "g-1", type: "polygon", native: {} }))
    controller.set("g-1")
    expect(controller.id).toBe("g-1")
    expect(controller.get()?.type).toBe("polygon")
    controller.clear()
    expect(controller.id).toBeUndefined()
    expect(controller.get()).toBeUndefined()
  })
})
