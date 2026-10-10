/**
 * 归一化：TypeDoc reflection 树 → 与渲染无关的 DocsModel。
 */

import {
  KIND,
  CATEGORIES,
  PACKAGE_DISPLAY,
  PACKAGE_ORDER,
  PACKAGE_SUMMARY,
} from "./config.mjs"

function isReference(node) {
  return node && node.kind === KIND.Reference
}

function resolveReference(node, flat) {
  if (
    isReference(node) &&
    typeof node.target === "number" &&
    flat.has(node.target)
  ) {
    return flat.get(node.target)
  }
  return node
}

function indexNodes(project) {
  const flat = new Map()
  const visit = (node) => {
    if (!node || typeof node.id !== "number") return
    flat.set(node.id, node)
    for (const child of node.children || []) visit(child)
    for (const sig of node.signatures || []) {
      flat.set(sig.id, sig)
      for (const param of sig.parameters || []) visit(param)
      if (sig.type && sig.type.declaration) visit(sig.type.declaration)
    }
    if (node.type && node.type.declaration) visit(node.type.declaration)
  }
  visit(project)
  return flat
}

function categoryOf(kind) {
  if (kind === KIND.Namespace || kind === KIND.Module) return "namespace"
  const found = CATEGORIES.find((c) => c.id !== "namespace" && c.kind === kind)
  return found ? found.id : null
}

function sourceOf(node) {
  const src = node && node.sources && node.sources[0]
  if (!src) return undefined
  return { path: src.fileName, line: src.line, url: src.url }
}

/** 把注释里的 parts 转为纯文本（用于覆盖率与简单描述）。 */
export function partsToText(parts) {
  if (!parts) return ""
  if (typeof parts === "string") return parts
  return (parts || [])
    .map((part) => {
      if (!part) return ""
      if (part.kind === "text") return part.text || ""
      if (part.kind === "code") return part.text || ""
      if (part.kind === "inline-tag") return part.text || ""
      return part.text || ""
    })
    .join("")
    .trim()
}

function groupTags(comment) {
  const map = {}
  for (const tag of (comment && comment.blockTags) || []) {
    ;(map[tag.tag] = map[tag.tag] || []).push(tag.content || [])
  }
  return map
}

function commentSummary(comment) {
  return (comment && comment.summary) || []
}

/** 类型表达式归一化。ctx.resolveTarget(id) → { name, page }。 */
export function normalizeType(type, ctx) {
  if (!type) return { kind: "raw", text: "unknown" }
  switch (type.type) {
    case "intrinsic":
      return { kind: "intrinsic", name: type.name }
    case "reference": {
      const numeric = typeof type.target === "number"
      const resolved = numeric ? ctx.resolveTarget(type.target) : undefined
      return {
        kind: "reference",
        name: type.name,
        page: resolved ? resolved.page : undefined,
        args: (type.typeArguments || []).map((a) => normalizeType(a, ctx)),
      }
    }
    case "array": {
      const element = normalizeType(type.elementType, ctx)
      return { kind: "array", element }
    }
    case "union":
      return {
        kind: "union",
        types: (type.types || []).map((t) => normalizeType(t, ctx)),
      }
    case "intersection":
      return {
        kind: "intersection",
        types: (type.types || []).map((t) => normalizeType(t, ctx)),
      }
    case "literal":
      return { kind: "literal", value: String(type.value) }
    case "tuple":
      return {
        kind: "tuple",
        elements: (type.elements || []).map((t) => normalizeType(t, ctx)),
      }
    case "reflection":
      return { kind: "object" }
    default:
      return { kind: "raw", text: typeToText(type, ctx) }
  }
}

