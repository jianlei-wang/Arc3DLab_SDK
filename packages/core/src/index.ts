export { createId } from "./ids"
export { Arc3DError, type Arc3DErrorCode } from "./errors"
export {
  classifyLoadError,
  classifyLoadFailure,
  type ClassifiedLoadError,
  type LoadFailureStage,
} from "./load-error"
export {
  BENCHMARK_SCENE,
  runRuntimeBenchmark,
  type BenchmarkPhase,
  type RuntimeBenchmarkReport,
} from "./benchmark"
export { ConsoleLogger, type Logger, type LogLevel } from "./logger"
export { LifecycleManager, type LifecycleState } from "./lifecycle"
export { EventBus, type Unsubscribe } from "./event-bus"
export { DisposerStack, type Disposer } from "./disposer"
export {
  ResourceRegistry,
  ResourceTracker,
  createHandle,
  registerAtomically,
  type ResourceHandle,
  type ResourceId,
} from "./resource"
export { getRuntimeDiagnostics, type RuntimeDiagnostics } from "./diagnostics"
export {
  CapabilityRegistry,
  registerCoreCapabilities,
  CORE_CAPABILITIES,
  type CapabilityRecord,
} from "./capabilities"
export {
  CommandBus,
  RESERVED_EXTENSION_PREFIXES,
  assertExtensionName,
  assertWritableExtension,
  type CommandParamField,
  type CommandSpec,
} from "./commands"
export { ToolRegistry, type ToolSpec } from "./tools"
export {
  PluginScopeManager,
  isPluginScope,
  type PluginScope,
  type PluginState,
} from "./plugin-scope"
export { createContext, type Arc3DContext } from "./context"
export {
  DataCatalog,
  type AttributeField,
  type AttributeType,
  type DataAsset,
  type DataAssetFormat,
  type FeatureRef,
  type FeatureSchema,
  type GeometryType,
  type LayerKind,
  type LayerMetadata,
  type LoadState,
} from "./catalog"
export {
  WGS84,
  WGS84_3D,
  WEB_MERCATOR,
  ELLIPSOID_VERTICAL,
  resolveSpatialReference,
  resolveVerticalReference,
  isGeographic,
  sameSpatialReference,
  assertGeographicPosition,
  identityTransform,
  tryCreateCoordinateTransform,
  assertTimeRange,
  describeDefaultShorthand,
  type SpatialReference,
  type HorizontalCrs,
  type AxisOrder,
  type AngularUnit,
  type LinearUnit,
  type VerticalDatum,
  type VerticalReference,
  type TimeRange,
  type CoordinateTransform,
} from "./spatial"
export {
  assertFiniteNumber,
  assertValidLngLat,
  parsePosition,
  assertPositions,
  assertCssColor,
  assertNonNegative,
  assertGraphicStyle,
  assertNewResourceId,
} from "./validate"
export { assertAlive, afterAwait, type LifecycleGate } from "./async-resource"
export type {
  LngLat,
  LngLatHeight,
  AngleUnit,
  CameraPose,
  CameraState,
  WindowPosition,
  SceneModeName,
  CreditMode,
  RenderMode,
  PositionInput,
  GraphicStyle,
  LayerEvent,
  GraphicEvent,
  PickResult,
  PickKind,
  Arc3DEvents,
  Engine,
  EngineViewer,
  EngineViewerOptions,
  EngineContext,
  DefaultBaseLayerState,
  SceneReadyOptions,
  SceneReadyResult,
  Arc3DConfig,
} from "./types"
