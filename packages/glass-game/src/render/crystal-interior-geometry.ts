// Crystal interior geometry — generate deterministic bounded tube and rounded-ribbon paths as renderer-independent data.

import type { NormalizedCrystalInteriorSettings } from './crystal-interior-config'
import { crystalInteriorBounds } from './crystal-interior-config'

export type CrystalInteriorPoint = readonly [number, number, number]

export interface CrystalInteriorPath {
  readonly id: string
  readonly kind: 'tube' | 'ribbon'
  readonly points: readonly CrystalInteriorPoint[]
  readonly radius: number
  readonly phaseOffset: number
  readonly paletteIndex: 0 | 1 | 2
}

export interface CrystalInteriorSparkle {
  readonly position: CrystalInteriorPoint
  readonly phaseOffset: number
  readonly size: number
}

export interface CrystalInteriorLayout {
  readonly paths: readonly CrystalInteriorPath[]
  readonly sparkles: readonly CrystalInteriorSparkle[]
  readonly phaseBins: number
}

interface RandomSource {
  next(): number
  signed(): number
  range(minimum: number, maximum: number): number
}

function randomSource(seed: number): RandomSource {
  let state = seed >>> 0
  return {
    next() {
      state += 0x6d2b79f5
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    },
    signed() {
      return this.next() * 2 - 1
    },
    range(minimum, maximum) {
      return minimum + this.next() * (maximum - minimum)
    },
  }
}

