import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { checkRelease } from "./release-check.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
}

/**
 * 校验发布 tag 指向预期提交。
 *
 * @param state - 发布仓库状态。
 * @param state.version - `package.json` 版本。
 * @param state.tag - 待发布 tag。
 * @param state.headCommit - 当前 HEAD 提交。
 * @param state.tagCommit - tag 指向的提交；tag 不存在时为 undefined。
 * @returns 不一致项列表。
 */
export function checkReleaseTag(state) {
  const issues = []
  if (!state.tag) return ["release tag is required"]
  if (state.tag !== `v${state.version}`) {
    issues.push(`tag ${state.tag} must match package version v${state.version}`)
  }
  if (!state.tagCommit) {
    issues.push(
      `tag ${state.tag} does not exist locally; create it before running preflight`,
    )
  } else if (state.tagCommit !== state.headCommit) {
    issues.push(
      `tag ${state.tag} points to ${state.tagCommit}, expected HEAD ${state.headCommit}`,
    )
  }
  return issues
}

/**
 * 收集当前仓库的发布前置状态。
 * @param root - 仓库根目录。
 * @returns 版本、HEAD、tag 提交与工作区状态。
 */
export function collectPreflightState(root = ROOT) {
  const version = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ).version
  const headCommit = git(root, ["rev-parse", "HEAD"])
  const dirty = git(root, ["status", "--porcelain"]).length > 0
  return { version, headCommit, dirty }
}

/**
 * 校验发布前置条件：工作区干净、tag 指向 HEAD、发布元数据一致。
 *
 * @param root - 仓库根目录。
 * @param options - 选项。
 * @param options.tag - 待发布 tag。
 * @param options.allowDirty - 是否允许未提交改动。
 * @returns 不一致项列表。
 */
export function checkPreflight(root = ROOT, options = {}) {
  const state = collectPreflightState(root)
  const issues = []
  if (state.dirty && !options.allowDirty) {
    issues.push("working tree is dirty; commit or stash changes before release")
  }
  let tagCommit
  if (options.tag) {
    try {
      tagCommit = git(root, [
        "rev-parse",
        "--verify",
        `${options.tag}^{commit}`,
      ])
    } catch {
      tagCommit = undefined
    }
  }
  issues.push(
    ...checkReleaseTag({
      version: state.version,
      tag: options.tag,
      headCommit: state.headCommit,
      tagCommit,
    }),
  )
  const snapshot = join(root, `scripts/api-history/v${state.version}.json`)
  if (!existsSync(snapshot)) {
    issues.push(
      `missing API snapshot scripts/api-history/v${state.version}.json; run npm run api:snapshot`,
    )
  }
  issues.push(...checkRelease(root, { tag: options.tag }))
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
  const tag = readArg("--tag")
  if (!tag) {
    console.error("usage: npm run release:preflight -- --tag v<version>")
    process.exit(1)
  }
  const issues = checkPreflight(ROOT, {
    tag,
    allowDirty: process.argv.includes("--allow-dirty"),
  })
  if (issues.length) {
    console.error("release preflight failed:")
    for (const issue of issues) console.error(`  - ${issue}`)
    process.exitCode = 1
  } else {
    console.log(
      `release preflight ok: ${tag} -> ${git(ROOT, ["rev-parse", "HEAD"])}`,
    )
  }
}