/** 类型 → Cesium 风格文本（兜底与交叉链接）。 */
export function typeToText(type, ctx) {
  if (!type) return "unknown"
  switch (type.type) {
    case "intrinsic":
      return type.name
    case "reference": {
      const name = type.name
      if (type.typeArguments && type.typeArguments.length) {
        return `${name}.<${type.typeArguments
          .map((a) => typeToText(a, ctx))
          .join(", ")}>`
      }
      return name
    }
    case "array":
      return `Array.<${typeToText(type.elementType, ctx)}>`
    case "union":
      return (type.types || []).map((t) => typeToText(t, ctx)).join(" | ")
    case "intersection":
      return (type.types || []).map((t) => typeToText(t, ctx)).join(" & ")
    case "literal":
      return typeof type.value === "string"
        ? `"${type.value}"`
        : String(type.value)
    case "tuple":
      return `[${(type.elements || []).map((t) => typeToText(t, ctx)).join(", ")}]`
    case "reflection":
      return "Object"
    case "typeOperator":
      return `${type.operator} ${typeToText(type.target, ctx)}`
    case "indexedAccess":
      return `${typeToText(type.objectType, ctx)}[${typeToText(type.indexType, ctx)}]`
    case "predicate":
      return type.name
    case "query":
      return `typeof ${typeToText(type.target, ctx)}`
    default:
      return type.name || "unknown"
  }
}

function signatureParamsText(sig) {
  const params = (sig.parameters || []).map((p) => {
    const rest = p.flags && p.flags.isRest ? "..." : ""
    const optional = p.flags && p.flags.isOptional ? "?" : ""
    return `${rest}${p.name}${optional}`
  })
  return `(${params.join(", ")})`
}

function normalizeReturn(sig, ctx) {
  if (!sig.type) return undefined
  const returnsTag = ((sig.comment && sig.comment.blockTags) || []).find(
    (t) => t.tag === "@returns" || t.tag === "@return",
  )
  return {
    type: normalizeType(sig.type, ctx),
    description: returnsTag ? partsToText(returnsTag.content) : "",
  }
}

function normalizeParams(sig, ctx) {
  return (sig.parameters || []).map((p) => {
    const summary = commentSummary(p.comment)
    const defaultTag = ((p.comment && p.comment.blockTags) || []).find(
      (t) => t.tag === "@defaultValue" || t.tag === "@default",
    )
    return {
      name: p.name,
      type: normalizeType(p.type, ctx),
      description: partsToText(summary),
      optional: !!(p.flags && p.flags.isOptional),
      rest: !!(p.flags && p.flags.isRest),
      defaultValue: defaultTag ? partsToText(defaultTag.content) : undefined,
    }
  })
}

function normalizeCallable(sig, ctx, extra = {}) {
  const tags = groupTags(sig.comment)
  return {
    id: sig.id,
    signature: signatureParamsText(sig),
    description: partsToText(commentSummary(sig.comment)),
    params: normalizeParams(sig, ctx),
    returns: normalizeReturn(sig, ctx),
    typeParams: (sig.typeParameters || []).map((tp) => ({
      name: tp.name,
      description: partsToText(commentSummary(tp.comment)),
    })),
    throws: (tags["@throws"] || tags["@exception"] || []).map((content) => {
      const text = partsToText(content)
      const match = text.match(/^\{([^}]+)\}\s*(.*)$/)
      if (match)
        return { type: { kind: "raw", text: match[1] }, description: match[2] }
      return { type: { kind: "raw", text: "" }, description: text }
    }),
    examples: (tags["@example"] || []).map((content) => content),
    see: (tags["@see"] || []).map((content) => partsToText(content)),
    since: tags["@since"] ? partsToText(tags["@since"][0]) : undefined,
    deprecated: tags["@deprecated"]
      ? partsToText(tags["@deprecated"][0])
      : undefined,
    source: sourceOf(sig),
    ...extra,
  }
}

function memberDoc(node, ctx) {
  const tags = groupTags(node.comment)
  return {
    name: node.name,
    type: normalizeType(node.type, ctx),
    description: partsToText(commentSummary(node.comment)),
    readonly: !!(node.flags && node.flags.isReadonly),
    static: !!(node.flags && node.flags.isStatic),
    optional: !!(node.flags && node.flags.isOptional),
    defaultValue: tags["@defaultValue"]
      ? partsToText(tags["@defaultValue"][0])
      : undefined,
    source: sourceOf(node),
  }
}

