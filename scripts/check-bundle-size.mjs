import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(1)}kB`
}

export function checkBundleSize(root = ROOT) {
  const issues = []
  const baselinePath = join(root, "bundle-baseline.json")
  if (!existsSync(baselinePath)) {
    return ["bundle-baseline.json is missing"]
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
  const tolerance = baseline.tolerancePercent ?? 0
  const limit = (value) => Math.floor(value * (1 + tolerance / 100))

  for (const [file, expected] of Object.entries(baseline.entries ?? {})) {
    const absolute = join(root, file)
    if (!existsSync(absolute)) {
      issues.push(`${file} not found; run \`npm run build\` first`)
      continue
    }
    const raw = statSync(absolute).size
    const gzip = gzipSync(readFileSync(absolute)).length
    const rawLimit = limit(expected.rawBytes)
    const gzipLimit = limit(expected.gzipBytes)
    if (raw > rawLimit) {
      issues.push(
        `${file} raw ${formatKb(raw)} exceeds baseline ${formatKb(expected.rawBytes)} (+${tolerance}% = ${formatKb(rawLimit)})`,
      )
    }
    if (gzip > gzipLimit) {
      issues.push(
        `${file} gzip ${formatKb(gzip)} exceeds baseline ${formatKb(expected.gzipBytes)} (+${tolerance}% = ${formatKb(gzipLimit)})`,
      )
    }
  }

  for (const asset of baseline.requiredAssets ?? []) {
    if (!existsSync(join(root, asset))) {
      issues.push(
        `required asset ${asset} is missing; it must be emitted, not inlined`,
      )
    }
  }

  const inlineLimit = baseline.inlineImageLimitBytes ?? 0
  if (inlineLimit > 0) {
    const distDir = join(root, "dist")
    if (existsSync(distDir)) {
      for (const name of readdirSync(distDir)) {
        if (!name.endsWith(".js")) continue
        const source = readFileSync(join(distDir, name), "utf8")
        const inlineRe = /data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)/g
        let match
        while ((match = inlineRe.exec(source))) {
          if (match[1].length > inlineLimit) {
            issues.push(
              `dist/${name} inlines a ${formatKb(match[1].length)} base64 image; emit it as a standalone asset instead`,
            )
          }
        }
      }
    }
  }
  return issues
}

function report(label, issues) {
  if (issues.length === 0) {
    console.log(`${label}: ok`)
    return
  }
  console.error(`${label}:`)
  for (const issue of issues) console.error(`  - ${issue}`)
  process.exitCode = 1
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectRun) {
  report("size", checkBundleSize())
}
