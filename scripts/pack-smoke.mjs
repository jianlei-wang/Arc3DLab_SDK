import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  collectExportTargets,
  collectPublishArtifacts,
} from "./publish-manifest.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

function requireFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run npm run build first.`)
  }
}

requireFile(join(ROOT, "dist/arc3dlab.esm.js"))
requireFile(join(ROOT, "dist/engine-cesium.js"))
requireFile(join(ROOT, "dist/index.d.ts"))

const work = join("/tmp/opencode", `arc3dlab-pack-${Date.now()}`)
mkdirSync(work, { recursive: true })

const packOutput = execFileSync(
  "npm",
  ["pack", "--json", "--pack-destination", work],
  {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
)
const [packInfo] = JSON.parse(packOutput)
const tarball =
  packInfo?.filename ?? readdirSync(work).find((name) => name.endsWith(".tgz"))
if (!tarball) throw new Error("npm pack produced no tarball")
const packedFiles = new Map(
  (packInfo?.files ?? []).map((file) => [file.path, file.size]),
)

/** 断言产物已进入 npm tarball，避免 files 规则遗漏嵌套目录。 */
function requirePacked(path) {
  if (!packedFiles.has(path)) throw new Error(`Missing packed file ${path}`)
}

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))

/** 本次构建发布到 tarball 的完整 `dist` 清单，中间声明目录除外。 */
const publishArtifacts = collectPublishArtifacts(ROOT)
const publishArtifactSet = new Set(publishArtifacts)
for (const path of publishArtifacts) requirePacked(path)
for (const path of packedFiles.keys()) {
  if (path.startsWith("dist/") && !publishArtifactSet.has(path)) {
    throw new Error(`Unexpected packed build artifact ${path}`)
  }
}

const entryTargets = new Set(
  [
    ...collectExportTargets(packageJson.exports),
    packageJson.module,
    packageJson.types,
  ]
    .filter(Boolean)
    .map((path) => path.replace(/^\.\//, "")),
)
for (const path of entryTargets) requirePacked(path)

const consumer = join(work, "consumer")
mkdirSync(consumer)
writeFileSync(
  join(consumer, "package.json"),
  JSON.stringify(
    {
      name: "arc3dlab-pack-consumer",
      type: "module",
      private: true,
    },
    null,
    2,
  ),
)

execFileSync("npm", ["install", "--ignore-scripts", join(work, tarball)], {
  cwd: consumer,
  stdio: "inherit",
})

const cesiumLink = join(consumer, "node_modules/cesium")
if (!existsSync(cesiumLink)) {
  mkdirSync(join(consumer, "node_modules"), { recursive: true })
  symlinkSync(join(ROOT, "node_modules/cesium"), cesiumLink)
}

const installedDir = join(consumer, "node_modules/arc3dlab")
for (const path of publishArtifacts) {
  if (!existsSync(join(installedDir, path))) {
    throw new Error(`Missing installed build artifact ${path}`)
  }
}
for (const path of entryTargets) {
  if (!existsSync(join(installedDir, path))) {
    throw new Error(`Missing installed entry target ${path}`)
  }
}
const installedBundle = readFileSync(
  join(installedDir, "dist/arc3dlab.esm.js"),
  "utf8",
)
const workerReference = installedBundle.match(
  /new URL\("(assets\/analysis-worker-entry-[^"]+\.js)", import\.meta\.url\)/,
)
if (!workerReference) {
  throw new Error("Installed bundle does not reference a Worker asset")
}
const workerAsset = `dist/${workerReference[1]}`
requirePacked(workerAsset)
if (!existsSync(join(installedDir, workerAsset))) {
  throw new Error(`Missing installed Worker asset ${workerAsset}`)
}

const workerShim = join(consumer, "worker-self-shim.mjs")
writeFileSync(
  workerShim,
  `import { parentPort } from "node:worker_threads"

const pending = []
let handler
Object.defineProperty(globalThis, "self", {
  value: globalThis,
  configurable: true,
})
Object.defineProperty(globalThis, "onmessage", {
  configurable: true,
  get: () => handler,
  set: (fn) => {
    handler = fn
    while (pending.length && handler) handler({ data: pending.shift() })
  },
})
globalThis.postMessage = (message) => parentPort.postMessage(message)
parentPort.on("message", (data) => {
  if (handler) handler({ data })
  else pending.push(data)
})
`,
)

writeFileSync(
  join(consumer, "worker-smoke.mjs"),
  `import { Worker as ThreadWorker } from "node:worker_threads"
