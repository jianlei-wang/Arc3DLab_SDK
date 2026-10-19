import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  collectExportTargets,
  collectPublishArtifacts,
} from "./publish-manifest.mjs"
import { CESIUM_PEER_VERSION } from "./release-gate.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const REQUIRED_PACKED_FILES = [
  "README.md",
  "CHANGES.md",
  "LOG.md",
  "NOTICE.md",
  "LICENSE",
]

const FORBIDDEN_PACKED_PREFIXES = [
  "src/",
  "packages/",
  "demo-vue3/",
  "tests/",
  "scripts/",
  "node_modules/",
  ".github/",
]

/**
 * 判断 `exports` 中是否声明了 CommonJS 出口。
 * @param value - `exports` 字段或其中的嵌套值。
 * @returns 是否存在 `require` 条件。
 */
function hasRequireCondition(value) {
  if (Array.isArray(value)) return value.some(hasRequireCondition)
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) => key === "require" || hasRequireCondition(nested),
    )
  }
  return false
}

/**
 * 校验已安装包的发布合同，确保消费方拿到的是 ESM-only 包且依赖关系明确。
 * @param installed - 安装目录中的 `package.json`。
 * @param expected - 仓库根 `package.json`。
 * @returns 不一致项列表。
 */
function checkInstalledContract(installed, expected) {
  const issues = []
  if (installed.name !== expected.name) {
    issues.push(`installed name ${installed.name} != ${expected.name}`)
  }
  if (installed.version !== expected.version) {
    issues.push(`installed version ${installed.version} != ${expected.version}`)
  }
  if (installed.type !== "module") issues.push("installed package must be ESM")
  if (installed.main !== undefined) {
    issues.push("installed package must not declare main")
  }
  if (hasRequireCondition(installed.exports)) {
    issues.push("installed package must not declare require exports")
  }
  if (installed.license !== expected.license) {
    issues.push(`installed license ${installed.license} != ${expected.license}`)
  }
  if (installed.engines?.node !== ">=22") {
    issues.push("installed package must require Node >=22")
  }
  if (
    installed.dependencies &&
    Object.keys(installed.dependencies).length > 0
  ) {
    issues.push("installed package must not declare runtime dependencies")
  }
  const peers = Object.keys(installed.peerDependencies ?? {})
  if (
    peers.length !== 1 ||
    peers[0] !== "cesium" ||
    installed.peerDependencies?.cesium !== CESIUM_PEER_VERSION
  ) {
    issues.push(
      `installed peerDependencies must be exactly cesium@${CESIUM_PEER_VERSION}`,
    )
  }
  if (installed.module !== expected.module) {
    issues.push(
      `installed module entry ${installed.module} != ${expected.module}`,
    )
  }
  if (installed.types !== expected.types) {
    issues.push(`installed types entry ${installed.types} != ${expected.types}`)
  }
  return issues
}

function requireFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run npm run build first.`)
  }
}

requireFile(join(ROOT, "dist/arc3dlab.esm.js"))
requireFile(join(ROOT, "dist/engine-cesium.js"))
requireFile(join(ROOT, "dist/index.d.ts"))

const work = mkdtempSync(join(tmpdir(), "arc3dlab-pack-"))
try {
  const npmExecPath = process.env.npm_execpath

  /** 通过当前 npm CLI 入口执行命令，兼容 Windows 无法直接启动 .cmd 的限制。 */
  function runNpm(args, options) {
    if (npmExecPath) {
      return execFileSync(process.execPath, [npmExecPath, ...args], options)
    }
    return execFileSync("npm", args, {
      ...options,
      shell: process.platform === "win32",
    })
  }

  const packOutput = runNpm(["pack", "--json", "--pack-destination", work], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
  const [packInfo] = JSON.parse(packOutput)
  const tarball =
    packInfo?.filename ??
    readdirSync(work).find((name) => name.endsWith(".tgz"))
  if (!tarball) throw new Error("npm pack produced no tarball")
  const packedFiles = new Map(
    (packInfo?.files ?? []).map((file) => [file.path, file.size]),
  )

  /** 断言产物已进入 npm tarball，避免 files 规则遗漏嵌套目录。 */
  function requirePacked(path) {
    if (!packedFiles.has(path)) throw new Error(`Missing packed file ${path}`)
  }

  const packageJson = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  )
  if (packInfo?.name !== packageJson.name) {
    throw new Error(`npm pack name ${packInfo?.name} != ${packageJson.name}`)
  }
  if (packInfo?.version !== packageJson.version) {
    throw new Error(
      `npm pack version ${packInfo?.version} != ${packageJson.version}`,
    )
  }
  if (!packedFiles.has("package.json")) {
    throw new Error("Missing packed file package.json")
  }
  for (const path of REQUIRED_PACKED_FILES) requirePacked(path)
  for (const path of packedFiles.keys()) {
    if (FORBIDDEN_PACKED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      throw new Error(`Unexpected packed source path ${path}`)
    }
  }

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

  runNpm(["install", "--ignore-scripts", join(work, tarball)], {
    cwd: consumer,
    stdio: "inherit",
  })

  const cesiumLink = join(consumer, "node_modules/cesium")
  if (!existsSync(cesiumLink)) {
    mkdirSync(join(consumer, "node_modules"), { recursive: true })
    symlinkSync(join(ROOT, "node_modules/cesium"), cesiumLink, "junction")
  }

  const installedDir = join(consumer, "node_modules/arc3dlab")
  const installedPackage = JSON.parse(
    readFileSync(join(installedDir, "package.json"), "utf8"),
  )
  const contractIssues = checkInstalledContract(installedPackage, packageJson)
  if (contractIssues.length) {
    throw new Error(
      `Installed package contract failed:\n- ${contractIssues.join("\n- ")}`,
    )
  }
  for (const path of REQUIRED_PACKED_FILES) {
    const installedPath = join(installedDir, path)
    if (!existsSync(installedPath)) {
      throw new Error(`Missing installed publish file ${path}`)
    }
    if (
      readFileSync(installedPath, "utf8") !==
      readFileSync(join(ROOT, path), "utf8")
    ) {
      throw new Error(`Installed publish file ${path} differs from repository`)
    }
  }
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
} finally {
  try {
    rmSync(work, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    })
  } catch (error) {
    console.warn(`Failed to clean up ${work}: ${String(error)}`)
  }
}
