// Piano Night link tests keep desktop and mobile launchers on the canonical route.
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PIANO_NIGHT_PATH } from '@/features/piano-night/route'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Piano Night launchers', () => {
  it('uses one canonical path in both legacy Piano presentations', () => {
    const desktop = repoFile('src/pages/PianoPage.tsx')
    const mobile = repoFile('src/components/mobile/PianoMobileStage.tsx')

    expect(PIANO_NIGHT_PATH).toBe('/piano-night')
    expect(desktop).toContain('href={PIANO_NIGHT_PATH}')
    expect(desktop).toContain('data-tour="piano-night-launch"')
    expect(desktop).toContain('data-testid="open-piano-night"')
    expect(mobile).toContain('href={PIANO_NIGHT_PATH}')
    expect(mobile).toContain('aria-label="Open Piano Night performance room"')
    expect(mobile).toContain('data-testid="open-piano-night"')
  })

  // ============================================================
  // The room door is in the chip row as well as the drawer
  // ============================================================
  //
  // Singing puts Zen straight in the chip row; Piano Night sat two levels
  // down an options sheet, under "Piano Night > Performance room > Open
  // room". Both places now, deliberately: the drawer entry is the one people
  // already know, and taking it away to add the chip would trade one
  // complaint for another.

  it('offers Piano Night from the chip row, not only the drawer', () => {
    const mobile = repoFile('src/components/mobile/PianoMobileStage.tsx')
    const chipRow = mobile.slice(
      mobile.indexOf('data-tour="piano-mobile-chips"'),
      mobile.indexOf('{/* ── Progress strip'),
    )

    expect(chipRow).toContain('data-testid="piano-room-chip"')
    expect(chipRow).toContain('href={PIANO_NIGHT_PATH}')
    expect(chipRow).toContain('Piano Room')
  })

  it('keeps the drawer entry too', () => {
    const mobile = repoFile('src/components/mobile/PianoMobileStage.tsx')
    const sheet = mobile.slice(mobile.indexOf('<OptionsSheet'))
    expect(sheet).toContain('data-testid="open-piano-night"')
  })

  it('spins the chip while the room loads', () => {
    // A room is a whole document load. Without this the chip looks ignored
    // for as long as the next page takes to arrive.
    const mobile = repoFile('src/components/mobile/PianoMobileStage.tsx')
    expect(mobile).toContain('<BusyLink')
    expect(mobile).toContain('busyLabel="Opening Piano Night…"')
  })

  it('does not dress the room chip as Zen', () => {
    // Zen is a mode of this page; a room is a different page. Two doors that
    // look identical and behave differently is the confusion to avoid.
    const stage = repoFile(
      'src/components/mobile/SingingMobileStage.module.css',
    )
    expect(stage).toContain('.roomChip {')
    const mobile = repoFile('src/components/mobile/PianoMobileStage.tsx')
    expect(mobile).toContain('stageStyles.roomChip')
    expect(mobile).not.toContain('stageStyles.zenChip')
  })
})
