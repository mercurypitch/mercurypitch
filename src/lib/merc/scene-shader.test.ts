// ============================================================
// Merc shader tests — the quality defines and the approved GLSL text
// ============================================================

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { MercQuality } from './constants'
import { QUALITY } from './constants'
import { POST_BLUR, POST_COMPOSITE, POST_DOWN } from './post-shaders'
import { fragSource, VERT } from './scene-shader'

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
// hash; never update it just to make this test pass.
describe('approved shader text', () => {
  const APPROVED: Record<string, string> = {
    'frag low':
      'e63ce0c4738c467a6cd1cc1b83b81f070592d26ff79d154dbfab491f62ad32cb',
    'frag medium':
      '28e5f49881814c0c06485a65795ab89779ae7f5e7c0b9e19b4d24902c079bee5',
    'frag high':
      '8b24980f079b99ac18f65ce0465c81c56cc2c738096b304bcf474057589234f1',
    'frag ultra':
      '7bc827f293cf31fb089c5f536636a7622fd42c7314918c408975d1cdb9025d3e',
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
    for (const q of QUALITIES) sources[`frag ${q}`] = fragSource(QUALITY[q])

    // Act
    const hashes = Object.fromEntries(
      Object.entries(sources).map(([k, s]) => [k, sha256(s)]),
    )

    // Assert
    expect(hashes).toEqual(APPROVED)
  })
})