import { AnalysisJobHost } from "arc3dlab"

const workerUrl = new URL(
  ${JSON.stringify(`./node_modules/arc3dlab/${workerAsset}`)},
  import.meta.url,
)
const shim = ${JSON.stringify(workerShim)}
let created = 0

const host = new AnalysisJobHost({
  createWorker: () => {
    created += 1
    const worker = new ThreadWorker(workerUrl, {
      execArgv: ["--import", shim],
    })
    const adapter = {
      onmessage: null,
      onerror: null,
      postMessage: (message) => worker.postMessage(message),
      terminate: () => worker.terminate(),
    }
    worker.on("message", (data) => adapter.onmessage?.({ data }))
    worker.on("error", (error) => adapter.onerror?.(error))
    return adapter
  },
})

const distance = await host.run({
  type: "distance",
  positions: [
    [116.39, 39.9, 0],
    [116.391, 39.9, 0],
  ],
})
if (distance.type !== "distance" || !(distance.meters > 0)) {
  throw new Error("Packaged Worker returned an invalid distance")
}
const area = await host.run({
  type: "area",
  positions: [
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
})
if (area.type !== "area" || !(area.squareMeters > 0)) {
  throw new Error("Packaged Worker returned an invalid area")
}
if (created !== 1) throw new Error("Worker was not created exactly once")
host.destroy()
console.log("pack worker smoke ok")
`,
)

execFileSync("node", ["worker-smoke.mjs"], {
  cwd: consumer,
  stdio: "inherit",
  timeout: 60_000,
})

writeFileSync(
  join(consumer, "import.mjs"),
  `import {
  Arc3D,
  CesiumEngine,
  Arc3DError,
  createId,
} from "arc3dlab"
import { CesiumEngine as EngineExport } from "arc3dlab/engine-cesium"
if (typeof Arc3D.create !== "function") {
  throw new Error("Arc3D.create missing")
}
if (typeof CesiumEngine !== "function") {
  throw new Error("CesiumEngine missing")
}
if (typeof EngineExport !== "function") {
  throw new Error("arc3dlab/engine-cesium missing CesiumEngine")
}
if (typeof createId !== "function") throw new Error("createId missing")
const error = new Arc3DError("INVALID_ARGUMENT", "pack-smoke")
if (error.code !== "INVALID_ARGUMENT") {
  throw new Error("Arc3DError code mismatch")
}
console.log("pack smoke ok")
`,
)

execFileSync("node", ["import.mjs"], { cwd: consumer, stdio: "inherit" })

writeFileSync(
  join(consumer, "consumer.ts"),
  `import {
  Arc3D,
  Arc3DError,
  CesiumEngine,
  createId,
} from "arc3dlab"
import type {
  AnalysisResult,
  AnalysisTask,
  Arc3DConfig,
  Arc3DPlugin,
  DataAsset,
  SpatialReference,
} from "arc3dlab"
import { CesiumEngine as EngineExport } from "arc3dlab/engine-cesium"

const config: Arc3DConfig = { container: "map" }
const plugin: Arc3DPlugin = { name: "demo", install: () => undefined }
const error: Arc3DError = new Arc3DError("INVALID_ARGUMENT", "consumer")
const task: AnalysisTask = {
  id: "t",
  algorithm: "demo",
  algorithmVersion: "1.0.0",
  input: {},
  status: "pending",
  createdAt: 0,
}
const spatial: SpatialReference = { crs: "EPSG:4326", axisOrder: "lng-lat", angularUnit: "degrees" }
const asset: DataAsset = { id: "a", format: "geojson", version: "1" }
type Result = AnalysisResult<number>

void [Arc3D, CesiumEngine, EngineExport, createId, config, plugin, error, task, spatial, asset] as unknown as [unknown, unknown, unknown, unknown, Arc3DConfig, Arc3DPlugin, Arc3DError, AnalysisTask, SpatialReference, DataAsset]
void (undefined as unknown as Result)
`,
)

const tsc = join(ROOT, "node_modules/typescript/bin/tsc")
execFileSync(
  process.execPath,
  [
    tsc,
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--module",
    "esnext",
    "--moduleResolution",
    "bundler",
    "--target",
    "es2020",
    "consumer.ts",
  ],
  { cwd: consumer, stdio: "inherit" },
)

console.log(
  `pack manifest smoke ok (${publishArtifacts.length} build artifacts, ${entryTargets.size} entry targets)`,
)
console.log("pack type smoke ok")
