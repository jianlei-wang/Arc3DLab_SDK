/**
 * 态势标绘的纯几何算法集合。
 *
 * 本模块从旧版 SDK 的 `third-party/{PlotUtil,PlotCommon,Algorithm}` 移植而来，
 * 全部以经纬度点 `[经度, 纬度]` 为输入输出，不依赖 Cesium 运行时，便于单元测试。
 */

/** 标绘算法使用的经纬度元组，`[经度, 纬度]`。 */
export type PlotPoint = [number, number]

/** 圆周常量。 */
const TWO_PI = 2 * Math.PI

/** 半圆周常量。 */
const HALF_PI = Math.PI / 2

/** 曲线拟合与圆弧采样的细分段数。 */
const FITTING_COUNT = 100

/** 判定近似相等的容差。 */
const ZERO_TOLERANCE = 1e-4

/** 角度转弧度系数。 */
const DEG2RAD = Math.PI / 180

/** 弧度转角度系数。 */
const RAD2DEG = 180 / Math.PI

/** 地球长半轴，单位米。 */
const EARTH_RADIUS = 6378137

/** 每纬度对应的米数近似值。 */
const METERS_PER_DEGREE = 111320

/**
 * 计算两点之间的平面欧氏距离（以度为单位）。
 *
 * @param a - 起点经纬度。
 * @param b - 终点经纬度。
 * @returns 两点间的平面距离。
 */
export function distance(a: PlotPoint, b: PlotPoint): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

/**
 * 计算折线的累计平面长度。
 *
 * @param points - 折线顶点集合。
 * @returns 累加距离。
 */
export function wholeDistance(points: PlotPoint[]): number {
  let total = 0
  for (let index = 0; index < points.length - 1; index++) {
    total += distance(points[index], points[index + 1])
  }
  return total
}

/**
 * 计算折线基准长度，采用 0.99 次幂压缩。
 *
 * @param points - 折线顶点集合。
 * @returns 基准长度。
 */
export function getBaseLength(points: PlotPoint[]): number {
  return wholeDistance(points) ** 0.99
}

/**
 * 计算两点中点。
 *
 * @param a - 起点经纬度。
 * @param b - 终点经纬度。
 * @returns 中点经纬度。
 */
export function midPoint(a: PlotPoint, b: PlotPoint): PlotPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

/**
 * 计算由起点指向终点的方位角（弧度）。
 *
 * @param a - 起点经纬度。
 * @param b - 终点经纬度。
 * @returns 方位角，取值区间为 [0, 2π)。
 */
export function getAzimuth(a: PlotPoint, b: PlotPoint): number {
  const radius = Math.asin(Math.abs(b[1] - a[1]) / distance(a, b))
  if (b[1] >= a[1] && b[0] >= a[0]) return radius + Math.PI
  if (b[1] >= a[1] && b[0] < a[0]) return TWO_PI - radius
  if (b[1] < a[1] && b[0] < a[0]) return radius
  return Math.PI - radius
}

/**
 * 计算以中间点为顶点、由三个点构成的夹角。
 *
 * @param a - 第一条边的端点。
 * @param b - 夹角顶点。
 * @param c - 第二条边的端点。
 * @returns 夹角，取值区间为 [0, 2π)。
 */
export function getAngleOfThreePoints(
  a: PlotPoint,
  b: PlotPoint,
  c: PlotPoint,
): number {
  const angle = getAzimuth(b, a) - getAzimuth(b, c)
  return angle < 0 ? angle + TWO_PI : angle
}

/**
 * 判断三点是否呈顺时针排列。
 *
 * @param a - 第一个点。
 * @param b - 第二个点。
 * @param c - 第三个点。
 * @returns 顺时针排列时返回 true。
 */
export function isClockWise(a: PlotPoint, b: PlotPoint, c: PlotPoint): boolean {
  return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
}

/**
 * 在两点连线上按比例取点。
 *
 * @param t - 比例系数，0 返回起点，1 返回终点。
 * @param a - 起点经纬度。
 * @param b - 终点经纬度。
 * @returns 插值点经纬度。
 */
export function getPointOnLine(
  t: number,
  a: PlotPoint,
  b: PlotPoint,
): PlotPoint {
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
}

/**
 * 计算三阶贝塞尔曲线在参数 t 处的点。
 *
 * @param t - 曲线参数，内部会截断到 [0, 1]。
 * @param p1 - 起点。
 * @param c1 - 第一个控制点。
 * @param c2 - 第二个控制点。
 * @param p2 - 终点。
 * @returns 曲线上的点。
 */
export function getCubicValue(
  t: number,
  p1: PlotPoint,
  c1: PlotPoint,
  c2: PlotPoint,
  p2: PlotPoint,
): PlotPoint {
  const tt = Math.max(Math.min(t, 1), 0)
  const g = 1 - tt
  const i = tt * tt
  const s = i * tt
  const a = g * g
  const l = a * g
  return [
    l * p1[0] + 3 * a * tt * c1[0] + 3 * g * i * c2[0] + s * p2[0],
    l * p1[1] + 3 * a * tt * c1[1] + 3 * g * i * c2[1] + s * p2[1],
  ]
}

/**
 * 由基点沿指定角度与距离推求第三点。
 *
 * @param a - 方向参考起点。
 * @param b - 基点，结果相对该点偏移。
 * @param angle - 相对方位角的偏转角，单位弧度。
 * @param length - 偏移距离。
 * @param clockwise - 是否沿顺时针偏转。
 * @returns 计算得到的点。
 */
export function getThirdPoint(
  a: PlotPoint,
  b: PlotPoint,
  angle: number,
  length: number,
  clockwise: boolean,
): PlotPoint {
  const azimuth = getAzimuth(a, b)
  const theta = clockwise ? azimuth + angle : azimuth - angle
  return [b[0] + length * Math.cos(theta), b[1] + length * Math.sin(theta)]
}

/**
 * 计算阶乘。
 *
 * @param n - 非负整数。
 * @returns n 的阶乘。
 */
export function getFactorial(n: number): number {
  if (n <= 1) return 1
  if (n === 2) return 2
  if (n === 3) return 6
  if (n === 4) return 24
  if (n === 5) return 120
  let result = 1
  for (let index = 1; index <= n; index++) result *= index
  return result
}

/**
 * 计算二项式系数。
 *
 * @param n - 阶数。
 * @param index - 项索引。
 * @returns 二项式系数 C(n, index)。
 */
export function getBinomialFactor(n: number, index: number): number {
  return getFactorial(n) / (getFactorial(index) * getFactorial(n - index))
}

/**
 * 计算伯恩斯坦基函数形式的贝塞尔曲线点集。
 *
 * @param points - 控制点集合，至少包含两个点方可产生曲线。
 * @returns 采样得到的曲线点集合。
 */
export function getBezierPoints(points: PlotPoint[]): PlotPoint[] {
  if (points.length <= 2) return points.slice()
  const result: PlotPoint[] = []
  const n = points.length - 1
  for (let t = 0; t <= 1; t += 0.01) {
    let x = 0
    let y = 0
    for (let index = 0; index <= n; index++) {
      const factor = getBinomialFactor(n, index)
      const a = t ** index
      const b = (1 - t) ** (n - index)
      x += factor * a * b * points[index][0]
      y += factor * a * b * points[index][1]
    }
    result.push([x, y])
  }
  result.push(points[n])
  return result
}

/**
 * 计算二次 B 样条曲线点集。
 *
 * @param points - 控制点集合。
 * @returns 采样得到的曲线点集合。
 */
export function getQBSplinePoints(points: PlotPoint[]): PlotPoint[] {
  if (points.length <= 2) return points.slice()
  const order = 2
  const result: PlotPoint[] = [points[0]]
  const limit = points.length - order - 1
  for (let n = 0; n <= limit; n++) {
    for (let t = 0; t <= 1; t += 0.05) {
      let x = 0
      let y = 0
      for (let s = 0; s <= order; s++) {
        const factor =
          s === 0
            ? (t - 1) ** 2 / 2
            : s === 1
              ? (-2 * t * t + 2 * t + 1) / 2
              : s === 2
                ? (t * t) / 2
                : 0
        x += factor * points[n + s][0]
        y += factor * points[n + s][1]
      }
      result.push([x, y])
    }
  }
  result.push(points[points.length - 1])
  return result
}

