import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

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

execFileSync("npm", ["pack", "--pack-destination", work], {
  cwd: ROOT,
  stdio: "inherit",
})

const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"))
if (!tarball) throw new Error("npm pack produced no tarball")

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

writeFileSync(
  join(consumer, "import.mjs"),
  `import {
  Arc3D,
  Viewer,
  CesiumEngine,
  Arc3DError,
  createId,
} from "arc3dlab"
import { CesiumEngine as EngineExport } from "arc3dlab/engine-cesium"
if (typeof Arc3D.create !== "function") {
  throw new Error("Arc3D.create missing")
}
if (typeof Viewer !== "function") throw new Error("Viewer missing")
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
