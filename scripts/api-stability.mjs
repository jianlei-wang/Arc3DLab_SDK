import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { checkPublicExports } from "./release-gate.mjs"
import { parseReleaseVersion } from "./release-check.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MANIFEST_PATH = "scripts/public-api-manifest.json"
const POLICY_PATH = "scripts/public-api-stability.json"
const HISTORY_DIR = "scripts/api-history"
const LEVELS = ["stable", "experimental", "internal"]

/**
 * 读取公开 API 稳定性策略。
 * @param root - 仓库根目录。
 * @returns 已解析的策略对象。
 */
export function loadStabilityPolicy(root = ROOT) {
  return JSON.parse(readFileSync(join(root, POLICY_PATH), "utf8"))
}

/**
 * 读取指定路径的公开 API 基线。
 * @param path - manifest 文件绝对路径。
 * @returns 已解析的 manifest。
 */
export function loadManifest(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function compareVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  return 0
}

/**
 * 查找不高于当前版本的最新发布快照。
 * @param root - 仓库根目录。
 * @param version - 当前 `package.json` 版本。
 * @returns 快照路径与内容；不存在时返回 undefined。
 */
export function findLatestSnapshot(root, version) {
  const current = parseReleaseVersion(version)
  if (!current) return undefined
  const dir = join(root, HISTORY_DIR)
  if (!existsSync(dir)) return undefined
  const candidates = []
  for (const name of readdirSync(dir)) {
    const match = /^v(.+)\.json$/.exec(name)
    if (!match) continue
    const parsed = parseReleaseVersion(match[1])
    if (!parsed || compareVersions(parsed, current) > 0) continue
    candidates.push({ name, version: match[1], parsed })
  }
  candidates.sort((a, b) => compareVersions(b.parsed, a.parsed))
  const latest = candidates[0]
  if (!latest) return undefined
  const path = join(dir, latest.name)
  return { path, version: latest.version, manifest: loadManifest(path) }
}

function deprecationMetadataIssues(key, meta, label) {
  const issues = []
  if (!meta || typeof meta !== "object") {
    return [`${label} ${key} deprecation metadata must be an object`]
  }
  if (!LEVELS.includes(meta.stability)) {
    issues.push(
      `${label} ${key} deprecation stability must be stable, experimental or internal`,
    )
  }
  const since = parseReleaseVersion(meta.since)
  const removeIn = parseReleaseVersion(meta.removeIn)
  if (!since) issues.push(`${label} ${key} deprecation since must be semver`)
  if (!removeIn)
    issues.push(`${label} ${key} deprecation removeIn must be semver`)
  if (since && removeIn && removeIn.major <= since.major) {
    issues.push(
      `${label} ${key} deprecation must cross a major boundary (removeIn > since major)`,
    )
  }
  if (typeof meta.replacement !== "string" || !meta.replacement.trim()) {
    issues.push(`${label} ${key} deprecation requires a replacement`)
  } else if (meta.replacement === key) {
    issues.push(
      `${label} ${key} deprecation replacement must differ from the symbol`,
    )
  }
  if (typeof meta.reason !== "string" || !meta.reason.trim()) {
    issues.push(`${label} ${key} deprecation requires a reason`)
  }
  return issues
}

function entryNames(entry) {
  return [...(entry.values ?? []), ...(entry.types ?? [])]
}

/**
 * 校验稳定性策略覆盖全部公开导出，并核对弃用生命周期元数据。
 *
 * @param policy - `public-api-stability.json` 内容。
 * @param manifest - 当前 `public-api-manifest.json` 内容。
 * @param options - 校验选项。
 * @param options.version - 期望的包版本；省略时使用 manifest 中的版本。
 * @returns 不一致项列表。
 */
