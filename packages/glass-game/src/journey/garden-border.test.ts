// Garden border regressions — preserve planted footprints used by scene exclusions.

import { Euler, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { GardenBorderCard } from './garden-border'
import { appendGardenBorder } from './garden-border'

const ROOT = [1.75, 0.42, -2.3] as const
const DIMENSIONS = [0.14, 0.23, 0.24].flatMap((radius) =>
  [0.15, 0.18, 0.26].map((height) => ({ radius, height })),
)

// Reconstruct the existing building-garden tessellation contract, including
// transparent corners: callers reserve the whole radius, not only alpha pixels.
function cardVertices(card: GardenBorderCard): Vector3[] {
  const vertices: Vector3[] = []
  const [columns, rows] = card.subdivisions ?? [4, 5]
  const rotation = new Euler(...card.rotation)
  const position = new Vector3(...card.position)
  for (let row = 0; row <= rows; row++) {
    const v = row / rows
    for (let column = 0; column <= columns; column++) {
      const u = column / columns
      vertices.push(
        new Vector3(
          (u - 0.5) * card.size[0],
          -v * card.size[1],
          Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * card.bend,
        )
          .applyEuler(rotation)
          .add(position),
      )
    }
  }
  return vertices
}

describe('garden borders', () => {
  it.each(DIMENSIONS)(
    'contains planted vertices within radius $radius and height $height',
    ({ radius, height }) => {
      for (let seed = 0; seed <= 10; seed++) {
        const sprigs: GardenBorderCard[] = []
        const trails: GardenBorderCard[] = []
        appendGardenBorder(sprigs, trails, ROOT, radius, height, seed)
        expect(sprigs.length).toBeGreaterThan(0)
        expect(trails.length).toBeGreaterThan(0)
        const cards = [...sprigs, ...trails]
        const vertices = cards.flatMap(cardVertices)
        const radialDistances = vertices.map((point) =>
          Math.hypot(point.x - ROOT[0], point.z - ROOT[2]),
        )
        const elevations = vertices.map((point) => point.y - ROOT[1])
        expect(
          vertices.every((point) => point.toArray().every(Number.isFinite)),
        ).toBe(true)
        expect(Math.max(...radialDistances)).toBeLessThanOrEqual(radius + 1e-9)
        expect(Math.min(...elevations)).toBeGreaterThanOrEqual(
          -Math.min(0.018, height * 0.07) - 1e-9,
        )
        expect(Math.max(...elevations)).toBeLessThanOrEqual(height + 1e-9)
        expect(Math.max(...elevations)).toBeGreaterThan(0)
        for (const card of cards)
          expect(card.position[1]).toBeLessThanOrEqual(ROOT[1])
        const triangles = cards.reduce((total, card) => {
          const [columns, rows] = card.subdivisions ?? [4, 5]
          return total + columns * rows * 2
        }, 0)
        expect(triangles).toBeLessThanOrEqual(280)
      }
    },
  )

  it('keeps botanical crop proportions and root-to-tip UV orientation', () => {
    const sprigs: GardenBorderCard[] = []
    const trails: GardenBorderCard[] = []
    appendGardenBorder(sprigs, trails, ROOT, 0.24, 0.26, 7)
    for (const [cards, textureWidth, textureHeight] of [
      [sprigs, 768, 768],
      [trails, 683, 1024],
    ] as const) {
      for (const card of cards) {
        const [u0, v0, u1, v1] = card.crop
        expect(card.crop.every((value) => value >= 0 && value <= 1)).toBe(true)
        expect(u1).toBeGreaterThan(u0)
        expect(v0).toBeGreaterThan(v1)
        expect(card.size[0]).toBeGreaterThan(0)
        expect(card.size[1]).toBeGreaterThan(0)
        expect(card.size[0] / card.size[1]).toBeCloseTo(
          ((u1 - u0) * textureWidth) / ((v0 - v1) * textureHeight),
          10,
        )
        const rotation = new Euler(...card.rotation)
        expect(new Vector3(0, -1, 0).applyEuler(rotation).y).toBeGreaterThan(0)
        expect(new Vector3(0, 0, 1).applyEuler(rotation).y).toBeGreaterThan(0)
      }
    }
  })

  it.each([0, -0.1, NaN, -Infinity, Infinity])(
    'does not append geometry for invalid radius or height %s',
    (invalid) => {
      for (const [radius, height] of [
        [invalid, 0.18],
        [0.24, invalid],
      ]) {
        const sprigs: GardenBorderCard[] = []
        const trails: GardenBorderCard[] = []
        appendGardenBorder(sprigs, trails, ROOT, 0.24, 0.18, 0)
        const priorSprigs = [...sprigs]
        const priorTrails = [...trails]
        appendGardenBorder(sprigs, trails, ROOT, radius!, height!, 1)
        expect(sprigs).toEqual(priorSprigs)
        expect(trails).toEqual(priorTrails)
      }
    },
  )
})
