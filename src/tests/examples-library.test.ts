// ============================================================
// Examples library — which demos become session rows
// ============================================================
//
// The corpus is Creative Commons and the mappings are the point, so getting
// these decisions wrong is not cosmetic: a parked song that keeps appearing is
// a licence problem, and a group rebuilt from the manifest would drag back
// every example a visitor deliberately moved out.

import { describe, expect, it } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoSessionId } from '@/features/karaoke-night/demo-song'
import { exampleAttribution, exampleSessionFrom, examplesToSeed, reconcileExampleGroup, } from '@/features/karaoke-night/examples-library'

function manifest(
  slug: string,
  over: Partial<DemoSongManifest> = {},
): DemoSongManifest {
  return {
    slug,
    title: slug,
    artist: 'Josh Woodward',
    attribution: {
      text: 'Josh Woodward — CC BY 4.0',
      url: 'https://www.joshwoodward.com/',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    stems: {
      vocal: `https://r2.example/demo/${slug}/vocal.m4a`,
      instrumental: `https://r2.example/demo/${slug}/instrumental.m4a`,
    },
    ...over,
  }
}

const JOSEPHINE = manifest('josephine')
/** The legacy slug, which keys rows that predate the list. */
const SPRING = manifest('karaoke-night')

describe('examplesToSeed', () => {
  it('seeds every playable demo on a device with nothing', () => {
    expect(examplesToSeed([JOSEPHINE, SPRING], new Set())).toHaveLength(2)
  })

  it('skips a demo that already has a session', () => {
    const existing = new Set([demoSessionId('josephine')])
    expect(
      examplesToSeed([JOSEPHINE, SPRING], existing).map((m) => m.slug),
    ).toEqual(['karaoke-night'])
  })

  it('respects the legacy slug rather than deriving an id from it', () => {
    // Goodbye to Spring's row is keyed by the bare demo id, not by its slug.
    // Anything deriving one from the other would seed a duplicate on every
    // device that has ever sung the demo.
    const existing = new Set([demoSessionId('karaoke-night')])
    expect(examplesToSeed([SPRING], existing)).toEqual([])
  })

  it('will not seed a song with no stems to play', () => {
    const parked = manifest('parked', { stems: {} })
    expect(examplesToSeed([parked], new Set())).toEqual([])
  })

  it('will not seed a half-published song', () => {
    const half = manifest('half', {
      stems: { vocal: 'https://r2.example/v.m4a' },
    })
    expect(examplesToSeed([half], new Set())).toEqual([])
  })

  it('has nothing to do when the studio is empty', () => {
    expect(examplesToSeed([], new Set())).toEqual([])
  })
})

describe('exampleSessionFrom', () => {
  it('points the row straight at the R2 stems', () => {
    // The row is metadata only because the URLs are the audio. Nothing
    // transfers until somebody opens the song.
    const session = exampleSessionFrom(JOSEPHINE, 0)
    expect(session.outputs?.vocal).toBe(
      'https://r2.example/demo/josephine/vocal.m4a',
    )
    expect(session.outputs?.instrumental).toBe(
      'https://r2.example/demo/josephine/instrumental.m4a',
    )
    expect(session.sessionId).toBe(demoSessionId('josephine'))
  })

  it('is complete, not a placeholder', () => {
    const session = exampleSessionFrom(JOSEPHINE, 0)
    expect(session.status).toBe('completed')
    expect(session.progress).toBe(100)
  })

  it('names the row so the list reads as a song', () => {
    expect(exampleSessionFrom(JOSEPHINE, 0).originalFile?.name).toBe(
      'Josh Woodward — josephine',
    )
  })

  it('carries a known duration through and invents none', () => {
    expect(
      exampleSessionFrom(manifest('d', { durationSec: 214 }), 0).stemMeta,
    ).toEqual({ vocal: { duration: 214 }, instrumental: { duration: 214 } })
    expect(exampleSessionFrom(JOSEPHINE, 0).stemMeta).toBeUndefined()
  })

  it('orders examples by the manifest and sorts them below real work', () => {
    const first = exampleSessionFrom(JOSEPHINE, 0)
    const second = exampleSessionFrom(SPRING, 1)
    expect(second.createdAt).toBeGreaterThan(first.createdAt)
    expect(first.createdAt).toBeLessThan(Date.UTC(2021, 0, 1))
  })

  it('gives the same row on every device, so nothing drifts', () => {
    expect(exampleSessionFrom(JOSEPHINE, 0)).toEqual(
      exampleSessionFrom(JOSEPHINE, 0),
    )
  })
})

describe('reconcileExampleGroup', () => {
  const ids = [demoSessionId('josephine'), demoSessionId('karaoke-night')]
  const present = new Set(ids)

  it('fills an empty group with the live examples', () => {
    expect(
      reconcileExampleGroup([JOSEPHINE, SPRING], present, []).sort(),
    ).toEqual([...ids].sort())
  })

  it('drops a song the studio has parked', () => {
    expect(reconcileExampleGroup([JOSEPHINE], present, ids)).toEqual([ids[0]])
  })

  it('drops a member whose session was deleted', () => {
    const only = new Set([ids[0]])
    expect(reconcileExampleGroup([JOSEPHINE, SPRING], only, ids)).toEqual([
      ids[0],
    ])
  })

  it('keeps the order the group already had', () => {
    const reversed = [ids[1], ids[0]]
    expect(
      reconcileExampleGroup([JOSEPHINE, SPRING], present, reversed),
    ).toEqual(reversed)
  })

  it('adds a newly published song without disturbing the rest', () => {
    const extra = manifest('third')
    const withThird = new Set([...ids, demoSessionId('third')])
    expect(
      reconcileExampleGroup([JOSEPHINE, SPRING, extra], withThird, ids),
    ).toEqual([...ids, demoSessionId('third')])
  })

  it('never lists a session twice', () => {
    const doubled = [ids[0], ids[0]]
    const result = reconcileExampleGroup([JOSEPHINE], present, doubled)
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('exampleAttribution', () => {
  it('carries the credit a CC corpus obliges us to show', () => {
    expect(exampleAttribution(JOSEPHINE)).toEqual({
      text: 'Josh Woodward — CC BY 4.0',
      url: 'https://www.joshwoodward.com/',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    })
  })

  it('is null rather than blank when there is no credit to show', () => {
    // A caller cannot then render an empty line and believe it complied.
    const bare = manifest('bare', {
      attribution: { text: '  ', url: '', license: '', licenseUrl: '' },
    })
    expect(exampleAttribution(bare)).toBeNull()
  })
})
