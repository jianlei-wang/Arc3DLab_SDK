import { Arc3DError } from "./errors"

export interface LifecycleGate {
  readonly isDestroyed: boolean
  readonly isTerminating: boolean
  assertUsable(action: string): void
}

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
