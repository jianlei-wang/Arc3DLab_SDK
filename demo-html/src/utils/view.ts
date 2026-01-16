const treeDatas = [
  {
    id: "地图初始化",
    label: "地图初始化",
    children: [
      { id: "000", label: "创建场景" },
      { id: "001", label: "操作模式" },
      { id: "004", label: "场景设置" },
    ],
  },
  {
    id: "地图影像",
    label: "地图影像",
    children: [
      { id: "003", label: "底图调整" }
    ],
  },
  {
    id: "DEM地形",
    label: "DEM地形",
    children: [
      { id: "005", label: "初始化地形" },
      { id: "006", label: "地形设置" },
    ],
  },
  {
    id: "地图事件",
    label: "地图事件",
    children: [
      { id: "002", label: "鼠标事件" },
      { id: "007", label: "鼠标提示" },
      // { id: "004", label: "对象拾取" },
      // { id: "015", label: "地球自转" },
    ],
  },
  {
    id: "地图图层",
    label: "地图图层",
    children: [
      { id: "008", label: "添加点Entity" },
      { id: "009", label: "添加点Primitive" },
      { id: "013", label: "添加线Entity" },
      { id: "014", label: "添加线Primitive" },
      { id: "010", label: "加载geojson" },
      { id: "011", label: "加载KML" },
      { id: "012", label: "加载geoserver地图服务" },
      // { id: "013", label: "点类对象" },
      // { id: "008", label: "加载3DTiles" },
      // { id: "010", label: "动态水面" },
      // { id: "011", label: "动态水面（带倒影）" },
      // { id: "014", label: "Geojson加载" },
    ],
  },

  {
    id: "3DTiles",
    label: "3DTiles",
    children: [
      // { id: "008", label: "加载3DTiles" },
      // { id: "009", label: "3DTiles模型压平" },
    ],
  },
]

export default treeDatas
