import { Arc3D, type Arc3DApp } from "arc3dlab"
import { createSandcastleGui, type SandcastleGui } from "./sandcastle-gui"

// Resolve the workspace packages through Vite's glob instead of bare
// `@arc3dlab/*` specifiers. The bare specifiers would make `vue-tsc` follow the
// workspace symlinks in node_modules into the raw `packages/*/src` sources and
// type-check them with the demo's stricter compiler options. Glob keeps the
// namespaces typed as `any` while Vite still bundles the real entry modules at
// run time.
const workspaceModules = import.meta.glob(
  "../../packages/{data,effects,graphics,scene,ui}/src/index.ts",
  { eager: true },
) as Record<string, Record<string, unknown>>

function workspaceNamespace(name: string): Record<string, unknown> {
  const key = Object.keys(workspaceModules).find((path) =>
    path.includes("/packages/" + name + "/"),
  )
  return key ? (workspaceModules[key] ?? {}) : {}
}

export type ConsoleLevel = "log" | "info" | "warn" | "error"

/**
 * 额外注入给 Sandcastle 示例的模块命名空间。
 *
 * 这些能力没有挂在 `Arc3DApp` 门面上（例如动态图形工厂、粒子工厂、导航条），
 * 通过 `sdk.xxx` 暴露给示例代码，同时挂到 `window.sdk` 便于调试。
 */
export const sandcastleSdk = {
  graphics: workspaceNamespace("graphics"),
  scene: workspaceNamespace("scene"),
  ui: workspaceNamespace("ui"),
  data: workspaceNamespace("data"),
  effects: workspaceNamespace("effects"),
}

export type SandcastleSdk = typeof sandcastleSdk

const CONSOLE_LEVELS = ["log", "info", "warn", "error"] as const

let restoreCapturedConsole = () => {}

function formatConsoleArg(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) return value.stack ?? value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * 为每个示例挂载强制的 FPS 控制与显示。
 *
 * 所有示例都通过该控件开关 Cesium 的帧率调试显示，并实时刷新帧率读数。
 */
function mountFpsMeter(app: Arc3DApp, gui: SandcastleGui): void {
  const meter = gui.addFpsMeter(true, (visible) =>
    app.performance.setFpsVisible(visible),
  )
  app.performance.setFpsVisible(true)
  let frames = 0
  let last = performance.now()
  app.scene.onPostRender(() => {
    frames += 1
    const now = performance.now()
    const elapsed = now - last
    if (elapsed >= 500) {
      meter.setValue(Math.round((frames * 1000) / elapsed))
      frames = 0
      last = now
    }
  })
}

function captureConsole(onConsole?: (level: ConsoleLevel, text: string) => void): () => void {
  if (!onConsole) return () => {}
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }
  for (const level of CONSOLE_LEVELS) {
    console[level] = (...args: unknown[]) => {
      original[level](...args)
      onConsole(level, args.map(formatConsoleArg).join(" "))
    }
  }
  return () => {
    for (const level of CONSOLE_LEVELS) {
      console[level] = original[level]
    }
  }
}

export async function runSandcastleCode(options: {
  container: string
  previous?: Arc3DApp
  code: string
  guiHost?: HTMLElement | null
  onConsole?: (level: ConsoleLevel, text: string) => void
}): Promise<Arc3DApp> {
  if (options.previous) {
    await options.previous.destroy()
  }

  const host = document.getElementById(options.container)
  if (host) host.replaceChildren()

  const gui = createSandcastleGui(options.guiHost ?? document.createElement("div"))
  window.gui = gui
  window.sdk = sandcastleSdk

  // Matches demo-vue3/src/examples/app-bootstrap.ts shown in the 公共代码 tab.
  const app = await Arc3D.create({
    container: options.container,
    scene: { creditMode: "compact", fpsShow: true },
  })
  window.app = app

  mountFpsMeter(app, gui)

  restoreCapturedConsole()
  restoreCapturedConsole = captureConsole(options.onConsole)
  const execute = new Function(
    "app",
    "Arc3D",
    "gui",
    "sdk",
    `"use strict"; return (async () => {\n${options.code}\n})();`
  )
  await execute(app, Arc3D, gui, sandcastleSdk)
  return app
}
