/**
 * 校验：公共符号注释覆盖率，产出 report.json。
 */

import fs from "node:fs"
import path from "node:path"

import { docsModelPath, reportPath, THRESHOLDS } from "./config.mjs"

function iterCallables(symbol) {
  const list = []
  if (symbol.construct) list.push(symbol.construct)
  for (const method of symbol.methods || []) list.push(method)
  if (symbol.kind === "function") list.push(symbol)
  return list
}

export function checkCoverage(model, thresholds = THRESHOLDS) {
  const undocumented = []
  const incompleteParams = []
  let paramsTotal = 0
  let paramsDocumented = 0

  for (const symbol of model.symbols) {
    if (!symbol.summaryText)
      undocumented.push(`${symbol.package}.${symbol.name}`)
    for (const callable of iterCallables(symbol)) {
      for (const param of callable.params || []) {
        paramsTotal += 1
        if (param.description && param.description.trim()) paramsDocumented += 1
        else
          incompleteParams.push(
            `${symbol.package}.${symbol.name}(${param.name})`,
          )
      }
    }
  }

  const total = model.symbols.length || 1
  const summary = (total - undocumented.length) / total
  const params = paramsTotal ? paramsDocumented / paramsTotal : 1

  return {
    totals: {
      symbols: model.symbols.length,
      documented: total - undocumented.length,
      params: paramsTotal,
      paramsDocumented,
    },
    coverage: { summary, params },
    thresholds,
    pass: summary >= thresholds.summary && params >= thresholds.params,
    undocumented,
    incompleteParams,
  }
}

export function run() {
  const model = JSON.parse(fs.readFileSync(docsModelPath, "utf8"))
  const report = checkCoverage(model)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  const pct = (v) => `${(v * 100).toFixed(1)}%`
  console.log(
    `docs coverage: summary ${pct(report.coverage.summary)} (threshold ${pct(
      report.thresholds.summary,
    )}), params ${pct(report.coverage.params)} (threshold ${pct(report.thresholds.params)})`,
  )
  console.log(
    `symbols: ${report.totals.documented}/${report.totals.symbols} documented; params: ${report.totals.paramsDocumented}/${report.totals.params}`,
  )
  if (!report.pass) {
    console.error(`docs coverage below threshold; see ${reportPath}`)
    process.exitCode = 1
  }
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
