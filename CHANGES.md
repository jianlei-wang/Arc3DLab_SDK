# Change Log

## 关键字说明 :mega:

``` 说明
## v 版本号 - 时间
### Breaking Changes：:mega: 重大变更（移除or替换）
### feat: :tada: 新功能、新特性
### fix: :wrench: 修复bug
```

## 当前

## v1.0.0-alpha.1 - 2026-10-08

### Breaking Changes

- 主入口切换为 `Arc3D.create()`
- `package.json` license 与 `LICENSE` 对齐为 GPL-2.0-only
- 移除源码内置 Cesium Ion / 天地图 Token

### feat

- 内部 packages 模块化：core / engine-cesium / scene / layers / graphics / data / interaction / analysis / effects / ui / sdk
- 引入 Arc3DApp、ResourceRegistry、EventBus、Lifecycle、CreditManager、RenderPolicy
- `Viewer` 降为兼容适配器
- 设计迭代文档：`docs/architecture/`

### fix

- addPoints 始终返回 Graphic
- Polygon Primitive 按 onGround 选择 GroundPrimitive / Primitive
- Polygon fill 与 outline 使用不同内部 ID，销毁时一起回收
- Imagery 同名添加先移除旧资源
- EventHandler 完整 destroy
- Tooltip 使用 textContent 与 canvas 相对坐标
