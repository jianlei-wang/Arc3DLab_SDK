import { describe, expect, it } from "vitest"
import {
  AnalysisTaskRegistry,
  Arc3D,
  Arc3DApp,
  Arc3DError,
  CesiumEngine,
  createId,
  createTaskExecutor,
  DataCatalog,
  runAnalysisTask,
  Viewer,
} from "../../src/index"
import type {
  AnalysisResult,
  AnalysisTask,
  Arc3DConfig,
  Arc3DPlugin,
  AttributeField,
  CoordinateTransform,
  DataAsset,
  DefaultBaseLayerState,
  FeatureRef,
  FeatureSchema,
  Graphic,
  GraphicCreateOptions,
  Layer,
  LayerMetadata,
  LngLat,
  LoadState,
  ModelCreateOptions,
  PickResult,
  ResultArtifact,
  SceneReadyResult,
  SpatialReference,
  TerrainSpec,
} from "../../src/index"

const runtimeWhitelist = [
  Arc3DApp,
  Arc3DError,
  CesiumEngine,
  DataCatalog,
  AnalysisTaskRegistry,
  Viewer,
]

describe("public api surface", () => {
  it("exposes the stable runtime whitelist", () => {
    expect(typeof Arc3D).toBe("object")
    expect(typeof Arc3D.create).toBe("function")
    expect(typeof Arc3D.createSync).toBe("function")
    for (const value of runtimeWhitelist) {
      expect(typeof value).toBe("function")
    }
    expect(typeof createId).toBe("function")
    expect(typeof createTaskExecutor).toBe("function")
    expect(typeof runAnalysisTask).toBe("function")
  })

  it("compiles consumer type usage against the whitelist", () => {
    type ConsumerSurface = {
      config: Arc3DConfig
      plugin: Arc3DPlugin
      graphic: Graphic
      graphicOptions: GraphicCreateOptions
      modelOptions: ModelCreateOptions
      layer: Layer
      terrain: TerrainSpec
      position: LngLat
      pick: PickResult
      spatial: SpatialReference
      transform: CoordinateTransform
      asset: DataAsset
      schema: FeatureSchema
      field: AttributeField
      ref: FeatureRef
      metadata: LayerMetadata
      loadState: LoadState
      baseLayerState: DefaultBaseLayerState
      sceneReady: SceneReadyResult
      task: AnalysisTask
      result: AnalysisResult
      artifact: ResultArtifact
    }
    const identity = <T>(value: T): T => value
    expect(typeof identity<ConsumerSurface>).toBe("function")
  })
})
