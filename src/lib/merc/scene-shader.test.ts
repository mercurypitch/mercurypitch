// ============================================================
// Merc shader tests — the quality defines and the approved GLSL text
// ============================================================

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { MercQuality } from './constants'
import { LIGHT, LIGHT_SLOTS, QUALITY } from './constants'
import { POST_BLUR, POST_COMPOSITE, POST_DOWN } from './post-shaders'
import { fragSource, VERT } from './scene-shader'
import { asStudied, glslLoops, LIGHT_UNIFORM, occurrences, vec3Text, ZERO_UNIFORM, } from './study-text.fixture'

const sha256 = (s: string): string =>
  createHash('sha256').update(s, 'utf8').digest('hex')

const QUALITIES: MercQuality[] = ['low', 'medium', 'high', 'ultra']

describe('fragSource', () => {
  it("bakes each quality's samples, march budget and edge AA into the defines", () => {
    for (const q of QUALITIES) {
      // Arrange
      const { spp, steps, edgeAA } = QUALITY[q]

      // Act
      const src = fragSource(QUALITY[q])

      // Assert
      expect(src, q).toContain(
        `\n#define SPP ${spp}\n#define MAX_STEPS ${steps}\n#define EDGE_AA ${edgeAA}\n`,
      )
    }
  })

  it('writes the shape constants as five-decimal GLSL floats', () => {
    // Act
    const src = fragSource(QUALITY.high)

    // Assert
    expect(src).toContain('#define REST_H 1.22500\n')
    expect(src).toContain('#define BODY_Y0 -0.01500\n')
    expect(src).toContain('#define BULB_R vec3(0.49550, 0.37510, 0.47560)\n')
    expect(src).toContain('#define FOOT_TOE vec2(0.17365, 0.98481)\n')
    expect(src).toContain('#define EYE_VIS 0.97874\n')
    expect(src).toContain('#define GRAD_N 12\n')
  })
})

// The pass 4 study's shader text, as the owner approved it, hashed from
// merc-sdf.js. A change here changes how Merc looks. If that is the intent,
// render the before and after, get the new look approved, then update the
// hash; never update it just to make this test pass. 16 Oct: a lip roll's
// lips added (uMouth.w); while it is 0 every room draws as it did. The scene
// shader is hashed as studied (study-text.fixture.ts): its loop starts read
// uZero and its light colours are uniforms set from LIGHT, which draws the
// same pixels, and nothing else may differ.
describe('approved shader text', () => {
  const APPROVED: Record<string, string> = {
    'frag low':
      '667d959eb6db1b4be14bfcefd537a9010806d0d9103bd299c47cadd22975020f',
    'frag medium':
      'fbff42da41df85bbdcc11fe616b06ec4e30da2b1c0dae270d7bcd19a7998db06',
    'frag high':
      '169340af862515af3d72e34c34357cb10b32ef7c0c00f00689b5668306cc8a17',
    'frag ultra':
      'f1757848aa378e209c67b7be6e49ee01ee4f1f2307bf985bfe1ea0388272ace1',
    VERT: '5e5cb7d301ae948a9e99926a0e5e040c73c9bb146c8875e1e91c6e34d71f50af',
    POST_DOWN:
      '0e261618781791184a851201fbd76cb167a7b97abfcdd89f3a7395b8e4ce6857',
    POST_BLUR:
      '706bbad74727a74e8504ba11ceeb72ce05062c5bd1651b854ce33904a0e975d6',
    POST_COMPOSITE:
      '1d7f376dea4a0140bab1f37bd3ab0f5c00595ca874011b9c51e89c04568a3eb9',
  }

  it('matches the approved pass 4 GLSL byte for byte', () => {
    // Arrange
    const sources: Record<string, string> = {
      VERT,
      POST_DOWN,
      POST_BLUR,
      POST_COMPOSITE,
    }
    for (const q of QUALITIES) {
      sources[`frag ${q}`] = asStudied(fragSource(QUALITY[q]))
    }

    // Act
    const hashes = Object.fromEntries(
      Object.entries(sources).map(([k, s]) => [k, sha256(s)]),
    )

    // Assert
    expect(hashes).toEqual(APPROVED)
  })
})

// What draws on the distance field, or renders a whole sample.
const HEAVY_CALL = /\b(?:map3?|mapBody|calcNormal(?:Body)?|renderSample)\(/

describe('loops the compiler must keep', () => {
  it('starts every loop that calls the distance field or a sample at uZero', () => {
    for (const q of QUALITIES) {
      // Arrange
      const src = fragSource(QUALITY[q])

      // Act
      const heavy = glslLoops(src).filter((l) => HEAVY_CALL.test(l.body))

      // Assert: the march, and the 4 and 9 sample loops around it.
      expect(
        heavy.map((l) => l.init),
        q,
      ).toEqual(['int i = uZero', 'int i = uZero', 'int i = uZero'])
      expect(occurrences(src, ZERO_UNIFORM), q).toBe(1)
    }
  })

  it('finds no other loop start that reads uZero', () => {
    // Arrange
    const src = fragSource(QUALITY.ultra)

    // Act
    const zeroStarts = glslLoops(src).filter((l) => l.init.includes('uZero'))

    // Assert
    expect(zeroStarts).toHaveLength(3)
    expect(occurrences(src, 'uZero')).toBe(4)
  })
})

describe('the light set', () => {
  it('reads every slot, and writes none of the colours out any more', () => {
    for (const q of QUALITIES) {
      // Arrange
      const src = fragSource(QUALITY[q])

      // Act
      const unread = LIGHT_SLOTS.filter((_, k) => !src.includes(`uLight[${k}]`))
      const written = LIGHT_SLOTS.filter((slot) =>
        src.includes(vec3Text(LIGHT[slot])),
      )

      // Assert
      expect(unread, q).toEqual([])
      expect(written, q).toEqual([])
      expect(occurrences(src, LIGHT_UNIFORM), q).toBe(1)
    }
  })

  it('declares one slot for each entry of LIGHT_SLOTS', () => {
    // Act
    const declared = LIGHT_UNIFORM.match(/uLight\[(\d+)\]/)

    // Assert
    expect(Number(declared?.[1])).toBe(LIGHT_SLOTS.length)
  })
})