function buildClassLike(node, ctx) {
  const members = []
  const methods = []
  let construct
  for (const child of node.children || []) {
    if (child.kind === KIND.Constructor) {
      if (child.signatures && child.signatures[0]) {
        construct = normalizeCallable(child.signatures[0], ctx)
      }
    } else if (child.kind === KIND.Property || child.kind === KIND.Accessor) {
      members.push(memberDoc(child, ctx))
    } else if (child.kind === KIND.Method) {
      const sig = (child.signatures || [])[0]
      if (sig) methods.push(normalizeCallable(sig, ctx, { name: child.name }))
    }
  }
  return { members, methods, construct }
}

function buildEnum(node, ctx) {
  const enumValues = (node.children || []).map((child) => ({
    name: child.name,
    value:
      child.type && child.type.type === "literal"
        ? String(child.type.value)
        : undefined,
    description: partsToText(commentSummary(child.comment)),
  }))
  return { enumValues }
}

function buildVariable(node, ctx) {
  const decl =
    node.type && node.type.type === "reflection" ? node.type.declaration : null
  if (decl && decl.children && decl.children.length) {
    const members = []
    const methods = []
    for (const child of decl.children) {
      if (child.kind === KIND.Property) members.push(memberDoc(child, ctx))
      else if (child.kind === KIND.Method) {
        const sig = (child.signatures || [])[0]
        if (sig) methods.push(normalizeCallable(sig, ctx, { name: child.name }))
      }
    }
    return { members, methods }
  }
  return { valueType: normalizeType(node.type, ctx) }
}

function buildSymbol(node, ownerName, ctx) {
  const category = categoryOf(node.kind)
  // 函数与方法的 TSDoc 挂在签名上，节点本身通常没有 comment。
  const comment =
    node.comment ||
    (node.signatures && node.signatures[0] && node.signatures[0].comment)
  const tags = groupTags(comment)
  const symbol = {
    id: node.id,
    name: node.name,
    kind: category,
    package: ownerName,
    qualifiedName: `${ownerName}.${node.name}`,
    summary: commentSummary(comment),
    remarks: (comment && comment.remarks) || [],
    summaryText: partsToText(commentSummary(comment)),
    source: sourceOf(node),
    flags: {
      readonly: !!(node.flags && node.flags.isReadonly),
      static: !!(node.flags && node.flags.isStatic),
      deprecated: tags["@deprecated"]
        ? partsToText(tags["@deprecated"][0])
        : undefined,
      since: tags["@since"] ? partsToText(tags["@since"][0]) : undefined,
      defaultValue: tags["@defaultValue"]
        ? partsToText(tags["@defaultValue"][0])
        : undefined,
    },
    examples: (tags["@example"] || []).map((c) => c),
    see: (tags["@see"] || []).map((c) => partsToText(c)),
    members: [],
    methods: [],
    throws: [],
    construct: undefined,
    valueType: undefined,
    typeAlias: undefined,
    enumValues: undefined,
    extensions: [],
  }

  if (category === "class" || category === "interface") {
    const { members, methods, construct } = buildClassLike(node, ctx)
    symbol.members = members
    symbol.methods = methods
    symbol.construct = construct
    symbol.extends = node.extendedTypes
      ? node.extendedTypes.map((t) => normalizeType(t, ctx))
      : []
    symbol.implements = node.implementedTypes
      ? node.implementedTypes.map((t) => normalizeType(t, ctx))
      : []
  } else if (category === "enumeration") {
    Object.assign(symbol, buildEnum(node, ctx))
  } else if (category === "type-alias") {
    symbol.typeAlias = normalizeType(node.type, ctx)
    symbol.typeParams = (node.typeParameters || []).map((tp) => ({
      name: tp.name,
      description: partsToText(commentSummary(tp.comment)),
    }))
  } else if (category === "function") {
    const sig = (node.signatures || [])[0]
    if (sig) Object.assign(symbol, normalizeCallable(sig, ctx))
  } else if (category === "variable") {
    Object.assign(symbol, buildVariable(node, ctx))
  }

  return symbol
}

