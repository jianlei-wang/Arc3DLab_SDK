# Analysis 模块

Updated: 2026-10-08

Analysis 是 Arc3DLab 的核心竞争力域。第一阶段提供测量骨架，后续按 Capability 扩展。

```ts
await app.analysis.measure.distance({ positions })
await app.analysis.measure.area({ positions })
await app.analysis.measure.height({ from, to })
```

后续：

- 地形剖面、坡度坡向
- 通视 / 视域
- 空间查询
- 体积 / 剖切
