import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
import { listPackages } from "./package-aliases.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const MANIFEST_PATH = "scripts/public-api-manifest.json"

// Arc3DLab 采用 Cesium-first：以下业务包允许直接依赖 cesium，Engine 仅为内部接缝。
const CESIUM_PACKAGES = new Set([
  "engine-cesium",
  "data",
  "scene",
  "layers",
  "graphics",
  "interaction",
  "analysis",
  "effects",
  "plotting",
])

const ALLOWED_INTERNAL = {
  core: [],
  "engine-cesium": ["@arc3dlab/core"],
  data: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  scene: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  layers: ["@arc3dlab/core", "@arc3dlab/engine-cesium", "@arc3dlab/data"],
  graphics: ["@arc3dlab/core", "@arc3dlab/engine-cesium", "@arc3dlab/effects"],
  interaction: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  analysis: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  effects: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  plotting: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  ui: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  sdk: [
    "@arc3dlab/core",
    "@arc3dlab/engine-cesium",
    "@arc3dlab/analysis",
    "@arc3dlab/data",
    "@arc3dlab/effects",
    "@arc3dlab/graphics",
    "@arc3dlab/interaction",
    "@arc3dlab/layers",
    "@arc3dlab/scene",
    "@arc3dlab/ui",
    "@arc3dlab/plotting",
  ],
  legacy: ["@arc3dlab/core", "@arc3dlab/sdk"],
}

export const PUBLIC_EXPORT_NAMES = [
  "Arc3D",
  "Arc3DApp",
  "Arc3DError",
  "CesiumEngine",
  "createId",
  "Viewer",
]

function walkTs(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue
      walkTs(path, files)
      continue
    }
    if (name.endsWith(".ts")) files.push(path)
  }
  return files
}

const CONSUMER_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".vue"]

function walkFiles(dir, extensions, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue
      walkFiles(path, extensions, files)
      continue
    }
    if (extensions.some((ext) => name.endsWith(ext))) files.push(path)
  }
  return files
}

