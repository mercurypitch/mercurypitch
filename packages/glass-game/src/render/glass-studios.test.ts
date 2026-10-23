// Glass studio scenes — each family's studio is built from light, not downloads, and keeps its defining layout.
import type { MeshBasicMaterial } from 'three'
import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import type { GLASS_STUDIO_KINDS } from './glass-studios'
import { createGlassStudioScene } from './glass-studios'

function emitters(kind: (typeof GLASS_STUDIO_KINDS)[number]): number[] {
  const values: number[] = []
  createGlassStudioScene(kind).traverse((object) => {
    if (!(object instanceof Mesh)) return
    const color = (object.material as MeshBasicMaterial).color
    values.push(Math.max(color.r, color.g, color.b))
  })
  return values
}

describe('glass studios', () => {
  it('lights the warm studio behind every viewpoint near 1.5 radiance', () => {
    const values = emitters('warm-bright-field')
    expect(values.filter((v) => v >= 1.4 && v <= 1.6)).toHaveLength(1)
    expect(Math.max(...values)).toBeGreaterThan(4)
  })

  it('keeps the dark-field studio dark apart from its strips', () => {
    const values = emitters('cool-dark-field')
    expect(values.filter((v) => v > 4)).toHaveLength(6)
    expect(Math.min(...values)).toBeLessThan(0.02)
  })

  it('places the same sparkle cards every time', () => {
    expect(emitters('sparkle')).toEqual(emitters('sparkle'))
    expect(emitters('sparkle').filter((v) => v >= 10)).toHaveLength(48)
  })
})
