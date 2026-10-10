/**
 * 符号页面渲染（类 / 接口 / 枚举 / 类型别名 / 函数 / 变量）。
 */

import { escapeAttr, escapeHtml, renderType } from "./html.mjs"
import {
  renderDetails,
  renderParamsTable,
  renderReturns,
  renderSummary,
  renderThrows,
} from "./comment.mjs"

function sourceLink(source) {
  if (!source) return ""
  const label = `${source.path} ${source.line}`
  const href = source.url || "#"
  return `<div class="source-link rightLinks"><a href="${escapeAttr(href)}">${escapeHtml(label)}</a></div>`
}

function returnTypeHtml(callable, ctx) {
  if (!callable || !callable.returns) return ""
  return ` : <span class="type-signature">${renderType(callable.returns.type, ctx)}</span>`
}

function renderDescriptorHead(symbol, ctx) {
  const ctor = symbol.kind === "class" ? symbol.construct : undefined
  let text
  if (symbol.kind === "class") {
    const sig = ctor ? ctor.signature : "()"
    text = `new ${escapeHtml(symbol.name)}<span class="signature">${escapeHtml(sig)}</span>`
  } else if (symbol.kind === "function" && symbol.signature) {
    text = `${escapeHtml(symbol.name)}<span class="signature">${escapeHtml(symbol.signature)}</span>${returnTypeHtml(symbol, ctx)}`
  } else if (symbol.kind === "type-alias" && symbol.typeAlias) {
    text = `${escapeHtml(symbol.name)}<span class="type-signature"> : ${renderType(symbol.typeAlias, ctx)}</span>`
  } else if (symbol.kind === "variable" && symbol.valueType) {
    text = `${escapeHtml(symbol.name)}<span class="type-signature"> : ${renderType(symbol.valueType, ctx)}</span>`
  } else {
    text = escapeHtml(symbol.name)
  }
  return `<div class="nameContainer">
  <h4 class="name" id="${escapeAttr(symbol.name)}">
    <a href="#${escapeAttr(symbol.name)}" class="doc-link"></a>
    ${text}
    ${sourceLink(symbol.source)}
  </h4>
</div>`
}

function renderCallableBody(callable, ctx, { includeReturns = true } = {}) {
  if (!callable) return ""
  return [
    callable.params && callable.params.length
      ? renderParamsTable(callable.params, ctx)
      : "",
    includeReturns ? renderReturns(callable, ctx) : "",
    renderThrows(callable.throws, ctx),
    renderDetails(callable, ctx),
  ]
    .filter(Boolean)
    .join("\n")
}

function renderMember(member, ctx) {
  const readonly = member.readonly
    ? '<span class="attribute-readonly type-signature">readonly</span> '
    : ""
  const stat = member.static
    ? '<span class="attribute-static type-signature">static</span> '
    : ""
  const optional = member.optional
    ? '<span class="optional type-signature">optional</span> '
    : ""
  return `<div class="nameContainer">
  <h4 class="name" id="${escapeAttr(member.name)}">
    <a href="#${escapeAttr(member.name)}" class="doc-link"></a>
    ${stat}${readonly}${optional}${escapeHtml(member.name)}<span class="type-signature"> : ${renderType(member.type, ctx)}</span>
    ${sourceLink(member.source)}
  </h4>
</div>
${member.description ? `<div class="description">${escapeHtml(member.description)}</div>` : ""}
${
  member.defaultValue
    ? `<dl class="details"><h5>Default Value:</h5><code class="language-javascript">${escapeHtml(member.defaultValue)}</code></dl>`
    : ""
}`
}

function renderMethod(method, ctx) {
  return `<div class="nameContainer">
  <h4 class="name" id="${escapeAttr(method.name)}">
    <a href="#${escapeAttr(method.name)}" class="doc-link"></a>
    ${escapeHtml(method.name)}<span class="signature">${escapeHtml(method.signature)}</span>${returnTypeHtml(method, ctx)}
    ${sourceLink(method.source)}
  </h4>
</div>
${method.description ? `<div class="description">${escapeHtml(method.description)}</div>` : ""}
${renderCallableBody(method, ctx)}`
}

function renderEnum(symbol, ctx) {
  const rows = (symbol.enumValues || [])
    .map(
      (v) =>
        `<tr><td class="name"><code>${escapeHtml(v.name)}</code></td><td class="type"><span class="param-type">${escapeHtml(v.value ?? "")}</span></td><td class="description last">${escapeHtml(v.description || "")}</td></tr>`,
    )
    .join("\n")
  return `<h3 class="subsection-title">Members</h3>
<table class="params"><thead><tr><th>Name</th><th>Type</th><th class="last">Description</th></tr></thead><tbody>${rows}</tbody></table>`
}

export function renderSymbolBody(symbol, ctx) {
  const parts = []
  parts.push('<div class="container-overview">')
  parts.push(renderDescriptorHead(symbol, ctx))
  const desc = renderSummary(symbol, ctx)
  parts.push(desc)

  if (symbol.kind === "class" || symbol.kind === "interface") {
    if (symbol.extends && symbol.extends.length) {
      parts.push(
        `<h5>Extends:</h5><span class="param-type">${symbol.extends.map((t) => renderType(t, ctx)).join(", ")}</span>`,
      )
    }
    if (symbol.implements && symbol.implements.length) {
      parts.push(
        `<h5>Implements:</h5><span class="param-type">${symbol.implements.map((t) => renderType(t, ctx)).join(", ")}</span>`,
      )
    }
    parts.push(
      renderCallableBody(symbol.construct, ctx, { includeReturns: false }),
    )
  } else if (symbol.kind === "function") {
    parts.push(renderCallableBody(symbol, ctx))
  } else if (symbol.kind === "type-alias") {
    parts.push(
      `<h5>Type:</h5><span class="param-type">${renderType(symbol.typeAlias, ctx)}</span>`,
    )
  } else if (symbol.kind === "variable") {
    if (symbol.valueType) {
      parts.push(
        `<h5>Type:</h5><span class="param-type">${renderType(symbol.valueType, ctx)}</span>`,
      )
    }
  }
  parts.push(renderDetails(symbol, ctx))
  parts.push("</div>")

  if (symbol.kind === "enumeration") {
    parts.push(renderEnum(symbol, ctx))
  }

  if (symbol.members && symbol.members.length) {
    parts.push('<h3 class="subsection-title">Members</h3>')
    parts.push(symbol.members.map((m) => renderMember(m, ctx)).join("\n"))
  }

  if (symbol.methods && symbol.methods.length) {
    parts.push('<h3 class="subsection-title">Methods</h3>')
    parts.push(symbol.methods.map((m) => renderMethod(m, ctx)).join("\n"))
  }

  return `<article>${parts.join("\n")}</article>`
}
