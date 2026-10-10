import { Arc3DError } from "@arc3dlab/core"

export interface FlyToCallbacks {
  complete?: () => void
  cancel?: () => void
}

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
