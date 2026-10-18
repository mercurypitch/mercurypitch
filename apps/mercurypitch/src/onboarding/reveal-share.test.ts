// ============================================================
// Sharing the reveal: the line, the link, and where it goes
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { RangeResult } from '@/lib/mirror/metrics'
import { parseVoiceprintLink } from '@/lib/mirror/shared-voiceprint'
import { singerForRange } from '@/lib/mirror/singer-match'
import { ONBOARDING_COPY } from './onboarding-copy'
import type { ShareWays } from './reveal-share'
import { revealPayload, shareReveal } from './reveal-share'

const E2_G4: RangeResult = {
  lowMidi: 40,
  highMidi: 67,
  lowNote: 'E2',
  highNote: 'G4',
  semitones: 27,
  qualifyingMidis: [40, 67],
  voiceHint: 'Baritone',
}

/** The twin the reveal names for this range. */
const TWIN = singerForRange(E2_G4) ?? 'none'

function ways(sheet: boolean, copy: boolean) {
  return {
    sheet: vi.fn<ShareWays['sheet']>(async () => Promise.resolve(sheet)),
    copy: vi.fn<ShareWays['copy']>(async () => Promise.resolve(copy)),
  }
}

describe('revealPayload', () => {
  it('says the twin when there is one, and the range when there is not', () => {
    expect(TWIN).not.toBe('none')
    expect(revealPayload(E2_G4, TWIN).text).toBe(`${TWIN} is my voice twin.`)
    expect(revealPayload(E2_G4, null).text).toBe('My range is E2 to G4.')
    expect(revealPayload(E2_G4, null).title).toBe(ONBOARDING_COPY.shareTitle)
  })

  it('links to the public Mirror, opened on this range and twin', () => {
    const { url } = revealPayload(E2_G4, TWIN)
    const link = new URL(url)

    expect(`${link.origin}${link.pathname}`).toBe(
      'https://mercurypitch.com/mirror',
    )
    expect(parseVoiceprintLink(link.search)).toMatchObject({
      lo: 40,
      hi: 67,
      st: 27,
      tw: TWIN,
    })
  })
})

describe('shareReveal', () => {
  it('hands the share sheet the payload, and copies nothing once it was shown', async () => {
    const w = ways(true, true)

    const result = await shareReveal(E2_G4, null, w)

    expect(result).toBe('shared')
    expect(w.sheet).toHaveBeenCalledWith(revealPayload(E2_G4, null))
    expect(w.copy).not.toHaveBeenCalled()
  })

  it('puts the link on the clipboard where there is no share sheet', async () => {
    const w = ways(false, true)

    const result = await shareReveal(E2_G4, null, w)

    expect(result).toBe('copied')
    expect(w.copy).toHaveBeenCalledWith(revealPayload(E2_G4, null).url)
  })

  it('says it failed when neither the sheet nor the clipboard takes it', async () => {
    expect(await shareReveal(E2_G4, null, ways(false, false))).toBe('failed')
  })
})