export function validateStabilityPolicy(policy, manifest, options = {}) {
  const issues = []
  if (policy?.schemaVersion !== 1) {
    issues.push("public API stability policy schemaVersion must be 1")
  }
  const policyEntries = policy?.entries
  const manifestEntries = manifest?.entries
  if (!policyEntries || typeof policyEntries !== "object") {
    return [...issues, "public API stability policy entries must be an object"]
  }
  if (!manifestEntries || typeof manifestEntries !== "object") {
    return [...issues, "public API manifest entries must be an object"]
  }
  const policyKeys = Object.keys(policyEntries).sort()
  const manifestKeys = Object.keys(manifestEntries).sort()
  if (JSON.stringify(policyKeys) !== JSON.stringify(manifestKeys)) {
    issues.push(
      `stability policy entries must match manifest entries: ${policyKeys.join(", ")}`,
    )
  }
  const version = options.version ?? manifest.version
  if (!parseReleaseVersion(version)) {
    issues.push("public API manifest version must be semver")
  }
  if (
    manifest.version !== undefined &&
    options.version &&
    manifest.version !== options.version
  ) {
    issues.push(
      `public API manifest version ${manifest.version} must match package.json ${options.version}`,
    )
  }
  if (manifest.entries?.["."]) {
    if (
      JSON.stringify(manifest.entries["."].values ?? []) !==
      JSON.stringify(manifest.values ?? [])
    ) {
      issues.push(
        'public API manifest top-level values must match entries["."]',
      )
    }
    if (
      JSON.stringify(manifest.entries["."].types ?? []) !==
      JSON.stringify(manifest.types ?? [])
    ) {
      issues.push('public API manifest top-level types must match entries["."]')
    }
    if (
      JSON.stringify(manifest.entries["."].deprecated ?? {}) !==
      JSON.stringify(manifest.deprecated ?? {})
    ) {
      issues.push(
        'public API manifest top-level deprecated map must match entries["."]',
      )
    }
  }

  for (const key of policyKeys) {
    const entry = policyEntries[key]
    const manifestEntry = manifestEntries[key]
    if (!entry || !manifestEntry) continue
    const names = entryNames(manifestEntry)
    const levels = {}
    for (const level of LEVELS) {
      const list = entry[level]
      if (!Array.isArray(list)) {
        issues.push(`stability policy ${key} ${level} must be an array`)
        continue
      }
      const duplicates = list.filter(
        (name, index) => list.indexOf(name) !== index,
      )
      if (duplicates.length) {
        issues.push(
          `stability policy ${key} ${level} has duplicates: ${[...new Set(duplicates)].join(", ")}`,
        )
      }
      for (const name of list) {
        if (levels[name]) {
          issues.push(
            `stability policy ${key} ${name} classified as both ${levels[name]} and ${level}`,
          )
        }
        levels[name] = level
        if (!names.includes(name)) {
          issues.push(
            `stability policy ${key} ${level} has unknown export ${name}`,
          )
        }
      }
    }
    const deprecated = entry.deprecated ?? {}
    if (typeof deprecated !== "object" || Array.isArray(deprecated)) {
      issues.push(`stability policy ${key} deprecated must be an object`)
    }
    for (const [name, meta] of Object.entries(deprecated)) {
      if (levels[name]) {
        issues.push(
          `stability policy ${key} ${name} is classified as ${levels[name]} and deprecated`,
        )
      }
      levels[name] = "deprecated"
      if (!names.includes(name)) {
        issues.push(
          `stability policy ${key} deprecated has unknown export ${name}`,
        )
      }
      issues.push(
        ...deprecationMetadataIssues(name, meta, `stability policy ${key}`),
      )
    }
    const deprecatedMembers = entry.deprecatedMembers ?? {}
    if (
      typeof deprecatedMembers !== "object" ||
      Array.isArray(deprecatedMembers)
    ) {
      issues.push(`stability policy ${key} deprecatedMembers must be an object`)
    }
    const manifestDeprecated = manifestEntry.deprecated ?? {}
    for (const [name, meta] of Object.entries(deprecatedMembers)) {
      const base = name.split(".")[0]
      if (!names.includes(base)) {
        issues.push(
          `stability policy ${key} deprecated member ${name} has no class ${base}`,
        )
      }
      if (levels[name]) {
        issues.push(
          `stability policy ${key} ${name} is classified as ${levels[name]} and deprecated`,
        )
      }
      issues.push(
        ...deprecationMetadataIssues(name, meta, `stability policy ${key}`),
      )
      if (manifestDeprecated[name] === undefined) {
        issues.push(
          `public API manifest ${key} missing @deprecated annotation for ${name}`,
        )
      }
    }
    for (const name of names) {
      if (!levels[name]) {
        issues.push(
          `stability policy ${key} missing classification for ${name}`,
        )
      }
    }
    const expectedDeprecated = new Set([
      ...Object.keys(deprecated),
      ...Object.keys(deprecatedMembers),
    ])
    for (const name of Object.keys(manifestDeprecated)) {
      if (!expectedDeprecated.has(name)) {
        issues.push(
          `public API manifest ${key} has undocumented deprecation ${name}`,
        )
      }
    }
    for (const name of expectedDeprecated) {
      if (manifestDeprecated[name] === undefined) {
        issues.push(`public API manifest ${key} missing deprecation ${name}`)
      }
    }
  }
  return issues
}

