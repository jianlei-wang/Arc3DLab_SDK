import { Arc3DError } from "./errors"

export const RESERVED_EXTENSION_PREFIXES = ["core.", "arc3dlab."] as const

export interface CommandParamField {
  type: "string" | "number" | "boolean" | "object" | "array"
  required?: boolean
  finite?: boolean
  min?: number
  max?: number
  enum?: unknown[]
  items?: CommandParamField
  properties?: Record<string, CommandParamField>
  additionalProperties?: boolean
}

export interface CommandSpec<
  TInput = Record<string, unknown>,
  TResult = unknown,
> {
  name: string
  version: string
  plugin: string
  params?: Record<string, CommandParamField>
  dependsOn?: string[]
  execute: (input: TInput) => TResult | Promise<TResult>
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

export function assertExtensionName(
  name: string,
  kind: "command" | "tool",
): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Arc3DError("INVALID_ARGUMENT", `Invalid ${kind} name: ${name}`)
  }
}

export function assertWritableExtension(
  name: string,
  plugin: string,
  kind: "command" | "tool",
): void {
  assertExtensionName(name, kind)
  const reserved = RESERVED_EXTENSION_PREFIXES.some((prefix) =>
    name.startsWith(prefix),
  )
  const corePlugin = plugin === "core" || plugin === "arc3dlab"
  if (reserved && !corePlugin) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Cannot override core ${kind}: ${name}`,
    )
  }
}

function describeType(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function fail(name: string, path: string, message: string): never {
  throw new Arc3DError(
    "INVALID_ARGUMENT",
    `Invalid command param: ${name}.${path} ${message}`,
  )
}

function validateField(
  name: string,
  path: string,
  field: CommandParamField,
  value: unknown,
): void {
  const actual = describeType(value)
  if (actual !== field.type) {
    fail(name, path, `expected ${field.type}, got ${actual}`)
  }
  if (field.enum && !field.enum.some((candidate) => candidate === value)) {
    fail(name, path, "value is not in enum")
  }
  if (field.type === "number") {
    const numeric = value as number
    if (field.finite !== false && !Number.isFinite(numeric)) {
      fail(name, path, "must be a finite number")
    }
    if (field.min !== undefined && numeric < field.min) {
      fail(name, path, `must be >= ${field.min}`)
    }
    if (field.max !== undefined && numeric > field.max) {
      fail(name, path, `must be <= ${field.max}`)
    }
  }
  if (field.type === "array" && field.items) {
    const items = field.items
    ;(value as unknown[]).forEach((item, index) => {
      validateField(name, `${path}[${index}]`, items, item)
    })
  }
  if (field.type === "object" && field.properties) {
    const record = value as Record<string, unknown>
    for (const [key, child] of Object.entries(field.properties)) {
      const childValue = record[key]
      if (childValue === undefined) {
        if (child.required) fail(name, `${path}.${key}`, "is required")
        continue
      }
      validateField(name, `${path}.${key}`, child, childValue)
    }
    if (field.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!field.properties[key])
          fail(name, `${path}.${key}`, "is not allowed")
      }
    }
  }
}

export function validateCommandInput(
  name: string,
  params: Record<string, CommandParamField> | undefined,
  input: unknown,
): Record<string, unknown> {
  const record =
    input === undefined || input === null
      ? {}
      : (input as Record<string, unknown>)
  if (typeof record !== "object" || Array.isArray(record)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Command input must be an object: ${name}`,
    )
  }
  if (!params) return record
  for (const [key, field] of Object.entries(params)) {
    const value = record[key]
    if (value === undefined) {
      if (field.required) {
        throw new Arc3DError(
          "INVALID_ARGUMENT",
          `Missing command param: ${name}.${key}`,
        )
      }
      continue
    }
    validateField(name, key, field, value)
  }
  return record
}

export class CommandBus {
  private items = new Map<string, CommandSpec>()

  constructor(private readonly ownerProvider?: () => string | undefined) {}

  register(spec: CommandSpec): void {
    const owner = this.ownerProvider?.() ?? spec.plugin
    assertWritableExtension(spec.name, owner, "command")
    if (this.items.has(spec.name)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Command already registered: ${spec.name}`,
      )
    }
    this.items.set(spec.name, { ...spec, plugin: owner })
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

  async execute<TResult = unknown>(
    name: string,
    input?: unknown,
  ): Promise<TResult> {
    const spec = this.items.get(name)
    if (!spec) {
      throw new Arc3DError(
        "RESOURCE_NOT_FOUND",
        `Command not registered: ${name}`,
      )
    }
    const parsed = validateCommandInput(name, spec.params, input)
    return (await spec.execute(parsed)) as TResult
  }
}