const DEEP_IMPORT_RE =
  /(?:@arc3dlab\/[a-z-]+|packages\/[a-z-]+|arc3dlab)\/src(?:\/|$|["'])/

function extractSpecifiers(source) {
  const specs = []
  const fromRe = /\bfrom\s+["']([^"']+)["']/g
  const sideRe = /\bimport\s+["']([^"']+)["']/g
  let match
  while ((match = fromRe.exec(source))) specs.push(match[1])
  while ((match = sideRe.exec(source))) specs.push(match[1])
  return specs
}

export function checkDependencyBoundaries(root = ROOT) {
  const violations = []
  const packagesDir = join(root, "packages")
  for (const pkg of readdirSync(packagesDir)) {
    const src = join(packagesDir, pkg, "src")
    if (!existsSync(src)) continue
    const allowed = new Set(ALLOWED_INTERNAL[pkg] ?? [])
    const allowCesium = CESIUM_PACKAGES.has(pkg)
    for (const file of walkTs(src)) {
      const rel = relative(root, file)
      for (const spec of extractSpecifiers(readFileSync(file, "utf8"))) {
        if (spec.startsWith(".") || spec.startsWith("node:")) continue
        if (spec === "cesium") {
          if (!allowCesium) violations.push(`${rel} imports cesium`)
          continue
        }
        if (spec.startsWith("@arc3dlab/") && !allowed.has(spec)) {
          violations.push(`${rel} imports ${spec}`)
        }
      }
    }
  }
  return violations
}

export function checkConsumerImports(root = ROOT) {
  const violations = []
  const targets = [
    { dir: "src", extensions: [".ts"] },
    { dir: "examples", extensions: CONSUMER_EXTENSIONS },
    { dir: "demo-vue3/src", extensions: CONSUMER_EXTENSIONS },
  ]
  for (const target of targets) {
    const base = join(root, target.dir)
    if (!existsSync(base)) continue
    for (const file of walkFiles(base, target.extensions)) {
      const rel = relative(root, file)
      for (const spec of extractSpecifiers(readFileSync(file, "utf8"))) {
        if (DEEP_IMPORT_RE.test(spec)) {
          violations.push(`${rel} deep-imports ${spec}`)
        }
      }
    }
  }
  return violations
}

const PUBLIC_ENTRIES = {
  ".": "src/index.ts",
  "./engine-cesium": "packages/engine-cesium/src/index.ts",
}

function buildProgram(root, entries) {
  const configPath = join(root, "tsconfig.json")
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configFile.error) {
    throw new Error(
      `Failed to read tsconfig.json: ${String(configFile.error.messageText)}`,
    )
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
  return ts.createProgram({
    rootNames: Object.values(entries).map((rel) => join(root, rel)),
    options: parsed.options,
  })
}

const SIG_FORMAT = ts.TypeFormatFlags.NoTruncation

function normalize(text) {
  return text.replace(/\s+/g, " ").trim()
}

function hasModifier(node, kind) {
  return (node.modifiers ?? []).some((modifier) => modifier.kind === kind)
}

function typeText(checker, type, node) {
  return checker.typeToString(type, node, SIG_FORMAT)
}

function describeClassMember(checker, member) {
  if (
    hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
    hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ||
    (member.name && ts.isPrivateIdentifier(member.name))
  ) {
    return undefined
  }
  const prefix = hasModifier(member, ts.SyntaxKind.StaticKeyword)
    ? "static "
    : ""
  if (ts.isConstructorDeclaration(member)) {
    const sig = checker.getSignatureFromDeclaration(member)
    return sig
      ? `constructor${checker.signatureToString(sig, member, SIG_FORMAT)}`
      : "constructor()"
  }
  const name = member.name ? member.name.getText() : ""
  const optional = member.questionToken ? "?" : ""
  if (ts.isPropertyDeclaration(member)) {
    const readonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword)
      ? "readonly "
      : ""
    const annotation = member.type
      ? normalize(member.type.getText())
      : typeText(checker, checker.getTypeAtLocation(member), member)
    return `${prefix}${readonly}${name}${optional}: ${annotation}`
  }
  if (ts.isMethodDeclaration(member)) {
    const sig = checker.getSignatureFromDeclaration(member)
    return sig
      ? `${prefix}${name}${optional}${checker.signatureToString(sig, member, SIG_FORMAT)}`
      : `${prefix}${name}${optional}()`
  }
  if (ts.isGetAccessorDeclaration(member)) {
    return `${prefix}get ${name}(): ${typeText(checker, checker.getTypeAtLocation(member), member)}`
  }
  if (ts.isSetAccessorDeclaration(member)) {
    const param = member.parameters[0]
    const annotation = param
      ? typeText(checker, checker.getTypeAtLocation(param), param)
      : "unknown"
    return `${prefix}set ${name}(${param ? param.name.getText() : "value"}: ${annotation})`
  }
  return `${prefix}${normalize(member.getText())}`
}

function describeSymbol(checker, printer, symbol) {
  const declarations = symbol.getDeclarations() ?? []
  const decl =
    declarations.find(
      (node) => !ts.isExportSpecifier(node) && !ts.isExportAssignment(node),
    ) ?? declarations[0]
  if (!decl) return ""
  if (ts.isClassDeclaration(decl)) {
    const params = decl.typeParameters
      ? `<${decl.typeParameters.map((t) => normalize(t.getText())).join(", ")}>`
      : ""
    const heritage = (decl.heritageClauses ?? [])
      .map((clause) => normalize(clause.getText()))
      .join(" ")
    const lines = [
      `class ${decl.name ? decl.name.text : ""}${params}${heritage ? ` ${heritage}` : ""}`,
    ]
    for (const member of decl.members) {
      const text = describeClassMember(checker, member)
      if (text) lines.push(`  ${text}`)
    }
    return lines.join("\n")
  }
  if (
    ts.isInterfaceDeclaration(decl) ||
    ts.isTypeAliasDeclaration(decl) ||
    ts.isEnumDeclaration(decl) ||
    ts.isModuleDeclaration(decl)
  ) {
    return normalize(
      printer.printNode(ts.EmitHint.Unspecified, decl, decl.getSourceFile()),
    )
  }
  const functionOverloads = declarations.filter((node) =>
    ts.isFunctionDeclaration(node),
  )
  if (functionOverloads.length) {
    const signatures = functionOverloads
      .map((node) => checker.getSignatureFromDeclaration(node))
      .filter(Boolean)
      .map((sig, index) =>
        checker.signatureToString(sig, functionOverloads[index], SIG_FORMAT),
      )
    if (signatures.length) return signatures.join(" | ")
  }
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl)
  const callSignatures = type.getCallSignatures()
  if (callSignatures.length) {
    return callSignatures
      .map((sig) => checker.signatureToString(sig, decl, SIG_FORMAT))
      .join(" | ")
  }
  const annotation = decl.type
    ? normalize(decl.type.getText())
    : typeText(checker, type, decl)
  const name = decl.name ? decl.name.getText() : ""
  return name ? `${name}: ${annotation}` : annotation
}

function collectEntrySurface(checker, printer, source) {
  const values = []
  const types = []
  const signatures = {}
  const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined
  if (moduleSymbol) {
    for (const sym of checker.getExportsOfModule(moduleSymbol)) {
      const name = sym.getName()
      const resolved =
        sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym
      const isValue = (resolved.flags & ts.SymbolFlags.Value) !== 0
      const isType = (resolved.flags & ts.SymbolFlags.Type) !== 0
      if (isValue) values.push(name)
      else if (isType) types.push(name)
      signatures[name] = describeSymbol(checker, printer, resolved)
    }
  }
  values.sort()
  types.sort()
  const sortedSignatures = {}
  for (const name of Object.keys(signatures).sort()) {
    sortedSignatures[name] = signatures[name]
  }
  return { values, types, signatures: sortedSignatures }
}