function levelFor(policy, entry, name) {
  const classified = policy?.entries?.[entry]
  if (!classified) return undefined
  for (const level of LEVELS) {
    if ((classified[level] ?? []).includes(name)) return level
  }
  if (classified.deprecated?.[name]) return "deprecated"
  const base = name.split(".")[0]
  if (
    classified.deprecatedMembers?.[name] ||
    classified.deprecatedMembers?.[base]
  ) {
    return "deprecated"
  }
  return undefined
}

/**
 * 比较两份 API 基线，按稳定性等级标记新增、移除与签名变化。
 *
 * @param base - 上一发布版本的 manifest。
 * @param current - 当前 manifest。
 * @param policy - 当前稳定性策略。
 * @returns 变更项列表。
 */
export function diffApiSurfaces(base, current, policy, basePolicy = policy) {
  const changes = []
  const entries = new Set([
    ...Object.keys(base?.entries ?? {}),
    ...Object.keys(current?.entries ?? {}),
  ])
  for (const key of [...entries].sort()) {
    const before = base?.entries?.[key]
    const after = current?.entries?.[key]
    if (!before) {
      changes.push({
        entry: key,
        name: key,
        kind: "entry",
        status: "added",
        level: "stable",
        breaking: false,
      })
      continue
    }
    if (!after) {
      changes.push({
        entry: key,
        name: key,
        kind: "entry",
        status: "removed",
        level: "stable",
        breaking: true,
      })
      continue
    }
    for (const kind of ["values", "types"]) {
      const oldNames = before[kind] ?? []
      const newNames = after[kind] ?? []
      for (const name of newNames.filter((item) => !oldNames.includes(item))) {
        changes.push({
          entry: key,
          name,
          kind,
          status: "added",
          level: levelFor(policy, key, name) ?? "unclassified",
          breaking: false,
        })
      }
      for (const name of oldNames.filter((item) => !newNames.includes(item))) {
        changes.push({
          entry: key,
          name,
          kind,
          status: "removed",
          level: levelFor(basePolicy, key, name) ?? "unclassified",
          breaking: true,
        })
      }
    }
    const oldSignatures = before.signatures ?? {}
    const newSignatures = after.signatures ?? {}
    for (const name of Object.keys(oldSignatures).sort()) {
      if (newSignatures[name] === undefined) continue
      if (oldSignatures[name] !== newSignatures[name]) {
        changes.push({
          entry: key,
          name,
          kind: "signature",
          status: "changed",
          level: levelFor(basePolicy, key, name) ?? "unclassified",
          breaking: true,
        })
      }
    }
  }
  return changes
}

