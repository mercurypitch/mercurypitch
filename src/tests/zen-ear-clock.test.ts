// ============================================================
// In zen mode, what you follow by ear runs on the audible clock
// ============================================================
//
// The mixer keeps two clocks. `elapsed` is where the transport is;
// `audibleElapsed` is where the sound has reached the output device, which
// over Bluetooth is a fifth of a second behind. The word sweep was moved onto
// the audible one long ago, but the pitch ribbon, the run-in to a line and
// the rest countdown were left on the transport, so on the one surface where
// all four sit together they disagreed: the notes arrived before the sound
// they were drawn for.
//
// Asserted against the source, in the manner of
// `src/tests/mixer-music-level.test.ts`: which clock reaches which visual is
// a wiring question, and rendering the whole zen stage to read a number off a
// canvas would pin far less for far more. The geometry each of them draws is
// covered by `zen-pitch-ribbon.test.ts`.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stage = readFileSync(
  resolve(process.cwd(), 'src/components/KaraokeMobileStage.tsx'),
  'utf8',
)

/** The JSX of one element, from its tag to the first `/>`. */
function element(tag: string): string {
  const from = stage.indexOf(`<${tag}`)
  expect(from, `${tag} is no longer rendered here`).toBeGreaterThan(-1)
  return stage.slice(from, stage.indexOf('/>', from))
}

describe('the zen stage', () => {
  it('names the audible clock once, and falls back when a host omits it', () => {
    // Optional on the props: a host that passes no audible position gets the
    // transport, which is what every caller had before this existed.
    expect(stage).toContain(
      'const earElapsed = (): number => props.lyricsElapsed?.() ?? props.elapsed()',
    )
  })

  it.each([
    ['the pitch ribbon', 'ZenPitchRibbon'],
    ['the rest countdown', 'RestCountdownDots'],
  ])('draws %s against it', (_label, tag) => {
    expect(element(tag)).toContain('elapsed={earElapsed}')
    expect(element(tag)).not.toContain('elapsed={props.elapsed}')
  })

  it('runs the lead-in to a line against it', () => {
    expect(stage).toContain(
      'leadInProgress(entry.leadInFrom, entry.time, earElapsed())',
    )
  })

  it('sweeps the words of the current line against it', () => {
    const word = stage.slice(
      stage.indexOf('props.computeActiveWord('),
      stage.indexOf('entry.wordEndTimes'),
    )
    expect(word).toContain('earElapsed()')
  })

  it('leaves the transport reporting the transport', () => {
    // The scrubber's own position and the time readout are the transport, not
    // the performance: dragging to 1:30 must read 1:30, not 1:29.8.
    expect(element('Scrubber')).toContain('value={props.elapsed()}')
    expect(stage).toContain('formatTime(scrub() ?? props.elapsed())')
  })
})
