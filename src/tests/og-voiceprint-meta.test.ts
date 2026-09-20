import { describe, expect, it } from 'vitest'
import { voiceprintDescription, voiceprintMetaTags, voiceprintTitle, } from '@/og-voiceprint-meta'

const FULL = { lo: 48, hi: 74, st: 26, ac: 12, sd: 9, tw: 'Freddie Mercury' }

describe('voiceprintTitle', () => {
  it('leads with the twin, because that is the interesting part', () => {
    expect(voiceprintTitle(FULL)).toBe('Freddie Mercury is my voice twin')
  })

  it('names the sender only when they opted into a name', () => {
    expect(voiceprintTitle({ ...FULL, n: 'Marko' })).toBe(
      "Freddie Mercury is Marko's voice twin",
    )
    expect(voiceprintTitle({ lo: 48, hi: 74 })).toBe('A voiceprint')
    expect(voiceprintTitle({ lo: 48, hi: 74, n: 'Marko' })).toBe(
      "Marko's voiceprint",
    )
  })
})

describe('voiceprintDescription', () => {
  it('reads out what the take measured, in the order the card does', () => {
    expect(voiceprintDescription(FULL)).toBe(
      'C3 – D5 · 2 octaves + 2 semitones · accuracy ±12¢ · steadiness ±9¢. Meet your own voice in about a minute.',
    )
  })

  it('omits what a partial take never measured', () => {
    const d = voiceprintDescription({ lo: 48, hi: 74, st: 26 })
    expect(d).toContain('C3 – D5')
    expect(d).not.toContain('accuracy')
    expect(d).not.toContain('steadiness')
  })

  it('still says something when nothing numeric survived', () => {
    expect(voiceprintDescription({ tw: 'Adele' })).toBe(
      'A voiceprint, measured in cents and milliseconds.',
    )
  })

  it('carries no name unless one was given', () => {
    expect(voiceprintDescription(FULL)).not.toMatch(/marko/i)
  })
})

const PAYLOAD =
  'eyJ2IjoxLCJ0Ijoidm9pY2VwcmludCIsImQiOnsibG8iOjQ4LCJoaSI6NzQsInN0IjoyNiwiYWMiOjEyLCJzZCI6OSwidHciOiJGcmVkZGllIE1lcmN1cnkifX0'
const at = (query: string): URL =>
  new URL(`https://mercurypitch.com/mirror${query}`)

describe('voiceprintMetaTags', () => {
  it('leaves the document alone when there is no voiceprint in the link', () => {
    expect(voiceprintMetaTags(at(''))).toBeNull()
    expect(voiceprintMetaTags(at('?utm_source=voiceprint'))).toBeNull()
    expect(voiceprintMetaTags(at('?v=not-a-payload'))).toBeNull()
  })

  it('refuses a share payload that is not a voiceprint', () => {
    const melody =
      'eyJ2IjoxLCJ0IjoibWVsb2R5IiwiZCI6eyJuIjoiWCIsImIiOjEyMCwiaSI6W119fQ'
    expect(voiceprintMetaTags(at(`?v=${melody}`))).toBeNull()
  })

  it('describes the voiceprint even with no card stored', () => {
    const meta = voiceprintMetaTags(at(`?v=${PAYLOAD}`))
    expect(meta?.title).toBe('Freddie Mercury is my voice twin')
    expect(meta?.description).toContain('C3 – D5')
    // No `og`, so the stock image stays — the text still personalises.
    expect(meta?.image).toBeNull()
  })

  it('points at the stored card when the link names one', () => {
    const meta = voiceprintMetaTags(at(`?v=${PAYLOAD}&og=aB3xY9zQ01`))
    expect(meta?.image).toBe(
      'https://mercurypitch.com/api/og/card/aB3xY9zQ01.png',
    )
  })

  it('ignores an og id that is not the right shape', () => {
    // Never interpolate an unvalidated parameter into a URL we publish.
    for (const bad of ['../../etc', 'short', 'way-too-long-here', '']) {
      const meta = voiceprintMetaTags(
        at(`?v=${PAYLOAD}&og=${encodeURIComponent(bad)}`),
      )
      expect(meta?.image).toBeNull()
    }
  })

  it('keeps the image on the origin that was asked for', () => {
    const meta = voiceprintMetaTags(
      new URL(`https://mirror.mercurypitch.com/?v=${PAYLOAD}&og=aB3xY9zQ01`),
    )
    expect(meta?.image).toBe(
      'https://mirror.mercurypitch.com/api/og/card/aB3xY9zQ01.png',
    )
  })
})