/**
 * 按 SemVer 与弃用周期评估 API 变更。
 *
 * @param changes - {@link diffApiSurfaces} 的输出。
 * @param options - 版本与策略。
 * @param options.baseVersion - 基线版本。
 * @param options.version - 当前版本。
 * @param options.policy - 当前稳定性策略。
 * @returns 不满足版本策略的项。
 */
export function assessApiChanges(changes, options) {
  const issues = []
  const base = parseReleaseVersion(options.baseVersion)
  const current = parseReleaseVersion(options.version)
  if (!base || !current)
    return ["api review requires semver base and current versions"]
  const majorBump = current.major > base.major
  const minorBump =
    majorBump || (current.major === base.major && current.minor > base.minor)
  for (const change of changes) {
    if (change.level === "unclassified") {
      issues.push(
        `public API ${change.status} ${change.entry} ${change.name} has no stability classification`,
      )
      continue
    }
    if (change.level === "internal") continue
    if (!change.breaking && change.status === "added") {
      if (!minorBump) {
        issues.push(
          `public API addition ${change.entry} ${change.name} requires a minor version bump (current ${options.version}, base ${options.baseVersion})`,
        )
      }
      continue
    }
    if (!change.breaking) continue
    if (change.level === "stable") {
      if (!majorBump) {
        issues.push(
          `stable API ${change.status} ${change.entry} ${change.name} requires a major version bump`,
        )
      }
      continue
    }
    if (change.level === "experimental") {
      if (!minorBump) {
        issues.push(
          `experimental API ${change.status} ${change.entry} ${change.name} requires a minor version bump`,
        )
      }
      continue
    }
    if (change.level === "deprecated") {
      const policyEntry = options.policy?.entries?.[change.entry]
      const meta =
        policyEntry?.deprecated?.[change.name] ??
        policyEntry?.deprecatedMembers?.[change.name] ??
        policyEntry?.deprecatedMembers?.[change.name.split(".")[0]]
      const removeIn = parseReleaseVersion(meta?.removeIn)
      if (removeIn && compareVersions(current, removeIn) < 0) {
        issues.push(
          `deprecated API ${change.name} cannot change before removeIn ${meta.removeIn}`,
        )
      }
      if (!majorBump) {
        issues.push(
          `deprecated API ${change.status} ${change.name} requires a major version bump`,
        )
      }
    }
  }
  return issues
}

function formatChanges(changes) {
  if (changes.length === 0) return []
  return changes.map(
    (change) =>
      `${change.level.padEnd(12)} ${change.status.padEnd(8)} ${change.entry} ${change.name} (${change.kind})`,
  )
}

function resolveBaseManifest(root, baseArg, version) {
  if (baseArg) {
    const normalized = baseArg.replace(/^v/, "")
    const explicit = join(root, HISTORY_DIR, `v${normalized}.json`)
    if (existsSync(explicit))
      return {
        path: explicit,
        version: normalized,
        manifest: loadManifest(explicit),
      }
    if (existsSync(baseArg)) {
      const manifest = loadManifest(baseArg)
      return { path: baseArg, version: manifest.version, manifest }
    }
    return undefined
  }
  return findLatestSnapshot(root, version)
}

function packageVersion(root = ROOT) {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version
}

/**
 * 校验稳定性策略、当前 manifest 与发布快照。
 * @param root - 仓库根目录。
 * @returns 不一致项列表。
 */
export function checkStability(root = ROOT) {
  const policy = loadStabilityPolicy(root)
  const manifest = loadManifest(join(root, MANIFEST_PATH))
  const version = packageVersion(root)
  const issues = validateStabilityPolicy(policy, manifest, { version })
  issues.push(
    ...checkPublicExports(root).filter((issue) =>
      issue.startsWith("public API"),
    ),
  )
  const snapshot = findLatestSnapshot(root, version)
  if (!snapshot) {
    issues.push(`missing API snapshot in ${HISTORY_DIR} for v${version}`)
  } else if (snapshot.version === version) {
    const same =
      JSON.stringify(snapshot.manifest.entries) ===
      JSON.stringify(manifest.entries)
    if (!same) {
      issues.push(
        `API snapshot v${snapshot.version} is stale; run npm run api:snapshot after review`,
      )
    }
  }
  return issues
}

