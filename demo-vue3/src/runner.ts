import { Arc3D, type Arc3DApp } from "arc3dlab"
import { createSandcastleGui } from "./sandcastle-gui"

export type ConsoleLevel = "log" | "info" | "warn" | "error"

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

  // Matches demo-vue3/src/examples/app-bootstrap.ts shown in the 公共代码 tab.
  const app = await Arc3D.create({
    container: options.container,
    scene: { creditMode: "compact" },
  })
  window.app = app

  restoreCapturedConsole()
  restoreCapturedConsole = captureConsole(options.onConsole)
  const execute = new Function(
    "app",
    "Arc3D",
    "gui",
    `"use strict"; return (async () => {\n${options.code}\n})();`
  )
  await execute(app, Arc3D, gui)
  return app
}
