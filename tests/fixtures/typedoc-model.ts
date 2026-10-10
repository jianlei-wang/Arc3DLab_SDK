/**
 * 最小 TypeDoc JSON 夹具，用于文档生成器的单元测试。
 */

function text(value: string) {
  return { kind: "text", text: value }
}

function comment(summary: string, blockTags: unknown[] = []) {
  return { summary: [text(summary)], blockTags }
}

export const fixtureProject = {
  id: 1,
  name: "fixture",
  kind: 1,
  children: [
    {
      id: 2,
      name: "packages/core/src",
      kind: 2,
      children: [
        {
          id: 10,
          name: "Widget",
          kind: 128,
          flags: {},
          sources: [
            {
              fileName: "packages/core/src/widget.ts",
              line: 1,
              url: "https://example.com/widget.ts#L1",
            },
          ],
          comment: comment("一个控件。"),
          children: [
            {
              id: 11,
              name: "Widget",
              kind: 512,
              flags: {},
              sources: [],
              signatures: [
                {
                  id: 12,
                  kind: 16384,
                  flags: {},
                  comment: comment("构造控件。"),
                  parameters: [
                    {
                      id: 13,
                      kind: 32768,
                      name: "options",
                      flags: { isOptional: true },
                      type: {
                        type: "reference",
                        name: "WidgetOptions",
                        target: 20,
                      },
                      comment: { summary: [text("控件选项。")], blockTags: [] },
                    },
                  ],
                  type: { type: "reference", name: "Widget", target: 10 },
                },
              ],
            },
            {
              id: 14,
              name: "title",
              kind: 1024,
              flags: { isReadonly: true },
              sources: [],
              type: { type: "intrinsic", name: "string" },
              comment: comment("标题。"),
            },
            {
              id: 15,
              name: "run",
              kind: 2048,
              flags: {},
              sources: [],
              signatures: [
                {
                  id: 16,
                  kind: 4096,
                  flags: {},
                  comment: comment("运行控件。", [
                    { tag: "@returns", content: [text("运行结果。")] },
                    { tag: "@throws", content: [text("{Error} 运行失败。")] },
                  ]),
                  parameters: [
                    {
                      id: 17,
                      kind: 32768,
                      name: "times",
                      flags: { isOptional: true },
                      type: { type: "intrinsic", name: "number" },
                      comment: { summary: [text("重复次数。")], blockTags: [] },
                    },
                  ],
                  type: { type: "intrinsic", name: "void" },
                },
              ],
            },
          ],
        },
        {
          id: 20,
          name: "WidgetOptions",
          kind: 256,
          flags: {},
          sources: [],
          comment: comment("控件选项。"),
          children: [
            {
              id: 21,
              name: "title",
              kind: 1024,
              flags: { isOptional: true },
              sources: [],
              type: { type: "intrinsic", name: "string" },
              comment: comment("标题。"),
            },
          ],
        },
        {
          id: 30,
          name: "Status",
          kind: 2097152,
          flags: {},
          sources: [],
          comment: comment("控件状态。"),
          type: {
            type: "union",
            types: [
              { type: "literal", value: "idle" },
              { type: "literal", value: "ready" },
            ],
          },
        },
      ],
    },
    {
      id: 3,
      name: "packages/other/src",
      kind: 2,
      children: [
        {
          id: 40,
          name: "Widget",
          kind: 128,
          flags: {},
          sources: [],
          comment: comment("另一个控件。"),
          children: [],
        },
      ],
    },
  ],
  symbolIdMap: {
    "2": {
      packageName: "@arc3dlab/core",
      packagePath: "src/index.ts",
      qualifiedName: "",
    },
    "3": {
      packageName: "@arc3dlab/other",
      packagePath: "src/index.ts",
      qualifiedName: "",
    },
    "10": {
      packageName: "@arc3dlab/core",
      packagePath: "src/widget.ts",
      qualifiedName: "Widget",
    },
    "20": {
      packageName: "@arc3dlab/core",
      packagePath: "src/widget.ts",
      qualifiedName: "WidgetOptions",
    },
    "30": {
      packageName: "@arc3dlab/core",
      packagePath: "src/widget.ts",
      qualifiedName: "Status",
    },
    "40": {
      packageName: "@arc3dlab/other",
      packagePath: "src/widget.ts",
      qualifiedName: "Widget",
    },
  },
}
