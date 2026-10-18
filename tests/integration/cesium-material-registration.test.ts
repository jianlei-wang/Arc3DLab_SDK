import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Material } from "cesium"
import * as Cesium from "cesium"
import {
  DYNAMIC_SPREAD_MATERIAL,
  POLYLINE_TRAIL_MATERIAL,
  registerArc3DMaterials,
} from "../../packages/effects/src/materials"
import {
  RADAR_NORMAL_MATERIAL,
  registerRadarNormalMaterial,
} from "../../packages/graphics/src/dynamic/materials"

const globals = globalThis as unknown as Record<string, unknown>

/** Cesium 判定 uniform 类型时会 `instanceof` 浏览器构造器，node 下需占位。 */
const BROWSER_CONSTRUCTORS = [
  "HTMLCanvasElement",
  "HTMLImageElement",
  "ImageBitmap",
  "OffscreenCanvas",
]

const savedGlobals: Record<string, unknown> = {}

interface MaterialTemplate {
  fabric?: { type?: string; source?: string }
}

interface MaterialCacheContract {
  addMaterial(type: string, template: MaterialTemplate): void
  getMaterial(type: string): MaterialTemplate | undefined
}

/**
 * 访问 Cesium 的内部材质缓存 `Material._materialCache`。
 *
 * 这是 Arc3DLab 对 Cesium 内部实现的唯一直接依赖点。Cesium 1.146.0 没有
 * 公开的材质注册 API，`Material.fromType` 自身也消费同一缓存。本文件把该
 * 内部契约显式记录并针对锁定版本做集成验证，作为升级 Cesium 时的护栏，
 * 而非把 `_materialCache` 当作可长期稳定依赖的公开接口。
 */
function materialCache(): MaterialCacheContract {
  return (Material as unknown as { _materialCache: MaterialCacheContract })
    ._materialCache
}

const REGISTERED_TYPES = [
  DYNAMIC_SPREAD_MATERIAL,
  POLYLINE_TRAIL_MATERIAL,
  RADAR_NORMAL_MATERIAL,
]

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}

describe("Cesium Material._materialCache version contract (cesium@1.146.0)", () => {
  it("pins the integration runtime to the declared Cesium peer", () => {
    expect(pkg.peerDependencies.cesium).toBe("1.146.0")
    expect(pkg.devDependencies.cesium).toBe(pkg.peerDependencies.cesium)
    expect((Cesium as unknown as { VERSION: string }).VERSION).toBe(
      pkg.peerDependencies.cesium,
    )
  })

  beforeAll(() => {
    for (const key of BROWSER_CONSTRUCTORS) {
      savedGlobals[key] = globals[key]
      if (globals[key] === undefined) globals[key] = class {}
    }
  })

  afterAll(() => {
    for (const key of BROWSER_CONSTRUCTORS) {
      if (savedGlobals[key] === undefined) delete globals[key]
      else globals[key] = savedGlobals[key]
    }
  })

  it("exposes the internal cache shape Arc3DLab depends on", () => {
    const cache = materialCache()
    expect(cache).toBeDefined()
    expect(typeof cache.addMaterial).toBe("function")
    expect(typeof cache.getMaterial).toBe("function")
  })

  it("registers every Arc3D material type into the Cesium cache", () => {
    registerArc3DMaterials()
    registerRadarNormalMaterial()
    for (const type of REGISTERED_TYPES) {
      const template = materialCache().getMaterial(type)
      expect(template?.fabric?.type).toBe(type)
      expect(template?.fabric?.source).toContain("czm_getMaterial")
    }
  })

  it("compiles registered materials through Material.fromType", () => {
    registerArc3DMaterials()
    registerRadarNormalMaterial()
    // 线尾迹材质带 `image` 纹理 uniform，编译时会触发浏览器纹理加载，
    // 故此处仅编译无纹理的材质；其纹理路径由浏览器 E2E 层覆盖。
    for (const type of [DYNAMIC_SPREAD_MATERIAL, RADAR_NORMAL_MATERIAL]) {
      const material = Material.fromType(type)
      expect(material.type).toBe(type)
      expect(material.shaderSource).toContain("czm_getMaterial")
    }
  })
})
