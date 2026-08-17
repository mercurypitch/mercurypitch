// ============================================================
// Guitar Night gives the fretboard back its height on a phone
// ============================================================
//
// Four findings from the owner's iPhone 13 Pro, all of them layout and none of
// them visible to jsdom, which has no layout engine at all. The contract is
// read off the stylesheet instead, the way HeaderAccount's touch targets are —
// that file is also where a future compaction pass would quietly undo this.
//
// The behaviour halves live with their components: the portalled camera sheet
// in GuitarNightStage.test.tsx, the docked voice pill in
// VoiceControlHud.test.tsx, the segmented loop marks in
// GuitarNightLoopControls.test.tsx, and the restacked stem card in
// GuitarNightRoom.test.tsx.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  'src/features/guitar-night/GuitarNightApp.module.css',
  'utf8',
)

/**
 * Every block authored under exactly `query`, concatenated. The stylesheet
 * opens the same breakpoint several times, so taking only the first one reads
 * the wrong half of the file.
 */
function mediaBlock(query: string): string {
  const opener = `${query} {`
  const blocks: string[] = []
  for (
    let start = css.indexOf(opener);
    start !== -1;
    start = css.indexOf(opener, start + 1)
  ) {
    const rest = css.slice(start)
    const end = rest.indexOf('\n}\n')
    blocks.push(end === -1 ? rest : rest.slice(0, end))
  }
  expect(blocks.length, `missing ${query}`).toBeGreaterThan(0)
  return blocks.join('\n')
}

describe('the phone header keeps to one row', () => {
  const phone = mediaBlock('@media (max-width: 720px)')
  const landscape = mediaBlock(
    '@media (max-height: 540px) and (min-width: 560px)',
  )

  it('drops the wordmark and keeps the mark on a narrow phone', () => {
    expect(phone).toMatch(/\.brand span\s*\{[^}]*display:\s*none/)
  })

  it('drops the wordmark, the app name and the room name in landscape', () => {
    // A landscape phone is 844x390: wide enough to escape every max-width
    // rule, and short enough that a second header row costs the fretboard the
    // height it needs. "Guitar Night" and "Velvet Rehearsal" are both
    // recoverable from the room menu, so neither earns a permanent row.
    expect(landscape).toMatch(
      /\.brand span,[\s\S]*?\.roomName\s*\{[\s\S]*?display:\s*none/,
    )
    expect(landscape).toMatch(/\.topbar\s*\{[^}]*flex-wrap:\s*nowrap/)
  })
})

describe('the take cue is a badge on a tight screen', () => {
  // "The jam doctor thing that cannot really be closed" — a full-width card
  // floating over the fretboard, with no dismiss of its own. The icon opens
  // the same dialog, and the button's aria-label still carries the sentence,
  // so nothing is lost to a screen reader.
  const tight = mediaBlock('@media (max-width: 720px), (max-height: 540px)')

  it('hides the cue copy and the Review word', () => {
    expect(tight).toMatch(
      /\.doctorCue > button > b,\s*\.doctorCueCopy\s*\{\s*display:\s*none/,
    )
  })

  it('shrinks the card to a round button', () => {
    expect(tight).toMatch(/\.doctorCue > button\s*\{[^}]*border-radius:\s*50%/)
    expect(tight).toMatch(/\.doctorCue > button\s*\{[^}]*width:\s*auto/)
  })

  it('stops the cue stretching across the stage', () => {
    expect(tight).toMatch(/\.doctorCue\s*\{[^}]*width:\s*auto/)
    expect(tight).toMatch(/\.doctorCue\s*\{[^}]*right:\s*auto/)
  })
})

describe('speed and volume split the transport row evenly', () => {
  const phone = mediaBlock('@media (max-width: 720px)')
  const landscape = mediaBlock(
    '@media (max-height: 540px) and (min-width: 560px)',
  )

  /** The four transport columns as authored, whitespace collapsed. */
  function backingColumns(block: string): string {
    const match = block.match(
      /\[data-room-kind='backing'\] \.transportControls\s*\{[^}]*grid-template-columns:([^;]+);/,
    )
    expect(match, 'missing backing transport columns').not.toBeNull()
    return (match?.[1] ?? '').replace(/\s+/g, ' ').trim()
  }

  it('gives each an equal share on a phone', () => {
    // Sizing speed by its content let it swallow the row: it took
    // minmax(6.8rem, 1fr) while volume was pinned to minmax(3rem, 4rem).
    expect(backingColumns(phone)).toBe(
      'var(--touch-target) minmax(3.25rem, 3.55rem) minmax(0, 1fr) minmax(0, 1fr)',
    )
  })

  it('gives each an equal share in landscape', () => {
    expect(backingColumns(landscape)).toBe(
      'var(--touch-target) 3.25rem minmax(0, 1fr) minmax(0, 1fr)',
    )
  })

  it('lets only the speed readout shrink, never the touch targets', () => {
    expect(phone).toMatch(
      /\[data-room-kind='backing'\] \.playbackSpeed\s*\{[^}]*grid-template-columns:\s*var\(--touch-target\) minmax\(0, 1fr\)\s*var\(--touch-target\)/,
    )
  })

  it('lets the volume fill the half it was given', () => {
    expect(phone).toMatch(
      /\[data-room-kind='backing'\] \.masterVolume\s*\{[^}]*justify-self:\s*stretch/,
    )
  })
})

describe('the stem card stacks its name above its state', () => {
  it('gives the name the whole first line', () => {
    expect(css).toMatch(/\.channelStrip strong\s*\{[^}]*grid-column:\s*1 \/ -1/)
    expect(css).toMatch(
      /\.channelStrip strong\s*\{[^}]*text-overflow:\s*ellipsis/,
    )
  })

  it('lets the cards share the strip instead of overflowing it', () => {
    expect(css).toMatch(/\.channelStrip button\s*\{[^}]*flex:\s*1 1 0/)
    expect(css).toMatch(
      /\.channelStrip button\s*\{[^}]*grid-template-columns:\s*1rem minmax\(0, 1fr\)/,
    )
  })
})