/**
 * @param {object} project TypeDoc JSON project reflection
 * @returns {object} DocsModel
 */
export function normalize(project) {
  const flat = indexNodes(project)
  const symbolIdMap = project.symbolIdMap || {}

  function ownerNameFor(node, fallbackPkg) {
    const info = symbolIdMap[String(node.id)]
    const pkg = (info && info.packageName) || fallbackPkg
    return (
      PACKAGE_DISPLAY[pkg] || String(pkg || "misc").replace(/^@arc3dlab\//, "")
    )
  }

  // 第一遍：收集去重后的符号（按解析后的声明 id）。
  const byId = new Map()
  const modules = project.children || []
  for (const moduleNode of modules) {
    const moduleInfo = symbolIdMap[String(moduleNode.id)]
    const fallbackPkg = moduleInfo && moduleInfo.packageName
    for (const raw of moduleNode.children || []) {
      const node = resolveReference(raw, flat)
      const category = categoryOf(node.kind)
      if (!category) continue
      if (byId.has(node.id)) continue
      byId.set(node.id, { node, fallbackPkg })
    }
  }

  // 页面命名与冲突处理。
  const byName = new Map()
  for (const { node } of byId.values()) {
    const list = byName.get(node.name) || []
    list.push(node.id)
    byName.set(node.name, list)
  }
  const idToPage = new Map()
  for (const [name, ids] of byName) {
    if (ids.length === 1) {
      idToPage.set(ids[0], `${name}.html`)
    }
  }
  const ctx = {
    resolveTarget: (id) => {
      const node = flat.get(id)
      return node ? { id, name: node.name, page: idToPage.get(id) } : undefined
    },
  }
  for (const [name, ids] of byName) {
    if (ids.length === 1) continue
    for (const id of ids) {
      const { node, fallbackPkg } = byId.get(id)
      const owner = ownerNameFor(node, fallbackPkg)
      idToPage.set(id, `${owner}.${name}.html`)
    }
  }

  // 第二遍：构建 SymbolDoc。
  const symbols = []
  for (const [id, { node, fallbackPkg }] of byId) {
    const owner = ownerNameFor(node, fallbackPkg)
    const symbol = buildSymbol(node, owner, ctx)
    symbol.page = idToPage.get(id)
    symbols.push(symbol)
  }

  const packageMap = new Map()
  for (const symbol of symbols) {
    let pkg = packageMap.get(symbol.package)
    if (!pkg) {
      pkg = {
        name: symbol.package,
        displayName: symbol.package,
        summary: PACKAGE_SUMMARY[symbol.package] || "",
        symbols: [],
      }
      packageMap.set(symbol.package, pkg)
    }
    pkg.symbols.push(symbol.id)
  }

  const packages = [...packageMap.values()].sort(
    (a, b) => PACKAGE_ORDER.indexOf(a.name) - PACKAGE_ORDER.indexOf(b.name),
  )
  for (const pkg of packages) {
    pkg.symbols.sort((x, y) => {
      const sx = symbols.find((s) => s.id === x)
      const sy = symbols.find((s) => s.id === y)
      return (
        CATEGORIES.findIndex((c) => c.id === sx.kind) -
          CATEGORIES.findIndex((c) => c.id === sy.kind) ||
        sx.name.localeCompare(sy.name)
      )
    })
  }

  const byCategory = {}
  for (const symbol of symbols) {
    ;(byCategory[symbol.kind] = byCategory[symbol.kind] || []).push(symbol.id)
  }
  for (const key of Object.keys(byCategory)) {
    byCategory[key].sort((x, y) =>
      symbols
        .find((s) => s.id === x)
        .name.localeCompare(symbols.find((s) => s.id === y).name),
    )
  }

  const byNameIndex = {}
  for (const symbol of symbols) {
    if (!byNameIndex[symbol.name]) byNameIndex[symbol.name] = symbol.page
  }

  return {
    packages,
    symbols,
    index: {
      byCategory,
      byPackage: Object.fromEntries(packages.map((p) => [p.name, p.symbols])),
      byName: byNameIndex,
    },
  }
}
