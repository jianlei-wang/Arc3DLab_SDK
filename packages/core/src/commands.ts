import { Arc3DError } from "./errors"

export const RESERVED_EXTENSION_PREFIXES = ["core.", "arc3dlab."] as const

export interface CommandParamField {
  type: "string" | "number" | "boolean" | "object" | "array"
  required?: boolean
}

export interface CommandSpec<TInput = Record<string, unknown>, TResult = unknown> {
  name: string
  version: string
  plugin: string
  params?: Record<string, CommandParamField>
  dependsOn?: string[]
  execute: (input: TInput) => TResult | Promise<TResult>
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

export function assertExtensionName(name: string, kind: "command" | "tool"): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Arc3DError("INVALID_ARGUMENT", `Invalid ${kind} name: ${name}`)
  }
}

export function assertWritableExtension(name: string, plugin: string, kind: "command" | "tool"): void {
  assertExtensionName(name, kind)
  const reserved = RESERVED_EXTENSION_PREFIXES.some((prefix) => name.startsWith(prefix))
  const corePlugin = plugin === "core" || plugin === "arc3dlab"
  if (reserved && !corePlugin) {
    throw new Arc3DError("INVALID_ARGUMENT", `Cannot override core ${kind}: ${name}`)
  }
}

function valueType(value: unknown): CommandParamField["type"] | "other" {
  if (Array.isArray(value)) return "array"
  if (value === null) return "object"
  const type = typeof value
  if (type === "string" || type === "number" || type === "boolean" || type === "object") {
    return type
  }
  return "other"
}

export function validateCommandInput(
  name: string,
  params: Record<string, CommandParamField> | undefined,
  input: unknown
): Record<string, unknown> {
  const record =
    input === undefined || input === null ? {} : (input as Record<string, unknown>)
  if (typeof record !== "object" || Array.isArray(record)) {
    throw new Arc3DError("INVALID_ARGUMENT", `Command input must be an object: ${name}`)
  }
  if (!params) return record
  for (const [key, field] of Object.entries(params)) {
    const value = record[key]
    if (value === undefined) {
      if (field.required) {
        throw new Arc3DError("INVALID_ARGUMENT", `Missing command param: ${name}.${key}`)
      }
      continue
    }
    if (valueType(value) !== field.type) {
      throw new Arc3DError("INVALID_ARGUMENT", `Invalid command param type: ${name}.${key}`)
    }
  }
  return record
}

export class CommandBus {
  private items = new Map<string, CommandSpec>()

  register(spec: CommandSpec): void {
    assertWritableExtension(spec.name, spec.plugin, "command")
    if (this.items.has(spec.name)) {
      throw new Arc3DError("DUPLICATE_RESOURCE", `Command already registered: ${spec.name}`)
    }
    this.items.set(spec.name, spec)
  }

  unregister(name: string): void {
    this.items.delete(name)
  }

  unregisterByPlugin(plugin: string): void {
    for (const [name, spec] of this.items) {
      if (spec.plugin === plugin) this.items.delete(name)
    }
  }

  has(name: string): boolean {
    return this.items.has(name)
  }

  get(name: string): CommandSpec | undefined {
    return this.items.get(name)
  }

  list(): string[] {
    return Array.from(this.items.keys())
  }

  async execute<TResult = unknown>(name: string, input?: unknown): Promise<TResult> {
    const spec = this.items.get(name)
    if (!spec) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Command not registered: ${name}`)
    }
    const parsed = validateCommandInput(name, spec.params, input)
    return (await spec.execute(parsed)) as TResult
  }
}
