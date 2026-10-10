import { Arc3DError } from "./errors"
import type { Engine } from "./types"

/** 能力来源，区分 SDK 内置能力与后端引擎提供的能力。 */
export type CapabilitySource = "sdk" | "backend"

/** 描述一项已注册能力及其可用性的记录。 */
export interface CapabilityRecord {
  /** 能力名称。 */
  name: string
  /** 能力提供方。 */
  provider: string
  /** 能力版本。 */
  version: string
  /** 能力当前是否可用。 */
  available: boolean
  /** 能力来源。 */
  source?: CapabilitySource
}

/** SDK 内置的核心能力清单。 */
export const CORE_CAPABILITIES: CapabilityRecord[] = [
  {
    name: "engine:cesium",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "backend",
  },
  {
    name: "render:entity",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "backend",
  },
  {
    name: "render:primitive",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "backend",
  },
  {
    name: "graphic:model",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "backend",
  },
  {
    name: "effects:postprocess",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "backend",
  },
  {
    name: "analysis:measure",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "sdk",
  },
  {
    name: "analysis:terrain",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "sdk",
  },
  {
    name: "analysis:visibility",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "sdk",
  },
  {
    name: "analysis:query",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "sdk",
  },
  {
    name: "analysis:clip",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "sdk",
  },
  {
    name: "analysis:volume",
    provider: "arc3dlab",
    version: "1.0.0",
    available: true,
    source: "sdk",
  },
]

/** 管理能力注册、查询与按提供方注销的注册表。 */
export class CapabilityRegistry {
  private items = new Map<string, CapabilityRecord>()

  /**
   * 创建能力注册表。
   *
   * @param ownerProvider - 可选的当前插件所有者提供函数。
   */
  constructor(private readonly ownerProvider?: () => string | undefined) {}

  /**
   * 注册一项能力。
   *
   * @param name - 能力名称或完整的能力记录。
   * @throws {Arc3DError} 当同名能力已由其他提供方注册时抛出，错误码为 `DUPLICATE_RESOURCE`。
   */
  register(name: string | CapabilityRecord): void {
    const base: CapabilityRecord =
      typeof name === "string"
        ? { name, provider: "arc3dlab", version: "1.0.0", available: true }
        : { ...name }
    const owner = this.ownerProvider?.()
    const record: CapabilityRecord = owner ? { ...base, provider: owner } : base
    const existing = this.items.get(record.name)
    if (existing && existing.provider !== record.provider) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Capability already registered: ${record.name} by ${existing.provider}`,
      )
    }
    this.items.set(record.name, record)
  }

  /**
   * 判断指定能力是否存在且可用。
   *
   * @param name - 能力名称。
   * @returns 能力是否可用。
   */
  has(name: string): boolean {
    return this.items.get(name)?.available === true
  }

  /**
   * 获取指定能力的记录。
   *
   * @param name - 能力名称。
   * @returns 能力记录，不存在时为 undefined。
   */
  get(name: string): CapabilityRecord | undefined {
    return this.items.get(name)
  }

  /**
   * 断言指定能力可用，否则抛出异常。
   *
   * @param name - 能力名称。
   * @param action - 正在执行的操作名称，用于错误信息。
   * @throws {Arc3DError} 当能力不可用时抛出，错误码为 `UNSUPPORTED_CAPABILITY`。
   */
  require(name: string, action: string): void {
    if (this.has(name)) return
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      `Capability not available: ${name} (${action})`,
    )
  }

  /**
   * 列出全部已注册能力名称。
   *
   * @returns 能力名称数组。
   */
  list(): string[] {
    return Array.from(this.items.keys())
  }

  /**
   * 列出全部已注册能力记录。
   *
   * @returns 能力记录数组。
   */
  records(): CapabilityRecord[] {
    return Array.from(this.items.values())
  }

  /**
   * 注销指定能力。
   *
   * @param name - 能力名称。
   * @param provider - 指定时仅注销该提供方注册的能力。
   */
  unregister(name: string, provider?: string): void {
    const existing = this.items.get(name)
    if (!existing) return
    if (provider && existing.provider !== provider) return
    this.items.delete(name)
  }

  /**
   * 注销指定提供方注册的全部能力，核心提供方除外。
   *
   * @param provider - 提供方名称。
   */
  unregisterByProvider(provider: string): void {
    if (provider === "arc3dlab" || provider === "core") return
    for (const [name, record] of this.items) {
      if (record.provider === provider) this.items.delete(name)
    }
  }
}

/**
 * 将核心能力清单注册到给定注册表。
 *
 * @param registry - 目标能力注册表。
 * @param engine - 可选的引擎，用于判定后端能力的可用性。
 */
export function registerCoreCapabilities(
  registry: CapabilityRegistry,
  engine?: Engine,
): void {
  for (const capability of CORE_CAPABILITIES) {
    const available =
      capability.source === "backend"
        ? engine
          ? engine.hasCapability(capability.name)
          : capability.available
        : capability.available
    registry.register({ ...capability, available })
  }
}
