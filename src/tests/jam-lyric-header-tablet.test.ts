// ============================================================
// The lyric header's controls on a tablet
// ============================================================
//
// Owner report, 2026-09-20, from a tablet: "the pitch guide '- 1x +' button
// is sleek compact, but on the lyrics header the toggles for left / middle /
// right alignment and the zoom level - 100% + buttons are too bulky in
// height. On desktop they seem fine."
//
// Not a bug: every touch screen got a phone's 40px targets, and the lane
// zoom beside them is 28px on the same screen. A touch screen wider than a
// phone now takes the lane zoom's size. jsdom has no layout and no pointer
// type, so what is pinned here is the stylesheet; the pixels are measured in
// `jam-stage-layout.spec.ts`.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = resolve(__dirname, '../..')
const css = (file: string): string =>
  readFileSync(resolve(repo, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of one top-level `@media` block, braces balanced. */
function mediaBlocks(sheet: string, query: string): string[] {
  const blocks: string[] = []
  let from = sheet.indexOf(query)
  while (from !== -1) {
    const open = sheet.indexOf('{', from)
    let depth = 1
    let at = open + 1
    while (depth > 0 && at < sheet.length) {
      if (sheet[at] === '{') depth += 1
      if (sheet[at] === '}') depth -= 1
      at += 1
    }
    blocks.push(sheet.slice(open + 1, at - 1))
    from = sheet.indexOf(query, at)
  }
  return blocks
}

const lyrics = css('src/components/jam/JamSongLyrics.module.css')
const laneZoom = css('src/components/jam/JamLaneZoomControl.module.css')
const TABLET = '@media (pointer: coarse) and (min-width: 641px)'
const PHONE = '@media (pointer: coarse) and (max-width: 640px)'

describe('the lyric header on a touch screen wider than a phone', () => {
  it('wears the lane zoom’s size, so the room’s small pills are one height', () => {
    const thumb = /min-width: var\(--jam-zoom-target, (\d+px)\)/.exec(
      mediaBlocks(laneZoom, '@media (pointer: coarse)').join('\n'),
    )?.[1]
    expect(thumb).toBe('28px')

    const tablet = mediaBlocks(lyrics, TABLET).join('\n')
    expect(tablet).toContain(`--jam-zoom-target: ${thumb}`)
    // Both pills, or the alignment buttons stay 40px beside a 28px zoom.
    expect(tablet).toContain(`--lyrics-align-target: ${thumb}`)
  })

  it('never goes under the 24px floor', () => {
    const sizes = [
      ...mediaBlocks(lyrics, TABLET)
        .join('\n')
        .matchAll(/--(?:jam-zoom|lyrics-align)-target: (\d+)px/g),
    ].map((match) => Number(match[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(24)
  })

  it('leaves a phone its thumb-sized targets', () => {
    const everyTouch = mediaBlocks(lyrics, '@media (pointer: coarse) {').join(
      '\n',
    )
    expect(everyTouch).toContain('--jam-zoom-target: 40px')
    // The 32px squeeze is a phone's step; on a tablet it would make the
    // buttons GROW as the column narrowed.
    expect(mediaBlocks(lyrics, PHONE).join('\n')).toContain(
      '--jam-zoom-target: 32px',
    )
    expect(mediaBlocks(lyrics, TABLET).join('\n')).not.toContain('32px')
  })

  it('comes after the rule for every touch screen, or it would lose to it', () => {
    expect(lyrics.indexOf(TABLET)).toBeGreaterThan(
      lyrics.indexOf('--jam-zoom-target: 40px'),
    )
  })

  it('splits at the width where the room’s stylesheet stops being a phone', () => {
    const panel = css('src/components/jam/JamPanel.module.css')
    expect(panel).toContain('@media (max-width: 640px)')
    expect(lyrics).toContain(PHONE)
    expect(lyrics).toContain(TABLET)
  })
})
