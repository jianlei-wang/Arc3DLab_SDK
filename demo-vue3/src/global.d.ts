//全局变量名
declare global {
  interface Window {
    app?: import("arc3dlab").Arc3DApp
    viewer?: unknown
    Arc3DLab?: unknown
  }
}
const LarkExplorer = window.LarkExplorer
export default LarkExplorer