function mix(left: number, right: number, amount: number): number {
  return left + (right - left) * amount
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function containedPoint(
  value: CrystalInteriorPoint,
  minimum: CrystalInteriorPoint,
  maximum: CrystalInteriorPoint,
): CrystalInteriorPoint {
  return [
    clamp(value[0], minimum[0], maximum[0]),
    clamp(value[1], minimum[1], maximum[1]),
    clamp(value[2], minimum[2], maximum[2]),
  ]
}

function resonanceLayout(
  settings: NormalizedCrystalInteriorSettings,
  random: RandomSource,
): CrystalInteriorLayout {
  const bounds = crystalInteriorBounds(settings)
  const minimum = bounds.minimum
  const maximum = bounds.maximum
  const center = settings.envelope.center
  const paths: CrystalInteriorPath[] = []
  const trunkCount = 3
  const pointCount = 7
  const spanX = maximum[0] - minimum[0]
  const spanY = maximum[1] - minimum[1]
  const spanZ = maximum[2] - minimum[2]
  for (let trunk = 0; trunk < trunkCount; trunk += 1) {
    const angle = (trunk / trunkCount) * Math.PI * 2 + random.signed() * 0.2
    const end: CrystalInteriorPoint = [
      center[0] + Math.cos(angle) * spanX * random.range(0.36, 0.49),
      center[1] + random.signed() * spanY * 0.28,
      center[2] + Math.sin(angle) * spanZ * random.range(0.28, 0.46),
    ]
    const points: CrystalInteriorPoint[] = []
    for (let index = 0; index < pointCount; index += 1) {
      const t = index / (pointCount - 1)
      const arc = Math.sin(t * Math.PI)
      points.push(
        containedPoint(
          [
            mix(center[0], end[0], t) + random.signed() * spanX * 0.035 * arc,
            mix(center[1], end[1], t) + random.signed() * spanY * 0.08 * arc,
            mix(center[2], end[2], t) + random.signed() * spanZ * 0.045 * arc,
          ],
          minimum,
          maximum,
        ),
      )
    }
    paths.push({
      id: `resonance-trunk-${trunk}`,
      kind: 'tube',
      points,
      radius: Math.min(spanY, spanZ) * 0.052,
      phaseOffset: trunk * 0.09,
      paletteIndex: trunk === 0 ? 2 : ((trunk % 2) as 0 | 1),
    })
    for (let branch = 0; branch < 2; branch += 1) {
      const forkIndex = 2 + branch * 2
      const fork = points[forkIndex]!
      const branchAngle =
        angle + (branch === 0 ? -1 : 1) * random.range(0.44, 0.8)
      const branchEnd = containedPoint(
        [
          fork[0] + Math.cos(branchAngle) * spanX * random.range(0.16, 0.28),
          fork[1] + random.signed() * spanY * 0.28,
          fork[2] + Math.sin(branchAngle) * spanZ * random.range(0.13, 0.25),
        ],
        minimum,
        maximum,
      )
      const midpoint = containedPoint(
        [
          mix(fork[0], branchEnd[0], 0.5) + random.signed() * spanX * 0.03,
          mix(fork[1], branchEnd[1], 0.5) + random.signed() * spanY * 0.08,
          mix(fork[2], branchEnd[2], 0.5) + random.signed() * spanZ * 0.035,
        ],
        minimum,
        maximum,
      )
      paths.push({
        id: `resonance-branch-${trunk}-${branch}`,
        kind: 'tube',
        points: [fork, midpoint, branchEnd],
        radius: Math.min(spanY, spanZ) * 0.029,
        phaseOffset: forkIndex / (pointCount - 1) + trunk * 0.09,
        paletteIndex: branch === 0 ? 0 : 1,
      })
    }
  }
  return { paths, sparkles: [], phaseBins: 8 }
}

function frostLayout(
  settings: NormalizedCrystalInteriorSettings,
  random: RandomSource,
): CrystalInteriorLayout {
  const bounds = crystalInteriorBounds(settings)
  const minimum = bounds.minimum
  const maximum = bounds.maximum
  const paths: CrystalInteriorPath[] = []
  const sparkles: CrystalInteriorSparkle[] = []
  const rootCount = 5
  const spanX = maximum[0] - minimum[0]
  const spanY = maximum[1] - minimum[1]
  const spanZ = maximum[2] - minimum[2]
  for (let root = 0; root < rootCount; root += 1) {
    const start: CrystalInteriorPoint = [
      mix(minimum[0], maximum[0], 0.2 + root * 0.15),
      maximum[1] - spanY * random.range(0.02, 0.1),
      random.range(minimum[2] + spanZ * 0.2, maximum[2] - spanZ * 0.2),
    ]
    const points: CrystalInteriorPoint[] = [start]
    for (let index = 1; index < 7; index += 1) {
      const t = index / 6
      points.push(
        containedPoint(
          [
            start[0] + random.signed() * spanX * 0.12 * t,
            mix(start[1], minimum[1], t),
            start[2] + random.signed() * spanZ * 0.17 * t,
          ],
          minimum,
          maximum,
        ),
      )
    }
    paths.push({
      id: `frost-root-${root}`,
      kind: 'tube',
      points,
      radius: Math.min(spanY, spanZ) * 0.022,
      phaseOffset: root * 0.12,
      paletteIndex: (root % 3) as 0 | 1 | 2,
    })
    const branchStart = points[random.next() > 0.5 ? 3 : 4]!
    const branchEnd = containedPoint(
      [
        branchStart[0] + random.signed() * spanX * 0.25,
        branchStart[1] - spanY * random.range(0.12, 0.28),
        branchStart[2] + random.signed() * spanZ * 0.25,
      ],
      minimum,
      maximum,
    )
    paths.push({
      id: `frost-branch-${root}`,
      kind: 'tube',
      points: [branchStart, branchEnd],
      radius: Math.min(spanY, spanZ) * 0.013,
      phaseOffset: 0.45 + root * 0.12,
      paletteIndex: (root % 2) as 0 | 1,
    })
  }
  for (let index = 0; index < 18; index += 1) {
    sparkles.push({
      position: [
        random.range(minimum[0], maximum[0]),
        random.range(minimum[1], maximum[1]),
        random.range(minimum[2], maximum[2]),
      ],
      phaseOffset: random.next(),
      size: random.range(0.012, 0.025),
    })
  }
  return { paths, sparkles, phaseBins: 10 }
}

function auroraLayout(
  settings: NormalizedCrystalInteriorSettings,
  random: RandomSource,
): CrystalInteriorLayout {
  const bounds = crystalInteriorBounds(settings)
  const minimum = bounds.minimum
  const maximum = bounds.maximum
  const paths: CrystalInteriorPath[] = []
  const spanX = maximum[0] - minimum[0]
  const spanY = maximum[1] - minimum[1]
  const spanZ = maximum[2] - minimum[2]
  const pointCount = 13
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    const points: CrystalInteriorPoint[] = []
    const phase = (ribbon * (Math.PI * 2)) / 3 + random.signed() * 0.08
    for (let index = 0; index < pointCount; index += 1) {
      const t = index / (pointCount - 1)
      const x = mix(minimum[0] + spanX * 0.08, maximum[0] - spanX * 0.08, t)
      const heart = Math.sin(t * Math.PI)
      points.push(
        containedPoint(
          [
            x,
            settings.envelope.center[1] +
              Math.sin(t * Math.PI * 2 + phase) * spanY * 0.22 * heart +
              (ribbon - 1) * spanY * 0.075,
            settings.envelope.center[2] +
              Math.cos(t * Math.PI * 2 + phase) * spanZ * 0.27 * heart,
          ],
          minimum,
          maximum,
        ),
      )
    }
    paths.push({
      id: `aurora-ribbon-${ribbon}`,
      kind: 'ribbon',
      points,
      radius: Math.min(spanY, spanZ) * (0.075 + ribbon * 0.012),
      phaseOffset: ribbon / 3,
      paletteIndex: ribbon as 0 | 1 | 2,
    })
  }
  return { paths, sparkles: [], phaseBins: 3 }
}

export function generateCrystalInteriorLayout(
  settings: NormalizedCrystalInteriorSettings,
): CrystalInteriorLayout {
  const random = randomSource(settings.seed)
  if (settings.preset === 'resonance-veins')
    return resonanceLayout(settings, random)
  if (settings.preset === 'frost-roots') return frostLayout(settings, random)
  return auroraLayout(settings, random)
}
