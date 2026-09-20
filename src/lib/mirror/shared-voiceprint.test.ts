import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeSharePayload, encodeVoiceprintForShare } from '@/lib/share-codec'
import { formatSpan, newOgCardId, OG_CARD_PARAM, parseVoiceprintLink, sharedRangeNotes, sharedVoiceprintTitle, uploadOgCard, VOICEPRINT_PARAM, voiceprintShareUrl, } from './shared-voiceprint'

const FULL = {
  lowMidi: 48,
  highMidi: 74,
  semitones: 26,
  accuracy: 12,
  steadiness: 9,
}

function searchOf(url: string): string {
  return url.slice(url.indexOf('?'))
}

describe('voiceprintShareUrl', () => {
  it('round-trips a full summary through the link', () => {
    const data = parseVoiceprintLink(
      searchOf(voiceprintShareUrl(FULL, 'Freddie Mercury')),
    )
    expect(data).not.toBeNull()
    expect(data?.lo).toBe(48)
    expect(data?.hi).toBe(74)
    expect(data?.st).toBe(26)
    expect(data?.ac).toBe(12)
    expect(data?.sd).toBe(9)
    expect(data?.tw).toBe('Freddie Mercury')
  })

  it('keeps the acquisition tag so the GA4 series stays continuous', () => {
    const url = voiceprintShareUrl(FULL, null)
    expect(url).toContain('utm_source=voiceprint')
    expect(url).toContain('utm_medium=share')
  })

  it('carries no name unless the singer opted into one', () => {
    const anon = parseVoiceprintLink(
      searchOf(voiceprintShareUrl(FULL, 'Adele')),
    )
    expect(anon?.n).toBeUndefined()

    const named = parseVoiceprintLink(
      searchOf(voiceprintShareUrl(FULL, 'Adele', 'Marko')),
    )
    expect(named?.n).toBe('Marko')
  })

  it('falls back to the bare tagged URL when there is nothing to encode', () => {
    const url = voiceprintShareUrl(null)
    expect(url).not.toContain(`${VOICEPRINT_PARAM}=`)
    expect(url).toContain('utm_source=voiceprint')
  })

  it('falls back rather than emitting a payload the decoder rejects', () => {
    // No numeric metric at all — the codec refuses it, so the link must not
    // carry it and strand the recipient on an empty card.
    const url = voiceprintShareUrl({}, 'Freddie Mercury')
    expect(url).not.toContain(`${VOICEPRINT_PARAM}=`)
  })

  it('survives a partial take that only measured range', () => {
    const url = voiceprintShareUrl({ lowMidi: 48, highMidi: 60, semitones: 12 })
    const data = parseVoiceprintLink(searchOf(url))
    expect(data?.lo).toBe(48)
    expect(data?.ac).toBeUndefined()
  })
})

describe('parseVoiceprintLink', () => {
  it('returns null for a location with no payload', () => {
    expect(parseVoiceprintLink('')).toBeNull()
    expect(parseVoiceprintLink('?utm_source=voiceprint')).toBeNull()
  })

  it('returns null for a malformed payload rather than throwing', () => {
    expect(
      parseVoiceprintLink(`?${VOICEPRINT_PARAM}=not-base64url!!`),
    ).toBeNull()
    expect(parseVoiceprintLink(`?${VOICEPRINT_PARAM}=`)).toBeNull()
  })

  it('refuses a share payload of a different type', () => {
    // A melody link must not render as somebody's voice.
    const melody =
      'eyJ2IjoxLCJ0IjoibWVsb2R5IiwiZCI6eyJuIjoiWCIsImIiOjEyMCwiaSI6W119fQ'
    expect(parseVoiceprintLink(`?${VOICEPRINT_PARAM}=${melody}`)).toBeNull()
  })
})

