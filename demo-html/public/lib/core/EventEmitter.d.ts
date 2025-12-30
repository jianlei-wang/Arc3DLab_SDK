import { ScreenSpaceEventType, Viewer } from "cesium";
export declare class CesiumEventEmitter {
    viewer: Viewer;
    constructor(viewer: Viewer);
    private handler;
    private events;
    /**
     * 绑定事件
     * @param eventName 事件名称
     * @param callback 回调函数
     */
    on(eventName: EventType, callback: Function): void;
    /**
     * 取消绑定事件
     * @param eventName 事件名称
     * @param callback 要移除的回调函数（可选）
     */
    off(eventName: EventType, callback?: Function): void;
    /**
     * 清空所有事件
     */
    clear(): void;
}
export declare const eventNameMap: {
    leftdown: ScreenSpaceEventType;
    leftup: ScreenSpaceEventType;
    click: ScreenSpaceEventType;
    dblclick: ScreenSpaceEventType;
    rightdown: ScreenSpaceEventType;
    rightup: ScreenSpaceEventType;
    rightclick: ScreenSpaceEventType;
    middledown: ScreenSpaceEventType;
    middleup: ScreenSpaceEventType;
    middleclick: ScreenSpaceEventType;
    mousemove: ScreenSpaceEventType;
    wheel: ScreenSpaceEventType;
    pinchstart: ScreenSpaceEventType;
    pinchend: ScreenSpaceEventType;
    pinchmove: ScreenSpaceEventType;
};
export type EventType = keyof typeof eventNameMap;
