import { Arc3DError } from "@arc3dlab/core"

/**
 * 飞行到目标位置时的完成与取消回调集合。
 */
export interface FlyToCallbacks {
  /** 飞行完成时触发的回调。 */
  complete?: () => void
  /** 飞行被取消时触发的回调。 */
  cancel?: () => void
}

/**
 * 将 Cesium 相机的 flyTo 调用包装为 Promise，在完成、取消或失败时结束等待。
 * @param run - 接收完成与取消回调并实际执行飞行的函数。
 * @param isDestroyed - 判断宿主应用是否已销毁的函数。
 * @returns 飞行完成或被取消时兑现、失败时拒绝的 Promise。
 * @throws {Arc3DError} 当飞行结束时宿主应用已被销毁时抛出。
 */
export function createFlyToPromise(
  run: (callbacks: FlyToCallbacks) => void,
  isDestroyed: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (): void => {
      if (isDestroyed()) {
        reject(
          new Arc3DError(
            "APP_DESTROYED",
            "Camera flyTo aborted because Arc3DApp has been destroyed",
          ),
        )
        return
      }
      resolve()
    }
    try {
      run({
        complete: finish,
        cancel: finish,
      })
    } catch (error) {
      reject(error)
    }
  })
}
