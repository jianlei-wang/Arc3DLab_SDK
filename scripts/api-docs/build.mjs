/**
 * 构建：extract → normalize → render → assets。
 */

import fs from "node:fs"
import path from "node:path"

import {
  docsModelPath,
  outDir,
  reportPath,
  repoRoot,
  themeDir,
} from "./config.mjs"
import { extract } from "./extract.mjs"
import { normalize } from "./normalize.mjs"
import { renderSite } from "./render/index.mjs"

function copyAssets() {
  const targets = [
    ["jsdoc-default.css", path.join(outDir, "styles", "jsdoc-default.css")],
    ["prism.css", path.join(outDir, "styles", "prism.css")],
    ["prism.js", path.join(outDir, "javascript", "prism.js")],
    ["logo.svg", path.join(outDir, "Images", "logo.svg")],
  ]
  for (const [from, to] of targets) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(path.join(themeDir, from), to)
  }
}

function writeRedirectIndex() {
  const dir = path.join(repoRoot, "api-docs")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, "index.html"),
    `<!DOCTYPE html><html><head><title>Arc3DLab SDK API</title><meta http-equiv="refresh" content="0; url=./api/"></head><body><p>正在跳转到 <a href="./api/">API 文档</a>...</p></body></html>`,
  )
}

export function build(options = {}) {
  const project = options.project || extract()
  const model = normalize(project)
  fs.mkdirSync(path.dirname(docsModelPath), { recursive: true })
  fs.writeFileSync(docsModelPath, JSON.stringify(model, null, 2))

  const pages = renderSite(model)
  fs.mkdirSync(outDir, { recursive: true })
  for (const [file, html] of pages) {
    fs.writeFileSync(path.join(outDir, file), html)
  }
  copyAssets()
  writeRedirectIndex()

  return { model, pages: pages.size }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { model, pages } = build()
  console.log(
    `docs built: ${pages} pages, ${model.symbols.length} symbols across ${model.packages.length} namespaces`,
  )
  console.log(`output: ${outDir}`)
  console.log(`report will be written by: npm run lint:docs (${reportPath})`)
}
