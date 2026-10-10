import { Arc3DError } from "./errors"
import type { Disposer } from "./disposer"

/** 插件的生命周期状态。 */
export type PluginState =
  "installing" | "installed" | "uninstalling" | "failed" | "disposed"

/** 描述单个插件作用域，用于追踪该插件注册的释放回调。 */
export interface PluginScope {
  /** 作用域所属插件名。 */
  readonly owner: string
  /** 当前插件状态。 */
  readonly state: PluginState
  /**
   * 追踪一个释放回调。
   *
   * @param disposer - 释放回调。
   * @returns 取消追踪的函数。
   */
  track(disposer: Disposer): () => void
  /** 已追踪的释放回调数量。 */
  readonly size: number
  /** 执行并清空全部释放回调。 */
  dispose(): Promise<unknown[]>
}

class PluginScopeImpl implements PluginScope {
  private items: Disposer[] = []
  private current: PluginState = "installing"

  constructor(readonly owner: string) {}

  get state(): PluginState {
    return this.current
  }

  setState(state: PluginState): void {
    this.current = state
  }

  track(disposer: Disposer): () => void {
    this.items.push(disposer)
    return () => {
      const index = this.items.lastIndexOf(disposer)
      if (index >= 0) this.items.splice(index, 1)
    }
  }

  get size(): number {
    return this.items.length
  }

  async dispose(): Promise<unknown[]> {
    const pending = this.items.splice(0, this.items.length).reverse()
    const errors: unknown[] = []
    for (const disposer of pending) {
      try {
        await disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    return errors
  }
}

/** 管理多个插件作用域的打开、查询与关闭。 */
export class PluginScopeManager {
  private scopes = new Map<string, PluginScopeImpl>()
  private activeOwner: string | undefined

  /**
   * 打开一个插件作用域。
   *
   * @param owner - 插件名。
   * @returns 新建的插件作用域。
   * @throws {Arc3DError} 当试图为保留插件名打开作用域时抛出，错误码为 `INVALID_ARGUMENT`。
   */
  open(owner: string): PluginScope {
    if (owner === "core" || owner === "arc3dlab") {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Reserved plugin scope: ${owner}`,
      )
    }
    const scope = new PluginScopeImpl(owner)
    this.scopes.set(owner, scope)
    return scope
  }

  /**
   * 获取指定插件的作用域。
   *
   * @param owner - 插件名。
   * @returns 对应作用域，不存在时为 undefined。
   */
  get(owner: string): PluginScope | undefined {
    return this.scopes.get(owner)
  }

  /** 当前活动的插件所有者名称。 */
  get owner(): string | undefined {
    return this.activeOwner
  }

  /**
   * 设置当前活动的插件所有者。
   *
   * @param owner - 插件名，undefined 表示清除。
   */
  setActive(owner: string | undefined): void {
    this.activeOwner = owner
  }

  /**
   * 更新指定插件的状态。
   *
   * @param owner - 插件名。
   * @param state - 目标状态。
   */
  setState(owner: string, state: PluginState): void {
    this.scopes.get(owner)?.setState(state)
  }

  /**
   * 关闭指定插件作用域并执行其释放回调。
   *
   * @param owner - 插件名。
   * @returns 释放过程中收集到的错误数组。
   */
  async close(owner: string): Promise<unknown[]> {
    const scope = this.scopes.get(owner)
    if (!scope) return []
    const errors = await scope.dispose()
    this.scopes.delete(owner)
    return errors
  }

  /**
   * 列出全部已打开的插件作用域名。
   *
   * @returns 插件名数组。
   */
  list(): string[] {
    return Array.from(this.scopes.keys())
  }
}

/**
 * 判断给定值是否为有效的插件作用域。
 *
 * @param value - 待判断的值。
 * @returns 是否为插件作用域。
 */
export function isPluginScope(
  value: PluginScope | undefined,
): value is PluginScope {
  return Boolean(value && typeof value.track === "function")
}
