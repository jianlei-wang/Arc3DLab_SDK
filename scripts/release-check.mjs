import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 解析发布版本号。
 * @param value - 版本字符串。
 * @returns 主版本、次版本与补丁号；格式非法时返回 undefined。
 */
export function parseReleaseVersion(value) {
  const match = SEMVER_RE.exec(String(value ?? ""))
  if (!match) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

/**
 * 从发布日志中提取指定版本的小节。
 *
 * 小节从 `## v<version>` 标题开始，到下一个 `## ` 标题结束；标题可带发布日期。
 *
 * @param changes - `CHANGES.md` 内容。
 * @param version - 目标版本，可带或不带前导 `v`。
 * @returns 小节正文与标题；找不到时返回 undefined。
 */
export function findVersionSection(changes, version) {
  const normalized = String(version).replace(/^v/, "")
  const lines = String(changes).split(/\r?\n/)
  let heading
  let body = []
  let collecting = false
  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (match) {
      if (collecting) break
      const title = match[1]
      const candidate = /^\[?v?([^\]\s]+)\]?/.exec(title)?.[1]
      if (candidate === normalized) {
        collecting = true
        heading = title
      }
      continue
    }
    if (collecting) body.push(line)
  }
  if (!collecting) return undefined
  return { heading, body: body.join("\n").trim() }
}

/**
 * 判断版本小节是否声明破坏性变更。
 * @param section - 版本小节。
 * @returns 是否存在 `Breaking Changes` 小节。
 */
export function hasBreakingChanges(section) {
  return /^###\s+Breaking Changes\b/im.test(section.body)
}

/**
 * 校验发布元数据，确保版本号、发布日志、兼容矩阵与迁移说明一致。
 *
 * 该函数只读取传入内容，不访问文件系统，便于在测试中构造边界数据。
 *
 * @param state - 发布相关文本快照。
 * @param state.packageJson - 根 `package.json` 内容。
 * @param state.packageLock - 根 `package-lock.json` 内容。
 * @param state.changes - `CHANGES.md` 内容。
 * @param state.compatibility - `COMPATIBILITY.md` 内容。
 * @param state.migrationDocs - 迁移文档内容列表。
 * @param options - 校验选项。
 * @param options.version - 期望版本号；省略时使用 `package.json` 版本。
 * @param options.tag - 期望 Git tag；省略时不校验。
 * @returns 不一致项列表；空数组表示通过。
 */
export function checkReleaseState(state, options = {}) {
  const issues = []
  let packageJson
  let packageLock
  try {
    packageJson = JSON.parse(state.packageJson)
  } catch (error) {
    return [`package.json is not valid JSON: ${String(error)}`]
  }
  try {
    packageLock = JSON.parse(state.packageLock)
  } catch (error) {
    return [`package-lock.json is not valid JSON: ${String(error)}`]
  }

  const version = String(packageJson.version ?? "")
  const parsed = parseReleaseVersion(version)
  if (!parsed) {
    return [`package.json version must be a semver release: ${version}`]
  }
  if (options.version && options.version !== version) {
    issues.push(
      `release version mismatch: expected ${options.version}, package.json has ${version}`,
    )
  }
  if (options.tag && options.tag !== `v${version}`) {
    issues.push(
      `release tag mismatch: expected v${version}, received ${options.tag}`,
    )
  }

  const lockVersion = packageLock.packages?.[""]?.version ?? packageLock.version
  if (lockVersion !== version) {
    issues.push(
      `package-lock.json root version ${String(lockVersion)} must match package.json ${version}`,
    )
  }

  const section = findVersionSection(state.changes, version)
  if (!section) {
    issues.push(`CHANGES.md missing released section for v${version}`)
  } else {
    const date = /-\s*(\S+)\s*$/.exec(section.heading)?.[1]
    if (!date || !DATE_RE.test(date)) {
      issues.push(
        `CHANGES.md section for v${version} must end with a YYYY-MM-DD date`,
      )
    }
    if (!section.body) {
      issues.push(`CHANGES.md section for v${version} is empty`)
    }
    if (hasBreakingChanges(section)) {
      const covered = state.migrationDocs.some(
        (content) =>
          content.includes(version) ||
          content.includes(`${parsed.major}.${parsed.minor}`),
      )
      if (!covered) {
        issues.push(
          `breaking changes in v${version} require migration notes in docs/architecture/13-migration.md, docs/guides/migration.md or guide/migration/`,
        )
      }
    }
  }

  if (options.tag) {
    const unreleased = findVersionSection(state.changes, "Unreleased")
    if (unreleased?.body) {
      issues.push(
        `CHANGES.md Unreleased entries must be moved into v${version} before tagging ${options.tag}`,
      )
    }
  }

  const activeLine = `${parsed.major}.${parsed.minor}.x`
  if (!String(state.compatibility).includes(activeLine)) {
    issues.push(`COMPATIBILITY.md missing active matrix row ${activeLine}`)
  }

  return issues
}

function walkMarkdown(dir, files = []) {
  if (!existsSync(dir)) return files
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walkMarkdown(path, files)
      continue
    }
    if (name.endsWith(".md")) files.push(path)
  }
  return files
}

/**
 * 收集仓库中与发布元数据相关的文件内容。
 * @param root - 仓库根目录。
 * @returns 发布状态快照。
 */
export function collectReleaseState(root = ROOT) {
  const migrationFiles = [
    join(root, "docs/architecture/13-migration.md"),
    join(root, "docs/guides/migration.md"),
    ...walkMarkdown(join(root, "guide/migration")),
  ].filter((path) => existsSync(path))
  return {
    packageJson: readFileSync(join(root, "package.json"), "utf8"),
    packageLock: readFileSync(join(root, "package-lock.json"), "utf8"),
    changes: readFileSync(join(root, "CHANGES.md"), "utf8"),
    compatibility: readFileSync(join(root, "COMPATIBILITY.md"), "utf8"),
    migrationDocs: migrationFiles.map((path) => readFileSync(path, "utf8")),
  }
}

/**
 * 校验当前仓库是否处于可发布状态。
 * @param root - 仓库根目录。
 * @param options - 校验选项，见 {@link checkReleaseState}。
 * @returns 不一致项列表。
 */
export function checkRelease(root = ROOT, options = {}) {
  return checkReleaseState(collectReleaseState(root), options)
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
  const envTag = process.env.GITHUB_REF_NAME?.startsWith("v")
    ? process.env.GITHUB_REF_NAME
    : undefined
  const issues = checkRelease(ROOT, {
    version: readArg("--version"),
    tag: readArg("--tag") ?? envTag,
  })
  if (issues.length) {
    console.error("release check failed:")
    for (const issue of issues) console.error(`  - ${issue}`)
    process.exitCode = 1
  } else {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
    console.log(
      `release check ok: v${pkg.version}, changelog, compatibility and migration notes aligned`,
    )
  }
}
