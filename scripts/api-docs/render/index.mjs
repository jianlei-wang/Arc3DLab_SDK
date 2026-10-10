/**
 * 站点渲染：布局、首页、包命名空间页与符号页。
 */

import { CATEGORIES, SITE, categoryById } from "../config.mjs"
import { escapeAttr, escapeHtml, renderType } from "./html.mjs"
import { renderSymbolBody } from "./symbol.mjs"

export function createContext(model) {
  const byId = new Map(model.symbols.map((s) => [s.id, s]))
  const linkNames = { ...model.index.byName }
  const ctx = {
    model,
    byId,
    linkNames,
    pageForId: (id) => {
      const symbol = byId.get(id)
      return symbol ? symbol.page : undefined
    },
    renderType: (expr) => renderType(expr, ctx),
  }
  return ctx
}

function navList(ctx) {
  const { model, byId } = ctx
  const blocks = []
  for (const pkg of model.packages) {
    const symbols = pkg.symbols.map((id) => byId.get(id)).filter(Boolean)
    const catBlocks = CATEGORIES.map((cat) => {
      const items = symbols.filter((s) => s.kind === cat.id)
      if (!items.length) return ""
      const links = items
        .map(
          (s) =>
            `<li><a href="${escapeAttr(s.page)}">${escapeHtml(s.name)}</a></li>`,
        )
        .join("")
      return `<div class="nav-category"><span class="nav-category-title">${cat.label}</span><ul>${links}</ul></div>`
    })
      .filter(Boolean)
      .join("")
    blocks.push(`<details class="nav-package" open>
  <summary><a href="${escapeAttr(pkg.name + ".html")}">${escapeHtml(pkg.name)}</a></summary>
  ${catBlocks}
</details>`)
  }
  return blocks.join("\n")
}

function layout(title, contentHtml, ctx, activePackage) {
  const sidebar = navList(ctx)
  return `<!DOCTYPE html>
<html lang="${SITE.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - ${escapeHtml(SITE.title)}</title>
  <link href="styles/jsdoc-default.css" rel="stylesheet">
  <link href="styles/prism.css" rel="stylesheet">
</head>
<body>
<nav id="sidebar">
  <div class="nav-header"><a href="index.html">${escapeHtml(SITE.title)}</a></div>
  <div class="nav-search"><input type="search" id="nav-search" placeholder="搜索 API" autocomplete="off"></div>
  <div class="nav-list" data-active-package="${escapeAttr(activePackage || "")}">
${sidebar}
  </div>
</nav>
<div id="main">
  <h1 class="page-title">
    <a href="index.html"><img src="Images/logo.svg" class="arc3dLogo" alt="Arc3DLab"></a>
    ${escapeHtml(title)}
    <div class="titleCenterer"></div>
  </h1>
${contentHtml}
</div>
<footer class="doc-footer">${escapeHtml(SITE.subtitle)}</footer>
<script>
(function () {
  var input = document.getElementById("nav-search")
  if (!input) return
  input.addEventListener("input", function () {
    var q = input.value.toLowerCase()
    document.querySelectorAll("#sidebar .nav-package").forEach(function (pkg) {
      var visible = false
      pkg.querySelectorAll("li").forEach(function (li) {
        var match = li.textContent.toLowerCase().indexOf(q) !== -1
        li.style.display = match ? "" : "none"
        if (match) visible = true
      })
      pkg.style.display = visible ? "" : "none"
    })
  })
})()
</script>
<script src="javascript/prism.js"></script>
</body>
</html>`
}

function symbolLink(symbol) {
  return `<a href="${escapeAttr(symbol.page)}">${escapeHtml(symbol.name)}</a>`
}

export function renderIndex(ctx) {
  const { model, byId } = ctx
  const packageCards = model.packages
    .map((pkg) => {
      const symbols = pkg.symbols.map((id) => byId.get(id)).filter(Boolean)
      const counts = CATEGORIES.map((cat) => {
        const n = symbols.filter((s) => s.kind === cat.id).length
        return n ? `${cat.label}: ${n}` : ""
      })
        .filter(Boolean)
        .join(" &middot; ")
      return `<li><a href="${escapeAttr(pkg.name + ".html")}"><code>${escapeHtml(pkg.name)}</code></a> &mdash; ${escapeHtml(pkg.summary)} <span class="pkg-counts">(${counts})</span></li>`
    })
    .join("\n")

  const categorySections = CATEGORIES.map((cat) => {
    const items = (model.index.byCategory[cat.id] || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
    if (!items.length) return ""
    return `<h3 class="subsection-title">${cat.label}</h3>
<ul class="see-list">${items.map((s) => `<li>${symbolLink(s)} <span class="qualified">${escapeHtml(s.package)}</span></li>`).join("")}</ul>`
  })
    .filter(Boolean)
    .join("\n")

  const content = `<article>
<div class="container-overview">
  <div class="description"><p>${escapeHtml(SITE.subtitle)}。以下按包命名空间与符号类别列出全部公共 API。</p></div>
</div>
<h3 class="subsection-title">Packages</h3>
<ul class="see-list">${packageCards}</ul>
${categorySections}
</article>`
  return layout(SITE.title, content, ctx)
}

export function renderPackagePage(pkg, ctx) {
  const { byId } = ctx
  const symbols = pkg.symbols.map((id) => byId.get(id)).filter(Boolean)
  const sections = CATEGORIES.map((cat) => {
    const items = symbols.filter((s) => s.kind === cat.id)
    if (!items.length) return ""
    return `<h3 class="subsection-title">${cat.label}</h3>
<ul class="see-list">${items.map((s) => `<li>${symbolLink(s)}</li>`).join("")}</ul>`
  })
    .filter(Boolean)
    .join("\n")
  const content = `<article>
<div class="container-overview">
  <div class="nameContainer"><h4 class="name" id="${escapeAttr(pkg.name)}"><code>${escapeHtml(pkg.name)}</code></h4></div>
  <div class="description"><p>${escapeHtml(pkg.summary)}</p></div>
</div>
${sections}
</article>`
  return layout(pkg.name, content, ctx, pkg.name)
}

export function renderSymbolPage(symbol, ctx) {
  const kindLabel = categoryById[symbol.kind]
    ? categoryById[symbol.kind].label
    : symbol.kind
  const breadcrumb = `<div class="breadcrumb"><a href="index.html">API</a> &rsaquo; <a href="${escapeAttr(symbol.package + ".html")}">${escapeHtml(symbol.package)}</a> &rsaquo; <span>${escapeHtml(symbol.name)}</span> <span class="kind-label">${escapeHtml(kindLabel)}</span></div>`
  return layout(
    symbol.name,
    breadcrumb + renderSymbolBody(symbol, ctx),
    ctx,
    symbol.package,
  )
}

/** 生成全部页面：path → html。 */
export function renderSite(model) {
  const ctx = createContext(model)
  const pages = new Map()
  pages.set("index.html", renderIndex(ctx))
  for (const pkg of model.packages) {
    pages.set(`${pkg.name}.html`, renderPackagePage(pkg, ctx))
  }
  for (const symbol of model.symbols) {
    pages.set(symbol.page, renderSymbolPage(symbol, ctx))
  }
  return pages
}