/**
 * 计算两点连线的法向量（未归一化）。
 *
 * @param a - 前一个点。
 * @param b - 中间点。
 * @param c - 后一个点。
 * @returns 归一化之前的角平分法向量。
 */
function getNormal(a: PlotPoint, b: PlotPoint, c: PlotPoint): [number, number] {
  let r = a[0] - b[0]
  let n = a[1] - b[1]
  const g = Math.sqrt(r * r + n * n)
  r /= g
  n /= g
  let i = c[0] - b[0]
  let s = c[1] - b[1]
  const length = Math.sqrt(i * i + s * s)
  i /= length
  s /= length
  return [r + i, n + s]
}

/**
 * 计算中间点两侧的角平分控制点。
 *
 * @param t - 张力系数。
 * @param a - 前一个点。
 * @param b - 中间点。
 * @param c - 后一个点。
 * @returns 左右两个控制点。
 */
function getBisectorNormals(
  t: number,
  a: PlotPoint,
  b: PlotPoint,
  c: PlotPoint,
): [PlotPoint, PlotPoint] {
  const normal = getNormal(a, b, c)
  const magnitude = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])
  const i = normal[0] / magnitude
  const s = normal[1] / magnitude
  const da = distance(a, b)
  const dc = distance(b, c)
  let left: PlotPoint
  let right: PlotPoint
  if (magnitude > ZERO_TOLERANCE) {
    if (isClockWise(a, b, c)) {
      left = [b[0] - t * da * s, b[1] + t * da * i]
      right = [b[0] + t * dc * s, b[1] - t * dc * i]
    } else {
      left = [b[0] + t * da * s, b[1] - t * da * i]
      right = [b[0] - t * dc * s, b[1] + t * dc * i]
    }
  } else {
    left = [b[0] + t * (a[0] - b[0]), b[1] + t * (a[1] - b[1])]
    right = [b[0] + t * (c[0] - b[0]), b[1] + t * (c[1] - b[1])]
  }
  return [left, right]
}

/**
 * 计算曲线起点侧的控制点。
 *
 * @param points - 控制点集合，至少包含三个点。
 * @returns 起点侧控制点。
 */
function getLeftMostControlPoint(points: PlotPoint[]): PlotPoint {
  const a = points[0]
  const b = points[1]
  const c = points[2]
  const normals = getBisectorNormals(0, a, b, c)
  const i = normals[0]
  const normal = getNormal(a, b, c)
  const magnitude = Math.sqrt(normal[0] ** 2 + normal[1] ** 2)
  let x = a[0]
  let y = a[1]
  if (magnitude > ZERO_TOLERANCE) {
    const mid = midPoint(a, b)
    const u = a[0] - mid[0]
    const v = a[1] - mid[1]
    const p = distance(a, b)
    const h = 2 / p
    const d = -h * v
    const f = h * u
    const e = d * d - f * f
    const vv = 2 * d * f
    const aa = f * f - d * d
    const dx = i[0] - mid[0]
    const dy = i[1] - mid[1]
    x = mid[0] + e * dx + vv * dy
    y = mid[1] + vv * dx + aa * dy
  }
  return [x, y]
}

/**
 * 计算曲线终点侧的控制点。
 *
 * @param points - 控制点集合，至少包含三个点。
 * @returns 终点侧控制点。
 */
function getRightMostControlPoint(points: PlotPoint[]): PlotPoint {
  const count = points.length
  const a = points[count - 3]
  const b = points[count - 2]
  const c = points[count - 1]
  const normals = getBisectorNormals(0, a, b, c)
  const s = normals[1]
  const normal = getNormal(a, b, c)
  const magnitude = Math.sqrt(normal[0] ** 2 + normal[1] ** 2)
  let x = c[0]
  let y = c[1]
  if (magnitude > ZERO_TOLERANCE) {
    const mid = midPoint(b, c)
    const u = c[0] - mid[0]
    const v = c[1] - mid[1]
    const h = distance(b, c)
    const d = 2 / h
    const f = -d * v
    const e = d * u
    const vv = f * f - e * e
    const aa = 2 * f * e
    const bb = e * e - f * f
    const dx = s[0] - mid[0]
    const dy = s[1] - mid[1]
    x = mid[0] + vv * dx + aa * dy
    y = mid[1] + aa * dx + bb * dy
  }
  return [x, y]
}

/**
 * 计算自然三次曲线经过给定点的平滑点集。
 *
 * @param points - 曲线经过的控制点集合，至少包含三个点。
 * @returns 平滑后的点集合。
 */
export function getCurvePoints(points: PlotPoint[]): PlotPoint[] {
  if (points.length < 3) return points.slice()
  let controls: PlotPoint[] = [getLeftMostControlPoint(points)]
  for (let n = 0; n < points.length - 2; n++) {
    controls = controls.concat(
      getBisectorNormals(0, points[n], points[n + 1], points[n + 2]),
    )
  }
  controls.push(getRightMostControlPoint(points))
  const result: PlotPoint[] = []
  for (let n = 0; n < points.length - 1; n++) {
    result.push(points[n])
    for (let t = 0; t < FITTING_COUNT; t++) {
      result.push(
        getCubicValue(
          t / FITTING_COUNT,
          points[n],
          controls[2 * n],
          controls[2 * n + 1],
          points[n + 1],
        ),
      )
    }
    result.push(points[n + 1])
  }
  return result
}

/**
 * 计算两点连线的交点。
 *
 * @param a - 第一条线的方向点一。
 * @param b - 第一条线的方向点二，直线经过 a、b。
 * @param c - 第二条线的方向点一。
 * @param d - 第二条线的方向点二，直线经过 c、d。
 * @returns 两直线的交点。
 */
export function getIntersectPoint(
  a: PlotPoint,
  b: PlotPoint,
  c: PlotPoint,
  d: PlotPoint,
): PlotPoint {
  if (a[1] === b[1]) {
    const n = (d[0] - c[0]) / (d[1] - c[1])
    return [n * (a[1] - c[1]) + c[0], a[1]]
  }
  if (c[1] === d[1]) {
    const s = (b[0] - a[0]) / (b[1] - a[1])
    return [s * (c[1] - a[1]) + a[0], c[1]]
  }
  const s = (b[0] - a[0]) / (b[1] - a[1])
  const n = (d[0] - c[0]) / (d[1] - c[1])
  const y = (s * a[1] - a[0] - n * c[1] + c[0]) / (s - n)
  const x = s * y - s * a[1] + a[0]
  return [x, y]
}

/**
 * 计算三点确定的外接圆圆心。
 *
 * @param a - 第一个点。
 * @param b - 第二个点。
 * @param c - 第三个点。
 * @returns 外接圆圆心。
 */
export function getCircleCenterOfThreePoints(
  a: PlotPoint,
  b: PlotPoint,
  c: PlotPoint,
): PlotPoint {
  const r: PlotPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const n: PlotPoint = [r[0] - a[1] + b[1], r[1] + a[0] - b[0]]
  const g: PlotPoint = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]
  const i: PlotPoint = [g[0] - a[1] + c[1], g[1] + a[0] - c[0]]
  return getIntersectPoint(r, n, g, i)
}

/**
 * 计算圆弧采样点。
 *
 * @param center - 圆心。
 * @param radius - 半径。
 * @param startAngle - 起始角，单位弧度。
 * @param endAngle - 结束角，单位弧度。
 * @returns 圆弧上的点集合。
 */
export function getArcPoints(
  center: PlotPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
): PlotPoint[] {
  let sweep = endAngle - startAngle
  sweep = sweep < 0 ? sweep + TWO_PI : sweep
  const points: PlotPoint[] = []
  for (let index = 0; index <= FITTING_COUNT; index++) {
    const angle = startAngle + (sweep * index) / FITTING_COUNT
    points.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ])
  }
  return points
}

