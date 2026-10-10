/**
 * 注释与 details 区块渲染。
 */

import { escapeHtml, renderParts, renderType } from "./html.mjs"

export function renderSummary(symbol, ctx) {
  const html = renderParts(symbol.summary, ctx)
  if (!html) return ""
  let out = `<div class="description">${html}</div>`
  if (symbol.remarks && symbol.remarks.length) {
    out += `<div class="description">${renderParts(symbol.remarks, ctx)}</div>`
  }
  return out
}

export function renderDetails(symbol, ctx) {
  const blocks = []

  for (const example of symbol.examples || []) {
    const html = renderParts(example, ctx)
    if (html) blocks.push(["Example", html])
  }

  if (symbol.flags && symbol.flags.defaultValue) {
    blocks.push([
      "Default Value",
      `<code class="language-javascript">${escapeHtml(symbol.flags.defaultValue)}</code>`,
    ])
  }

  if (symbol.see && symbol.see.length) {
    const items = symbol.see
      .map((entry) => {
        const page =
          ctx.linkNames[entry] ||
          ctx.linkNames[entry.split(".").pop()] ||
          undefined
        return page
          ? `<li><a href="${page}">${escapeHtml(entry)}</a></li>`
          : `<li>${escapeHtml(entry)}</li>`
      })
      .join("")
    blocks.push(["See", `<ul class="see-list">${items}</ul>`])
  }

  if (symbol.flags && symbol.flags.since) {
    blocks.push(["Since", escapeHtml(symbol.flags.since)])
  }

  if (symbol.flags && symbol.flags.deprecated) {
    blocks.push(["Deprecated", escapeHtml(symbol.flags.deprecated)])
  }

  if (!blocks.length) return ""

  const inner = blocks
    .map(([label, body]) => `<h5>${label}:</h5>${body}`)
    .join("\n")
  return `<dl class="details">${inner}</dl>`
}

export function renderParamsTable(params, ctx) {
  if (!params || !params.length) return ""
  const rows = params
    .map((param) => {
      const optional = param.optional
        ? '<span class="optional">optional</span>'
        : ""
      const rest = param.rest ? '<span class="optional">repeatable</span>' : ""
      const def = param.defaultValue
        ? `<span class="default-value">default: <code>${escapeHtml(param.defaultValue)}</code></span>`
        : ""
      return `<tr>
  <td class="name"><code>${escapeHtml(param.name)}</code></td>
  <td class="type"><span class="param-type">${renderType(param.type, ctx)}</span></td>
  <td class="description last">${optional}${rest}${escapeHtml(param.description || "")}${def}</td>
</tr>`
    })
    .join("\n")
  return `<table class="params">
  <thead>
    <tr>
      <th>Name</th>
      <th>Type</th>
      <th class="last">Description</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`
}

export function renderReturns(callable, ctx) {
  if (!callable || !callable.returns) return ""
  const { type, description } = callable.returns
  return `<h5>Returns:</h5>
<table class="params">
  <thead>
    <tr>
      <th>Type</th>
      <th class="last">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="type"><span class="param-type">${renderType(type, ctx)}</span></td>
      <td class="description last">${escapeHtml(description || "")}</td>
    </tr>
  </tbody>
</table>`
}

export function renderThrows(throws, ctx) {
  if (!throws || !throws.length) return ""
  const items = throws
    .map((t) => {
      const typeText =
        t.type && t.type.text
          ? `<span class="param-type">${escapeHtml(t.type.text)}</span>`
          : ""
      return `<li><div class="param-desc">${typeText}${typeText ? ": " : ""}${escapeHtml(t.description || "")}</div></li>`
    })
    .join("\n")
  return `<h5>Throws:</h5>\n<ul>${items}</ul>`
}
