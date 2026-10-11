# 导航组件与外部服务

内置导航条、可注入的 Web 数据服务提供者，以及图层高亮语义。

## 导航条

`NavigationBar` 在视图容器内渲染放大、缩小、复位、俯视与二三维切换控件：

```ts
import { NavigationBar } from "@arc3dlab/ui"

const bar = new NavigationBar(app.context, {
  controls: ["zoomIn", "zoomOut", "home", "top", "mode"],
  zoomRatio: 0.5,
})
bar.mount() // 缺省挂载到视图容器
bar.destroy() // 移除 DOM 与事件监听
```

`mount(container?)` 可指定宿主容器；`document` 选项可注入自定义 DOM 工厂以便测试。

## Web 数据服务

`app.data.web` 持有可注入的 `WebServiceProvider`，内置高德参考实现 `createGaodeProvider`：

```ts
import { createGaodeProvider } from "@arc3dlab/data"

app.data.web.setProvider(
  createGaodeProvider({ key: import.meta.env.VITE_AMAP_KEY }),
)

const route = await app.data.web.driving(origin, destination)
const pois = await app.data.web.poi("加油站", { region: "北京", count: 10 })
const geocodes = await app.data.web.geocode("北京市东城区长安街")
const reverse = await app.data.web.reverseGeocode({ longitude: 116.39, latitude: 39.9 })
```

接口 `WebServiceProvider` 定义 `driving` / `poi` / `geocode` / `reverseGeocode`。坐标以 WGS84 出入，内部自动完成 GCJ-02 互转；凭据与 `fetch` 均通过参数注入，不读取环境变量。未注入提供者时抛出 `PROVIDER_UNAVAILABLE`，缺少凭据时抛出 `MISSING_CREDENTIALS`。

## 图层高亮

`@arc3dlab/core` 的 `ActiveStyle` 以纯函数描述 `blink`、`scaling`、`jump` 三类高亮动画，并通过抽象端口写入与还原：

```ts
import { ActiveStyle } from "@arc3dlab/core"

const style = new ActiveStyle(writer, { type: "blink", geometry: "billboard" })
style.step(tick)
style.restore()
```

`activeFrameValue`、`activePropertyKey` 与 `triangularWave` 可单独复用。

相关：[材质与后处理](/effects-ui/effects)、[数据源与提供者](/data/providers)。