/**
 * 计算两点之间的球面距离，单位米。
 *
 * @param a - 起点经纬度。
 * @param b - 终点经纬度。
 * @returns 球面距离，单位米。
 */
export function distanceMeters(a: PlotPoint, b: PlotPoint): number {
  const dLat = (b[1] - a[1]) * DEG2RAD
  const dLng = (b[0] - a[0]) * DEG2RAD
  const lat1 = a[1] * DEG2RAD
  const lat2 = b[1] * DEG2RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 计算由起点指向终点的方位角，单位度。
 *
 * @param start - 起点经纬度。
 * @param end - 终点经纬度。
 * @returns 方位角，取值区间为 (-180, 180]。
 */
export function calculateAngle(start: PlotPoint, end: PlotPoint): number {
  const lat1 = start[1] * DEG2RAD
  const lat2 = end[1] * DEG2RAD
  const lon1 = start[0] * DEG2RAD
  const lon2 = end[0] * DEG2RAD
  const a = Math.sin(lon2 - lon1) * Math.cos(lat2)
  const b =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  return Math.atan2(a, b) * RAD2DEG
}

/**
 * 由起点沿指定方位角与球面距离推求终点。
 *
 * @param lng - 起点经度。
 * @param lat - 起点纬度。
 * @param angle - 方位角，单位度。
 * @param meters - 球面距离，单位米。
 * @returns 推求得到的经纬度点。
 */
export function getPointByAngleDistance(
  lng: number,
  lat: number,
  angle: number,
  meters: number,
): PlotPoint {
  const a = 6378137
  const b = 6356752.3142
  const f = 1 / 298.257223563
  const alpha1 = angle * DEG2RAD
  const sinAlpha1 = Math.sin(alpha1)
  const cosAlpha1 = Math.cos(alpha1)
  const tanU1 = (1 - f) * Math.tan(lat * DEG2RAD)
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1)
  const sinU1 = tanU1 * cosU1
  const sigma1 = Math.atan2(tanU1, cosAlpha1)
  const sinAlpha = cosU1 * sinAlpha1
  const cosSqAlpha = 1 - sinAlpha * sinAlpha
  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b)
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))
  let sigma = meters / (b * A)
  let sigmaP = 2 * Math.PI
  let cos2SigmaM = 0
  let sinSigma = 0
  let cosSigma = 0
  while (Math.abs(sigma - sigmaP) > 1e-12) {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma)
    sinSigma = Math.sin(sigma)
    cosSigma = Math.cos(sigma)
    const deltaSigma =
      B *
      sinSigma *
      (cos2SigmaM +
        (B / 4) *
          (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            (B / 6) *
              cos2SigmaM *
              (-3 + 4 * sinSigma * sinSigma) *
              (-3 + 4 * cos2SigmaM * cos2SigmaM)))
    sigmaP = sigma
    sigma = meters / (b * A) + deltaSigma
  }
  const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1
  const lat2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
    (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp),
  )
  const lambda = Math.atan2(
    sinSigma * sinAlpha1,
    cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1,
  )
  const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha))
  const L =
    lambda -
    (1 - C) *
      f *
      sinAlpha *
      (sigma +
        C *
          sinSigma *
          (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)))
  return [lng + L * RAD2DEG, lat2 * RAD2DEG]
}

/**
 * 以原点为基准，按东西与南北方向偏移得到新点（局部平面近似）。
 *
 * @param origin - 原点经纬度。
 * @param east - 向东偏移量，单位米。
 * @param north - 向北偏移量，单位米。
 * @returns 偏移后的经纬度点。
 */
export function offsetByMeters(
  origin: PlotPoint,
  east: number,
  north: number,
): PlotPoint {
  const lat = origin[1] * DEG2RAD
  const dLat = north / METERS_PER_DEGREE
  const dLng = east / (METERS_PER_DEGREE * Math.cos(lat))
  return [origin[0] + dLng, origin[1] + dLat]
}

/**
 * 计算细长直箭头的闭合轮廓点。
 *
 * @param tail - 箭尾点。
 * @param head - 箭头点。
 * @returns 轮廓点集合。
 */
export function fineArrow(tail: PlotPoint, head: PlotPoint): PlotPoint[] {
  const tailWidthFactor = 0.15
  const neckWidthFactor = 0.2
  const headWidthFactor = 0.25
  const headAngle = Math.PI / 8.5
  const neckAngle = Math.PI / 13
  const points: PlotPoint[] = [tail, head]
  const n = getBaseLength(points)
  const tailWidth = n * tailWidthFactor
  const neckWidth = n * neckWidthFactor
  const headWidth = n * headWidthFactor
  const a = getThirdPoint(head, tail, HALF_PI, tailWidth, true)
  const l = getThirdPoint(head, tail, HALF_PI, tailWidth, false)
  const u = getThirdPoint(tail, head, headAngle, headWidth, false)
  const c = getThirdPoint(tail, head, headAngle, headWidth, true)
  const p = getThirdPoint(tail, head, neckAngle, neckWidth, false)
  const h = getThirdPoint(tail, head, neckAngle, neckWidth, true)
  return [a, p, u, head, c, h, l, tail]
}

/**
 * 计算双箭头（钳击箭头）的轮廓点。
 *
 * @param input - 鼠标采集的锚点集合，至少三个点。
 * @returns 轮廓点集合。
 */
export function doubleArrow(input: PlotPoint[]): PlotPoint[] {
  const count = input.length
  if (count < 2) return []
  if (count === 2) return input.slice()
  const o = input[0]
  const e = input[1]
  const r = input[2]
  const tempPoint4 = count === 3 ? getTempPoint4(o, e, r) : input[3]
  const connPoint = count === 3 || count === 4 ? midPoint(o, e) : input[4]
  let n: PlotPoint[]
  let g: PlotPoint[]
  if (isClockWise(o, e, r)) {
    n = getArrowPoints(o, connPoint, tempPoint4, false)
    g = getArrowPoints(connPoint, e, r, true)
  } else {
    n = getArrowPoints(e, connPoint, r, false)
    g = getArrowPoints(connPoint, o, tempPoint4, true)
  }
  const i = n.length
  const s = (i - 5) / 2
  const a = n.slice(0, s)
  const l = n.slice(s, s + 5)
  const u = n.slice(s + 5, i)
  let c = g.slice(0, s)
  const p = g.slice(s, s + 5)
  const h = g.slice(s + 5, i)
  c = getBezierPoints(c)
  const d = getBezierPoints(h.concat(a.slice(1)))
  const u2 = getBezierPoints(u)
  return c.concat(p, d, l, u2)
}

/**
 * 计算尾翼攻击箭头（燕尾攻击箭头）的轮廓点。
 *
 * @param input - 鼠标采集的锚点集合，至少三个点。
 * @returns 轮廓点集合。
 */
export function attackArrow(input: PlotPoint[]): PlotPoint[] {
  const points = dereplication(input)
  const count = points.length
  if (count < 2) return []
  if (count === 2) return points.slice()
  let e = points[0]
  let r = points[1]
  if (isClockWise(points[0], points[1], points[2])) {
    e = points[1]
    r = points[0]
  }
  const n = midPoint(e, r)
  const g = [n].concat(points.slice(2))
  const head = getAttackArrowHeadPoints(g, e, r)
  const s = head[0]
  const a = head[4]
  const l = distance(e, r)
  const u = getBaseLength(g)
  const c = u * 0.1 * 1
  const swallowTailPnt = getThirdPoint(g[1], g[0], 0, c, true)
  const p = l / u
  const h = getAttackArrowBodyPoints(g, s, a, p)
  const t = h.length
  const d = [e].concat(h.slice(0, t / 2))
  d.push(s)
  const f = [r].concat(h.slice(t / 2, t))
  f.push(a)
  const dl = getQBSplinePoints(d)
  const fl = getQBSplinePoints(f)
  return dl.concat(head, fl.reverse(), [swallowTailPnt, dl[0]])
}

/**
 * 计算燕尾箭头的轮廓点。
 *
 * @param start - 起点。
 * @param end - 终点。
 * @param swallow - 是否包含燕尾缺口，默认为 true。
 * @returns 轮廓点集合。
 */
