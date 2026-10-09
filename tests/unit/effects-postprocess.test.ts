import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { PostProcessManager, type PostProcessStageFactory } from "@arc3dlab/effects"

function manager() {
  const added: unknown[] = []
  const factory: PostProcessStageFactory = {
    createBloom: (options) => ({ uniforms: { sigma: options?.sigma ?? 2 } }),
    createOutline: () => ({ uniforms: {} }),
    createDepthOfField: (options) => ({ uniforms: { focalDistance: options?.focalDistance ?? 10 } }),
    createColorCorrection: (options) => ({ uniforms: { brightness: options?.brightness ?? 1 } }),
  }
  const fog = { enabled: false, density: 0.0002 }
  const postprocess = new PostProcessManager(
    {
      lifecycle: new LifecycleManager(),
      engine: {
        native: {
          viewer: {
            scene: {
              fog,
              postProcessStages: {
                add(stage: unknown) {
                  added.push(stage)
                  return stage
                },
                remove(stage: unknown) {
                  const index = added.indexOf(stage)
                  if (index >= 0) added.splice(index, 1)
                  return true
                },
              },
            },
          },
        },
      },
    } as Arc3DContext,
    factory
  )
  return { postprocess, added, fog }
}

describe("PostProcessManager", () => {
  it("tracks bloom and fog in list()", () => {
    const { postprocess, added, fog } = manager()
    postprocess.setBloom(true, { sigma: 4 })
    postprocess.setFog(true, { density: 0.002 })
    expect(postprocess.list()).toEqual(["bloom", "fog"])
    expect(added).toHaveLength(1)
    expect(fog.enabled).toBe(true)
    expect(fog.density).toBe(0.002)
  })

  it("clears stages and disables fog", () => {
    const { postprocess, added, fog } = manager()
    postprocess.setOutline(true)
    postprocess.setColorCorrection(true, { brightness: 1.2 })
    postprocess.setFog(true)
    postprocess.clear()
    expect(postprocess.list()).toEqual([])
    expect(added).toHaveLength(0)
    expect(fog.enabled).toBe(false)
  })

  it("toggles the viewer bloom stage when it already exists", () => {
    const bloom = { enabled: false, uniforms: { sigma: 2 } }
    const postprocess = new PostProcessManager({
      lifecycle: new LifecycleManager(),
      engine: {
        native: {
          viewer: {
            scene: {
              fog: { enabled: false, density: 0 },
              postProcessStages: {
                bloom,
                add() {
                  throw new Error("should use built-in bloom")
                },
                remove() {
                  return false
                },
              },
            },
          },
        },
      },
    } as Arc3DContext)
    postprocess.setBloom(true, { sigma: 5 })
    expect(bloom.enabled).toBe(true)
    expect(bloom.uniforms.sigma).toBe(5)
    expect(postprocess.list()).toEqual(["bloom"])
    postprocess.destroy()
    expect(bloom.enabled).toBe(false)
  })
})
