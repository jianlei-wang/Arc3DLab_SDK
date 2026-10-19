import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { collectPublishArtifacts } from "./publish-manifest.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const TARBALL_PREFIX = "package/"

/**
 * 解析 npm 的 SRI integrity 字符串。
 * @param integrity - 例如 `sha512-<base64>`。
 * @returns 算法与 base64 摘要；格式非法时返回 undefined。
 */
export function parseIntegrity(integrity) {
  const match = /^(sha512|sha384|sha256|sha1)-([A-Za-z0-9+/=]+)$/.exec(
    String(integrity ?? ""),
  )
  return match ? { algorithm: match[1], digest: match[2] } : undefined
}

/**
 * 校验下载内容与 npm integrity 一致。
 * @param content - 文件内容。
 * @param integrity - npm SRI 字符串。
 * @returns 是否一致。
 */
export function verifyIntegrity(content, integrity) {
  const parsed = parseIntegrity(integrity)
  if (!parsed) return false
  const digest = createHash(parsed.algorithm).update(content).digest("base64")
  return digest === parsed.digest
}

/**
 * 校验 registry 元数据指向预期包与版本。
 * @param metadata - `npm view <pkg>@<version> --json` 的结果。
 * @param expectedVersion - 期望版本。
 * @returns 不一致项列表。
 */
export function verifyRegistryMetadata(metadata, expectedVersion) {
  const issues = []
  if (metadata?.name !== "arc3dlab") {
    issues.push(
      `registry name must be arc3dlab, received ${String(metadata?.name)}`,
    )
  }
  if (metadata?.version !== expectedVersion) {
    issues.push(
      `registry version must be ${expectedVersion}, received ${String(metadata?.version)}`,
    )
  }
  const tarball = metadata?.dist?.tarball
  if (typeof tarball !== "string" || !/^https:\/\//.test(tarball)) {
    issues.push("registry dist.tarball must be an https URL")
  }
  if (!parseIntegrity(metadata?.dist?.integrity)) {
    issues.push("registry dist.integrity must be a valid SRI string")
  }
  return issues
}

/**
 * 校验 tarball 条目与本地发布清单一致。
 *
 * @param entries - `tar -tzf` 输出的包内路径（可带 `package/` 前缀）。
 * @param artifacts - `collectPublishArtifacts()` 产出的根相对路径。
 * @param files - `package.json` 的 `files` 根文件列表。
 * @returns 不一致项列表。
 */
export function verifyTarballEntries(entries, artifacts, files) {
  const issues = []
  const normalized = entries
    .map((entry) => entry.replace(/^\.\//, ""))
    .map((entry) =>
      entry.startsWith(TARBALL_PREFIX)
        ? entry.slice(TARBALL_PREFIX.length)
        : entry,
    )
    .filter((entry) => entry && !entry.endsWith("/"))
  const present = new Set(normalized)
  const expected = new Set(["package.json", ...artifacts])
  for (const file of files ?? []) {
    if (file.startsWith("dist") || file.startsWith("!")) continue
    expected.add(file)
  }
  for (const file of expected) {
    if (!present.has(file)) issues.push(`tarball missing ${file}`)
  }
  for (const file of present) {
    if (file.startsWith("dist/") && !expected.has(file)) {
      issues.push(`tarball contains unexpected dist artifact ${file}`)
    }
    if (file.endsWith(".map"))
      issues.push(`tarball must not publish source map ${file}`)
    for (const prefix of [
      "node_modules/",
      "src/",
      "tests/",
      "scripts/",
      "packages/",
      "dist/src/",
      "dist/packages/",
    ]) {
      if (file.startsWith(prefix))
        issues.push(`tarball must not publish ${prefix} (${file})`)
    }
  }
  return issues
}

/**
 * 校验安装后的 `package.json` 保持发布合同。
 * @param pkg - 安装目录中的 `package.json`。
 * @param expectedVersion - 期望版本。
 * @returns 不一致项列表。
 */
export function verifyInstalledManifest(pkg, expectedVersion) {
  const issues = []
  if (pkg?.name !== "arc3dlab")
    issues.push("installed package name must be arc3dlab")
  if (pkg?.version !== expectedVersion) {
    issues.push(
      `installed version ${String(pkg?.version)} must be ${expectedVersion}`,
    )
  }
  if (pkg?.type !== "module") issues.push("installed package must be ESM-only")
  if (pkg?.main !== undefined)
    issues.push("installed package must not declare main")
  if (pkg?.dependencies && Object.keys(pkg.dependencies).length > 0) {
    issues.push("installed package must not have runtime dependencies")
  }
  if (pkg?.peerDependencies?.cesium !== "1.146.0") {
    issues.push("installed package must declare exact cesium peer 1.146.0")
  }
  return issues
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
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
  const version =
    readArg("--version") ??
    JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version
  const temp = mkdtempSync(join(tmpdir(), "arc3dlab-registry-"))
  try {
    const raw = execFileSync("npm", ["view", `arc3dlab@${version}`, "--json"], {
      encoding: "utf8",
      timeout: 60000,
    })
    const metadata = JSON.parse(raw)
    const issues = verifyRegistryMetadata(metadata, version)
    if (issues.length) throw new Error(issues.join("\n"))
    const response = await fetch(metadata.dist.tarball, {
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) {
      throw new Error(
        `registry tarball download failed: HTTP ${response.status}`,
      )
    }
    const tarball = Buffer.from(await response.arrayBuffer())
    if (!verifyIntegrity(tarball, metadata.dist.integrity)) {
      throw new Error("registry tarball integrity mismatch")
    }
    const tarballPath = join(temp, `arc3dlab-${version}.tgz`)
    writeFileSync(tarballPath, tarball)
    const entries = execFileSync("tar", ["-tzf", tarballPath], {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean)
    const packageJson = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    )
    const tarIssues = verifyTarballEntries(
      entries,
      collectPublishArtifacts(ROOT),
      packageJson.files,
    )
    if (tarIssues.length) throw new Error(tarIssues.join("\n"))

    const extractDir = join(temp, "extract")
    mkdirSync(extractDir)
    execFileSync("tar", ["-xzf", tarballPath, "-C", extractDir])
    const installed = JSON.parse(
      readFileSync(join(extractDir, "package", "package.json"), "utf8"),
    )
    const manifestIssues = verifyInstalledManifest(installed, version)
    if (manifestIssues.length) throw new Error(manifestIssues.join("\n"))

    const consumer = join(temp, "consumer")
    mkdirSync(consumer)
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "arc3dlab-registry-check",
        private: true,
        type: "module",
      }),
    )
    execFileSync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--legacy-peer-deps",
        "--no-audit",
        "--no-fund",
        tarballPath,
      ],
      { cwd: consumer, stdio: "pipe", timeout: 120000 },
    )
    const cesium = join(ROOT, "node_modules", "cesium")
    if (!existsSync(cesium)) {
      throw new Error(
        "local cesium is required to verify the installed import path",
      )
    }
    symlinkSync(cesium, join(consumer, "node_modules", "cesium"), "dir")
    execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        "const sdk = await import('arc3dlab'); if (typeof sdk.Arc3D?.create !== 'function') throw new Error('Arc3D missing'); await import('arc3dlab/engine-cesium');",
      ],
      { cwd: consumer, stdio: "pipe", timeout: 60000 },
    )
    console.log(`registry verify ok: arc3dlab@${version}`)
  } catch (error) {
    console.error("registry verify failed:")
    console.error(String(error?.message ?? error))
    process.exitCode = 1
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}
