import {
  Arc3DError,
  classifyLoadError,
  createHandle,
  type Arc3DContext,
  type ResourceHandle,
} from "@arc3dlab/core"
import type { Arc3DPlugin } from "./plugins"

export interface MiningHost {
  graphics: {
    add(id: string, kind: string): void
    remove(id: string): void
    list(): string[]
  }
  layers: {
    add(id: string): void
    remove(id: string): void
    list(): string[]
  }
  analysis: {
    area(positions: Array<[number, number]>): number
  }
  ui: {
    setStatus(text: string): void
    clearStatus(): void
  }
}

export type MiningStatus =
  | { state: "idle" }
  | { state: "ready"; loaded: number; failed: number }
  | { state: "partial"; loaded: number; failed: number }
  | { state: "offline" }
  | { state: "failed"; code: string; message: string }
  | { state: "cancelled" }

export interface MiningLoadInput {
  source?: "memory" | "network"
  token?: string
  offline?: boolean
  format?: "ok" | "invalid"
  includeBroken?: boolean
}

const SAMPLE_HOLES = [
  { id: "mining-hole-1", longitude: 104.05, latitude: 30.55, height: 0 },
  { id: "mining-hole-2", longitude: 104.08, latitude: 30.58, height: 0 },
  { id: "mining-hole-bad" },
]

const SITE_RING: Array<[number, number]> = [
  [104.0, 30.5],
  [104.2, 30.5],
  [104.2, 30.7],
  [104.0, 30.7],
]

export interface MiningPlugin extends Arc3DPlugin<MiningHost> {
  status: MiningStatus
}

export function createMiningPlugin(): MiningPlugin {
  const owned: ResourceHandle[] = []
  let status: MiningStatus = { state: "idle" }
  let loadTask: AbortController | undefined

  const plugin: MiningPlugin = {
    name: "mining",
    version: "1.0.0",
    dependsOn: ["analysis:measure"],
    get status() {
      return status
    },
    async install(app, context) {
      context.capabilities.register({
        name: "plugin:mining",
        provider: "mining",
        version: "1.0.0",
        available: true,
      })
      context.commands.register({
        name: "mining.load",
        version: "1.0.0",
        plugin: "mining",
        params: {
          source: { type: "string" },
          token: { type: "string" },
          offline: { type: "boolean" },
          format: { type: "string" },
          includeBroken: { type: "boolean" },
        },
        execute: (input) => load(app, context, input as MiningLoadInput),
      })
      context.commands.register({
        name: "mining.analyze",
        version: "1.0.0",
        plugin: "mining",
        execute: () => analyze(app),
      })
      context.commands.register({
        name: "mining.cancel",
        version: "1.0.0",
        plugin: "mining",
        execute: () => cancel(),
      })
      context.tools.register({
        name: "mining.inspect",
        version: "1.0.0",
        plugin: "mining",
        activate: () => {
          app.ui.setStatus("mining inspect")
        },
        deactivate: () => {
          app.ui.clearStatus()
        },
      })
      await load(app, context, { source: "memory" })
    },
    async uninstall(app, context) {
      cancel()
      clearOwned(context, app)
      app.ui.clearStatus()
      status = { state: "idle" }
    },
  }

  function cancel(): MiningStatus {
    loadTask?.abort()
    loadTask = undefined
    status = { state: "cancelled" }
    return status
  }

  function clearOwned(context: Arc3DContext, app: MiningHost): void {
    for (const handle of owned.splice(0)) {
      context.registry.unregister(handle.id)
      if (handle.type === "layer") app.layers.remove(handle.id)
      else app.graphics.remove(handle.id)
      if (handle.owned) handle.destroy()
    }
  }

  async function load(
    app: MiningHost,
    context: Arc3DContext,
    input: MiningLoadInput
  ): Promise<MiningStatus> {
    const controller = new AbortController()
    loadTask = controller
    try {
      if (controller.signal.aborted) {
        throw new Arc3DError("CANCELLED", "Cancelled mining load")
      }
      if (input.format === "invalid") {
        throw new Arc3DError("INVALID_FORMAT", "Mining dataset is malformed")
      }
      if (input.source === "network") {
        if (input.offline) {
          throw new Arc3DError("NETWORK_FAILURE", "Mining plugin is offline")
        }
        if (!input.token) {
          throw new Arc3DError("AUTH_FAILED", "Mining data requires a token")
        }
      }
      clearOwned(context, app)
      let loaded = 0
      let failed = 0
      const rows = input.includeBroken
        ? SAMPLE_HOLES
        : SAMPLE_HOLES.filter((hole) => hole.longitude !== undefined)
      for (const hole of rows) {
        if (hole.longitude === undefined || hole.latitude === undefined) {
          failed += 1
          continue
        }
        const handle = createHandle({
          id: hole.id,
          type: "point",
          native: { plugin: "mining" },
          owned: true,
        })
        context.registry.add(handle)
        app.graphics.add(handle.id, "point")
        owned.push(handle)
        loaded += 1
      }
      const layer = createHandle({
        id: "mining-site",
        type: "layer",
        native: { plugin: "mining" },
        owned: true,
      })
      context.registry.add(layer)
      app.layers.add(layer.id)
      owned.push(layer)
      const area = app.analysis.area(SITE_RING)
      status =
        failed > 0
          ? { state: "partial", loaded, failed }
          : { state: "ready", loaded, failed }
      app.ui.setStatus(`mining ${status.state} area=${area.toFixed(0)}`)
      return status
    } catch (error) {
      const classified = classifyLoadError(error)
      if (classified.code === "NETWORK_FAILURE") {
        status = { state: "offline" }
      } else if (classified.code === "CANCELLED") {
        status = { state: "cancelled" }
      } else {
        status = {
          state: "failed",
          code: classified.code,
          message: classified.message,
        }
      }
      app.ui.setStatus(`mining ${status.state}`)
      throw classified
    } finally {
      if (loadTask === controller) loadTask = undefined
    }
  }

  function analyze(app: MiningHost): { squareMeters: number } {
    const squareMeters = app.analysis.area(SITE_RING)
    app.ui.setStatus(`mining area=${squareMeters.toFixed(0)}`)
    return { squareMeters }
  }

  return plugin
}
