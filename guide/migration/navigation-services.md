# 导航组件与外部服务

Web 数据服务通过 `app.data.web` 使用，导航条通过 `app.ui.navigation` 创建，高德提供者与图层高亮语义从 `arc3dlab` 具名导出。

## Web 数据服务

`app.data.web` 持有可注入的 `WebServiceProvider`：

```ts
import { createGaodeProvider } from "arc3dlab"

app.data.web.setProvider(createGaodeProvider({ key: "your-gaode-key" }))

const route = await app.data.web.driving(origin, destination)
const pois = await app.data.web.poi("加油站", { region: "北京", count: 10 })
const geocodes = await app.data.web.geocode("北京市东城区长安街")
const reverse = await app.data.web.reverseGeocode({
  longitude: 116.39,
  latitude: 39.9,
})
```

接口 `WebServiceProvider` 定义 `driving` / `poi` / `geocode` / `reverseGeocode`。坐标以 WGS84 出入，内部自动完成 GCJ-02 互转；凭据与 `fetch` 均通过参数注入，不读取环境变量。未注入提供者时抛出 `PROVIDER_UNAVAILABLE`，缺少凭据时抛出 `MISSING_CREDENTIALS`。

## 导航条

`app.ui.navigation(options?)` 创建导航条，默认提供放大、缩小、复位、俯视与二三维切换控件：

```ts
const nav = app.ui.navigation({
  controls: ["zoomIn", "zoomOut", "home", "mode"],
  zoomRatio: 0.5,
})

nav.mount()
nav.mounted // 是否已挂载
nav.destroy()
```

`controls` 可选值：`zoomIn`、`zoomOut`、`home`、`top`、`mode`；`labels` 可覆盖控件提示文案。

## 图层高亮

`ActiveStyle` 以纯函数描述 `blink`（呼吸）、`scaling`（缩放闪烁）、`jump`（跳跃）三类高亮动画，通过属性读写端口写入动画值，关闭时精确还原：

```ts
import { ActiveStyle } from "arc3dlab"

const active = new ActiveStyle(
  {
    read: (key) => Number(properties[key] ?? 1),
    write: (key, value) => {
      properties[key] = value
    },
  },
  { type: "blink", geometry: "point" },
)

active.step(frame) // 逐帧推进，返回 { key, value }
active.restore() // 还原基准值
```

相关：[材质与后处理](/effects-ui/effects)、[数据源与提供者](/data/providers)。
