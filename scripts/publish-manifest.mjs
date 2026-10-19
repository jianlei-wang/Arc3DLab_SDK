import { existsSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

/**
 * 发布产物中不应出现的声明中间文件目录。`vite-plugin-dts` 会为每个内部包生成
 * 相对引用的 `.d.ts`，这些文件在发布包内无法解析，最终声明由 rollup 之后的
 * `index.d.ts` / `engine-cesium.d.ts` 提供。
 */
const INTERNAL_DECLARATION_PREFIXES = ["dist/src/", "dist/packages/"]

function toPosix(path) {
  return path.split(sep).join("/")
}

function walkFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walkFiles(path, files)
      continue
    }
    files.push(path)
  }
  return files
}

/**
 * 收集构建后应当发布到 npm tarball 的 `dist` 产物。
 * 中间声明目录与 source map 不参与发布；其余文件（JS、声明入口、图片与 Worker
 * 资源）都必须随包发布。source map 仅在仓库构建目录保留，用于本地调试。
 * @param root - 仓库根目录。
 * @returns 以仓库根目录为基准的相对路径（POSIX 分隔符），按字典序排列。
 */
export function collectPublishArtifacts(root) {
  const dist = join(root, "dist")
  if (!existsSync(dist)) {
    throw new Error("Missing dist. Run npm run build first.")
  }
  return walkFiles(dist)
    .map((path) => toPosix(relative(root, path)))
    .filter((path) => !path.endsWith(".map"))
    .filter(
      (path) =>
        !path.endsWith(".d.ts") ||
        !INTERNAL_DECLARATION_PREFIXES.some((prefix) =>
          path.startsWith(prefix),
        ),
    )
    .sort()
}

/**
 * 递归提取 `package.json` 的 `exports` 中所有指向包内文件的相对路径。
 * @param value - `exports` 字段值或其中的嵌套值。
 * @returns 去掉 `./` 前缀的包内相对路径。
 */
export function collectExportTargets(value) {
  if (typeof value === "string") {
    return value.startsWith("./") ? [value.slice(2)] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectExportTargets)
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectExportTargets)
  }
  return []
}
