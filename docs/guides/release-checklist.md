# 发布检查清单

Updated: 2026-10-19

本文是 `arc3dlab` 的发布审计记录模板与执行顺序。任何一项关键门禁失败都必须停止发布；不要在失败项未关闭时通过修改版本号或跳过检查继续。

## 1. 变更与版本审查

- [ ] 公共导出已按 `scripts/public-api-stability.json` 标记为 `stable` / `experimental` / `internal` / `deprecated`。
- [ ] 运行 `npm run lint:stability`，每个导出恰好属于一个等级，弃用元数据完整。
- [ ] 运行 `npm run api:review`，确认相对 `scripts/api-history/` 最近快照的导出与签名变更符合版本位。
- [ ] 稳定 API 破坏性变更已进入 major；实验性 API 不兼容变更已进入 minor；patch 仅包含修复与内部调整。
- [ ] 弃用项至少保留一个 minor，`removeIn` 跨 major，且已写 `### Deprecated` 与迁移说明。
- [ ] `CHANGES.md` 已包含目标版本小节、日期、`### Known Limitations`；破坏性变更有 `### Breaking Changes`。
- [ ] `COMPATIBILITY.md` 活跃矩阵包含目标 `major.minor.x`。

## 2. 发布前门禁

```bash
# 类型检查、测试与 API 门禁
npm run gate:fast

# 覆盖率、文档、构建、体积、基准、发布元数据与打包 smoke
npm run gate:release

# 真实浏览器主链路与 Worker 降级
npm run test:e2e
xvfb-run -a npm run test:e2e:firefox

# tarball 安装到真实 Vite 消费者并执行生产构建与浏览器验证
npm run test:consumer
```

- [ ] `gate:fast` 与 `gate:release` 通过。
- [ ] Chromium / Firefox E2E 通过；无 WebGL2 的 Firefox 使用 `xvfb-run -a`。
- [ ] `test:consumer` 通过。
- [ ] Sandcastle 可在同一提交构建：`npm run build:sandcastle`。
- [ ] `npm pack --dry-run` 的文件列表不包含 source map、源码、测试或 `node_modules`。

## 3. 版本与快照

```bash
# 更新 package.json 与 lockfile，不创建 tag
npm version <version> --no-git-tag-version

# 刷新公共 API 快照并写入 api-history
node scripts/release-gate.mjs exports:update
npm run api:snapshot

# 校验版本、日志、兼容矩阵、迁移说明与快照
npm run release:check
```

- [ ] `package.json` 与 `package-lock.json` 根版本一致。
- [ ] `scripts/api-history/v<version>.json` 与 `scripts/public-api-manifest.json` 一致。
- [ ] `CHANGES.md` 的 `Unreleased` 已整理到目标版本小节并清空。
- [ ] 工作区已提交，CI 所需文件全部入库。

## 4. 打 tag 与发布验证

```bash
# 在目标提交创建并推送 tag
git tag -a v<version> -m "arc3dlab v<version>"
git push origin v<version>

# 在 tag 提交上运行发布前置检查
npm run release:preflight -- --tag v<version>
```

- [ ] tag 指向预期提交，`release-preflight` 通过。
- [ ] `release.yml` 的 `quality`、`package` job 通过，`release-tarball` 与 `SHA256SUMS` 归档成功。
- [ ] 发布凭据与最终 `npm publish` 由人工确认；工作流本身不自动发布。

## 5. 发布后 registry 验证

```bash
# 从 npm registry 下载并核对完整性、tarball 清单与安装导入路径
npm run release:verify -- --version <version>
```

- [ ] registry 元数据中的名称、版本、tarball URL 与 integrity 正确。
- [ ] tarball 与本地发布清单一致，不包含 source map、源码或私有依赖。
- [ ] 安装后的 `package.json` 保持 ESM-only、无运行时依赖、精确 `cesium@1.146.0` peer。
- [ ] 安装后 `import("arc3dlab")` 与 `import("arc3dlab/engine-cesium")` 成功。
- [ ] 在独立消费项目验证 `Arc3D.create()`、Cesium 静态资源和 Worker 路径。

## 发布记录模板

```markdown
## v<version> - YYYY-MM-DD

- 发布提交：<commit>
- Git tag：v<version>
- npm tarball：<registry url>
- 发布人：<name>
- 变更摘要：<link to CHANGES.md section>
- API 审查：<api:review 结果 / 版本位判定>
- 门禁结果：gate:release / e2e / test:consumer / sandcastle
- Registry 验证：release:verify 通过
- 已知限制：<link to CHANGES.md Known Limitations>
- 回滚方案：撤回 npm dist-tag、发布修复版本；不删除已发布版本
```

将记录追加到 `docs/releases/` 下的版本文件中，或在内部发布系统保留同等信息。不得以“CI 已通过”替代 API、版本与迁移的人工确认。
