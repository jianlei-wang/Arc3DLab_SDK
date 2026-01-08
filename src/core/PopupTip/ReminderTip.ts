import {Viewer} from "../Viewer"
import { WindowPos } from "src/types"

class ReminderTip {
  private _message: string
  private _tipEvent: any
  private _isShow: boolean
  private _viewEl: Element
  private _tipEl: HTMLElement
  /**
   * 鼠标提示弹窗tip
   * @param {Viewer} viewer 地图场景
   * @param {string} [id="sdk-reminder-tip"] 元素对象id
   */
  constructor(private viewer: Viewer, private id: string = "sdk-reminder-tip") {
    this._viewEl =
      this.viewer.container.getElementsByClassName("cesium-viewer")[0]
    this._message = ""
    this._isShow = false
    // 绑定事件处理函数，确保在移除时是同一个引用
    this._tipEvent = this._handleMouseMove.bind(this)
    const domObj = document.getElementById(this.id)
    this._tipEl = domObj || this.initTipEl(this.id)
  }

  /**
   * 是否显示提示框
   * @type {boolean}
   */
  get show() {
    return this._isShow
  }
  set show(bool) {
    bool ? this.showTip() : this.hideTip()
  }

  /**
   * 提示内容
   * @type {string}
   */
  get message() {
    return this._message
  }
  set message(str) {
    this._message = str
  }

  /**
   * 初始化元素
   * @param id
   * @returns
   */
  private initTipEl(id: string) {
    let elementbottom = document.createElement("div")
    this._viewEl.append(elementbottom)
    let html = `<div id="${id}" style="display: none;pointer-events: none;position: absolute;z-index: 1000;opacity: 0.8;border-radius: 4px;padding: 4px 8px;white-space: nowrap;font-family:黑体;color:white;font-weight: bolder;font-size: 14px;background: #000000cc;color: white"></div>`
    this._viewEl.insertAdjacentHTML("beforeend", html)
    const domEl = document.getElementById(id)!
    return domEl
  }
  /**
   * 显示提示框
   */
  showTip() {
    this._isShow = true
    this._viewEl.addEventListener("mousemove", this._tipEvent)
  }
  /**
   * 清除提示框
   */
  hideTip() {
    this._isShow = false
    this._tipEvent &&
      this._viewEl.removeEventListener("mousemove", this._tipEvent)
    this._createTip({ x: 0, y: 0 }, false)
    this._message = ""
  }

  /**
   * 鼠标移动事件处理
   */
  private _handleMouseMove(e: MouseEvent) {
    this._createTip({ x: e.clientX, y: e.clientY }, true)
  }

  /**
   * 创建提示
   * @param position
   * @param show
   */
  private _createTip(position: WindowPos, show: boolean) {
    this._tipEl.innerHTML = this._message
    this._tipEl.style.left = position.x + 15 + "px"
    this._tipEl.style.top = position.y + 20 + "px"
    this._tipEl.style.display = show ? "block" : "none"
  }
}

export default ReminderTip
