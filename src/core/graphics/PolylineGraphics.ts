import {
  Color,
  Entity,
  MaterialProperty,
  PolylineGraphics,
  Cartesian3,
  GeometryInstance,
  GroundPolylineGeometry,
  ColorGeometryInstanceAttribute,
  PolylineGeometry,
  PerInstanceColorAppearance,
} from "cesium"

export interface PolylineOption extends PolylineGraphics.ConstructorOptions {
  color?: string
  width?: number
  onGround?: boolean
  allowPick?: boolean
  id?: string
  featureAttribute?: object
  material?: MaterialProperty | Color
  zIndex?: number
  ids?: string[]
}

const defaultOptions: PolylineOption = {
  color: "#ff0f40",
  width: 2,
  onGround: true,
  allowPick: true,
  id: "default_polyline_id",
  featureAttribute: {},
  zIndex: 0,
  material: Color.WHITE,
  ids: [],
}

class PolylineGraphic extends PolylineGraphics {
  options: PolylineOption
  constructor(options: PolylineOption = {}) {
    const processedOptions = PolylineGraphic.processOptions(options)
    super(processedOptions)
    this.options = processedOptions
  }

  private static processOptions(options: PolylineOption): PolylineOption {
    const finalOptions = Object.assign({}, defaultOptions, options)
    if (finalOptions.color && typeof finalOptions.color === "string") {
      finalOptions.material = Color.fromCssColorString(finalOptions.color)
    }

    finalOptions.clampToGround = finalOptions.onGround

    return finalOptions
  }
  createEntity(positions: Cartesian3[], properties?: any): Entity {
    const entity = new Entity({
      polyline: {
        positions: positions,
        ...this.options,
      },
      properties: properties || this.options.featureAttribute,
      id: this.options.id,
    })
    return entity
  }

  createPrimitive(positions: Cartesian3[]) {
    const { onGround, material, width, id } = this.options
    const geoOtp = {
      positions,
      width,
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    }
    const lineGeo = onGround
      ? new GroundPolylineGeometry(geoOtp)
      : new PolylineGeometry(geoOtp)
    const instance = new GeometryInstance({
      geometry: lineGeo,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(material as Color),
      },
      id,
    })
    return instance
  }
}
export default PolylineGraphic
