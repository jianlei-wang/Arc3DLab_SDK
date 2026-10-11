/**
 * 可移除事件监听的最小接口，与 Cesium `Event` 兼容。
 */
export interface CameraChangeEvent {
  /**
   * 添加事件监听。
   * @param listener - 监听回调。
   * @param scope - 回调作用域。
   */
  addEventListener(listener: () => void, scope?: unknown): void
  /**
   * 移除事件监听。
   * @param listener - 监听回调。
   * @param scope - 回调作用域。
   */
  removeEventListener(listener: () => void, scope?: unknown): void
}

/**
 * 可同步的最小相机接口。
 */
export interface SyncableCamera {
  /** 相机世界坐标位置。 */
  position: unknown
  /** 相机朝向向量。 */
  direction: unknown
  /** 相机上方向向量。 */
  up: unknown
  /** 相机变化事件。 */
  changed?: CameraChangeEvent
  /**
   * 按目标位置与朝向设置相机。
   * @param options - 相机视图选项。
   */
  setView(options: {
    destination: unknown
    orientation: { direction: unknown; up: unknown }
  }): void
}

/**
 * 可同步的最小场景视图接口。
 */
export interface SyncableView {
  /** 视图相机。 */
  camera: SyncableCamera
}

/**
 * 多屏联动对象，将主视图的相机变化同步到其他视图。
 */
export class SyncViewer {
  private readonly listener: () => void
  private destroyed = false

  /**
   * 创建多屏联动对象。
   * @param primary - 作为基准的主视图。
   * @param views - 需要跟随同步的其他视图。
   */
  constructor(
    private readonly primary: SyncableView,
    private readonly views: SyncableView[],
  ) {
    this.listener = () => this.sync()
    this.primary.camera.changed?.addEventListener(this.listener, this)
  }

  /** 当前联动的视图数量（不含主视图）。 */
  get size(): number {
    return this.views.length
  }

  /**
   * 立即将主视图相机同步到其他视图。
   */
  sync(): void {
    const source = this.primary.camera
    for (const view of this.views) {
      view.camera.setView({
        destination: source.position,
        orientation: { direction: source.direction, up: source.up },
      })
    }
  }

  /**
   * 结束联动并释放监听。
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.primary.camera.changed?.removeEventListener(this.listener, this)
  }
}
