import { Arc3D, type Arc3DApp } from "arc3dlab"

export async function runSandcastleCode(options: {
  container: string
  previous?: Arc3DApp
  code: string
}): Promise<Arc3DApp> {
  if (options.previous) {
    await options.previous.destroy()
  }

  const host = document.getElementById(options.container)
  if (host) host.replaceChildren()

  // Matches demo-vue3/src/examples/app-bootstrap.ts shown in the 公共代码 tab.
  const app = await Arc3D.create({
    container: options.container,
    scene: { creditMode: "compact" },
  })
  window.app = app

  const execute = new Function(
    "app",
    "Arc3D",
    `"use strict"; return (async () => {\n${options.code}\n})();`
  )
  await execute(app, Arc3D)
  return app
}
