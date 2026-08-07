// ============================================================
// Lead-in cue — coming back in after a short silence
// ============================================================
//
// Gaps above REST_THRESHOLD_SEC get a rest row with countdown dots. Below it
// there was nothing at all, so a four-second silence left the singer knowing
// the line but not the moment. These pin the band and the ramp.

import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import { buildCanonicalEntries, LEAD_IN_MAX_SEC, LEAD_IN_MIN_GAP_SEC, leadInProgress, REST_THRESHOLD_SEC, } from '@/lib/canonical-lrc'
import type { LrcLine } from '@/lib/lyrics-service'

const line = (time: number, text: string): LrcLine => ({ time, text })

/** Canonical 'line' entries only — rests shift the indices. */
function lines(entries: LrcLine[]) {
  return buildCanonicalEntries(entries).filter((e) => e.type === 'line')
}

describe('lead-in windows', () => {
  it('marks a gap too short for a rest but long enough to lose the beat', () => {
    // 4 s of silence: the reported case.
    const [, second] = lines([line(1, 'first'), line(5, 'second')])
    expect(second.leadInFrom).toBe(1)
  })

  it('leaves a gap that is barely a breath alone', () => {
    const [, second] = lines([line(1, 'first'), line(2, 'second')])
    expect(second.leadInFrom).toBeUndefined()
  })

  it('leaves long silences to the rest row that already covers them', () => {
    const gap = REST_THRESHOLD_SEC + 5
    const built = lines([line(1, 'first'), line(1 + gap, 'second')])
    expect(built[1].leadInFrom).toBeUndefined()
  })

  it('caps the run-in however wide the gap', () => {
    // Just under the rest threshold: a 19 s cue would be its own ordeal.
    const built = lines([line(1, 'first'), line(20, 'second')])
    expect(built[1].leadInFrom).toBe(20 - LEAD_IN_MAX_SEC)
  })

  it('measures the gap from where singing stopped, not where the line began', () => {
    // Word-level LRC: the first line runs to 4 s, so the silence before the
    // second is 3 s, not the 8 s its line starts are apart.
    const built = lines([line(1, 'one [00:04.00]two'), line(9, 'second')])
    expect(built[1].leadInFrom).toBe(4)
  })

  it('cues the first line when the song opens on silence', () => {
    const [first] = lines([line(4, 'first')])
    expect(first.leadInFrom).toBe(0)
  })

  it('exposes the threshold it uses, so callers cannot drift from it', () => {
    expect(LEAD_IN_MIN_GAP_SEC).toBe(2.5)
  })
})

describe('leadInProgress', () => {
  it('ramps from 0 at the run-in to 1 at the line', () => {
    expect(leadInProgress(10, 14, 10)).toBe(0)
    expect(leadInProgress(10, 14, 12)).toBe(0.5)
    expect(leadInProgress(10, 14, 13)).toBe(0.75)
  })

  it('is null outside its window, not zero', () => {
    // Zero would render a cue on every line in the song, permanently empty.
    expect(leadInProgress(10, 14, 9.9)).toBeNull()
    expect(leadInProgress(10, 14, 14)).toBeNull()
    expect(leadInProgress(10, 14, 200)).toBeNull()
  })

  it('is null for a line that has no cue', () => {
    expect(leadInProgress(undefined, 14, 12)).toBeNull()
  })

  it('is null rather than dividing by zero on a degenerate window', () => {
    expect(leadInProgress(14, 14, 14)).toBeNull()
    expect(leadInProgress(15, 14, 14.5)).toBeNull()
  })
})

// Zen karaoke renders from `stableParsedLyrics` and nothing else — it never
// sees a canonical entry. If the field stops making that hop the cue silently
// stops existing there, with nothing else breaking to give it away.
describe('the cue reaching the surfaces that draw it', () => {
  it('carries leadInFrom into the map zen renders from', () => {
    createRoot((dispose) => {
      const controller = useStemMixerLyricsController({
        sessionId: 'lead-in-hop',
        songTitle: 'Silence',
        duration: () => 200,
        playing: () => false,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })
      controller.handleLyricsUpload({
        filename: 'silence.lrc',
        format: 'lrc',
        // 4 s of silence before the second line: a cue, not a rest row.
        text: '[00:01.00]first\n[00:05.00]second\n',
      })

      const parsed = controller.stableParsedLyrics()
      expect(parsed.get(1)?.leadInFrom).toBe(1)
      // And the line with nothing before it to wait through carries none.
      expect(parsed.get(0)?.leadInFrom).toBeUndefined()
      dispose()
    })
  })
})
