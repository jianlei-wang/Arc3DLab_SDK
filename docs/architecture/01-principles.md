# 架构原则

Updated: 2026-10-08

这些规则同时写入 `CONTRIBUTING.md`，属于 SDK 长期约束。

## Rule 1

`core` 独立于 Cesium。

## Rule 2

`core` 独立于 Vue / React。

## Rule 3

公共 API 使用明确类型，禁止 `any`。

## Rule 4

只使用 Cesium 公开 API。

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

数据描述与渲染后端分离。用户描述 Polygon，RenderPolicy 选择 Entity / Primitive / Buffer。

## Rule 11

插件只通过 Capability / Plugin API 扩展，保持对 Cesium 全局对象的隔离。

## Rule 12

稳定公共 API 必须有自动化测试。
