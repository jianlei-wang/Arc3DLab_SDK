// The Sandcastle demo consumes the workspace SDK source directly: Vite resolves
// the bare `arc3dlab` specifier to the root entry via the alias in
// `demo-vue3/vite.config.ts`. Declare the facade surface the demo relies on so
// `vue-tsc` has accurate-enough types without following the workspace symlinks
// into `packages/*/src` (which are type-checked under the root project's
// compiler options).
declare module "arc3dlab" {
  export const Arc3D: {
    create(config?: Record<string, unknown>): Promise<Arc3DApp>
  }
  export interface Arc3DApp {
    destroy(): Promise<void>
    readonly [key: string]: any
  }
}
