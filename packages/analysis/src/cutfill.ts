import { pointInPolygon, type LngLatLike } from "./geometry"
import { fromLocalMeters, toLocalMeters } from "./geometry"

export interface CutFillCell {
  longitude: number
  latitude: number
  coverage: number
  areaSquareMeters: number
}

export interface CutFillGrid {
  cells: CutFillCell[]
  resolutionMeters: number
  cellWidthMeters: number
  cellHeightMeters: number
}

function pointInXy(
  point: { east: number; north: number },
  ring: Array<{ east: number; north: number }>,
): boolean {
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].east
    const yi = ring[i].north
    const xj = ring[j].east
    const yj = ring[j].north
    const intersect =
      yi > point.north !== yj > point.north &&
      point.east <
        ((xj - xi) * (point.north - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function cellCoverage(
  west: number,
  south: number,
  east: number,
  north: number,
  ring: Array<{ east: number; north: number }>,
): number {
  const probes = [
    { east: west, north: south },
    { east: east, north: south },
    { east: east, north: north },
    { east: west, north: north },
    { east: (west + east) / 2, north: (south + north) / 2 },
  ]
  const hits = probes.filter((probe) => pointInXy(probe, ring)).length
  return hits / probes.length
}

export function buildCutFillGrid(
  ring: LngLatLike[],
  samples: number,
): CutFillGrid {
  if (ring.length < 3 || samples < 1) {
    return {
      cells: [],
      resolutionMeters: 0,
      cellWidthMeters: 0,
      cellHeightMeters: 0,
    }
  }
  const origin = ring[0]
  const projected = ring.map((point) => toLocalMeters(origin, point))
  const west = Math.min(...projected.map((point) => point.east))
  const east = Math.max(...projected.map((point) => point.east))
  const south = Math.min(...projected.map((point) => point.north))
  const north = Math.max(...projected.map((point) => point.north))
  const width = Math.max(east - west, 0)
  const height = Math.max(north - south, 0)
  const cellWidthMeters = width / samples
  const cellHeightMeters = height / samples
  const resolutionMeters =
    Math.hypot(cellWidthMeters, cellHeightMeters) / Math.SQRT2
  const cells: CutFillCell[] = []
  for (let i = 0; i < samples; i += 1) {
    for (let j = 0; j < samples; j += 1) {
      const cellWest = west + i * cellWidthMeters
      const cellSouth = south + j * cellHeightMeters
      const cellEast = cellWest + cellWidthMeters
      const cellNorth = cellSouth + cellHeightMeters
      const coverage = cellCoverage(
        cellWest,
        cellSouth,
        cellEast,
        cellNorth,
        projected,
      )
      if (coverage <= 0) continue
      const center = fromLocalMeters(
        origin,
        (cellWest + cellEast) / 2,
        (cellSouth + cellNorth) / 2,
      )
      if (coverage < 1 && !pointInPolygon(center, ring) && coverage < 0.2)
        continue
      cells.push({
        longitude: center.longitude,
        latitude: center.latitude,
        coverage,
        areaSquareMeters: cellWidthMeters * cellHeightMeters * coverage,
      })
    }
  }
  return { cells, resolutionMeters, cellWidthMeters, cellHeightMeters }
}

export function accumulateCutFillWeighted(
  samples: Array<{ delta: number; area: number }>,
): { cut: number; fill: number } {
  let cut = 0
  let fill = 0
  for (const sample of samples) {
    if (sample.delta > 0) cut += sample.delta * sample.area
    else fill += -sample.delta * sample.area
  }
  return { cut, fill }
}

export function estimateCutFillError(
  cells: CutFillCell[],
  deltas: number[],
): number {
  let error = 0
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]
    if (cell.coverage >= 1) continue
    error += 0.5 * cell.areaSquareMeters * Math.abs(deltas[i] ?? 0)
  }
  return error
}
