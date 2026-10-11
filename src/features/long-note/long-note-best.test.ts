import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('long-note-best', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  async function load() {
    return import('./long-note-best')
  }

  it('keeps a best per note, so a higher note never wipes a lower one', async () => {
    const { longNoteBest, recordLongNoteBest } = await load()
    expect(
      recordLongNoteBest(57, { inBandSeconds: 9, steadiness: 80, at: 1 }),
    ).toEqual({ previous: null, improved: false })
    recordLongNoteBest(60, { inBandSeconds: 4, steadiness: 70, at: 2 })
    expect(longNoteBest(57)?.inBandSeconds).toBe(9)
    expect(longNoteBest(60)?.inBandSeconds).toBe(4)
  })

  it('says improved only when a previous best was beaten', async () => {
    const { longNoteBest, recordLongNoteBest } = await load()
    recordLongNoteBest(57, { inBandSeconds: 9, steadiness: 80, at: 1 })
    const worse = recordLongNoteBest(57, {
      inBandSeconds: 7,
      steadiness: 99,
      at: 2,
    })
    expect(worse.improved).toBe(false)
    expect(longNoteBest(57)?.at).toBe(1)
    const better = recordLongNoteBest(57, {
      inBandSeconds: 11,
      steadiness: 60,
      at: 3,
    })
    expect(better).toEqual({
      previous: { inBandSeconds: 9, steadiness: 80, at: 1 },
      improved: true,
    })
    expect(longNoteBest(57)?.at).toBe(3)
  })

  it('breaks a tie on the shown tenth with steadiness', async () => {
    const { beats } = await load()
    const previous = { inBandSeconds: 10.02, steadiness: 80, at: 1 }
    expect(
      beats({ inBandSeconds: 10.04, steadiness: 79, at: 2 }, previous),
    ).toBe(false)
    expect(
      beats({ inBandSeconds: 10.0, steadiness: 81, at: 2 }, previous),
    ).toBe(true)
    expect(
      beats({ inBandSeconds: 10.1, steadiness: 10, at: 2 }, previous),
    ).toBe(true)
  })

  it('reads a damaged stored table as empty', async () => {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_bests',
      JSON.stringify({ 57: { inBandSeconds: 'long' } }),
    )
    const { longNoteBest } = await load()
    expect(longNoteBest(57)).toBeNull()
  })
})
