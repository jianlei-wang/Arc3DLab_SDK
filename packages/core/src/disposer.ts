export type Disposer = () => void | Promise<void>

export class DisposerStack {
  private items: Disposer[] = []

  get size(): number {
    return this.items.length
  }

  push(disposer: Disposer): () => void {
    this.items.push(disposer)
    return () => {
      const index = this.items.lastIndexOf(disposer)
      if (index >= 0) this.items.splice(index, 1)
    }
  }

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
