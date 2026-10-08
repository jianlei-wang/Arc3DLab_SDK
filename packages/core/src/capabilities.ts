export class CapabilityRegistry {
  private flags = new Set<string>()

  register(name: string): void {
    this.flags.add(name)
  }

  has(name: string): boolean {
    return this.flags.has(name)
  }

  list(): string[] {
    return Array.from(this.flags)
  }
}
