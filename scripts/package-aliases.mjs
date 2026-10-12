import { existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * 扫描 `packages/*` 下带 `src/index.ts` 的内部包目录，作为别名的唯一来源。
 *
 * 新增内部包只需创建目录，Vite / Vitest 别名自动生效；CI 通过
 * `release-gate.mjs workspace` 校验 `tsconfig.json` 与目录一致。
 *
 * @param {string} [root] - 仓库根目录。
 * @returns {string[]} 排序后的包名列表。
 */
export function listPackages(root = ROOT) {
  const packagesDir = join(root, "packages")
  if (!existsSync(packagesDir)) return []
  return readdirSync(packagesDir)
    .filter((name) => existsSync(join(packagesDir, name, "src/index.ts")))
    .sort()
}

/**
 * 生成 `@arc3dlab/*` 到源码入口的别名映射。
 *
 * @param {string} [root] - 仓库根目录。
 * @returns {Record<string, string>} 别名映射。
 */
export function packageAliases(root = ROOT) {
  /** @type {Record<string, string>} */
  const alias = {}
  for (const name of listPackages(root)) {
    alias[`@arc3dlab/${name}`] = join(root, "packages", name, "src/index.ts")
  }
  return alias
}

export { ROOT as PACKAGE_ALIASES_ROOT }