export function swallowtailArrow(
  start: PlotPoint,
  end: PlotPoint,
  swallow = true,
): PlotPoint[] {
  const x0 = start[0]
  const y0 = start[1]
  const x1 = end[0]
  const y1 = end[1]
  const xt = (15.8 * x1 + 3.2 * x0) / 19
  const yt = (15.8 * y1 + 3.2 * y0) / 19
  const ap: Array<PlotPoint | undefined> = []
  ap[0] = [x1, y1]
  ap[1] = [xt + (0.85 / 3.2) * (y1 - yt), yt - (0.85 / 3.2) * (x1 - xt)]
  ap[2] = [xt + (0.25 / 3.2) * (y1 - yt), yt - (0.25 / 3.2) * (x1 - xt)]
  ap[3] = [x0 + (1.6 / 19) * (y1 - y0), y0 - (1.6 / 19) * (x1 - x0)]
  ap[4] = swallow
    ? [(3.2 * x1 + 15.8 * x0) / 19, (3.2 * y1 + 15.8 * y0) / 19]
    : undefined
  ap[5] = [x0 - (1.6 / 19) * (y1 - y0), y0 + (1.6 / 19) * (x1 - x0)]
  ap[6] = [xt - (0.25 / 3.2) * (y1 - yt), yt + (0.25 / 3.2) * (x1 - xt)]
  ap[7] = [xt - (0.85 / 3.2) * (y1 - yt), yt + (0.85 / 3.2) * (x1 - xt)]
  return ap.filter((item): item is PlotPoint => Boolean(item))
}

/**
 * 计算钳击箭头的轮廓点，等价于双箭头算法。
 *
 * @param points - 锚点集合，至少三个点。
 * @returns 轮廓点集合。
 */
export function pincerArrow(points: PlotPoint[]): PlotPoint[] {
  return doubleArrow(points)
}

/**
 * 计算直箭头的轮廓点。
 *
 * @param start - 箭头起点。
 * @param end - 箭头终点。
 * @param swallow - 是否使用燕尾尾部，默认为 true。
 * @returns 轮廓点集合。
 */
export function straightArrow(
  start: PlotPoint,
  end: PlotPoint,
  swallow = true,
): PlotPoint[] {
  const ratio = 6
  const s = start
  const e = end
  const vx = e[0] - s[0]
  const vy = e[1] - s[1]
  const l = Math.sqrt(vx * vx + vy * vy)
  const w = l / ratio
  const x = s[0] + (5 * (e[0] - s[0])) / ratio
  const y = s[1] + (5 * (e[1] - s[1])) / ratio
  const vLeft: PlotPoint = [-vy, vx]
  const leftMag = Math.sqrt(vLeft[0] ** 2 + vLeft[1] ** 2) || 1
  const unitLeft: PlotPoint = [
    (vLeft[0] / leftMag) * (w / 2),
    (vLeft[1] / leftMag) * (w / 2),
  ]
  const unitRight: PlotPoint = [-unitLeft[0], -unitLeft[1]]
  const point1: PlotPoint = [s[0] + unitLeft[0], s[1] + unitLeft[1]]
  const point2: PlotPoint = [x + unitLeft[0], y + unitLeft[1]]
  const point3: PlotPoint = [x + 2 * unitLeft[0], y + 2 * unitLeft[1]]
  const point4: PlotPoint = [e[0], e[1]]
  const point5: PlotPoint = [x + 2 * unitRight[0], y + 2 * unitRight[1]]
  const point6: PlotPoint = [x + unitRight[0], y + unitRight[1]]
  const point7: PlotPoint = [s[0] + unitRight[0], s[1] + unitRight[1]]
  const result: PlotPoint[] = [
    point1,
    point2,
    point3,
    point4,
    point5,
    point6,
    point7,
  ]
  if (swallow) {
    result.push([s[0] + (e[0] - s[0]) / 10, s[1] + (e[1] - s[1]) / 10])
  }
  return result
}

/**
 * 计算直角箭头的轮廓点。
 *
 * @param anchorpoints - 锚点集合，至少两个点。
 * @returns 轮廓点集合。
 */
export function rightAngleArrow(anchorpoints: PlotPoint[]): PlotPoint[] {
  if (anchorpoints.length <= 2) {
    return calculateTwoPoints(anchorpoints, 1)
  }
  const ratio = 6
  let length = 0
  for (let index = 0; index < anchorpoints.length - 1; index++) {
    const start = anchorpoints[index]
    const end = anchorpoints[index + 1]
    length += Math.sqrt((end[1] - start[1]) ** 2 + (end[0] - start[0]) ** 2)
  }
  const w = length / ratio
  const pointsCL: PlotPoint[] = []
  const pointsCR: PlotPoint[] = []
  let pointTL: PlotPoint = [0, 0]
  let pointTR: PlotPoint = [0, 0]
  for (let j = 0; j < anchorpoints.length - 2; j++) {
    const u1 = anchorpoints[j]
    const u2 = anchorpoints[j + 1]
    const u3 = anchorpoints[j + 2]
    const v12: PlotPoint = [u2[0] - u1[0], u2[1] - u1[1]]
    const v23: PlotPoint = [u3[0] - u2[0], u3[1] - u2[1]]
    const lr12 = calculateVector(v12, Math.PI / 2, w / 2)
    const lr23 = calculateVector(v23, Math.PI / 2, w / 2)
    const pointL1: PlotPoint = [u1[0] + lr12[0][0], u1[1] + lr12[0][1]]
    const pointR1: PlotPoint = [u1[0] + lr12[1][0], u1[1] + lr12[1][1]]
    const pointL2: PlotPoint = [u2[0] + lr23[0][0], u2[1] + lr23[0][1]]
    const pointR2: PlotPoint = [u2[0] + lr23[1][0], u2[1] + lr23[1][1]]
    const pointCL = calculateIntersection(v12, v23, pointL1, pointL2)
    const pointCR = calculateIntersection(v12, v23, pointR1, pointR2)
    if (j === 0) {
      pointTL = pointL1
      pointTR = pointR1
      pointsCL.push([
        (pointTL[0] + pointCL[0]) / 2,
        (pointTL[1] + pointCL[1]) / 2,
      ])
      pointsCR.push([
        (pointTR[0] + pointCR[0]) / 2,
        (pointTR[1] + pointCR[1]) / 2,
      ])
    } else {
      const prevL = pointsCL[pointsCL.length - 1]
      const prevR = pointsCR[pointsCR.length - 1]
      pointsCL.push([(prevL[0] + pointCL[0]) / 2, (prevL[1] + pointCL[1]) / 2])
      pointsCR.push([(prevR[0] + pointCR[0]) / 2, (prevR[1] + pointCR[1]) / 2])
    }
    pointsCL.push(pointCL)
    pointsCR.push(pointCR)
  }
  const uE2 = anchorpoints[anchorpoints.length - 2]
  const uE1 = anchorpoints[anchorpoints.length - 1]
  const vE: PlotPoint = [uE1[0] - uE2[0], uE1[1] - uE2[1]]
  const headD = Math.sqrt(vE[0] * vE[0] + vE[1] * vE[1])
  let pointHL: PlotPoint
  let pointHR: PlotPoint
  let pointTriangleL: PlotPoint
  let pointTriangleR: PlotPoint
  const lastCL = pointsCL[pointsCL.length - 1]
  const lastCR = pointsCR[pointsCR.length - 1]
  if (headD <= w) {
    const lrH = calculateVector(vE, Math.PI / 2, w / 2)
    pointHL = [uE2[0] + lrH[0][0], uE2[1] + lrH[0][1]]
    pointHR = [uE2[0] + lrH[1][0], uE2[1] + lrH[1][1]]
    pointsCL.push([(lastCL[0] + pointHL[0]) / 2, (lastCL[1] + pointHL[1]) / 2])
    pointsCR.push([(lastCR[0] + pointHR[0]) / 2, (lastCR[1] + pointHR[1]) / 2])
    pointTriangleL = [2 * pointHL[0] - uE2[0], 2 * pointHL[1] - uE2[1]]
    pointTriangleR = [2 * pointHR[0] - uE2[0], 2 * pointHR[1] - uE2[1]]
  } else {
    const mag = Math.sqrt(vE[0] * vE[0] + vE[1] * vE[1]) || 1
    const pointC: PlotPoint = [
      uE1[0] - (vE[0] * w) / mag,
      uE1[1] - (vE[1] * w) / mag,
    ]
    const lrH = calculateVector(vE, Math.PI / 2, w / 2)
    pointHL = [pointC[0] + lrH[0][0], pointC[1] + lrH[0][1]]
    pointHR = [pointC[0] + lrH[1][0], pointC[1] + lrH[1][1]]
    pointsCL.push([(lastCL[0] + pointHL[0]) / 2, (lastCL[1] + pointHL[1]) / 2])
    pointsCR.push([(lastCR[0] + pointHR[0]) / 2, (lastCR[1] + pointHR[1]) / 2])
    pointTriangleL = [2 * pointHL[0] - pointC[0], 2 * pointHL[1] - pointC[1]]
    pointTriangleR = [2 * pointHR[0] - pointC[0], 2 * pointHR[1] - pointC[1]]
  }
  let pointsBCL: PlotPoint[] = []
  let pointsBCR: PlotPoint[] = []
  for (let index = 0; index < pointsCL.length - 2; index++) {
    pointsBCL = pointsBCL.concat(
      getBezierPoints([
        pointsCL[index],
        pointsCL[index + 1],
        pointsCL[index + 2],
      ]),
    )
    pointsBCR = pointsBCR.concat(
      getBezierPoints([
        pointsCR[index],
        pointsCR[index + 1],
        pointsCR[index + 2],
      ]),
    )
  }
  let result: PlotPoint[] = [pointTL]
  result = result.concat(pointsBCL)
  result.push(pointHL)
  result.push(pointTriangleL)
  result.push(uE1)
  result.push(pointTriangleR)
  result.push(pointHR)
  result = result.concat(pointsBCR.reverse())
  result.push(pointTR)
  return result
}

