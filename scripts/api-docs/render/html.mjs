/**
 * HTML 与类型表达式渲染助手。
 */

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;")
}

/** 渲染注释 parts（支持 {@link} 与代码块）。 */
export function renderParts(parts, ctx, options = {}) {
  if (!parts || !parts.length) return ""
  return parts
    .map((part) => {
      if (!part) return ""
      if (part.kind === "code") {
        return `<pre><code class="language-javascript">${escapeHtml(part.text)}</code></pre>`
      }
      if (part.kind === "inline-tag") {
        return renderInlineTag(part, ctx, options)
      }
      return linkifyText(escapeHtml(part.text || ""), ctx)
    })
    .join("")
}

function renderInlineTag(part, ctx, options) {
  if (part.tag === "@link") {
    const label =
      part.text || (typeof part.target === "string" ? part.target : "link")
    const page =
      typeof part.target === "number" && ctx
        ? ctx.pageForId(part.target)
        : undefined
    if (page) {
      return `<a href="${escapeAttr(page)}"><code>${escapeHtml(label)}</code></a>`
    }
    return `<code>${escapeHtml(label)}</code>`
  }
  return escapeHtml(part.text || "")
}

/** 将 `Name.html` 形式的交叉链接标记转换为真实链接。 */
function linkifyText(text, ctx) {
  if (!ctx || !ctx.linkNames) return text
  return text.replace(/\{\{link:([^}]+)\}\}/g, (_m, name) => {
    const page = ctx.linkNames[name]
    return page
      ? `<a href="${escapeAttr(page)}"><code>${escapeHtml(name)}</code></a>`
      : escapeHtml(name)
  })
}

/** 类型表达式 → HTML（Cesium param-type 风格，带交叉链接）。 */
export function renderType(expr, ctx) {
  if (!expr) return "unknown"
  switch (expr.kind) {
    case "intrinsic":
      return escapeHtml(expr.name)
    case "reference": {
      const name = escapeHtml(expr.name)
      const args =
        expr.args && expr.args.length
          ? `.<${expr.args.map((a) => renderType(a, ctx)).join(", ")}>`
          : ""
      if (expr.page) {
        return `<a href="${escapeAttr(expr.page)}">${name}</a>${args}`
      }
      return `${name}${args}`
    }
    case "array":
      return `Array.&lt;${renderType(expr.element, ctx)}&gt;`
    case "union":
      return expr.types.map((t) => renderType(t, ctx)).join(" | ")
    case "intersection":
      return expr.types.map((t) => renderType(t, ctx)).join(" &amp; ")
    case "literal":
      return /^-?\d/.test(expr.value)
        ? escapeHtml(expr.value)
        : `"${escapeHtml(expr.value)}"`
    case "tuple":
      return `[${expr.elements.map((t) => renderType(t, ctx)).join(", ")}]`
    case "object":
      return "Object"
    default:
      return escapeHtml(expr.text || "unknown")
  }
}

/** 类型表达式 → 纯文本（用于标题类签名）。 */
export function typeToPlain(expr) {
  if (!expr) return "unknown"
  switch (expr.kind) {
    case "intrinsic":
      return expr.name
    case "reference":
      return (
        expr.name +
        (expr.args && expr.args.length
          ? `.<${expr.args.map(typeToPlain).join(", ")}>`
          : "")
      )
    case "array":
      return `Array.<${typeToPlain(expr.element)}>`
    case "union":
      return expr.types.map(typeToPlain).join(" | ")
    case "intersection":
      return expr.types.map(typeToPlain).join(" & ")
    case "literal":
      return typeof expr.value === "string" ? `"${expr.value}"` : expr.value
    case "tuple":
      return `[${expr.elements.map(typeToPlain).join(", ")}]`
    case "object":
      return "Object"
    default:
      return expr.text || "unknown"
  }
}
