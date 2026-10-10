import { Arc3DError } from "./errors"

/** 提供生命周期可用性检查的抽象接口，用于异步操作前后的存活校验。 */
export interface LifecycleGate {
  /** 对象是否已销毁。 */
  readonly isDestroyed: boolean
  /** 对象是否正在销毁或已销毁。 */
  readonly isTerminating: boolean
  /** 断言对象仍可用于指定操作，不可用时抛出异常。 */
  assertUsable(action: string): void
}

/**
 * 断言生命周期对象仍可用，否则先释放资源再抛出异常。
 *
 * @param lifecycle - 提供存活状态的生命周期对象。
 * @param action - 正在执行的操作名称，用于错误信息。
 * @param dispose - 断言失败时调用的资源释放回调。
 * @throws {Arc3DError} 当对象正在销毁或已销毁时抛出，错误码为 `APP_DESTROYED`。
 */
export function assertAlive(
  lifecycle: LifecycleGate,
  action: string,
  dispose?: () => void,
): void {
  if (lifecycle.isTerminating || lifecycle.isDestroyed) {
    dispose?.()
    throw new Arc3DError(
      "APP_DESTROYED",
      `Cannot ${action} after Arc3DApp has been destroyed`,
    )
  }
  try {
    lifecycle.assertUsable(action)
  } catch (error) {
    dispose?.()
    throw error
  }
}

/**
 * 在等待异步结果后再次校验生命周期，若已销毁则释放结果并抛出异常。
 *
 * @param lifecycle - 提供存活状态的生命周期对象。
 * @param action - 正在执行的操作名称，用于错误信息。
 * @param value - 异步等待得到的值。
 * @param dispose - 校验失败时用于释放该值的回调。
 * @returns 校验通过后原样返回的异步值。
 * @throws {Arc3DError} 当对象正在销毁或已销毁时抛出，错误码为 `APP_DESTROYED`。
 */
export async function afterAwait<T>(
  lifecycle: LifecycleGate,
  action: string,
  value: T,
  dispose?: (value: T) => void,
): Promise<T> {
  assertAlive(
    lifecycle,
    action,
    value !== undefined && dispose ? () => dispose(value) : undefined,
  )
  return value
}