/**
 * 比较当前 manifest 与最近发布快照。
 * @param root - 仓库根目录。
 * @param options - 选项。
 * @param options.base - 指定基线版本或文件。
 * @returns 变更项、问题列表与基线信息。
 */
export function reviewApi(root = ROOT, options = {}) {
  const policy = loadStabilityPolicy(root)
  const manifest = loadManifest(join(root, MANIFEST_PATH))
  const version = packageVersion(root)
  const issues = validateStabilityPolicy(policy, manifest, { version })
  issues.push(
    ...checkPublicExports(root).filter((issue) =>
      issue.startsWith("public API"),
    ),
  )
  const base = resolveBaseManifest(root, options.base, version)
  if (!base) {
    issues.push(
      "api review requires a released snapshot in scripts/api-history",
    )
    return { changes: [], issues, baseVersion: undefined }
  }
  const changes = diffApiSurfaces(
    base.manifest,
    manifest,
    policy,
    base.manifest.stability ?? policy,
  )
  issues.push(
    ...assessApiChanges(changes, {
      baseVersion: base.version,
      version,
      policy,
    }),
  )
  return { changes, issues, baseVersion: base.version }
}

/**
 * 将当前 manifest 写入发布快照。
 * @param root - 仓库根目录。
 * @param options - 选项。
 * @param options.force - 是否覆盖内容不同的同名快照。
 * @returns 写入路径。
 */
export function writeApiSnapshot(root = ROOT, options = {}) {
  const manifest = loadManifest(join(root, MANIFEST_PATH))
  const version = packageVersion(root)
  const policy = loadStabilityPolicy(root)
  const issues = validateStabilityPolicy(policy, manifest, { version })
  if (issues.length) {
    throw new Error(
      `cannot snapshot invalid API manifest:\n${issues.join("\n")}`,
    )
  }
  const dir = join(root, HISTORY_DIR)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `v${version}.json`)
  if (existsSync(path) && !options.force) {
    const existing = readFileSync(path, "utf8")
    const next = `${JSON.stringify(manifest, null, 2)}\n`
    if (existing !== next) {
      throw new Error(
        `snapshot v${version} exists and differs; pass --force to replace`,
      )
    }
    return path
  }
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  return path
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
  const command = process.argv[2] ?? "check"
  const baseIndex = process.argv.indexOf("--base")
  const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined
  if (command === "check") {
    const issues = checkStability()
    if (issues.length) {
      console.error("api stability check failed:")
      for (const issue of issues) console.error(`  - ${issue}`)
      process.exitCode = 1
    } else {
      console.log("api stability: ok")
    }
  } else if (command === "review") {
    const result = reviewApi(ROOT, { base })
    const lines = formatChanges(result.changes)
    if (lines.length) {
      console.log(`api review against v${result.baseVersion}:`)
      for (const line of lines) console.log(`  ${line}`)
    } else {
      console.log(
        `api review: no public surface changes since v${result.baseVersion}`,
      )
    }
    if (result.issues.length) {
      console.error("api review failed:")
      for (const issue of result.issues) console.error(`  - ${issue}`)
      process.exitCode = 1
    } else {
      console.log("api review: ok")
    }
  } else if (command === "snapshot") {
    const path = writeApiSnapshot(ROOT, {
      force: process.argv.includes("--force"),
    })
    console.log(`api snapshot written: ${path}`)
  } else {
    console.error(`Unknown command: ${command}`)
    process.exit(1)
  }
}
