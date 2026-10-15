// The widths the mixer's rows fold at, said once in CSS and once in TS.
// ============================================================
//
// The rail's timeline takes its own line and the header's buttons drop
// their words by container query, which only CSS can say; the tests and
// the fold notes read the same widths from rail-fold.ts and header-fold.ts.
// A width changed in one place and not the other would leave the e2e
// checking a fold that no longer happens there, so they are held equal.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEADER_WORDS_PX } from '../header/header-fold'
import { TIMELINE_OWN_LINE_COARSE_PX, TIMELINE_OWN_LINE_PX } from './rail-fold'

const MIXER = resolve(process.cwd(), 'src/components/stem-mixer')

const read = (sheet: string): string =>
  readFileSync(resolve(MIXER, sheet), 'utf8')

/** Every `max-width` a named container query in this sheet asks about. */
function containerWidths(css: string, container: string): number[] {
  const query = new RegExp(
    `@container\\s+${container}\\s*\\(\\s*max-width:\\s*(\\d+)px\\s*\\)`,
    'g',
  )
  return [...css.matchAll(query)].map((match) => Number(match[1]))
}

describe('the mixer rows fold where their notes say', () => {
  it('puts the timeline on its own line under 650 px of rail, 1000 on a touch screen', () => {
    const css = read('rail/MixerRail.module.css')
    expect(containerWidths(css, 'mixer-rail').sort()).toEqual(
      [TIMELINE_OWN_LINE_PX - 1, TIMELINE_OWN_LINE_COARSE_PX - 1].sort(),
    )
    // The coarse width is the one inside the pointer query.
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(containerWidths(coarse, 'mixer-rail')).toEqual([
      TIMELINE_OWN_LINE_COARSE_PX - 1,
    ])
  })

  it("drops the header buttons' words under 1000 px of header", () => {
    expect(
      containerWidths(read('header/MixerHeader.module.css'), 'mixer-header'),
    ).toEqual([HEADER_WORDS_PX - 1])
  })
})