describe('the payload boundary', () => {
  it('encodes only what is already printed on the card', () => {
    const payload = decodeSharePayload(
      encodeVoiceprintForShare(FULL, 'Freddie Mercury', 'Marko'),
    )
    expect(payload?.t).toBe('voiceprint')
    expect(Object.keys(payload?.d ?? {}).sort()).toEqual([
      'ac',
      'hi',
      'lo',
      'n',
      'sd',
      'st',
      'tw',
    ])
  })

  it('stays short enough to be an ordinary URL', () => {
    expect(voiceprintShareUrl(FULL, 'Freddie Mercury').length).toBeLessThan(300)
  })
})

describe('sharedVoiceprintTitle', () => {
  it('names the sender when they opted in, and stays anonymous otherwise', () => {
    expect(sharedVoiceprintTitle({ lo: 48, n: 'Marko' })).toBe(
      "Marko's voiceprint",
    )
    expect(sharedVoiceprintTitle({ lo: 48 })).toBe('A voiceprint')
    expect(sharedVoiceprintTitle({ lo: 48, n: '' })).toBe('A voiceprint')
  })
})

describe('formatSpan', () => {
  it('speaks in octaves and semitones', () => {
    expect(formatSpan(26)).toBe('2 octaves + 2 semitones')
    expect(formatSpan(24)).toBe('2 octaves')
    expect(formatSpan(7)).toBe('7 semitones')
  })

  it('keeps a single unit singular', () => {
    expect(formatSpan(12)).toBe('1 octave')
    expect(formatSpan(13)).toBe('1 octave + 1 semitone')
    expect(formatSpan(1)).toBe('1 semitone')
  })

  it('returns null rather than a nonsense span', () => {
    expect(formatSpan(0)).toBeNull()
    expect(formatSpan(-5)).toBeNull()
    expect(formatSpan(null)).toBeNull()
    expect(formatSpan(undefined)).toBeNull()
    expect(formatSpan(Number.NaN)).toBeNull()
  })
})

describe('sharedRangeNotes', () => {
  it('names the two ends of the range', () => {
    expect(sharedRangeNotes({ lo: 48, hi: 74 })).toBe('C3 – D5')
  })

  it('is null when the take measured no range', () => {
    expect(sharedRangeNotes({ ac: 12 })).toBeNull()
    expect(sharedRangeNotes({ lo: 48 })).toBeNull()
  })
})

describe('newOgCardId', () => {
  it('is ten base62 characters, the same shape as a share id', () => {
    for (let i = 0; i < 50; i++) {
      expect(newOgCardId()).toMatch(/^[0-9A-Za-z]{10}$/)
    }
  })

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 200 }, () => newOgCardId()))
    expect(seen.size).toBe(200)
  })
})

describe('a link naming a stored card', () => {
  it('carries the card id alongside the voiceprint and the tag', () => {
    const url = voiceprintShareUrl(FULL, 'Adele', null, 'aB3xY9zQ01')
    expect(url).toContain(`${OG_CARD_PARAM}=aB3xY9zQ01`)
    expect(url).toContain(`${VOICEPRINT_PARAM}=`)
    expect(url).toContain('utm_source=voiceprint')
  })

  it('omits the card when none was stored', () => {
    expect(voiceprintShareUrl(FULL, 'Adele')).not.toContain(`${OG_CARD_PARAM}=`)
    expect(voiceprintShareUrl(FULL, 'Adele', null, '')).not.toContain(
      `${OG_CARD_PARAM}=`,
    )
  })

  it('still decodes the voiceprint with a card id present', () => {
    const url = voiceprintShareUrl(FULL, 'Adele', null, 'aB3xY9zQ01')
    const data = parseVoiceprintLink(url.slice(url.indexOf('?')))
    expect(data?.lo).toBe(48)
    expect(data?.tw).toBe('Adele')
  })
})

describe('uploadOgCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs the card to its own id', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null)))
    vi.stubGlobal('fetch', fetchMock)

    const png = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    uploadOgCard('aB3xY9zQ01', png)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/og/card/aB3xY9zQ01',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('swallows a failure rather than leaving an unowned rejection', async () => {
    // A rejected fire-and-forget outliving its test file fails an otherwise
    // green run, and the singer has nothing to do about it either way.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    expect(() =>
      uploadOgCard('aB3xY9zQ01', new Blob([new Uint8Array([1])])),
    ).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })
})
