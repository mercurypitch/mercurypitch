// Celadon arch contact — measured conservative sections preserve the exported S01 opening.
import type { RunnerBlockerCollisionProfile } from './contracts'

function rectangle(depth: number, floor: number) {
  return [
    { zFraction: -depth, yFraction: floor },
    { zFraction: depth, yFraction: floor },
    { zFraction: depth, yFraction: 1 },
    { zFraction: -depth, yFraction: 1 },
  ]
}

// Triangle crossings are clipped before measuring each band's extrema.
// Outer feet reach the ground; the middle bands retain the actual passage.
export const CELADON_ARCH_COLLISION = {
  kind: 'convex-yz-bands',
  bands: [
    { minXFraction: -0.5, maxXFraction: -0.3, vertices: rectangle(0.5, 0) },
    {
      minXFraction: -0.3,
      maxXFraction: -0.25,
      vertices: rectangle(0.3693, 0.51366),
    },
    {
      minXFraction: -0.25,
      maxXFraction: 0.25,
      vertices: rectangle(0.24131, 0.5478),
    },
    {
      minXFraction: 0.25,
      maxXFraction: 0.3,
      vertices: rectangle(0.3693, 0.51366),
    },
    { minXFraction: 0.3, maxXFraction: 0.5, vertices: rectangle(0.5, 0) },
  ],
} as const satisfies RunnerBlockerCollisionProfile
