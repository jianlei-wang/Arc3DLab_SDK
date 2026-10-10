/**
 * 提取：调用 TypeDoc 生成 JSON 模型。
 */

import { spawnSync } from "node:child_process"
import fs from "node:fs"

import { modelDir, modelJsonPath, repoRoot, typedocConfig } from "./config.mjs"

export function extract(options = {}) {
  fs.mkdirSync(modelDir, { recursive: true })
  const config = options.config ?? typedocConfig
  const out = options.out ?? modelJsonPath
  const result = spawnSync(
    "npx",
    ["typedoc", "--options", config, "--json", out],
    { cwd: repoRoot, stdio: "inherit", encoding: "utf8" },
  )
  if (result.status !== 0) {
    throw new Error(`typedoc exited with code ${result.status}`)
  }
  return JSON.parse(fs.readFileSync(out, "utf8"))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const project = extract()
  console.log(`extracted ${(project.children || []).length} modules`)
}