/**
 * 计算圆形轮廓点。
 *
 * @param center - 圆心。
 * @param edge - 圆上一点，用于确定半径。
 * @param segments - 采样段数，默认为 64。
 * @returns 闭合的圆环点集合。
 */
export function circlePoints(
  center: PlotPoint,
  edge: PlotPoint,
  segments = 64,
): PlotPoint[] {
  const radius = distanceMeters(center, edge)
  const points: PlotPoint[] = []
  for (let index = 0; index <= segments; index++) {
    const angle = (360 * index) / segments
    points.push(getPointByAngleDistance(center[0], center[1], angle, radius))
  }
  return points
}

/**
 * 计算正多边形轮廓点。
 *
 * @param center - 中心点。
 * @param edge - 一个顶点，用于确定外接圆半径与起始方位。
 * @param sides - 边数，至少为 3。
 * @returns 闭合的多边形点集合。
 */
export function regularPolygonPoints(
  center: PlotPoint,
  edge: PlotPoint,
  sides: number,
): PlotPoint[] {
  const count = Math.max(3, Math.floor(sides))
  const radius = distanceMeters(center, edge)
  const start = calculateAngle(center, edge)
  const points: PlotPoint[] = []
  for (let index = 0; index <= count; index++) {
    const angle = start + (360 * index) / count
    points.push(getPointByAngleDistance(center[0], center[1], angle, radius))
  }
  return points
}

/**
 * 计算椭圆轮廓点。
 *
 * @param center - 中心点。
 * @param edge - 长轴端点，用于确定长半轴长度与旋转角。
 * @param segments - 采样段数，默认为 64。
 * @param ratio - 短半轴与长半轴之比，默认为 0.6。
 * @returns 闭合的椭圆环点集合。
 */
export function ellipsePoints(
  center: PlotPoint,
  edge: PlotPoint,
  segments = 64,
  ratio = 0.6,
): PlotPoint[] {
  const semiMajor = distanceMeters(center, edge)
  const semiMinor = semiMajor * ratio
  const rotation = calculateAngle(center, edge) * DEG2RAD
  const cosR = Math.cos(rotation)
  const sinR = Math.sin(rotation)
  const points: PlotPoint[] = []
  for (let index = 0; index <= segments; index++) {
    const t = (TWO_PI * index) / segments
    const x = semiMajor * Math.cos(t)
    const y = semiMinor * Math.sin(t)
    const east = x * cosR - y * sinR
    const north = x * sinR + y * cosR
    points.push(offsetByMeters(center, east, north))
  }
  return points
}

/**
 * 计算扇形轮廓点。
 *
 * @param center - 扇形圆心。
 * @param p1 - 第一条半径上的点。
 * @param p2 - 第二条半径上的点，定义扇形的张角。
 * @param segments - 圆弧采样段数，默认为 100。
 * @returns 扇形轮廓点集合。
 */
export function sectorPoints(
  center: PlotPoint,
  p1: PlotPoint,
  p2: PlotPoint,
  segments = 100,
): PlotPoint[] {
  const radius = distanceMeters(center, p1)
  const startAngle = calculateAngle(center, p1)
  const endAngle = calculateAngle(center, p2)
  const from = Math.min(startAngle, endAngle)
  const to = Math.max(startAngle, endAngle)
  const points: PlotPoint[] = [[center[0], center[1]]]
  const step = (to - from) / segments
  for (let index = 0; index <= segments; index++) {
    const angle = from + index * step
    points.push(getPointByAngleDistance(center[0], center[1], angle, radius))
  }
  points.push([center[0], center[1]])
  return points
}

/**
 * 计算弓形轮廓点。
 *
 * @param start - 弓形起始点。
 * @param end - 弓形结束点。
 * @param segments - 圆弧采样段数，默认为 90。
 * @returns 弓形轮廓点集合。
 */
export function bowPoints(
  start: PlotPoint,
  end: PlotPoint,
  segments = 90,
): PlotPoint[] {
  const center = midPoint(start, end)
  const diameter = distanceMeters(start, end)
  const radius = diameter / 2
  const angle = calculateAngle(center, end)
  const sourcePos = getPointByAngleDistance(
    center[0],
    center[1],
    90 + angle,
    radius,
  )
  const angleLeft = calculateAngle(sourcePos, start)
  const circleRadius = Math.SQRT2 * radius
  const points: PlotPoint[] = []
  for (let index = 0; index < segments; index++) {
    points.push(
      getPointByAngleDistance(
        sourcePos[0],
        sourcePos[1],
        angleLeft + index,
        circleRadius,
      ),
    )
  }
  return points
}

/**
 * 计算矩形的四个顶点。
 *
 * @param p0 - 矩形的一个角点。
 * @param p1 - 矩形的对角点。
 * @returns 按顺序排列的四个顶点。
 */
export function rectanglePoints(p0: PlotPoint, p1: PlotPoint): PlotPoint[] {
  return [
    [p0[0], p0[1]],
    [p1[0], p0[1]],
    [p1[0], p1[1]],
    [p0[0], p1[1]],
  ]
}

/**
 * 计算圆角矩形的轮廓点。
 *
 * @param p0 - 矩形的一个角点。
 * @param p1 - 矩形的对角点。
 * @returns 圆角矩形轮廓点集合。
 */
