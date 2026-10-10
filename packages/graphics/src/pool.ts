import type { LngLatHeight, PositionInput } from "@arc3dlab/core"
import { parsePosition } from "@arc3dlab/core"

/**
 * 坐标缓冲区对象池接口，用于复用经纬高数组以减少内存分配。
 */
export interface PositionPool {
  /**
   * 从池中获取一个指定长度的坐标缓冲区。
   * @param size - 需要的坐标数量。
   * @returns 可复用的经纬高数组。
   */
  acquire(size: number): LngLatHeight[]
  /**
   * 将坐标缓冲区归还到池中。
   * @param buffer - 待归还的缓冲区。
   */
  release(buffer: LngLatHeight[]): void
  /**
   * 查询池中当前可用的缓冲区数量。
   * @returns 空闲缓冲区数量。
   */
  available(): number
}

/**
 * 创建一个坐标缓冲区对象池。
 * @param maxBuffers - 池中最多缓存的缓冲区数量。
 * @returns 坐标缓冲区对象池实例。
 */
export function createPositionPool(maxBuffers = 8): PositionPool {
  const free: LngLatHeight[][] = []
  return {
    acquire(size: number) {
      const buffer = free.pop() ?? []
      buffer.length = size
      return buffer
    },
    release(buffer: LngLatHeight[]) {
      buffer.length = 0
      if (free.length < maxBuffers) free.push(buffer)
    },
    available() {
      return free.length
    },
  }
}

/**
 * 坐标差异补丁，描述需要整体替换还是局部修补的坐标变化。
 */
export interface PositionPatch {
  /** 更新模式，replace 表示整体替换，patch 表示局部修补。 */
  mode: "replace" | "patch"
  /** 需要更新的坐标索引与目标坐标。 */
  changes: Array<{ index: number; position: LngLatHeight }>
}

function samePoint(left: LngLatHeight, right: LngLatHeight): boolean {
  return (
    left.longitude === right.longitude &&
    left.latitude === right.latitude &&
    left.height === right.height
  )
}

/**
 * 比较旧坐标与新坐标，生成最合适的更新补丁。
 * @param previous - 原有的经纬高坐标数组。
 * @param next - 新的坐标输入数组。
 * @returns 描述坐标变化的更新补丁。
 */
export function diffPositions(
  previous: LngLatHeight[],
  next: PositionInput[],
): PositionPatch {
  const parsed = next.map((item) => parsePosition(item))
  if (previous.length !== parsed.length) {
    return {
      mode: "replace",
      changes: parsed.map((position, index) => ({ index, position })),
    }
  }
  const changes: PositionPatch["changes"] = []
  for (let index = 0; index < parsed.length; index += 1) {
    if (!samePoint(previous[index], parsed[index])) {
      changes.push({ index, position: parsed[index] })
    }
  }
  if (changes.length > parsed.length / 2) {
    return { mode: "replace", changes }
  }
  return { mode: "patch", changes }
}

/**
 * 批量把坐标更新应用到可获取的图形上。
 * @param get - 根据 ID 获取图形的方法。
 * @param updates - 包含 ID 与新坐标的更新列表。
 * @returns 成功更新的图形数量。
 */
export function applyPositionUpdates(
  get: (
    id: string,
  ) =>
    | { setPositions: (positions: PositionInput | PositionInput[]) => void }
    | undefined,
  updates: Array<{ id: string; positions: PositionInput | PositionInput[] }>,
): number {
  let updated = 0
  for (const update of updates) {
    const graphic = get(update.id)
    if (!graphic) continue
    graphic.setPositions(update.positions)
    updated += 1
  }
  return updated
}
