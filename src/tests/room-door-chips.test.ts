// ============================================================
// The room doors sit in the bar, not two levels down a drawer
// ============================================================
//
// Reported about the phone: the Singing page has "a sleek timeline bar, and a
// simple selector, and then the right anchored buttons" — while Piano and
// Guitar hid their performance rooms inside the options sheet. Piano Night
// was three taps down ("Piano Night > Performance room > Open room"); Guitar
// Night was three taps down its own ("More > Guitar Night > Open").
//
// Both are one tap from the bar now, and both are STILL in the drawer. That
// is deliberate: the drawer entry is the one anybody who already found it
// will reach for, and swapping one door for another trades a complaint for a
// complaint.
//
// The geometry — same row, real touch targets, no sideways scroll — is
// asserted in `src/e2e/piano-night.spec.ts` and `src/e2e/guitar.spec.ts`,
// where there is a layout engine to ask.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const DOORS = [
  {
    room: 'Guitar Night',
    page: 'src/pages/GuitarPage.tsx',
    testId: 'guitar-room-chip',
    href: 'href="/guitar-night"',
    busyLabel: 'busyLabel="Opening Guitar Night…"',
    drawerLabel: '<OptionRow label="Guitar Night">',
  },
  {
    room: 'Piano Night',
    page: 'src/components/mobile/PianoMobileStage.tsx',
    testId: 'piano-room-chip',
    href: 'href={PIANO_NIGHT_PATH}',
    busyLabel: 'busyLabel="Opening Piano Night…"',
    drawerLabel: '<OptionSection label="Piano Night">',
  },
] as const

describe.each(DOORS)('$room', (door) => {
  const source = repoFile(door.page)

  it('has a door in the bar', () => {
    expect(source).toContain(`data-testid="${door.testId}"`)
    expect(source).toContain(door.href)
  })

  it('keeps the door in the drawer as well', () => {
    expect(source).toContain(door.drawerLabel)
  })

  it('spins while the room loads', () => {
    // Opening a room is a whole document load. Without this the chip looks
    // ignored for as long as the next page takes to arrive — the reason
    // every room door got `BusyLink` in 0.9.0.
    expect(source).toContain('<BusyLink')
    expect(source).toContain(door.busyLabel)
  })

  it('names itself, because the phone shows only the icon', () => {
    // `.chipLabel` is `display: none` under 768px and the Piano chip is a
    // short word; either way the accessible name cannot come from the label.
    const chip = source.slice(
      source.indexOf(`data-testid="${door.testId}"`) - 600,
      source.indexOf(`data-testid="${door.testId}"`) + 400,
    )
    expect(chip).toMatch(/aria-label="Open (Guitar Night|Piano Night)/)
  })
})

describe('the phone status bar chips', () => {
  const css = repoFile(
    'src/components/shared/status-bar/SongStatusBar.module.css',
  )

  it('are a thumb wide once they lose their labels', () => {
    // Iconified they were 25px tall — a quarter of the row and well under a
    // thumb. This is the rule that stops the new Guitar Night door being a
    // 37x25 target.
    const phone = css.slice(css.indexOf('@media (max-width: 768px)'))
    expect(phone).toContain('min-height: 34px')
    expect(phone).toContain('min-width: 34px')
  })
})
