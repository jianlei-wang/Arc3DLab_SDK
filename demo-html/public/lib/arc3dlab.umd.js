(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('cesium')) :
    typeof define === 'function' && define.amd ? define(['exports', 'cesium'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Arc3DLab = {}, global.Cesium));
})(this, (function (exports, Cesium) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var Cesium__namespace = /*#__PURE__*/_interopNamespace(Cesium);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    /**
     * Cesium 事件类型映射表（自定义事件名称到 Cesium 原生事件类型的映射）
     * @readonly
     * @enum {number}
     * @property {ScreenSpaceEventType} leftDown - 鼠标左键按下事件
     * @property {ScreenSpaceEventType} leftUp - 鼠标左键释放事件
     * @property {ScreenSpaceEventType} leftClick - 鼠标左键单击事件
     * @property {ScreenSpaceEventType} leftDblClick - 鼠标左键双击事件
     * @property {ScreenSpaceEventType} rightDown - 鼠标右键按下事件
     * @property {ScreenSpaceEventType} rightUp - 鼠标右键释放事件
     * @property {ScreenSpaceEventType} rightClick - 鼠标右键单击事件
     * @property {ScreenSpaceEventType} middleDown - 鼠标中键按下事件
     * @property {ScreenSpaceEventType} middleUp - 鼠标中键释放事件
     * @property {ScreenSpaceEventType} middleClick - 鼠标中键单击事件
     * @property {ScreenSpaceEventType} mouseMove - 鼠标移动事件
     * @property {ScreenSpaceEventType} wheel - 鼠标滚轮滚动事件
     * @property {ScreenSpaceEventType} pinchStart - 触摸屏双指手势开始事件
     * @property {ScreenSpaceEventType} pinchEnd - 触摸屏双指手势结束事件
     * @property {ScreenSpaceEventType} pinchMove - 触摸屏双指手势移动事件
     */
    var EventNameMap = {
        leftDown: Cesium.ScreenSpaceEventType.LEFT_DOWN,
        leftUp: Cesium.ScreenSpaceEventType.LEFT_UP,
        leftClick: Cesium.ScreenSpaceEventType.LEFT_CLICK,
        leftDblClick: Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
        rightDown: Cesium.ScreenSpaceEventType.RIGHT_DOWN,
        rightUp: Cesium.ScreenSpaceEventType.RIGHT_UP,
        rightClick: Cesium.ScreenSpaceEventType.RIGHT_CLICK,
        middleDown: Cesium.ScreenSpaceEventType.MIDDLE_DOWN,
        middleUp: Cesium.ScreenSpaceEventType.MIDDLE_UP,
        middleClick: Cesium.ScreenSpaceEventType.MIDDLE_CLICK,
        mouseMove: Cesium.ScreenSpaceEventType.MOUSE_MOVE,
        wheel: Cesium.ScreenSpaceEventType.WHEEL,
        pinchStart: Cesium.ScreenSpaceEventType.PINCH_START,
        pinchEnd: Cesium.ScreenSpaceEventType.PINCH_END,
        pinchMove: Cesium.ScreenSpaceEventType.PINCH_MOVE,
    };

    var EventEmitter = /** @class */ (function () {
        /**
         * 创建事件处理器实例
         * @param {Viewer} viewer - Cesium 的视图器对象
         * @description
         * 基于 Cesium 的屏幕空间事件处理器扩展类，支持多回调函数管理
         * @example
         * const emitter = new EventEmitter(viewer);
         * emitter.on('leftClick', (event) => console.log('Clicked:', event.position));
         */
        function EventEmitter(viewer) {
            this.viewer = viewer;
            /** @private 原生的 Cesium 屏幕空间事件处理器 */
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
            /** @private 存储事件及其回调函数的映射表 */
            this.events = new Map();
        }
        /**
         * 绑定指定事件类型的回调函数
         * @param {EventType} eventName - 要监听的事件名称（参见 eventNameMap 的键名）
         * @param {Function} callback - 事件触发时的回调函数
         * @throws {Error} 当 eventName 不是有效的事件类型时
         */
        EventEmitter.prototype.on = function (eventName, callback) {
            var _this = this;
            if (!this.events.has(eventName)) {
                this.events.set(eventName, []);
                this.handler.setInputAction(function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    var callbacks = _this.events.get(eventName);
                    callbacks === null || callbacks === void 0 ? void 0 : callbacks.forEach(function (callback) {
                        callback.apply(void 0, args);
                    });
                }, EventNameMap[eventName]);
            }
            this.events.get(eventName).push(callback);
        };
        /**
         * 移除指定事件类型的回调函数
         * @param {EventType} eventName - 要移除的事件名称
         * @param {Function} [callback] - 要移除的特定回调函数（不传则移除该事件所有回调）
         */
        EventEmitter.prototype.off = function (eventName, callback) {
            if (!this.events.has(eventName))
                return;
            if (callback) {
                var callbacks = this.events.get(eventName);
                var index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
            }
            else {
                this.events.delete(eventName);
            }
        };
        /**
         * 移除事件类型集
         * @param {Array<EventType>} eventNames 要移除的事件名称集合
         */
        EventEmitter.prototype.offEvents = function (eventNames) {
            if (eventNames === void 0) { eventNames = []; }
            for (var index = 0; index < eventNames.length; index++) {
                var eventName = eventNames[index];
                this.events.has(eventName) && this.events.delete(eventName);
            }
        };
        /**
         * 清空所有已注册的事件和回调
         */
        EventEmitter.prototype.clear = function () {
            this.events.clear();
        };
        return EventEmitter;
    }());

    var globeImg = "data:image/jpeg;base64,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";

    // Cesium Icon资源key
    var CesiumIcon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiYjUwNWQyOC0yZmZhLTRmMzItOTQyZC02ZmQyMWIyMTA3NmEiLCJpZCI6NjcyNzcsImlhdCI6MTY2ODE1ODc2Mn0.t1h6-ZADkGnZUZZoLtrlgtTp8_MR2Kxfhew42ksDgmk";
    // 天地图token
    var TDT_KEY = "51f791b33368bb3935997fa43031a7ec";

    /**
     * 天地图，获取参数
     * @param type 地图类型：img-影像，vec-矢量，cva-矢量注记，cia-影像注记
     * @param token 天地图token
     * @returns
     */
    function getTdtOption(type, token) {
        if (token === void 0) { token = TDT_KEY; }
        var url = "https://{s}.tianditu.gov.cn/".concat(type, "_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=").concat(type, "&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={TileCol}&TILEROW={TileRow}&TILEMATRIX={TileMatrix}&TILEMATRIX={TileMatrix}&tk=").concat(token);
        return {
            url: url,
            layer: type,
            style: "default",
            format: "tiles",
            tileMatrixSetID: "w",
            maximumLevel: 18,
            subdomains: ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"],
            token: token,
        };
    }

    /**
     * 基础图层类，包括影像底图和地形底图
     */
    var BaseLayer = {
        /**
         * 默认单图像底图
         * @readonly
         * @type {ImageryLayer}
         */
        get DefaultSingleImg() {
            return Cesium.ImageryLayer.fromProviderAsync(Cesium.SingleTileImageryProvider.fromUrl(globeImg), {});
        },
        /**
         * 默认arcgis底图
         * @readonly
         * @type {ImageryLayer}
         */
        get DefaultArcgisImg() {
            return Cesium.ImageryLayer.fromProviderAsync(Cesium.ArcGisMapServerImageryProvider.fromUrl("https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer"), {});
        },
        /**
         * 默认天地图影像地图
         * @readonly
         * @type {ImageryLayer}
         */
        get DefaultTdtImg() {
            var option = getTdtOption("img");
            return Cesium.ImageryLayer.fromProviderAsync(Promise.resolve(new Cesium.WebMapTileServiceImageryProvider(option)), {});
        },
        /**
         * 默认天地图矢量地图
         * @readonly
         * @type {ImageryLayer}
         */
        get DefaultTdtVec() {
            var option = getTdtOption("vec");
            return Cesium.ImageryLayer.fromProviderAsync(Promise.resolve(new Cesium.WebMapTileServiceImageryProvider(option)), {});
        },
        /**
         * 默认全球地形
         * @readonly
         * @type {Terrain}
         */
        get DefaultTerrain() {
            var terrainProvider = Cesium.createWorldTerrainAsync({
                requestWaterMask: true,
                requestVertexNormals: true,
            });
            return new Cesium.Terrain(terrainProvider);
        },
        /**
         * 获取tms格式地形
         * @param {String} url - 地形文件路径，如：http://localhost:80/terrain/
         * @returns {Terrain} - tms格式地形对象
         */
        getTerrain: function (url) {
            return new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl(url));
        },
    };

    /**
     * 获取地图尺寸
     */
    function mapSize(viewer) {
        var _a = viewer.canvas, width = _a.width, height = _a.height;
        return { width: width, height: height };
    }
    /**
     * 获取地图图片
     */
    function mapImg(viewer) {
        viewer.render(); //避免出现导出是一张黑乎乎的图片
        return viewer.scene.canvas.toDataURL("image/png");
    }

    /**
     * 判断是否已经加载地形数据
     * @param viewer - 地图场景
     * @returns 是否已经加载地形
     */
    function boolTerrain(viewer) {
        return viewer.terrainProvider !== undefined && viewer.terrainProvider !== null;
    }

    var Terrain = /** @class */ (function () {
        /**
         * 地形主类
         * @param viewer
         */
        function Terrain(viewer) {
            this.viewer = viewer;
            this.viewer = viewer;
            this._alpha = 1.0;
            this._updateTranslucency(false);
        }
        Object.defineProperty(Terrain.prototype, "provider", {
            /**
             * 地形对象，参考Cesium的TerrainProvider类
             * @readonly
             * @type {TerrainProvider}
             */
            get: function () {
                return this.viewer.terrainProvider;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Terrain.prototype, "exaggeration", {
            /**
             * 地形夸张系数
             * @type {Number}
             */
            get: function () {
                return this.viewer.scene.verticalExaggeration;
            },
            set: function (scale) {
                this.viewer.scene.verticalExaggeration = scale;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Terrain.prototype, "show", {
            /**
             * 是否显示地形（借助于地形夸张调整）
             * @param {boolean} bool
             */
            set: function (bool) {
                var terrain = boolTerrain(this.viewer);
                if (!terrain)
                    return;
                this.exaggeration = bool ? 1 : 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Terrain.prototype, "alpha", {
            /**
             * 地表透明度，只有在开启碰撞检测的时候才能生效
             * @type {Number}
             */
            get: function () {
                return this._alpha;
            },
            set: function (val) {
                this._updateAlpha(val);
                this._alpha = val;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Terrain.prototype, "translucency", {
            /**
             * 地表碰撞检测
             * @type {Boolean}
             */
            get: function () {
                return this.viewer.scene.globe.translucency.enabled;
            },
            set: function (bool) {
                this._updateTranslucency(bool);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Terrain.prototype, "enableUnderground", {
            /**
             * 是否允许进入地下
             * @type {Boolean}
             */
            get: function () {
                return !this.viewer.scene.screenSpaceCameraController
                    .enableCollisionDetection;
            },
            set: function (bool) {
                this.viewer.scene.screenSpaceCameraController.enableCollisionDetection =
                    !bool;
            },
            enumerable: false,
            configurable: true
        });
        Terrain.prototype._updateAlpha = function (val) {
            var frontFaceAlphaByDistance = this.viewer.scene.globe.translucency.frontFaceAlphaByDistance;
            frontFaceAlphaByDistance.nearValue = val;
            frontFaceAlphaByDistance.farValue = val;
        };
        Terrain.prototype._updateTranslucency = function (bool) {
            this.viewer.scene.globe.translucency.frontFaceAlphaByDistance =
                new Cesium.NearFarScalar(1.5e2, 0.5, 8.0e6, 1.0);
            this.viewer.scene.globe.translucency.enabled = bool; //是否开启透明
            this._updateAlpha(this._alpha);
        };
        return Terrain;
    }());

    var ReminderTip = /** @class */ (function () {
        /**
         * 鼠标提示弹窗tip
         * @param {Viewer} viewer 地图场景
         * @param {string} [id="sdk-reminder-tip"] 元素对象id
         */
        function ReminderTip(viewer, id) {
            if (id === void 0) { id = "sdk-reminder-tip"; }
            this.viewer = viewer;
            this.id = id;
            this._viewEl =
                this.viewer.container.getElementsByClassName("cesium-viewer")[0];
            this._message = "";
            this._isShow = false;
            // 绑定事件处理函数，确保在移除时是同一个引用
            this._tipEvent = this._handleMouseMove.bind(this);
            var domObj = document.getElementById(this.id);
            this._tipEl = domObj || this.initTipEl(this.id);
        }
        Object.defineProperty(ReminderTip.prototype, "show", {
            /**
             * 是否显示提示框
             * @type {boolean}
             */
            get: function () {
                return this._isShow;
            },
            set: function (bool) {
                bool ? this.showTip() : this.hideTip();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ReminderTip.prototype, "message", {
            /**
             * 提示内容
             * @type {string}
             */
            get: function () {
                return this._message;
            },
            set: function (str) {
                this._message = str;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * 初始化元素
         * @param id
         * @returns
         */
        ReminderTip.prototype.initTipEl = function (id) {
            var elementbottom = document.createElement("div");
            this._viewEl.append(elementbottom);
            var html = "<div id=\"".concat(id, "\" style=\"display: none;pointer-events: none;position: absolute;z-index: 1000;opacity: 0.8;border-radius: 4px;padding: 4px 8px;white-space: nowrap;font-family:\u9ED1\u4F53;color:white;font-weight: bolder;font-size: 14px;background: #000000cc;color: white\"></div>");
            this._viewEl.insertAdjacentHTML("beforeend", html);
            var domEl = document.getElementById(id);
            return domEl;
        };
        /**
         * 显示提示框
         */
        ReminderTip.prototype.showTip = function () {
            this._isShow = true;
            this._viewEl.addEventListener("mousemove", this._tipEvent);
        };
        /**
         * 清除提示框
         */
        ReminderTip.prototype.hideTip = function () {
            this._isShow = false;
            this._tipEvent &&
                this._viewEl.removeEventListener("mousemove", this._tipEvent);
            this._createTip({ x: 0, y: 0 }, false);
            this._message = "";
        };
        /**
         * 鼠标移动事件处理
         */
        ReminderTip.prototype._handleMouseMove = function (e) {
            this._createTip({ x: e.clientX, y: e.clientY }, true);
        };
        /**
         * 创建提示
         * @param position
         * @param show
         */
        ReminderTip.prototype._createTip = function (position, show) {
            this._tipEl.innerHTML = this._message;
            this._tipEl.style.left = position.x + 15 + "px";
            this._tipEl.style.top = position.y + 20 + "px";
            this._tipEl.style.display = show ? "block" : "none";
        };
        return ReminderTip;
    }());

    var defaultOptions = {
        pColor: "#ff0000",
        pOutlineColor: "#ffff00",
        onGround: true,
        allowPick: true,
        pixelSize: 10,
        outlineWidth: 1,
        id: "default_point_id",
        featureAttribute: {},
    };
    var PointGraphic = /** @class */ (function (_super) {
        __extends(PointGraphic, _super);
        function PointGraphic(options) {
            if (options === void 0) { options = {}; }
            var _this = this;
            // Process custom options before passing to parent
            var processedOptions = PointGraphic.processOptions(options);
            _this = _super.call(this, processedOptions) || this;
            _this.options = processedOptions;
            return _this;
        }
        PointGraphic.processOptions = function (options) {
            var finalOptions = Object.assign({}, defaultOptions, options);
            // Convert color strings to Cesium.Color objects
            if (finalOptions.pColor && typeof finalOptions.pColor === "string") {
                finalOptions.color = Cesium.Color.fromCssColorString(finalOptions.pColor);
            }
            if (finalOptions.pOutlineColor &&
                typeof finalOptions.pOutlineColor === "string") {
                finalOptions.outlineColor = Cesium.Color.fromCssColorString(finalOptions.pOutlineColor);
            }
            // Set height reference based on onGround option
            if (finalOptions.onGround) {
                finalOptions.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
            }
            return finalOptions;
        };
        /**
         * Create a Cesium Entity with this point graphic
         * @param position The position of the point
         * @param properties Additional properties for the entity
         * @returns Cesium Entity
         */
        PointGraphic.prototype.createEntity = function (position, properties) {
            var entity = new Cesium.Entity({
                position: position,
                point: this,
                properties: properties || this.options.featureAttribute,
                id: this.options.id,
            });
            return entity;
        };
        /**
         * Create a PointPrimitive using PointPrimitiveCollection
         * @param position The position of the point
         * @param collection Optional collection to add the primitive to
         * @returns PointPrimitive
         */
        PointGraphic.prototype.createPointPrimitive = function (position, collection) {
            var _a, _b, _c, _d, _e, _f, _g;
            var pointPrimitive = {
                position: position,
                pixelSize: ((_a = this.pixelSize) === null || _a === void 0 ? void 0 : _a.getValue()) || this.options.pixelSize,
                color: ((_b = this.color) === null || _b === void 0 ? void 0 : _b.getValue()) || Cesium.Color.RED,
                outlineColor: ((_c = this.outlineColor) === null || _c === void 0 ? void 0 : _c.getValue()) || Cesium.Color.YELLOW,
                outlineWidth: ((_d = this.outlineWidth) === null || _d === void 0 ? void 0 : _d.getValue()) || this.options.outlineWidth,
                heightReference: this.options.onGround
                    ? Cesium.HeightReference.CLAMP_TO_GROUND
                    : Cesium.HeightReference.NONE,
                disableDepthTestDistance: ((_e = this.disableDepthTestDistance) === null || _e === void 0 ? void 0 : _e.getValue()) ||
                    this.options.disableDepthTestDistance,
                scaleByDistance: ((_f = this.scaleByDistance) === null || _f === void 0 ? void 0 : _f.getValue()) || this.options.scaleByDistance,
                pixelOffsetScaleByDistance: this.options.pixelOffsetScaleByDistance,
                show: ((_g = this.show) === null || _g === void 0 ? void 0 : _g.getValue()) || true,
                id: this.options.id,
            };
            if (collection) {
                return collection.add(pointPrimitive);
            }
            // If no collection provided, return the primitive configuration
            // In a real implementation, you would typically add to a collection
            return pointPrimitive;
        };
        return PointGraphic;
    }(Cesium.PointGraphics));

    /**
     * 生成唯一id
     * @returns 例：936e0deb-c208-4098-9959-327e519e63e2
     */
    function randomId() {
        var tempUrl = URL.createObjectURL(new Blob());
        var uuid = tempUrl.toString();
        URL.revokeObjectURL(tempUrl);
        return uuid.substring(uuid.lastIndexOf("/") + 1);
    }
    /**
     * 安全执行回调
     */
    function safeCallback(callback, data) {
        if (callback && typeof callback === "function") {
            var result = callback(data);
            return result !== undefined ? result : data;
        }
        return data;
    }

    var Add = /** @class */ (function () {
        /**
         * 图层-添加对象类
         * @param  {Viewer} viewer 地图场景对象
         */
        function Add(viewer) {
            this.viewer = viewer;
        }
        /**
         * 添加点-Entity形式
         * @method
         * @param {Cartesian3[]} positions 点位置数组，笛卡尔坐标
         * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
         * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
         * @returns {Cesium.Entity[]} 点对象数组，Entity类对象
         */
        Add.prototype.addPointsAsEntities = function (positions, option, callback) {
            var entities = [];
            // Check if option is an array or single object
            var isOptionArray = Array.isArray(option);
            for (var i = 0; i < positions.length; i++) {
                // Get the option for this specific point
                var currentOption = isOptionArray
                    ? __assign(__assign({}, option[i]), { id: option[i].id || randomId() }) : __assign(__assign({}, option), { id: option.ids ? option.ids[i] : randomId() });
                var pointGraphic = new PointGraphic(currentOption);
                var entity = pointGraphic.createEntity(positions[i]);
                this.viewer.entities.add(entity);
                entities.push(entity);
            }
            // If callback is provided, allow user to modify the entities
            if (callback) {
                return safeCallback(callback, entities);
            }
            return entities;
        };
        /**
         * 添加点-Primitive形式
         * @method
         * @param {Cartesian3[]} positions 点位置，笛卡尔坐标
         * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
         * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
         * @returns {Cesium.PointPrimitive[]} 点对象，PointPrimitive类对象，参照Cesium
         */
        Add.prototype.addPointsAsPrimitives = function (positions, option, callback) {
            var primitives = [];
            // Check if option is an array or single object
            var isOptionArray = Array.isArray(option);
            // Create a point primitive collection to hold all points
            var pointCollection = this.viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
            for (var i = 0; i < positions.length; i++) {
                // Get the option for this specific point
                var currentOption = isOptionArray
                    ? __assign(__assign({}, option[i]), { id: option[i].id || randomId() }) : __assign(__assign({}, option), { id: option.ids ? option.ids[i] : randomId() });
                var pointGraphic = new PointGraphic(currentOption);
                var primitive = pointGraphic.createPointPrimitive(positions[i], pointCollection);
                primitives.push(primitive);
            }
            // If callback is provided, allow user to modify the primitives
            if (callback) {
                return safeCallback(callback, primitives);
            }
            return primitives;
        };
        /**
         * 添加点-支持Entity和Primitive两种形式
         * @method
         * @param {Cartesian3[]} positions 点位置数组，笛卡尔坐标
         * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
         * @param {boolean} usePrimitive 是否使用Primitive方式，默认为false（使用Entity方式）
         * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
         * @returns {any} 包含entities或primitives的对象
         */
        Add.prototype.addPoints = function (positions, option, usePrimitive, callback) {
            if (option === void 0) { option = {}; }
            if (usePrimitive === void 0) { usePrimitive = false; }
            if (usePrimitive) {
                var primitives = this.addPointsAsPrimitives(positions, option, callback);
                return primitives;
            }
            else {
                var entities = this.addPointsAsEntities(positions, option, callback);
                return entities;
            }
        };
        return Add;
    }());

    var Layers = /** @class */ (function () {
        /**
         * 图层管理类
         * @param {Viewer} viewer
         */
        function Layers(viewer) {
            this.viewer = viewer;
            /**
             * 添加图层
             */
            this.Add = new Add(this.viewer);
        }
        return Layers;
    }());

    /**
     * 设置 Cesium 应用的默认相机视图矩形。
     * 这定义了相机重置时显示的默认地理范围。
     */
    Cesium__namespace.Camera.DEFAULT_VIEW_RECTANGLE = new Cesium__namespace.Rectangle(Cesium__namespace.Math.toRadians(70), Cesium__namespace.Math.toRadians(-15), Cesium__namespace.Math.toRadians(140), Cesium__namespace.Math.toRadians(80));
    /**
     * 为 WebGIS 应用预配置设置的增强型 Cesium Viewer。
     * 此类扩展了标准 Cesium Viewer，具有针对 3D 地理空间可视化优化的默认设置。
     *
     * @class Viewer
     * @extends Cesium.Viewer
     * @example
     * ```typescript
     * import { Viewer } from "arc3dlab";
     * const viewer = new Viewer("containerId");
     * ```
     */
    var Viewer = /** @class */ (function (_super) {
        __extends(Viewer, _super);
        /**
         * 创建具有优化默认设置的 Viewer 实例
         *
         * @param container - 将创建查看器的 DOM 元素或 ID
         * @param options - 可选的配置选项
         */
        function Viewer(container, options) {
            //设置初始化默认参数
            var _this = _super.call(this, container, __assign({ 
                //是否创建动画小器件，左下角仪表
                animation: false, 
                //是否显示全屏按钮
                fullscreenButton: false, 
                //放大镜图标，查找位置工具，查找到之后会将镜头对准找到的地址，默认使用bing地图
                geocoder: false, 
                //房子图标，是否显示Home按钮，视角返回初始位置
                homeButton: false, 
                //是否显示信息框
                infoBox: false, 
                //经纬网图标，选择视角的模式，有三种：3D，2D，哥伦布视图（2.5D)，是否显示3D/2D选择器
                sceneModePicker: false, 
                //是否显示时间轴
                timeline: false, 
                //设定3维地图的默认场景模式:Cesium.SceneMode.SCENE2D、Cesium.SceneMode.SCENE3D、Cesium.SceneMode.MORPHING
                sceneMode: Cesium__namespace.SceneMode.SCENE3D, 
                //如果设置为true，则所有几何图形以3D模式绘制以节约GPU资源
                scene3DOnly: true, 
                //是否显示图层选择器，可选择要显示的地图服务和地形服务
                baseLayerPicker: false, 
                //问号图标，右上角导航帮助按钮，显示默认的地图控制帮助
                navigationHelpButton: false, 
                //虚拟现实
                vrButton: false, 
                //是否显示选取指示器组件[绿框]
                selectionIndicator: false, 
                //设置背景透明,涉及透贴显示
                orderIndependentTranslucency: true, 
                //开启时间动画
                shouldAnimate: true, 
                //关闭默认底图以支持离线使用
                baseLayer: BaseLayer.DefaultSingleImg, contextOptions: {
                    webgl: {
                        preserveDrawingBuffer: false, //保留绘图缓冲区：通过canvas截图需要将该项设置为true
                        failIfMajorPerformanceCaveat: true, //防止在性能不佳的设备上运行
                        antialias: true, //抗锯齿,
                        alpha: true, //透明度支持
                        powerPreference: "high-performance", //cpu偏好：优先使用高性能cpu,
                    },
                    requestWebgl1: false,
                }, shadows: false }, options)) || this;
            _this.options = options;
            /**
             * Cesium事件发射器实例
             * @type {EventEmitter}
             */
            _this.EventHandler = new EventEmitter(_this);
            /**
             * 地形主类，地形相关方法
             * @type {Terrain}
             */
            _this.Terrain = new Terrain(_this);
            /**
             * 鼠标提示主类
             * @type {ReminderTip}
             */
            _this.ReminderTip = new ReminderTip(_this);
            /**
             * 图层管理类
             * @type {Layers}
             */
            _this.Layers = new Layers(_this);
            _this.initBaseConfig();
            console.log("Viewer initialized 20260108");
            return _this;
        }
        //常见基础设置
        Viewer.prototype.initBaseConfig = function () {
            var _a, _b, _c;
            // Cesium Icon资源key
            Cesium__namespace.Ion.defaultAccessToken = ((_a = this.options) === null || _a === void 0 ? void 0 : _a.defaultKey) || CesiumIcon;
            //默认打开深度检测，那么在地形以下的对象不可见
            this.scene.globe.depthTestAgainstTerrain = true;
            // 1.0代表真实时间速率，大于1则加速，小于1则减速
            this.clock.multiplier = 1;
            //禁止相机进入地下 false允许，true禁止
            this.scene.screenSpaceCameraController.enableCollisionDetection = true;
            this.cesiumWidget.creditContainer.style.display = "none";
            this.resolutionScale = window.devicePixelRatio; //高分辨率设备适配
            // Mapbox控制模式
            if ((_b = this.options) === null || _b === void 0 ? void 0 : _b.mapboxController) {
                // 设置中键用于缩放
                this.scene.screenSpaceCameraController.zoomEventTypes = [
                    Cesium__namespace.CameraEventType.WHEEL, // 保留滚轮缩放
                    Cesium__namespace.CameraEventType.MIDDLE_DRAG, // 添加中键拖动缩放
                    Cesium__namespace.CameraEventType.PINCH, // 保留多点触控缩放
                ];
                //设置右键旋转
                this.scene.screenSpaceCameraController.tiltEventTypes = [
                    Cesium__namespace.CameraEventType.RIGHT_DRAG,
                    Cesium__namespace.CameraEventType.PINCH,
                    {
                        eventType: Cesium__namespace.CameraEventType.RIGHT_DRAG,
                        modifier: Cesium__namespace.KeyboardEventModifier.CTRL,
                    },
                    {
                        eventType: Cesium__namespace.CameraEventType.MIDDLE_DRAG,
                        modifier: Cesium__namespace.KeyboardEventModifier.CTRL,
                    },
                ];
            }
            // 显示帧率
            this.scene.debugShowFramesPerSecond = ((_c = this.options) === null || _c === void 0 ? void 0 : _c.fpsShow) || false;
        };
        Object.defineProperty(Viewer.prototype, "fps", {
            /**
             * 控制帧率显示
             * @type {Boolean}
             */
            get: function () {
                return this.scene.debugShowFramesPerSecond;
            },
            set: function (show) {
                this.scene.debugShowFramesPerSecond = show; // 显示帧率
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Viewer.prototype, "lightShadow", {
            /**
             * 地球光源阴影
             * @type {Boolean}
             */
            set: function (bool) {
                this.scene.globe.enableLighting = bool;
                this.shadows = bool;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Viewer.prototype, "size", {
            /**
             * 地图画布大小，例如：{width:1920,height:1080}
             * @type {Object}
             * @readonly
             */
            get: function () {
                return mapSize(this);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Viewer.prototype, "image", {
            /**
             * 当前地图场景图片，base64格式
             * @type {String}
             * @readonly
             */
            get: function () {
                return mapImg(this);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Viewer.prototype, "baseImagery", {
            /**
             * 场景底图
             * Cesium机制是最底层的图层为_isBaseLayer，通过lowerToBottom来控制
             * @type {Cesium.ImageryLayer} imagery 参考Cesium的ImageryLayer
             */
            get: function () {
                //@ts-ignore
                var layers = this.imageryLayers._layers;
                var baseLayer = layers.find(function (layer) { return layer._isBaseLayer; });
                return baseLayer;
            },
            set: function (imagery) {
                //@ts-ignore
                var baseLayer = this.imageryLayers._layers.find(function (layer) { return layer._isBaseLayer; });
                baseLayer && this.imageryLayers.remove(baseLayer);
                this.imageryLayers.lowerToBottom(imagery);
            },
            enumerable: false,
            configurable: true
        });
        return Viewer;
    }(Cesium__namespace.Viewer));

    Object.defineProperty(exports, 'Cartesian2', {
        enumerable: true,
        get: function () { return Cesium.Cartesian2; }
    });
    Object.defineProperty(exports, 'Cartesian3', {
        enumerable: true,
        get: function () { return Cesium.Cartesian3; }
    });
    Object.defineProperty(exports, 'Color', {
        enumerable: true,
        get: function () { return Cesium.Color; }
    });
    Object.defineProperty(exports, 'Math', {
        enumerable: true,
        get: function () { return Cesium.Math; }
    });
    exports.BaseLayer = BaseLayer;
    exports.Viewer = Viewer;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=arc3dlab.umd.js.map
