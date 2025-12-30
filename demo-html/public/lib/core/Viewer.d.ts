import * as Cesium from "cesium";
interface Option extends Cesium.Viewer.ConstructorOptions {
    allowCameraUnderground?: boolean;
    asMapboxControl?: boolean;
}
export declare class Viewer extends Cesium.Viewer {
    options?: Option | undefined;
    constructor(container: Element | string, options?: Option | undefined);
    private initBaseConfig;
}
export {};
