# 架构原则

Updated: 2026-10-18

这些规则同时写入 `CONTRIBUTING.md`，属于 SDK 长期约束。

## Rule 1

`core` 独立于 Cesium。

## Rule 2

`core` 独立于 Vue / React。

## Rule 3

公共 API 使用明确类型，禁止 `any`。

## Rule 4

只使用 Cesium 公开 API。

唯一登记例外是自定义材质注册所需的 `Material._materialCache`：Cesium 1.146.0 未提供公开替代，使用位置、风险与升级核查见 `COMPATIBILITY.md` 的「Cesium 内部 API 依赖（升级高风险点）」。该入口不进入公共 API 合同，升级 Cesium 时按兼容性变更处理。

## Rule 5

模块加载过程保持无副作用。相机默认范围、Ion Token 只在实例初始化时设置。

## Rule 6

Token 由运行时配置注入。源码默认配置只允许占位符。

## Rule 7

所有 SDK 创建的资源都能通过 `destroy()` / `remove()` 回收。

## Rule 8

异步 API 必须声明 `Promise<T>` 返回类型。

## Rule 9

Layer 描述栅格/地形/切片等图层；Graphic 描述点线面等要素。二者分开。

## Rule 10

数据描述与渲染策略分离。用户描述 Polygon，RenderPolicy 选择 Entity / Primitive / Buffer。这里的后端分离指同一 Cesium 引擎内的渲染路径选择；替换 CesiumJS 需要新增引擎适配层与端口抽象，当前 `engine.type` 仅接受 `"cesium"`。

## Rule 11

插件只通过 Capability / Plugin API 扩展，保持对 Cesium 全局对象的隔离。

## Rule 12

稳定公共 API 必须有自动化测试。
