/** 资源释放回调类型，可同步或异步执行。 */
export type Disposer = () => void | Promise<void>

/** 以栈结构收集释放回调，并按后进先出顺序统一执行的容器。 */
export class DisposerStack {
  private items: Disposer[] = []

  /** 当前栈中待执行的释放回调数量。 */
  get size(): number {
    return this.items.length
  }

  /**
   * 将一个释放回调压入栈顶。
   *
   * @param disposer - 待注册的释放回调。
   * @returns 从栈中移除该回调的函数。
   */
  push(disposer: Disposer): () => void {
    this.items.push(disposer)
    return () => {
      const index = this.items.lastIndexOf(disposer)
      if (index >= 0) this.items.splice(index, 1)
    }
  }

  /**
   * 以逆序依次执行并清空全部释放回调。
   *
   * @param onError - 某个回调抛出异常时调用的错误处理器。
   * @returns 全部回调处理完成后 resolve 的 Promise。
   */
  async disposeAll(onError?: (error: unknown) => void): Promise<void> {
    const pending = this.items.splice(0, this.items.length).reverse()
    for (const disposer of pending) {
      try {
        await disposer()
      } catch (error) {
        onError?.(error)
      }
    }
  }
}
