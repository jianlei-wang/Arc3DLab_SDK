/**
 * @fileoverview 基元管理器，负责管理Cesium中的基元对象
 */

import { Viewer } from "src/core/Viewer";

/**
 * 基元管理器类
 * 用于管理Cesium中的基元对象，包括添加、获取、删除等操作
 */
class PrimitiveManager {
    primitives: Map<any, any>;
    
    /**
     * 构造函数
     * @param {Viewer} viewer Cesium视图对象
     */
    constructor(private viewer: Viewer) {
        this.primitives = new Map();
    }

    /**
     * 添加基元
     * @param {string} id 基元唯一标识符
     * @param {any} primitive 要添加的基元对象
     * @returns {any} 添加后的基元对象
     */
    add(id: string, primitive: any) {
        if (this.primitives.has(id)) {
            this.remove(id);
        }
        primitive = this.viewer.scene.primitives.add(primitive);
        this.primitives.set(id, primitive);
        return primitive;
    }

    /**
     * 获取基元
     * @param {string} id 基元唯一标识符
     * @returns {any} 对应的基元对象，如果不存在则返回undefined
     */
    get(id: string) {
        return this.primitives.get(id);
    }

    /**
     * 删除基元
     * @param {string} id 基元唯一标识符
     * @returns {boolean} 删除成功返回true，否则返回false
     */
    remove(id: string) {
        const primitive = this.primitives.get(id);
        if (primitive) {
            this.viewer.scene.primitives.remove(primitive);
            this.primitives.delete(id);
            return true;
        }
        return false;
    }

    /**
     * 设置基元显示状态
     * @param {string} id 基元唯一标识符
     * @param {boolean} visible 显示状态，true为显示，false为隐藏
     */
    show(id: string, visible: boolean) {
        const primitive = this.primitives.get(id);
        if (primitive) {
            primitive.show = visible;
        }
    }

    /**
     * 清空所有基元
     */
    clear() {
        this.primitives.forEach((primitive, id) => {
            this.viewer.scene.primitives.remove(primitive);
        });
        this.primitives.clear();
    }

    /**
     * 获取所有基元的ID列表
     * @returns {string[]} 所有基元的ID数组
     */
    getIds() {
        return Array.from(this.primitives.keys());
    }
}

export default PrimitiveManager;