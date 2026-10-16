// ============================================================
// Warm Merc tests — every amber swap still finds its cool constant
// ============================================================

import { describe, expect, it } from 'vitest'
import type { MercQuality } from '@/lib/merc/constants'
import { QUALITY } from '@/lib/merc/constants'
import { fragSource } from '@/lib/merc/scene-shader'
import { occurrences, WARM_SWAPS, warmFragment } from './merc-warm'

const QUALITIES: MercQuality[] = ['low', 'medium', 'high', 'ultra']

describe('warmFragment', () => {
  it('finds every cool constant exactly once at every quality', () => {
    for (const q of QUALITIES) {
      // Arrange
      const src = fragSource(QUALITY[q])

      for (const [cool] of WARM_SWAPS) {
        // Act
        const n = occurrences(src, cool)

        // Assert
        expect(n, `${q}: ${cool}`).toBe(1)
      }
    }
  })

  it('leaves no cool constant behind and changes nothing else', () => {
    // Arrange
    const src = fragSource(QUALITY.medium)

    // Act
    const warm = warmFragment(src)

    // Assert
    for (const [cool, amber] of WARM_SWAPS) {
      expect(occurrences(warm, cool), cool).toBe(0)
      expect(occurrences(warm, amber), amber).toBeGreaterThanOrEqual(1)
    }
    let back = warm
    for (const [cool, amber] of WARM_SWAPS) back = back.replace(amber, cool)
    expect(back).toBe(src)
  })

  it('refuses a shader it does not recognise', () => {
    // Arrange
    const changed = fragSource(QUALITY.medium).replace(
      WARM_SWAPS[0][0],
      'vec3(0.0)',
    )

    // Act
    const run = (): string => warmFragment(changed)

    // Assert
    expect(run).toThrow(/expected one/)
  })
})
