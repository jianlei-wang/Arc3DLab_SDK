import {
  Cartesian3,
  Color,
  Entity,
  PolygonGraphics,
  PolygonHierarchy,
  Property,
} from "cesium"

export interface PolygonOption
  extends Omit<PolygonGraphics.ConstructorOptions, "outlineColor" | "outline"> {
  color?: string
  onGround?: boolean
  outline?: boolean
  outlineWidth?: number
  outlineColor?: string
  id?: string
  featureAttribute?: object
  zIndex?: number
  ids?: string[]
}

const defaultOptions: PolygonOption = {
  color: "#ff0000",
  onGround: true,
  outline: true,
  outlineWidth: 1,
  outlineColor: "#00ff00",
  id: "default_polygon_id",
  featureAttribute: {},
  zIndex: 0,
  ids: [],
}

class PolygonGraphic extends PolygonGraphics {
  options: PolygonOption
  constructor(options: PolygonOption = {}) {
    const processedOptions = PolygonGraphic.processOptions(options)
    super(processedOptions)
    this.options = processedOptions
  }

  private static processOptions(
    options: PolygonOption
  ): PolygonGraphics.ConstructorOptions {
    // First merge with defaults
    const mergedOptions = Object.assign({}, defaultOptions, options)

    // Create a new object for Cesium constructor that conforms to ConstructorOptions
    const cesiumOptions: any = {}

    // Copy all properties
    Object.keys(mergedOptions).forEach((key) => {
      if (key !== "color" && key !== "outlineColor" && key !== "onGround") {
        ;(cesiumOptions as any)[key] = (mergedOptions as any)[key]
      }
    })

    // Convert color from string to material
    if (mergedOptions.color && typeof mergedOptions.color === "string") {
      cesiumOptions.material = Color.fromCssColorString(mergedOptions.color)
    }

    // Convert outlineColor from string to Color
    if (
      mergedOptions.outlineColor &&
      typeof mergedOptions.outlineColor === "string"
    ) {
      cesiumOptions.outlineColor = Color.fromCssColorString(
        mergedOptions.outlineColor
      )
    }

    cesiumOptions.heightReference = mergedOptions.onGround ? 1 : 0 // CLAMP_TO_GROUND = 1, NONE = 0

    return cesiumOptions
  }

  creatEntity(positions: Cartesian3[], properties?: any) {
    const entity = new Entity({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        ...this.options,
      },
      properties: properties || this.options.featureAttribute,
      id: this.options.id,
    })
  }
}
export default PolygonGraphic
