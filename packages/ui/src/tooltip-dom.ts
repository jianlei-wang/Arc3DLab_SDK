import type { WindowPosition } from "@arc3dlab/core"

export const TOOLTIP_OWNED_ATTR = "data-arc3d-owned"

export function hostRelativePosition(
  clientX: number,
  clientY: number,
  hostRect: { left: number; top: number }
): WindowPosition {
  return { x: clientX - hostRect.left, y: clientY - hostRect.top }
}

export function tooltipOffsetStyle(position: WindowPosition): { left: string; top: string } {
  return {
    left: `${position.x + 15}px`,
    top: `${position.y + 20}px`,
  }
}

export function createOwnedTooltipElement(id: string): HTMLDivElement {
  const element = document.createElement("div")
  element.id = id
  element.setAttribute(TOOLTIP_OWNED_ATTR, "true")
  element.style.cssText =
    "display:none;pointer-events:none;position:absolute;z-index:1000;opacity:0.8;border-radius:4px;padding:4px 8px;white-space:nowrap;color:#fff;font-size:14px;background:#000000cc;"
  return element
}

export function removeOwnedTooltip(element: {
  getAttribute(name: string): string | null
  remove(): void
}): boolean {
  if (element.getAttribute(TOOLTIP_OWNED_ATTR) !== "true") return false
  element.remove()
  return true
}