/**
 * 使用 TypeScript Compiler API 解析每个公共入口的真实导出表与导出签名，
 * 区分运行时值导出与类型导出，作为公共 API 合同的稳定清单。
 *
 * 覆盖根入口 `.` 与子路径 `./engine-cesium`；签名会捕获函数参数/返回类型、
 * 类型成员、类成员等结构化变化。
 *
 * @param {string} [root] - 仓库根目录。
 * @returns {Record<string, { values: string[], types: string[], signatures: Record<string, string> }>}
 */
export function collectPublicSurface(root = ROOT) {
  const program = buildProgram(root, PUBLIC_ENTRIES)
  const checker = program.getTypeChecker()
  const printer = ts.createPrinter({ removeComments: true })
  const surface = {}
  for (const [key, rel] of Object.entries(PUBLIC_ENTRIES)) {
    const source = program.getSourceFile(join(root, rel))
    surface[key] = collectEntrySurface(checker, printer, source)
  }
  return surface
}

/**
 * 根入口导出清单（值/类型），保持向后兼容。
 *
 * @param {string} [root] - 仓库根目录。
 * @returns {{ values: string[], types: string[] }}
 */
export function collectPublicExports(root = ROOT) {
  const surface = collectPublicSurface(root)
  const rootEntry = surface["."]
  return { values: rootEntry.values, types: rootEntry.types }
}

function sortedUnion(...lists) {
  return Array.from(new Set(lists.flat())).sort()
}

function diffEntry(key, actual, expected) {
  const issues = []
  for (const kind of ["values", "types"]) {
    const exp = expected[kind] ?? []
    const act = actual[kind] ?? []
    const added = act.filter((name) => !exp.includes(name))
    const removed = exp.filter((name) => !act.includes(name))
    if (added.length) {
      issues.push(
        `public API ${kind} added: ${key} ${added.join(", ")} (update ${MANIFEST_PATH} and docs)`,
      )
    }
    if (removed.length) {
      issues.push(
        `public API ${kind} removed: ${key} ${removed.join(", ")} (update ${MANIFEST_PATH} and docs)`,
      )
    }
  }
  const expSig = expected.signatures ?? {}
  const actSig = actual.signatures ?? {}
  for (const name of sortedUnion(Object.keys(expSig), Object.keys(actSig))) {
    if (actSig[name] === undefined) {
      issues.push(
        `public API signature removed: ${key} ${name} (update ${MANIFEST_PATH} and docs)`,
      )
    } else if (expSig[name] === undefined) {
      issues.push(
        `public API signature added: ${key} ${name} (update ${MANIFEST_PATH} and docs)`,
      )
    } else if (expSig[name] !== actSig[name]) {
      issues.push(
        `public API signature changed: ${key} ${name} (update ${MANIFEST_PATH} and docs)`,
      )
    }
  }
  return issues
}

export function diffManifest(actual, expected) {
  const issues = []
  const expectedEntries = expected.entries ?? { ".": expected }
  for (const [key, act] of Object.entries(actual)) {
    issues.push(...diffEntry(key, act, expectedEntries[key] ?? {}))
  }
  for (const key of Object.keys(expectedEntries)) {
    if (!(key in actual)) {
      issues.push(`public API entry removed: ${key}`)
    }
  }
  return issues
}

export function checkPublicExports(root = ROOT) {
  const issues = []
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  const rootExport = pkg.exports?.["."]
  const engineExport = pkg.exports?.["./engine-cesium"]
  if (rootExport?.import !== "./dist/arc3dlab.esm.js") {
    issues.push("exports['.'].import must be ./dist/arc3dlab.esm.js")
  }
  if (rootExport?.types !== "./dist/index.d.ts") {
    issues.push("exports['.'].types must be ./dist/index.d.ts")
  }
  if (engineExport?.import !== "./dist/engine-cesium.js") {
    issues.push("engine-cesium import must be ./dist/engine-cesium.js")
  }
  if (engineExport?.types !== "./dist/engine-cesium.d.ts") {
    issues.push("engine-cesium types must be ./dist/engine-cesium.d.ts")
  }
  if (
    rootExport?.require !== undefined ||
    engineExport?.require !== undefined
  ) {
    issues.push("packages are ESM-only; exports must not declare require")
  }
  if (pkg.main !== undefined) {
    issues.push("package.json must not declare main (ESM-only)")
  }
  if (pkg.peerDependencies?.cesium !== "1.146.0") {
    issues.push("peerDependencies.cesium must be 1.146.0")
  }
  if (pkg.packageManager !== "npm@10.9.4") {
    issues.push("packageManager must be npm@10.9.4")
  }
  if (!existsSync(join(root, "package-lock.json"))) {
    issues.push("package-lock.json is required")
  }
  const manifestFile = join(root, MANIFEST_PATH)
  if (!existsSync(manifestFile)) {
    issues.push(
      `${MANIFEST_PATH} missing; run node scripts/release-gate.mjs exports:update`,
    )
  } else {
    const expected = JSON.parse(readFileSync(manifestFile, "utf8"))
    issues.push(...diffManifest(collectPublicSurface(root), expected))
  }
  return issues
}

