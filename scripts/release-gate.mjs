import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const CESIUM_PACKAGES = new Set([
  "engine-cesium",
  "data",
  "scene",
  "layers",
  "graphics",
  "interaction",
  "analysis",
  "effects",
])

const ALLOWED_INTERNAL = {
  core: [],
  "engine-cesium": ["@arc3dlab/core"],
  data: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  scene: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  layers: ["@arc3dlab/core", "@arc3dlab/engine-cesium", "@arc3dlab/data"],
  graphics: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  interaction: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  analysis: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
  effects: ["@arc3dlab/core", "@arc3dlab/engine-cesium"],
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
  if (pkg.peerDependencies?.cesium !== "1.146.0") {
    issues.push("peerDependencies.cesium must be 1.146.0")
  }
  if (pkg.packageManager !== "npm@10.9.4") {
    issues.push("packageManager must be npm@10.9.4")
  }
  if (!existsSync(join(root, "package-lock.json"))) {
    issues.push("package-lock.json is required")
  }
  const entry = readFileSync(join(root, "src/index.ts"), "utf8")
  for (const name of PUBLIC_EXPORT_NAMES) {
    if (!new RegExp(`\\b${name}\\b`).test(entry)) {
      issues.push(`src/index.ts missing ${name}`)
    }
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
  for (const required of ["LICENSE", "NOTICE.md", "dist/*"]) {
    if (!files.includes(required)) {
      issues.push(`package.json files missing ${required}`)
    }
  }
  return issues
}

export function runAll(root = ROOT) {
  return {
    deps: checkDependencyBoundaries(root),
    exports: checkPublicExports(root),
    license: checkLicense(root),
    api: checkConsumerImports(root),
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
  else if (command === "license") report("license", checkLicense())
  else if (command === "api") report("api", checkConsumerImports())
  else if (command === "all") {
    const result = runAll()
    report("deps", result.deps)
    report("exports", result.exports)
    report("license", result.license)
    report("api", result.api)
  } else {
    console.error(`Unknown command: ${command}`)
    process.exit(1)
  }
}
