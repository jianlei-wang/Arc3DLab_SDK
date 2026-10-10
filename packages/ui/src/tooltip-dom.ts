import type { WindowPosition } from "@arc3dlab/core"

/**
 * 标记提示元素由 Arc3D 拥有的 HTML 属性名。
 */
export const TOOLTIP_OWNED_ATTR = "data-arc3d-owned"

/**
 * 将客户端坐标转换为相对于宿主容器的坐标。
 * @param clientX - 鼠标事件的客户端 X 坐标
 * @param clientY - 鼠标事件的客户端 Y 坐标
 * @param hostRect - 宿主容器的边界矩形
 * @returns 相对于宿主容器的位置
 */
export function hostRelativePosition(
  clientX: number,
  clientY: number,
  hostRect: { left: number; top: number },
): WindowPosition {
  return { x: clientX - hostRect.left, y: clientY - hostRect.top }
}

/**
 * 根据提示位置计算其偏移样式。
 * @param position - 相对于宿主容器的位置
 * @returns 包含 left 与 top 的样式对象
 */
export function tooltipOffsetStyle(position: WindowPosition): {
  left: string
  top: string
} {
  return {
    left: `${position.x + 15}px`,
    top: `${position.y + 20}px`,
  }
}

/**
 * 创建带有 Arc3D 所有权标记的提示元素。
 * @param id - 元素的 id
 * @returns 新建的提示 DOM 元素
 */
export function createOwnedTooltipElement(id: string): HTMLDivElement {
  const element = document.createElement("div")
  element.id = id
  element.setAttribute(TOOLTIP_OWNED_ATTR, "true")
  element.style.cssText =
    "display:none;pointer-events:none;position:absolute;z-index:1000;opacity:0.8;border-radius:4px;padding:4px 8px;white-space:nowrap;color:#fff;font-size:14px;background:#000000cc;"
  return element
}

/**
 * 移除带有 Arc3D 所有权标记的提示元素。
 * @param element - 待移除的提示元素
 * @returns 元素属于 Arc3D 并被移除时返回 true
 */
export function removeOwnedTooltip(element: {
  getAttribute(name: string): string | null
  remove(): void
}): boolean {
  if (element.getAttribute(TOOLTIP_OWNED_ATTR) !== "true") return false
  element.remove()
  return true
}