export function roundRectanglePoints(
  p0: PlotPoint,
  p1: PlotPoint,
): PlotPoint[] {
  const oX = (p0[0] + p1[0]) / 2
  const oY = (p0[1] + p1[1]) / 2
  const a = Math.abs(p0[0] - p1[0])
  const b = Math.abs(p0[1] - p1[1])
  const r = (1 / 10) * Math.min(a, b)
  const o1: PlotPoint = [oX - a / 2 + r, oY - b / 2 + r]
  const o2: PlotPoint = [oX + a / 2 - r, oY - b / 2 + r]
  const o3: PlotPoint = [oX + a / 2 - r, oY + b / 2 - r]
  const o4: PlotPoint = [oX - a / 2 + r, oY + b / 2 - r]
  const step = Math.PI / 180
  const points: PlotPoint[] = []
  const arcs: Array<[PlotPoint, number, number]> = [
    [o1, Math.PI, (3 / 2) * Math.PI],
    [o2, (Math.PI * 3) / 2, TWO_PI],
    [o3, 0, (1 / 2) * Math.PI],
    [o4, (1 / 2) * Math.PI, Math.PI],
  ]
  for (const [origin, from, to] of arcs) {
    let theta = from
    for (let i = 0; i < Math.abs(from - to); i += step) {
      points.push([
        origin[0] + r * Math.cos(theta),
        origin[1] + r * Math.sin(theta),
      ])
      theta += step
      if (theta < 0) theta += TWO_PI
      if (theta > TWO_PI) theta -= TWO_PI
    }
  }
  return points
}

/**
 * 计算集结地轮廓点。
 *
 * @param p0 - 起始点。
 * @param p1 - 结束点。
 * @returns 集结地轮廓点集合。
 */
export function assemblePoints(p0: PlotPoint, p1: PlotPoint): PlotPoint[] {
  const vectorOL: PlotPoint = [p1[0] - p0[0], p1[1] - p0[1]]
  const dOL = Math.sqrt(vectorOL[0] ** 2 + vectorOL[1] ** 2)
  const vOP1 = calculateVector(vectorOL, Math.PI / 3, (Math.sqrt(3) / 12) * dOL)
  const p = [
    [p0[0], p0[1]] as PlotPoint,
    [p0[0] + vOP1[1][0], p0[1] + vOP1[1][1]] as PlotPoint,
    [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] as PlotPoint,
  ]
  const vLP3 = calculateVector(
    vectorOL,
    (Math.PI * 2) / 3,
    (Math.sqrt(3) / 12) * dOL,
  )
  p.push([p1[0] + vLP3[1][0], p1[1] + vLP3[1][1]])
  p.push([p1[0], p1[1]])
  const vOP5 = calculateVector(vectorOL, Math.PI / 2, (1 / 2) * dOL)
  p.push([vOP5[0][0] + p[2][0], vOP5[0][1] + p[2][1]])
  const closeCardinal = createCloseCardinal(
    p.map((item) => [item[0], item[1]] as PlotPoint),
  )
  return calculatePointsFBZ3(closeCardinal, 100)
}

/**
 * 计算旗标轮廓点。
 *
 * @param p0 - 旗杆底部点。
 * @param p1 - 旗杆顶部点。
 * @param type - 旗面样式，0 曲线、1 直线、2 正三角、3 倒三角、4 对三角，默认为 0。
 * @returns 旗标轮廓点集合。
 */
export function flagPoints(
  p0: PlotPoint,
  p1: PlotPoint,
  type = 0,
): PlotPoint[] {
  const startPoint = p0
  const endPoint = p1
  const pointCenter: PlotPoint = [
    endPoint[0],
    (endPoint[1] - startPoint[1]) / 4 + startPoint[1],
  ]
  const point1 = startPoint
  const point2: PlotPoint = [
    (endPoint[0] - startPoint[0]) / 4 + startPoint[0],
    (endPoint[1] - startPoint[1]) / 8 + startPoint[1],
  ]
  const point3: PlotPoint = [(startPoint[0] + endPoint[0]) / 2, startPoint[1]]
  const point4: PlotPoint = [
    ((endPoint[0] - startPoint[0]) * 3) / 4 + startPoint[0],
    -(endPoint[1] - startPoint[1]) / 8 + startPoint[1],
  ]
  const point5: PlotPoint = [endPoint[0], startPoint[1]]
  const point6: PlotPoint = [endPoint[0], (startPoint[1] + endPoint[1]) / 2]
  const point7: PlotPoint = [
    ((endPoint[0] - startPoint[0]) * 3) / 4 + startPoint[0],
    ((endPoint[1] - startPoint[1]) * 3) / 8 + startPoint[1],
  ]
  const point8: PlotPoint = [
    (startPoint[0] + endPoint[0]) / 2,
    (startPoint[1] + endPoint[1]) / 2,
  ]
  const point9: PlotPoint = [
    (endPoint[0] - startPoint[0]) / 4 + startPoint[0],
    ((endPoint[1] - startPoint[1]) * 5) / 8 + startPoint[1],
  ]
  const point10: PlotPoint = [startPoint[0], (startPoint[1] + endPoint[1]) / 2]
  const point11: PlotPoint = [startPoint[0], endPoint[1]]
  const point12: PlotPoint = [
    startPoint[0] - (endPoint[0] - startPoint[0]) / 30,
    endPoint[1],
  ]
  const point13: PlotPoint = [
    startPoint[0] - (endPoint[0] - startPoint[0]) / 30,
    startPoint[1],
  ]
  let curve1Points: PlotPoint[]
  let curve2Points: PlotPoint[]
  switch (type) {
    case 1:
      curve1Points = [point1, point5]
      curve2Points = [point6, point10, point10, point10, point10, point10]
      break
    case 2:
      curve1Points = [point1, point6]
      curve2Points = [point6, point10, point10, point10, point10, point10]
      break
    case 3:
      curve1Points = [point1, point5]
      curve2Points = [point5, point10, point10, point10, point10, point10]
      break
    case 4:
      curve1Points = [point1, pointCenter]
      curve2Points = [pointCenter, point10, point10, point10, point10, point10]
      break
    default:
      curve1Points = [point1, point2, point3, point4, point5]
      curve2Points = [
        point6,
        point7,
        point8,
        point9,
        point10,
        point10,
        point10,
        point10,
        point10,
      ]
      break
  }
  const curveTop = getBezierPoints(curve1Points)
  const curveBottom = getBezierPoints(curve2Points)
  return curveTop.concat(curveBottom, [point11, point12, point13])
}

/**
 * 计算阵型轮廓点。
 *
 * @param start - 起始点。
 * @param end - 结束点。
 * @param type - 阵型样式，0 进攻、1 防御，默认为 0。
 * @returns 阵型轮廓点集合。
 */
export function formationPoints(
  start: PlotPoint,
  end: PlotPoint,
  type = 0,
): PlotPoint[] {
  const center = midPoint(start, end)
  const diameter = distanceMeters(start, end)
  const radius = diameter / 2
  const angle = calculateAngle(center, end)
  const sourcePos = getPointByAngleDistance(
    center[0],
    center[1],
    90 + angle,
    radius,
  )
  const angleLeft = calculateAngle(sourcePos, start)
  const circleRadius = Math.SQRT2 * radius
  const factor = type === 0 ? 0.9 : 1.1
  const points: PlotPoint[] = []
  for (let index = 0; index < 90; index++) {
    const current = angleLeft + index
    const point = getPointByAngleDistance(
      sourcePos[0],
      sourcePos[1],
      current,
      circleRadius,
    )
    points.push(point)
    if (index !== 0 && index % 15 === 0) {
      points.push(
        getPointByAngleDistance(
          sourcePos[0],
          sourcePos[1],
          current,
          circleRadius * factor,
        ),
      )
      points.push(point)
    }
  }
  return points
}

/**
 * 生成标注文本，按模式拆分并换行。
 *
 * @param text - 原始文本。
 * @param type - 拆分模式，true 按空格拆分，false 按字面量 `\n` 拆分。
 * @returns 归一化后的文本。
 */
export function getLabelText(text: string, type: boolean): string {
  const parts = type ? text.split(" ") : text.split("\\n")
  let result = ""
  for (let index = 0; index < parts.length; index++) {
    result += index === 0 ? parts[index] : `\n${parts[index]}`
  }
  return result
}

/**
 * 去除相邻的重复点（保留首尾）。
 *
 * @param array - 原始点集合。
 * @returns 去重后的点集合。
 */
function dereplication(array: PlotPoint[]): PlotPoint[] {
  const last = array[array.length - 1]
  let change = false
  const result = array.filter((item) => {
    if (item[0] !== last[0] && item[1] !== last[1]) return true
    change = true
    return false
  })
  if (change) result.push(last)
  return result
}

