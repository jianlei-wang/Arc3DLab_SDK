# 更新日志

## 关键字说明

``` 说明
feat: 新功能、新特性
fix: 修改 bug
perf: 更改代码，以提高性能（在不影响代码内部行为的前提下，对程序性能进行优化）
refactor: 代码重构（重构，在不影响代码内部行为、功能下的代码修改）
docs: 文档修改
style: 代码格式修改, 注意不是 css 修改（例如分号修改）
test: 测试用例新增、修改
build: 影响项目构建或依赖项修改
revert: 恢复上一次提交
ci: 持续集成相关文件修改
chore: 其他修改（不在上述类型中的修改）
release: 发布新版本
workflow: 工作流相关文件修改
```

### $\colorbox{green}{001 v1.0.0 }$

#### 更新时间

```time
2026-10-11
```

#### 更新内容

```content
release: 发布首个正式版本 v1.0.0
docs: 新增 VitePress 开发指南站（guide/，独立端口 5175，顶栏互链 Sandcastle 与 API 文档）
docs: 新增 Cesium 风格 API 文档站，自研生成器替换 TypeDoc + Material 主题
docs: 公共导出中文 TSDoc 覆盖率达 100%（摘要与参数）
feat: 新增 app.scene.whenSceneReady() 首屏就绪信号
feat: 内置分析新增任务化方法，返回统一 AnalysisResult
test: 新增浏览器 E2E（Playwright + Chromium / SwiftShader）
build: 新增 bundle 体积门禁与依赖漏洞审计
```
