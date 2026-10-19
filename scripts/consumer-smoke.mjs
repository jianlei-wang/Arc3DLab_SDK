import { execFileSync } from "node:child_process"
import { createServer } from "node:http"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, extname, join, normalize, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const FIXTURE = join(ROOT, "tests/fixtures/vite-consumer")

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".woff2": "font/woff2",
}

function requireFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run npm run build first.`)
  }
}

requireFile(join(ROOT, "dist/arc3dlab.esm.js"))
requireFile(join(ROOT, "dist/index.d.ts"))

const work = mkdtempSync(join(ROOT, ".consumer-smoke-"))
const consumer = join(work, "consumer")

/**
 * 通过当前 npm CLI 入口执行命令，兼容 Windows 无法直接启动 .cmd 的限制。
 * @param {string[]} args - npm 参数。
 * @param {import("node:child_process").ExecFileSyncOptions} options - 执行选项。
 */
function runNpm(args, options) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) {
    return execFileSync(process.execPath, [npmExecPath, ...args], options)
  }
  return execFileSync("npm", args, {
    ...options,
    shell: process.platform === "win32",
  })
}

/**
 * 以正确的 MIME 类型提供构建产物。
 * @param {string} dist - 构建输出目录。
 * @returns {import("node:http").Server} HTTP 服务器。
 */
function createStaticServer(dist) {
  const root = resolve(dist)
  return createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    )
    const relative = pathname === "/" ? "index.html" : pathname.slice(1)
    const file = normalize(join(root, relative))
    if (file !== root && !file.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end("forbidden")
      return
    }
    if (!existsSync(file)) {
      response.writeHead(404).end("not found")
      return
    }
    response.writeHead(200, {
      "content-type":
        MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    response.end(readFileSync(file))
  })
}

try {
  mkdirSync(consumer)
  cpSync(FIXTURE, consumer, { recursive: true })
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify(
      {
        name: "arc3dlab-vite-consumer",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  )

  const packOutput = runNpm(["pack", "--json", "--pack-destination", work], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
  const [packInfo] = JSON.parse(packOutput)
  const tarball =
    packInfo?.filename ??
    readdirSync(work).find((name) => name.endsWith(".tgz"))
  if (!tarball) throw new Error("npm pack produced no tarball")

  runNpm(
    ["install", "--ignore-scripts", "--legacy-peer-deps", join(work, tarball)],
    { cwd: consumer, stdio: "inherit" },
  )

  const cesiumLink = join(consumer, "node_modules/cesium")
  if (existsSync(cesiumLink)) {
    throw new Error("Consumer unexpectedly resolved a transitive Cesium copy")
  }
  symlinkSync(join(ROOT, "node_modules/cesium"), cesiumLink, "junction")

  const tsc = join(ROOT, "node_modules/typescript/bin/tsc")
  execFileSync(
    process.execPath,
    [
      tsc,
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--target",
      "es2022",
      join(consumer, "main.ts"),
    ],
    { cwd: consumer, stdio: "inherit" },
  )

  const vite = join(ROOT, "node_modules/vite/bin/vite.js")
  execFileSync(
    process.execPath,
    [vite, "build", "--config", join(consumer, "vite.config.ts")],
    { cwd: consumer, stdio: "inherit", timeout: 180_000 },
  )

  const dist = join(consumer, "dist")
  requireFile(join(dist, "index.html"))
  const assets = readdirSync(join(dist, "assets"))
  if (!assets.some((name) => /^analysis-worker-entry-.*\.js$/.test(name))) {
    throw new Error("Production build did not emit the packaged Worker asset")
  }

  const server = createStaticServer(dist)
  await new Promise((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen),
  )
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Static server did not expose a port")
  }

  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  })
  try {
    const page = await browser.newPage()
    const pageErrors = []
    const workerResponses = []
    page.on("pageerror", (error) => pageErrors.push(error.message))
    page.on("response", (response) => {
      if (/analysis-worker-entry-.*\.js/.test(response.url())) {
        workerResponses.push({
          status: response.status(),
          url: response.url(),
        })
      }
    })

    await page.goto(`http://127.0.0.1:${address.port}/`)
    await page.waitForFunction(
      () =>
        Boolean(
          window.__ARC3D_CONSUMER_REPORT__ || window.__ARC3D_CONSUMER_ERROR__,
        ),
      undefined,
      { timeout: 60_000 },
    )

    const failure = await page.evaluate(() => window.__ARC3D_CONSUMER_ERROR__)
    if (failure) throw new Error(`Consumer page failed: ${failure}`)
    const report = await page.evaluate(() => window.__ARC3D_CONSUMER_REPORT__)
    if (!report) throw new Error("Consumer page produced no report")

    const expectations = [
      [report.reportKind === "packaged-consumer", "report kind"],
      [Number(report.workerMeters) > 0, "worker distance"],
      [report.workerUnavailable === false, "worker was used"],
      [report.workerCreated === 1, "worker created once"],
      [report.workerCompleted === 1, "worker completed once"],
      [report.workerPending === 0, "worker pending drained"],
      [report.workerProtocolErrors === 0, "worker protocol clean"],
      [Number(report.fallbackMeters) > 0, "fallback distance"],
      [report.fallbackUnavailable === true, "fallback marked unavailable"],
      [report.fallbackCreated === 0, "fallback created no worker"],
      [report.fallbackCompleted === 1, "fallback completed once"],
      [report.fallbackPending === 0, "fallback pending drained"],
      [workerResponses.some((item) => item.status === 200), "worker asset 200"],
      [pageErrors.length === 0, `page errors: ${pageErrors.join("; ")}`],
    ]
    for (const [passed, name] of expectations) {
      if (!passed) throw new Error(`Consumer expectation failed: ${name}`)
    }

    console.log(
      `consumer production smoke ok (worker asset ${workerResponses[0].url})`,
    )
  } finally {
    await browser.close()
    await new Promise((resolveClose) => server.close(resolveClose))
  }
} finally {
  try {
    rmSync(work, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    })
  } catch (error) {
    console.warn(`Failed to clean up ${work}: ${String(error)}`)
  }
}
