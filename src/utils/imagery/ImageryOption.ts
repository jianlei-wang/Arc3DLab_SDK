import { TDT_KEY } from "../def/Default"

/**
 * 天地图，获取参数
 * @param type 地图类型：img-影像，vec-矢量，cva-矢量注记，cia-影像注记
 * @param token 天地图token
 * @returns
 */
export function getTdtOption(
  type: "img" | "vec" | "cva" | "cia",
  token = TDT_KEY
) {
  const url = `https://{s}.tianditu.gov.cn/${type}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${type}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={TileCol}&TILEROW={TileRow}&TILEMATRIX={TileMatrix}&TILEMATRIX={TileMatrix}&tk=${token}`
  return {
    url: url,
    layer: type,
    style: "default",
    format: "tiles",
    tileMatrixSetID: "w",
    maximumLevel: 18,
    subdomains: ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    token: token,
  }
}
