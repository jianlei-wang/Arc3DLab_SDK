import type { PositionInput } from "@arc3dlab/core"
import { toCartesian3 } from "@arc3dlab/engine-cesium"
import { graphicChildId } from "./policy"

export function syncPointCollection(
  collection: {
    length: number
    get(index: number): { position?: unknown }
    add(options: Record<string, unknown>): unknown
    remove(item: unknown): boolean
  },
  groupId: string,
  positions: PositionInput[],
  style: {
    color: unknown
    outlineColor: unknown
    pixelSize: number
    outlineWidth: number
  },
): void {
  const cartesians = positions.map((position) => toCartesian3(position))
  while (collection.length > cartesians.length) {
    collection.remove(collection.get(collection.length - 1))
  }
  cartesians.forEach((cartesian, index) => {
    if (index < collection.length) {
      collection.get(index).position = cartesian
      return
    }
    collection.add({
      id: graphicChildId(groupId, index),
      position: cartesian,
      color: style.color,
      outlineColor: style.outlineColor,
      pixelSize: style.pixelSize,
      outlineWidth: style.outlineWidth,
      show: true,
    })
  })
}
