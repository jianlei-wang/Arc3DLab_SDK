import { describe, expect, it } from "vitest"
import { Arc3DError, CommandBus } from "@arc3dlab/core"

function bus(): CommandBus {
  const commands = new CommandBus()
  commands.register({
    name: "schema.check",
    version: "1.0.0",
    plugin: "schema",
    params: {
      count: { type: "number", required: true, min: 0, max: 10 },
      mode: { type: "string", enum: ["a", "b"] },
      tags: { type: "array", items: { type: "string" } },
      nested: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", required: true },
          depth: { type: "number", min: 0 },
        },
      },
    },
    execute: (input) => input,
  })
  return commands
}

describe("Command schema", () => {
  it("accepts a valid payload", async () => {
    await expect(
      bus().execute("schema.check", {
        count: 5,
        mode: "a",
        tags: ["x", "y"],
        nested: { name: "hole", depth: 2 },
      }),
    ).resolves.toBeDefined()
  })

  it("rejects NaN and Infinity", async () => {
    await expect(
      bus().execute("schema.check", { count: Number.NaN }),
    ).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
    await expect(
      bus().execute("schema.check", { count: Number.POSITIVE_INFINITY }),
    ).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
  })

  it("enforces min and max", async () => {
    await expect(bus().execute("schema.check", { count: -1 })).rejects.toThrow(
      Arc3DError,
    )
    await expect(bus().execute("schema.check", { count: 11 })).rejects.toThrow(
      Arc3DError,
    )
  })

  it("rejects values outside the enum", async () => {
    await expect(
      bus().execute("schema.check", { count: 1, mode: "c" }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
  })

  it("rejects null where an object is expected", async () => {
    await expect(
      bus().execute("schema.check", { count: 1, nested: null }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
  })

  it("validates nested properties with a field path", async () => {
    await expect(
      bus().execute("schema.check", { count: 1, nested: { depth: -3 } }),
    ).rejects.toThrow(/schema\.check\.nested\.name is required/)
    await expect(
      bus().execute("schema.check", {
        count: 1,
        nested: { name: "x", depth: -3 },
      }),
    ).rejects.toThrow(/schema\.check\.nested\.depth/)
  })

  it("rejects additional properties when disabled", async () => {
    await expect(
      bus().execute("schema.check", {
        count: 1,
        nested: { name: "x", extra: true },
      }),
    ).rejects.toThrow(/schema\.check\.nested\.extra is not allowed/)
  })

  it("reports the array element path", async () => {
    await expect(
      bus().execute("schema.check", { count: 1, tags: ["ok", 3] }),
    ).rejects.toThrow(/schema\.check\.tags\[1\]/)
  })
})
