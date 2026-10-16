import type { DefaultBaseLayerState } from "@arc3dlab/core"
import type { ImageryLayer } from "cesium"

/**
 * 默认占位底图控制器需要宿主提供的最小操作接口。
 */
export interface DefaultBaseLayerHost {
  /**
   * 将图层插入影像集合最底层。
   * @param layer - 待插入的影像图层。
   */
  addToBottom(layer: ImageryLayer): void
  /**
   * 将图层移动到影像集合最底层。
   * @param layer - 待移动的影像图层。
   */
  lowerToBottom(layer: ImageryLayer): void
  /** 请求渲染一帧。 */
  requestRender(): void
}

/**
 * 默认占位底图控制器。
 *
 * 默认占位底图与业务自定义底图共用最底层槽位，因此占位图的可见性由
 * “期望状态”驱动，而非一次性操作：业务设置自定义底图时隐藏占位图，
 * 移除后恢复。该期望状态在占位图尚未加载完成时会被记录，加载完成后
 * 按最新期望生效，从而覆盖“占位图先完成”与“业务底图先完成”两种时序。
 */
export class DefaultBaseLayerController {
  private wanted = true
  private layer: ImageryLayer | undefined
  private currentState: DefaultBaseLayerState = "disabled"

  /**
   * 创建默认占位底图控制器。
   * @param host - 宿主提供的影像集合操作。
   */
  constructor(private readonly host: DefaultBaseLayerHost) {}

  /** 当前默认占位底图状态。 */
  get state(): DefaultBaseLayerState {
    return this.currentState
  }

  /** 当前已加载的占位图层，未加载时返回 undefined。 */
  get imagery(): ImageryLayer | undefined {
    return this.layer
  }

  /** 标记占位底图进入加载中状态。 */
  markLoading(): void {
    this.currentState = "loading"
  }

  /** 标记占位底图加载失败。 */
  markFailed(): void {
    this.currentState = "failed"
  }

  /**
   * 挂载已加载完成的占位图层，并立即应用当前期望可见性。
   * @param layer - 已加载的影像图层。
   */
  attach(layer: ImageryLayer): void {
    this.layer = layer
    layer.show = this.wanted
    this.host.addToBottom(layer)
    this.currentState = "ready"
  }

  /**
   * 设置占位底图的期望可见性。
   *
   * 占位图尚未加载完成时仅记录期望，待 `attach` 时应用。
   * @param visible - 是否显示。
   */
  setVisible(visible: boolean): void {
    this.wanted = visible
    if (!this.layer) return
    this.layer.show = visible
    if (visible) this.host.lowerToBottom(this.layer)
    this.host.requestRender()
  }

  /** 释放占位图层引用。 */
  clear(): void {
    this.layer = undefined
  }
}
