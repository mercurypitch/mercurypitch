// ============================================================
// Warm Merc tests — Tavi lit in amber, from the shader text Merc uses
// ============================================================

import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MercQuality } from '@/lib/merc/constants'
import { LIGHT, LIGHT_SLOTS, QUALITY } from '@/lib/merc/constants'
import { createFakeGl, stubContext } from '@/lib/merc/fake-gl.test-fixtures'
import { mount } from '@/lib/merc/renderer'
import { fragSource } from '@/lib/merc/scene-shader'
import { asStudied } from '@/lib/merc/study-text.fixture'
import { WARM_LIGHT, WARM_LOOK } from './merc-warm'

const sha256 = (s: string): string =>
  createHash('sha256').update(s, 'utf8').digest('hex')

const QUALITIES: MercQuality[] = ['low', 'medium', 'high', 'ultra']

// Tavi's shader text as the warm swaps wrote it into the pass 4 study text,
// before the light set existed: the amber she was approved in. A change to
// the study text changes these with scene-shader.test.ts's hashes, and on
// purpose only.
const WARM_APPROVED: Record<MercQuality, string> = {
  low: '725563620b612f4c6b89d13696275da3eb237cf6f91077ee93e6c73e644b7186',
  medium: 'a69e9e557a9772b0edbe325770ebe799c5bf8aa8d065fe6c1ae81750d559d02a',
  high: '4cc1a004ffd231b1d983611e3d945c91abac51fe55a543fb6be815f449336fef',
  ultra: 'a273046126424671271b9f651dfca14aa41c92b8bd4973b1390f55b6be9161a3',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the warm light', () => {
  it('lights Tavi exactly as the warm swaps wrote her shader', () => {
    for (const q of QUALITIES) {
      // Arrange
      const shipped = fragSource(QUALITY[q])

      // Act
      const lit = asStudied(shipped, WARM_LIGHT)

      // Assert
      expect(sha256(lit), q).toBe(WARM_APPROVED[q])
    }
  })

  it('turns every slot of the light from blue to amber', () => {
    // Act
    const cool = LIGHT_SLOTS.filter((slot) => {
      const [r, , b] = WARM_LIGHT[slot]
      return r <= b || WARM_LIGHT[slot] === LIGHT[slot]
    })

    // Assert
    expect(cool).toEqual([])
    expect(WARM_LOOK.light).toBe(WARM_LIGHT)
  })

  it('draws Tavi with the program Merc was compiled with, her light a uniform', () => {
    // Arrange
    const fake = createFakeGl()
    stubContext(fake.gl)
    const tavi = mount(document.createElement('div'), {
      quality: 'medium',
      capture: true,
    })
    const compiled = [...fake.sources]

    // Act
    tavi.setLook(WARM_LOOK)
    tavi.renderAt(0)

    // Assert
    expect(compiled).toHaveLength(8)
    expect(fake.sources).toEqual(compiled)
    expect(fake.vec3s.get('uLight[0]')).toEqual(
      Array.from(new Float32Array(LIGHT_SLOTS.flatMap((s) => WARM_LIGHT[s]))),
    )
    tavi.destroy()
  })
})