/**
 * 计算双箭头单侧的骨架点。
 *
 * @param t - 骨架点集合。
 * @param o - 连接点。
 * @param e - 头部参考点。
 * @param r - 方向标志。
 * @returns 骨架点集合。
 */
function getArrowPoints(
  t: PlotPoint,
  o: PlotPoint,
  e: PlotPoint,
  r: boolean,
): PlotPoint[] {
  const n = midPoint(t, o)
  const g = distance(n, e)
  let i = getThirdPoint(e, n, 0, 0.3 * g, true)
  let s = getThirdPoint(e, n, 0, 0.5 * g, true)
  i = getThirdPoint(n, i, HALF_PI, g / 5, r)
  s = getThirdPoint(n, s, HALF_PI, g / 4, r)
  const a = [n, i, s, e]
  const l = getArrowHeadPoints(a)
  const u = l[0]
  const c = l[4]
  const p = distance(t, o) / getBaseLength(a) / 2
  const h = getArrowBodyPoints(a, u, c, p)
  const d = h.length
  const f = h.slice(0, d / 2)
  const E = h.slice(d / 2, d)
  f.push(u)
  E.push(c)
  f.reverse()
  f.push(o)
  E.reverse()
  E.push(t)
  f.reverse()
  return f.concat(l, E)
}

/**
 * 计算双箭头头部五个关键点。
 *
 * @param t - 骨架点集合。
 * @returns 头部关键点集合。
 */
function getArrowHeadPoints(t: PlotPoint[]): PlotPoint[] {
  const base = getBaseLength(t)
  const n = base * 0.25
  const g = t[t.length - 1]
  const i = n * 0.3
  const s = n * 0.15
  const a = n * 0.85
  const l = getThirdPoint(t[t.length - 2], g, 0, n, true)
  const u = getThirdPoint(t[t.length - 2], g, 0, a, true)
  const c = getThirdPoint(g, l, HALF_PI, i, false)
  const p = getThirdPoint(g, l, HALF_PI, i, true)
  const h = getThirdPoint(g, u, HALF_PI, s, false)
  const d = getThirdPoint(g, u, HALF_PI, s, true)
  return [h, c, g, p, d]
}

/**
 * 计算双箭头主体的两侧点。
 *
 * @param t - 骨架点集合。
 * @param o - 头部左侧点。
 * @param e - 头部右侧点。
 * @param r - 宽度比例。
 * @returns 主体两侧点集合。
 */
function getArrowBodyPoints(
  t: PlotPoint[],
  o: PlotPoint,
  e: PlotPoint,
  r: number,
): PlotPoint[] {
  const n = wholeDistance(t)
  const g = getBaseLength(t)
  const i = g * r
  const s = distance(o, e)
  const a = (i - s) / 2
  let l = 0
  const u: PlotPoint[] = []
  const c: PlotPoint[] = []
  for (let p = 1; p < t.length - 1; p++) {
    const h = getAngleOfThreePoints(t[p - 1], t[p], t[p + 1]) / 2
    l += distance(t[p - 1], t[p])
    const d = (i / 2 - (l / n) * a) / Math.sin(h)
    u.push(getThirdPoint(t[p - 1], t[p], Math.PI - h, d, true))
    c.push(getThirdPoint(t[p - 1], t[p], h, d, false))
  }
  return u.concat(c)
}

/**
 * 计算双箭头第四个临时控制点。
 *
 * @param t - 第一个锚点。
 * @param o - 第二个锚点。
 * @param e - 第三个锚点。
 * @returns 临时控制点。
 */
function getTempPoint4(t: PlotPoint, o: PlotPoint, e: PlotPoint): PlotPoint {
  const s = midPoint(t, o)
  const a = distance(s, e)
  const l = getAngleOfThreePoints(t, s, e)
  let n: number
  let g: number
  let i: PlotPoint
  let r: PlotPoint
  if (l < HALF_PI) {
    n = a * Math.sin(l)
    g = a * Math.cos(l)
    i = getThirdPoint(t, s, HALF_PI, n, false)
    r = getThirdPoint(s, i, HALF_PI, g, true)
  } else if (l < Math.PI) {
    n = a * Math.sin(Math.PI - l)
    g = a * Math.cos(Math.PI - l)
    i = getThirdPoint(t, s, HALF_PI, n, false)
    r = getThirdPoint(s, i, HALF_PI, g, false)
  } else if (l < 1.5 * Math.PI) {
    n = a * Math.sin(l - Math.PI)
    g = a * Math.cos(l - Math.PI)
    i = getThirdPoint(t, s, HALF_PI, n, true)
    r = getThirdPoint(s, i, HALF_PI, g, true)
  } else {
    n = a * Math.sin(TWO_PI - l)
    g = a * Math.cos(TWO_PI - l)
    i = getThirdPoint(t, s, HALF_PI, n, true)
    r = getThirdPoint(s, i, HALF_PI, g, false)
  }
  return r
}

/**
 * 计算攻击箭头头部的五个关键点。
 *
 * @param t - 骨架点集合。
 * @param o - 头部左基点。
 * @param e - 头部右基点。
 * @returns 头部关键点集合。
 */
function getAttackArrowHeadPoints(
  t: PlotPoint[],
  o: PlotPoint,
  e: PlotPoint,
): PlotPoint[] {
  const headHeightFactor = 0.18
  const headTailFactor = 0.8
  const headWidthFactor = 0.3
  const neckWidthFactor = 0.15
  const neckHeightFactor = 0.85
  let r = getBaseLength(t)
  let n = r * headHeightFactor
  const g = t[t.length - 1]
  r = distance(g, t[t.length - 2])
  const i = distance(o, e)
  if (n > i * headTailFactor) n = i * headTailFactor
  const s = n * headWidthFactor
  const a = n * neckWidthFactor
  if (r < n) n = r
  const l = n * neckHeightFactor
  const u = getThirdPoint(t[t.length - 2], g, 0, n, true)
  const c = getThirdPoint(t[t.length - 2], g, 0, l, true)
  const p = getThirdPoint(g, u, HALF_PI, s, false)
  const h = getThirdPoint(g, u, HALF_PI, s, true)
  const d = getThirdPoint(g, c, HALF_PI, a, false)
  const f = getThirdPoint(g, c, HALF_PI, a, true)
  return [d, p, g, h, f]
}

/**
 * 计算攻击箭头主体的两侧点。
 *
 * @param t - 骨架点集合。
 * @param o - 头部左侧点。
 * @param e - 头部右侧点。
 * @param r - 宽度比例。
 * @returns 主体两侧点集合。
 */
function getAttackArrowBodyPoints(
  t: PlotPoint[],
  o: PlotPoint,
  e: PlotPoint,
  r: number,
): PlotPoint[] {
  return getArrowBodyPoints(t, o, e, r)
}

/**
 * 由基准向量按角度与长度计算左右偏移向量。
 *
 * @param v - 基准向量。
 * @param theta - 旋转角，单位弧度。
 * @param d - 偏移距离。
 * @returns 左右两个偏移向量。
 */
function calculateVector(
  v: PlotPoint,
  theta: number,
  d: number,
): [PlotPoint, PlotPoint] {
  const angle = theta || Math.PI / 2
  const length = d || 1
  let x1: number
  let x2: number
  let y1: number
  let y2: number
  let left: PlotPoint
  let right: PlotPoint
  const dV = Math.sqrt(v[0] * v[0] + v[1] * v[1])
  if (v[1] === 0) {
    x1 = x2 = (dV * length * Math.cos(angle)) / v[0]
    if (v[0] > 0) {
      y1 = Math.sqrt(length * length - x1 * x1)
      y2 = -y1
    } else {
      y2 = Math.sqrt(length * length - x1 * x1)
      y1 = -y2
    }
    left = [x1, y1]
    right = [x2, y2]
  } else {
    const n = -v[0] / v[1]
    const m = (length * dV * Math.cos(angle)) / v[1]
    const a = 1 + n * n
    const b = 2 * n * m
    const c = m * m - length * length
    x1 = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a)
    x2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
    y1 = n * x1 + m
    y2 = n * x2 + m
    if (v[1] >= 0) {
      left = [x1, y1]
      right = [x2, y2]
    } else {
      left = [x2, y2]
      right = [x1, y1]
    }
  }
  return [left, right]
}

