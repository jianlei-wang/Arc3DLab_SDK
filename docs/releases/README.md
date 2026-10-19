# 发布记录

每个正式版本在此保留一份发布审计记录，模板见 `docs/guides/release-checklist.md`。记录至少包含：

- 发布提交与 Git tag
- npm tarball 与 `release:verify` 结果
- 公共 API 审查结论与版本位判定
- `gate:release`、E2E、`test:consumer` 与 Sandcastle 结果
- 已知限制与回滚方案

尚未完成 registry 验证的版本不得在此标记为已发布。
