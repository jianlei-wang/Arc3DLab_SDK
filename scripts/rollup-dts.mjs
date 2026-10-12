import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { Extractor, ExtractorConfig } = require("@microsoft/api-extractor")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DIST = join(ROOT, "dist")
const TSCONFIG = join(ROOT, "tsconfig.rollup.json")

const ENTRIES = [
  { entry: join(DIST, "src/index.d.ts"), out: join(DIST, "index.d.ts") },
  {
    entry: join(DIST, "packages/engine-cesium/src/index.d.ts"),
    out: join(DIST, "engine-cesium.d.ts"),
  },
]

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walk(path, files)
      continue
    }
    if (name.endsWith(".d.ts")) files.push(path)
  }
  return files
}

const FROM_RE = /(\bfrom\s+["'])([^"'\n]+?)\.ts(["'])/g
const IMPORT_RE = /(\bimport\(\s*["'])([^"'\n]+?)\.ts(["'])/g

/**
 * vite-plugin-dts 会把内部包别名改写成指向源码的 `.ts` 相对路径。这些路径在发布产物里
 * 并不存在，且会让 api-extractor 把源码实现体内联进 `.d.ts`。这里去掉 `.ts` 扩展名，
 * 使其解析到同目录的 `.d.ts`。
 */
function stripTsExtensions(files) {
  let changed = 0
  for (const file of files) {
    const before = readFileSync(file, "utf8")
    const after = before.replace(FROM_RE, "$1$2$3").replace(IMPORT_RE, "$1$2$3")
    if (after !== before) {
      writeFileSync(file, after)
      changed += 1
    }
  }
  return changed
}

function rollup({ entry, out }) {
  if (!existsSync(entry)) {
    throw new Error(`declaration entry missing: ${entry}`)
  }
  const extractorConfig = ExtractorConfig.prepare({
    configObject: {
      projectFolder: ROOT,
      mainEntryPointFilePath: entry,
      compiler: { tsconfigFilePath: TSCONFIG },
      apiReport: { enabled: false },
      docModel: { enabled: false },
      dtsRollup: { enabled: true, publicTrimmedFilePath: out },
      tsdocMetadata: { enabled: false },
    },
    configObjectFullPath: join(ROOT, "api-extractor.json"),
    packageJsonFullPath: join(ROOT, "package.json"),
  })
  const result = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showDiagnostics: false,
    showVerboseMessages: false,
  })
  if (!result.succeeded) {
    throw new Error(
      `api-extractor failed for ${entry} (errors: ${result.errorCount})`,
    )
  }
  console.log(`bundled ${out.replace(ROOT + "/", "")}`)
}

const dtsFiles = walk(DIST)
const rewritten = stripTsExtensions(dtsFiles)
console.log(`normalized ${rewritten}/${dtsFiles.length} declaration files`)

for (const entry of ENTRIES) {
  rollup(entry)
}

console.log("declaration rollup ok")
