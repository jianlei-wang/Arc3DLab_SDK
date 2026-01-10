import {
  PointGraphics,
  HeightReference,
  Color,
  Cartesian3,
  Entity,
  PointPrimitive,
  PointPrimitiveCollection,
  NearFarScalar,
} from "cesium"
import { randomId } from "../../utils/Generate"

export interface PointOption extends PointGraphics.ConstructorOptions {
  pColor?: string
  pOutlineColor?: string
  onGround?: boolean
  allowPick?: boolean
  id?: string
  featureAttribute?: object
  pixelSize?: number
  outlineWidth?: number
  disableDepthTestDistance?: number
  scaleByDistance?: NearFarScalar
  pixelOffsetScaleByDistance?: any
  image?: string
  ids?: string[]
}

const defaultOptions: PointOption = {
  pColor: "#ff0000",
  pOutlineColor: "#ffff00",
  onGround: true,
  allowPick: true,
  pixelSize: 10,
  outlineWidth: 1,
  id: "default_point_id",
  featureAttribute: {},
}

class PointGraphic extends PointGraphics {
  options: PointOption

  constructor(options: PointOption = {}) {
    // Process custom options before passing to parent
    const processedOptions = PointGraphic.processOptions(options)
    super(processedOptions)
    this.options = processedOptions
  }

  private static processOptions(options: PointOption): PointOption {
    const finalOptions = Object.assign({}, defaultOptions, options)

    // Convert color strings to Cesium.Color objects
    if (finalOptions.pColor && typeof finalOptions.pColor === "string") {
      finalOptions.color = Color.fromCssColorString(finalOptions.pColor)
    }

    if (
      finalOptions.pOutlineColor &&
      typeof finalOptions.pOutlineColor === "string"
    ) {
      finalOptions.outlineColor = Color.fromCssColorString(
        finalOptions.pOutlineColor
      )
    }

    // Set height reference based on onGround option
    if (finalOptions.onGround) {
      finalOptions.heightReference = HeightReference.CLAMP_TO_GROUND
    }

    return finalOptions
  }

  /**
   * Create a Cesium Entity with this point graphic
   * @param position The position of the point
   * @param properties Additional properties for the entity
   * @returns Cesium Entity
   */
  createEntity(position: Cartesian3, properties?: any): Entity {
    const entity = new Entity({
      position: position,
      point: this,
      properties: properties || this.options.featureAttribute,
      id: this.options.id,
    })

    return entity
  }

  /**
   * Create a PointPrimitive using PointPrimitiveCollection
   * @param position The position of the point
   * @param collection Optional collection to add the primitive to
   * @returns PointPrimitive
   */
  createPointPrimitive(
    position: Cartesian3,
    collection?: PointPrimitiveCollection
  ): PointPrimitive {
    const pointPrimitive = {
      position: position,
      pixelSize: this.pixelSize?.getValue() || this.options.pixelSize,
      color: this.color?.getValue() || Color.RED,
      outlineColor: this.outlineColor?.getValue() || Color.YELLOW,
      outlineWidth: this.outlineWidth?.getValue() || this.options.outlineWidth,
      heightReference: this.options.onGround
        ? HeightReference.CLAMP_TO_GROUND
        : HeightReference.NONE,
      disableDepthTestDistance:
        this.disableDepthTestDistance?.getValue() ||
        this.options.disableDepthTestDistance,
      scaleByDistance:
        this.scaleByDistance?.getValue() || this.options.scaleByDistance,
      pixelOffsetScaleByDistance: this.options.pixelOffsetScaleByDistance,
      show: this.show?.getValue() || true,
      id: this.options.id,
    }

    if (collection) {
      return collection.add(pointPrimitive)
    }

    // If no collection provided, return the primitive configuration
    // In a real implementation, you would typically add to a collection
    return pointPrimitive as any
  }
}

export default PointGraphic
