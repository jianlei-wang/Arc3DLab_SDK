export const GLOBE_CONTAINER_ID = "sandcastle-globe"

export const APP_BOOTSTRAP_CODE = `import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "${GLOBE_CONTAINER_ID}",
  scene: { creditMode: "compact" },
})
`
