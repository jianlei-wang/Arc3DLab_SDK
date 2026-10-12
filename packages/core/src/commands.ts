import { Arc3DError } from "./errors"

/** 保留的扩展名前缀，普通插件不可使用。 */
export const RESERVED_EXTENSION_PREFIXES = ["core.", "arc3dlab."] as const

/** 描述命令参数的类型与约束。 */
export interface CommandParamField {
  /** 参数类型。 */
  type: "string" | "number" | "boolean" | "object" | "array"
  /** 是否为必填参数。 */
  required?: boolean
  /** 数值是否必须为有限数。 */
  finite?: boolean
  /** 数值下限。 */
  min?: number
  /** 数值上限。 */
  max?: number
  /** 允许的枚举值集合。 */
  enum?: unknown[]
  /** 数组元素的字段约束。 */
  items?: CommandParamField
  /** 对象属性的字段约束。 */
  properties?: Record<string, CommandParamField>
  /** 是否允许额外属性。 */
  additionalProperties?: boolean
}

/** 描述一条命令的名称、参数与执行逻辑。 */
export interface CommandSpec<
  TInput = Record<string, unknown>,
  TResult = unknown,
> {
  /** 命令名称。 */
  name: string
  /** 命令版本。 */
  version: string
  /** 命令所属插件。 */
  plugin: string
  /** 命令参数约束。 */
  params?: Record<string, CommandParamField>
  /** 依赖的其他命令名称。 */
  dependsOn?: string[]
  /** 命令执行函数。 */
  execute: (input: TInput) => TResult | Promise<TResult>
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/**
 * 校验扩展名是否符合命名规范。
 *
 * @param name - 待校验的扩展名。
 * @param kind - 扩展类型，命令或工具。
 * @throws {Arc3DError} 当名称不匹配规范时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertExtensionName(
  name: string,
  kind: "command" | "tool",
): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Arc3DError("INVALID_ARGUMENT", `Invalid ${kind} name: ${name}`)
  }
}

/**
 * 校验扩展名合法且未被非核心方占用保留前缀。
 *
 * 保留前缀（`core.` / `arc3dlab.`）的授权只依据注册方显式声明的 `owner`：
 * 省略 owner 时按非核心方处理。注册者自报的 `plugin` 字段不参与保留命名空间的
 * 授权判断，避免插件通过伪造 `plugin` 字段抢占核心扩展。
 *
 * @param name - 扩展名。
 * @param owner - 显式声明的所有者；undefined 表示未经作用域授权的调用。
 * @param kind - 扩展类型，命令或工具。
 * @throws {Arc3DError} 当名称非法或非核心方试图占用保留前缀时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertWritableExtension(
  name: string,
  owner: string | undefined,
  kind: "command" | "tool",
): void {
  assertExtensionName(name, kind)
  const reserved = RESERVED_EXTENSION_PREFIXES.some((prefix) =>
    name.startsWith(prefix),
  )
  const coreOwner = owner === "core" || owner === "arc3dlab"
  if (reserved && !coreOwner) {
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

/**
 * 校验命令输入并返回规范化后的对象。
 *
 * @param name - 命令名称，用于错误信息。
 * @param params - 命令参数约束，省略时跳过字段校验。
 * @param input - 待校验的输入。
 * @returns 校验通过后的输入对象。
 * @throws {Arc3DError} 当输入非对象、缺少必填参数或字段不合法时抛出，错误码为 `INVALID_ARGUMENT`。
 */
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

/**
 * 生成命令定义的防御性快照，隔离调用方对读取结果与内部注册状态的修改。
 *
 * @param spec - 内部命令定义。
 * @returns 独立副本。
 */
function snapshotCommand(spec: CommandSpec): CommandSpec {
  return {
    ...spec,
    params: spec.params ? cloneParamFields(spec.params) : undefined,
    dependsOn: spec.dependsOn ? [...spec.dependsOn] : undefined,
  }
}

function cloneParamFields<T>(value: T): T {
  if (value === null || typeof value !== "object") return value
  try {
    return structuredClone(value)
  } catch {
    return (Array.isArray(value) ? value.slice() : { ...value }) as T
  }
}

/** 负责命令注册、校验与执行的命令总线。 */
export class CommandBus {
  private items = new Map<string, CommandSpec>()

  /**
   * 注册一条命令。
   *
   * @param spec - 命令定义。
   * @param owner - 显式归属的插件名；省略时仅用于归属记录，不授予保留命名空间。
   * @throws {Arc3DError} 当命令名非法或已被注册时抛出，错误码为 `INVALID_ARGUMENT` 或 `DUPLICATE_RESOURCE`。
   */
  register(spec: CommandSpec, owner?: string): void {
    const resolved = owner ?? spec.plugin
    assertWritableExtension(spec.name, owner, "command")
    if (this.items.has(spec.name)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Command already registered: ${spec.name}`,
      )
    }
    this.items.set(spec.name, { ...spec, plugin: resolved })
  }

  /**
   * 注销指定命令。
   *
   * @param name - 命令名称。
   */
  unregister(name: string): void {
    this.items.delete(name)
  }

  /**
   * 注销指定插件注册的全部命令。
   *
   * @param plugin - 插件名称。
   */
  unregisterByPlugin(plugin: string): void {
    for (const name of Array.from(this.items.keys())) {
      if (this.items.get(name)?.plugin === plugin) this.items.delete(name)
    }
  }

  /**
   * 判断命令是否已注册。
   *
   * @param name - 命令名称。
   * @returns 命令是否已注册。
   */
  has(name: string): boolean {
    return this.items.has(name)
  }

  /**
   * 获取命令定义。
   *
   * 返回防御性快照：修改读取结果不会改变内部注册状态，也不会影响按插件注销
   * 时对 `plugin` 字段的判定。
   *
   * @param name - 命令名称。
   * @returns 命令定义的副本，不存在时为 undefined。
   */
  get(name: string): CommandSpec | undefined {
    const spec = this.items.get(name)
    return spec ? snapshotCommand(spec) : undefined
  }

  /**
   * 列出全部已注册命令名称。
   *
   * @returns 命令名称数组。
   */
  list(): string[] {
    return Array.from(this.items.keys())
  }

  /**
   * 校验输入并执行指定命令。
   *
   * @param name - 命令名称。
   * @param input - 命令输入。
   * @returns 命令执行结果。
   * @throws {Arc3DError} 当命令未注册或输入非法时抛出，错误码为 `RESOURCE_NOT_FOUND` 或 `INVALID_ARGUMENT`。
   */
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