/**
 * 校验内部包目录、`tsconfig.json` 路径别名与 workspace 声明一致。
 *
 * @param {string} [root] - 仓库根目录。
 * @returns {string[]} 不一致项列表。
 */
export function checkWorkspaceAliases(root = ROOT) {
  const issues = []
  const discovered = listPackages(root)
  const tsconfig = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8"))
  const paths = tsconfig.compilerOptions?.paths ?? {}
  const discoveredKeys = discovered.map((name) => `@arc3dlab/${name}`)
  for (const name of discovered) {
    const key = `@arc3dlab/${name}`
    const mapped = paths[key]
    if (!mapped || !mapped.includes(`packages/${name}/src/index.ts`)) {
      issues.push(`tsconfig.json missing path alias for ${key}`)
    }
  }
  for (const key of Object.keys(paths)) {
    if (!discoveredKeys.includes(key)) {
      issues.push(
        `tsconfig.json has unknown alias ${key} (no packages/*/src/index.ts)`,
      )
    }
  }
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  if (!(pkg.workspaces ?? []).includes("packages/*")) {
    issues.push("package.json workspaces must include packages/*")
  }
  return issues
}

export function checkLicense(root = ROOT) {
  const issues = []
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  if (pkg.license !== "GPL-2.0-only") {
    issues.push("package.json license must be GPL-2.0-only")
  }
  const license = readFileSync(join(root, "LICENSE"), "utf8")
  if (!license.includes("GNU GENERAL PUBLIC LICENSE")) {
    issues.push("LICENSE missing GNU GPL header")
  }
  if (!license.includes("Version 2")) {
    issues.push("LICENSE missing Version 2")
  }
  const notice = readFileSync(join(root, "NOTICE.md"), "utf8")
  if (!notice.includes("CesiumJS")) {
    issues.push("NOTICE.md missing CesiumJS")
  }
  if (!notice.includes("GPL")) {
    issues.push("NOTICE.md missing GPL")
  }
  const files = pkg.files ?? []
  for (const required of ["LICENSE", "NOTICE.md"]) {
    if (!files.includes(required)) {
      issues.push(`package.json files missing ${required}`)
    }
  }
  if (!files.some((entry) => entry.startsWith("dist/"))) {
    issues.push("package.json files missing dist/*")
  }
  return issues
}

export function runAll(root = ROOT) {
  return {
    deps: checkDependencyBoundaries(root),
    exports: checkPublicExports(root),
    license: checkLicense(root),
    api: checkConsumerImports(root),
    workspace: checkWorkspaceAliases(root),
  }
}

function report(label, issues) {
  if (issues.length === 0) {
    console.log(`${label}: ok`)
    return
  }
  console.error(`${label}:`)
  for (const issue of issues) console.error(`  - ${issue}`)
  process.exitCode = 1
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(entry).href
  } catch {
    return false
  }
}

if (isDirectRun()) {
  const command = process.argv[2] ?? "all"
  if (command === "deps") report("deps", checkDependencyBoundaries())
  else if (command === "exports") report("exports", checkPublicExports())
  else if (command === "exports:update") {
    const surface = collectPublicSurface()
    const rootEntry = surface["."]
    const manifest = {
      values: rootEntry.values,
      types: rootEntry.types,
      entries: surface,
    }
    writeFileSync(
      join(ROOT, MANIFEST_PATH),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    const summary = Object.entries(surface)
      .map(
        ([key, entry]) =>
          `${key}: ${entry.values.length} values, ${entry.types.length} types`,
      )
      .join("; ")
    console.log(`wrote ${MANIFEST_PATH}: ${summary}`)
  } else if (command === "license") report("license", checkLicense())
  else if (command === "api") report("api", checkConsumerImports())
  else if (command === "workspace") report("workspace", checkWorkspaceAliases())
  else if (command === "all") {
    const result = runAll()
    report("deps", result.deps)
    report("exports", result.exports)
    report("license", result.license)
    report("api", result.api)
    report("workspace", result.workspace)
  } else {
    console.error(`Unknown command: ${command}`)
    process.exit(1)
  }
}
