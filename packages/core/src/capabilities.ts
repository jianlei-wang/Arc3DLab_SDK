import { Arc3DError } from "./errors"

export interface CapabilityRecord {
  name: string
  provider: string
  version: string
  available: boolean
}

export const CORE_CAPABILITIES: CapabilityRecord[] = [
  { name: "engine:cesium", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "render:entity", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "render:primitive", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "graphic:model", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "analysis:measure", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "analysis:terrain", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "analysis:visibility", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "analysis:query", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "analysis:clip", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "analysis:volume", provider: "arc3dlab", version: "1.0.0", available: true },
  { name: "effects:postprocess", provider: "arc3dlab", version: "1.0.0", available: true },
]

export class CapabilityRegistry {
  private items = new Map<string, CapabilityRecord>()

  register(name: string | CapabilityRecord): void {
    const record: CapabilityRecord =
      typeof name === "string"
        ? { name, provider: "arc3dlab", version: "1.0.0", available: true }
        : name
    const existing = this.items.get(record.name)
    if (existing && existing.provider !== record.provider) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Capability already registered: ${record.name} by ${existing.provider}`
      )
    }
    this.items.set(record.name, record)
  }

  has(name: string): boolean {
    return this.items.get(name)?.available === true
  }

  get(name: string): CapabilityRecord | undefined {
    return this.items.get(name)
  }

  require(name: string, action: string): void {
    if (this.items.size === 0) return
    if (this.has(name)) return
    throw new Arc3DError("UNSUPPORTED_CAPABILITY", `Capability not available: ${name} (${action})`)
  }

  list(): string[] {
    return Array.from(this.items.keys())
  }

  records(): CapabilityRecord[] {
    return Array.from(this.items.values())
  }

  unregister(name: string, provider?: string): void {
    const existing = this.items.get(name)
    if (!existing) return
    if (provider && existing.provider !== provider) return
    this.items.delete(name)
  }

  unregisterByProvider(provider: string): void {
    if (provider === "arc3dlab" || provider === "core") return
    for (const [name, record] of this.items) {
      if (record.provider === provider) this.items.delete(name)
    }
  }

}

export function registerCoreCapabilities(registry: CapabilityRegistry): void {
  for (const capability of CORE_CAPABILITIES) registry.register(capability)
}
