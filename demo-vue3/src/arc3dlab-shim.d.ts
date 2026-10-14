// The demo depends on the published `arc3dlab` package, whose `0.0.3` release
// predates the `Arc3D` / `Arc3DApp` facade used throughout the Sandcastle demo.
// Declare the surface the demo relies on so `vue-tsc` has accurate-enough types
// without pulling the workspace sources (which are type-checked under different
// compiler options in the root project).
declare module "arc3dlab" {
  export const Arc3D: {
    create(config?: Record<string, unknown>): Promise<Arc3DApp>
  }
  export interface Arc3DApp {
    destroy(): Promise<void>
    readonly [key: string]: any
  }
}