/**
 * 计算两条直线段的交点。
 *
 * @param v1 - 第一条线的方向向量。
 * @param v2 - 第二条线的方向向量。
 * @param point1 - 第一条线上的点。
 * @param point2 - 第二条线上的点。
 * @returns 交点坐标。
 */
function calculateIntersection(
  v1: PlotPoint,
  v2: PlotPoint,
  point1: PlotPoint,
  point2: PlotPoint,
): PlotPoint {
  let x: number
  let y: number
  if (v1[1] * v2[0] - v1[0] * v2[1] === 0) {
    if (v1[0] * v2[0] > 0 || v1[1] * v2[1] > 0) {
      x = (point1[0] + point2[0]) / 2
      y = (point1[1] + point2[1]) / 2
    } else {
      x = point2[0]
      y = point2[1]
    }
  } else {
    x =
      (v1[0] * v2[0] * (point2[1] - point1[1]) +
        point1[0] * v1[1] * v2[0] -
        point2[0] * v2[1] * v1[0]) /
      (v1[1] * v2[0] - v1[0] * v2[1])
    if (v1[0] !== 0) {
      y = ((x - point1[0]) * v1[1]) / v1[0] + point1[1]
    } else {
      y = ((x - point2[0]) * v2[1]) / v2[0] + point2[1]
    }
  }
  return [x, y]
}

/**
 * 生成闭合的样条控制点。
 *
 * @param points - 输入点集合，至少包含三个点。
 * @returns 包含起止点的控制点集合。
 */
function createCloseCardinal(points: PlotPoint[]): PlotPoint[] {
  if (points == null || points.length < 3) return points
  const lastP = points[0]
  points.push(lastP)
  const cPoints = points
  const cardinalPoints: PlotPoint[] = []
  const t = 0.4
  const e = 0.005
  const n = cPoints.length - 1
  for (let k = 0; k <= n - 1; k++) {
    let p0: PlotPoint
    let p1: PlotPoint
    let p2: PlotPoint
    if (k === n - 1) {
      p0 = cPoints[n - 1]
      p1 = cPoints[0]
      p2 = cPoints[1]
    } else {
      p0 = cPoints[k]
      p1 = cPoints[k + 1]
      p2 = cPoints[k + 2]
    }
    let p1l: PlotPoint = [0, 0]
    let p1r: PlotPoint = [0, 0]
    const p0p1: PlotPoint = [p1[0] - p0[0], p1[1] - p0[1]]
    const p1p2: PlotPoint = [p2[0] - p1[0], p2[1] - p1[1]]
    const d01 = Math.sqrt(p0p1[0] ** 2 + p0p1[1] ** 2)
    const d12 = Math.sqrt(p1p2[0] ** 2 + p1p2[1] ** 2)
    const p0p1Unit: PlotPoint = [p0p1[0] / d01, p0p1[1] / d01]
    const p1p2Unit: PlotPoint = [p1p2[0] / d12, p1p2[1] / d12]
    const bisector: PlotPoint = [
      p0p1Unit[0] + p1p2Unit[0],
      p0p1Unit[1] + p1p2Unit[1],
    ]
    const d012 = Math.sqrt(bisector[0] ** 2 + bisector[1] ** 2)
    const bisectorUnit: PlotPoint = [bisector[0] / d012, bisector[1] / d012]
    const cos = p0p1Unit[0] * p1p2Unit[0] + p0p1Unit[1] * p1p2Unit[1]
    if (Math.abs(1 - cos) < e) {
      p1l = [p1[0] - p1p2Unit[0] * d01 * t, p1[1] - p1p2Unit[1] * d01 * t]
      p1r = [p1[0] + p0p1Unit[0] * d12 * t, p1[1] + p0p1Unit[1] * d12 * t]
    } else {
      p1l = [
        p1[0] - bisectorUnit[0] * d01 * t,
        p1[1] - bisectorUnit[1] * d01 * t,
      ]
      p1r = [
        p1[0] + bisectorUnit[0] * d12 * t,
        p1[1] + bisectorUnit[1] * d12 * t,
      ]
    }
    if (k === n - 1) {
      cardinalPoints[0] = p1
      cardinalPoints[1] = p1r
      cardinalPoints[(n - 2) * 3 + 2 + 3] = p1l
      cardinalPoints[(n - 2) * 3 + 2 + 4] = cPoints[n]
    } else {
      cardinalPoints[k * 3 + 2 + 0] = p1l
      cardinalPoints[k * 3 + 2 + 1] = p1
      cardinalPoints[k * 3 + 2 + 2] = p1r
    }
  }
  return cardinalPoints
}

/**
 * 计算三阶贝塞尔曲线采样点。
 *
 * @param points - 控制点集合。
 * @param part - 采样分段数，默认为 20。
 * @returns 采样点集合。
 */
function calculatePointsFBZ3(points: PlotPoint[], part = 20): PlotPoint[] {
  const bezierPts: PlotPoint[] = []
  let scale = 0.05
  if (part > 0) scale = 1 / part
  for (let i = 0; i < points.length - 3;) {
    const pointS = points[i]
    const pointC1 = points[i + 1]
    const pointC2 = points[i + 2]
    const pointE = points[i + 3]
    bezierPts.push(pointS)
    for (let t = 0; t < 1;) {
      const x =
        (1 - t) ** 3 * pointS[0] +
        3 * t * (1 - t) ** 2 * pointC1[0] +
        3 * t * t * (1 - t) * pointC2[0] +
        t ** 3 * pointE[0]
      const y =
        (1 - t) ** 3 * pointS[1] +
        3 * t * (1 - t) ** 2 * pointC1[1] +
        3 * t * t * (1 - t) * pointC2[1] +
        t ** 3 * pointE[1]
      bezierPts.push([x, y])
      t += scale
    }
    i += 3
    if (i >= points.length) bezierPts.push(pointS)
  }
  return bezierPts
}

/**
 * 计算简单直箭头的轮廓点（两锚点情形）。
 *
 * @param anchorpoints - 锚点集合。
 * @param type - 尾部样式，1 平尾、2 燕尾。
 * @returns 轮廓点集合。
 */
function calculateTwoPoints(anchorpoints: PlotPoint[], type = 1): PlotPoint[] {
  const ratio = 6
  const s = anchorpoints[0]
  const e = anchorpoints[1]
  const vx = e[0] - s[0]
  const vy = e[1] - s[1]
  const l = Math.sqrt(vx * vx + vy * vy)
  const w = l / ratio
  const x = s[0] + (5 * (e[0] - s[0])) / ratio
  const y = s[1] + (5 * (e[1] - s[1])) / ratio
  const vLeft: PlotPoint = [-vy, vx]
  const mag = Math.sqrt(vLeft[0] ** 2 + vLeft[1] ** 2) || 1
  const unitLeft: PlotPoint = [
    (vLeft[0] / mag) * (w / 2),
    (vLeft[1] / mag) * (w / 2),
  ]
  const unitRight: PlotPoint = [-unitLeft[0], -unitLeft[1]]
  const point1: PlotPoint = [s[0] + unitLeft[0], s[1] + unitLeft[1]]
  const point2: PlotPoint = [x + unitLeft[0], y + unitLeft[1]]
  const point3: PlotPoint = [x + 2 * unitLeft[0], y + 2 * unitLeft[1]]
  const point4: PlotPoint = [e[0], e[1]]
  const point5: PlotPoint = [x + 2 * unitRight[0], y + 2 * unitRight[1]]
  const point6: PlotPoint = [x + unitRight[0], y + unitRight[1]]
  const point7: PlotPoint = [s[0] + unitRight[0], s[1] + unitRight[1]]
  const result: PlotPoint[] = [
    point1,
    point2,
    point3,
    point4,
    point5,
    point6,
    point7,
  ]
  if (type === 2) {
    result.push([s[0] + (e[0] - s[0]) / 10, s[1] + (e[1] - s[1]) / 10])
  }
  return result
}
