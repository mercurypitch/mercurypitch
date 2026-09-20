// ============================================================
// The song's name, in the room's header
// ============================================================
//
// Owner report (2026-09-20, tablet): "our song takes too much space in the
// third row". The name led a bar of its own between the playback controls
// and the words. It is in the header now, after the room's name -- as much
// of it as fits, and the rest on hover or a tap.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'

const room = vi.hoisted(() => ({
  getSong: null as unknown as () => JamSong | null,
}))

vi.mock('@/stores/jam-store', () => ({
  jamSong: () => room.getSong(),
}))

const { JamNowSinging } = await import('@/components/jam/JamNowSinging')

const [song, setSong] = createSignal<JamSong | null>(null)
room.getSong = song

const roomSong = (id: string, title: string, artist?: string): JamSong => ({
  id,
  title,
  ...(artist === undefined ? {} : { artist }),
  stems: { instrumental: 'blob:instrumental' },
  lines: [],
  notes: [],
  durationSec: 180,
  origin: 'local',
})

afterEach(() => {
  cleanup()
  setSong(null)
})

describe('the song name in the jam header', () => {
  it('is not there when the room is on a drill', () => {
    const { queryByTestId } = render(() => <JamNowSinging />)
    expect(queryByTestId('jam-now-singing')).toBeNull()
  })

  it('says the song and who it is by', () => {
    setSong(roomSong('a', 'Goodbye to Spring', 'Josh Woodward'))
    const { getByTestId } = render(() => <JamNowSinging />)
    expect(getByTestId('jam-now-singing').textContent).toBe(
      'Goodbye to Spring · Josh Woodward',
    )
  })

  it('leaves no dangling separator for a song with no artist', () => {
    setSong(roomSong('a', 'My upload'))
    const { getByTestId } = render(() => <JamNowSinging />)
    const chip = getByTestId('jam-now-singing')
    expect(chip.textContent).toBe('My upload')
    expect(chip.getAttribute('title')).toBe('My upload')
  })

  it('carries the WHOLE name for a hover, however little of it fits', () => {
    const long = 'A Very Long Song Title That No Header Could Ever Hold'
    setSong(roomSong('a', long, 'An Equally Long Artist Name'))
    const { getByTestId } = render(() => <JamNowSinging />)
    const chip = getByTestId('jam-now-singing')
    expect(chip.getAttribute('title')).toBe(
      `${long} · An Equally Long Artist Name`,
    )
    expect(chip.getAttribute('aria-label')).toBe(
      `Now singing: ${long} · An Equally Long Artist Name`,
    )
  })

  it('opens out on a tap and closes on the next', () => {
    setSong(roomSong('a', 'Goodbye to Spring', 'Josh Woodward'))
    const { getByTestId } = render(() => <JamNowSinging />)
    const chip = getByTestId('jam-now-singing')
    expect(chip.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('false')
  })

  it('starts closed for the next song: what was opened was the old name', () => {
    setSong(roomSong('a', 'First', 'Someone'))
    const { getByTestId } = render(() => <JamNowSinging />)
    fireEvent.click(getByTestId('jam-now-singing'))
    expect(getByTestId('jam-now-singing').getAttribute('aria-expanded')).toBe(
      'true',
    )

    setSong(roomSong('b', 'Second', 'Someone else'))
    expect(getByTestId('jam-now-singing').getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  it('stays open through an update to the SAME song', () => {
    // The pitch guide arriving, or the words being edited, replaces the song
    // object without changing the song. That must not snap the name shut
    // under the finger that just opened it.
    const first = roomSong('a', 'First', 'Someone')
    setSong(first)
    const { getByTestId } = render(() => <JamNowSinging />)
    fireEvent.click(getByTestId('jam-now-singing'))

    setSong({ ...first, durationSec: 181 })
    expect(getByTestId('jam-now-singing').getAttribute('aria-expanded')).toBe(
      'true',
    )
  })
})

// ── The rows themselves ─────────────────────────────────────────────
//
// jsdom lays nothing out, so these read the stylesheets for the rules the
// layout stands on. The browser spec (jam-room-rows.spec.ts) measures them.

const css = (file: string): string =>
  readFileSync(resolve(__dirname, '../components/jam', file), 'utf8')

const block = (sheet: string, selector: string): string => {
  const at = sheet.indexOf(`${selector} {`)
  if (at === -1) throw new Error(`${selector} is not in the stylesheet`)
  return sheet.slice(at, sheet.indexOf('}', at))
}

describe('the jam room rows', () => {
  it('lets the playback row hold the timeline beside the buttons, and wrap', () => {
    const row = block(css('JamPanel.module.css'), '.transportRow')
    expect(row).toContain('display: flex')
    expect(row).toContain('flex-wrap: wrap')
    const timeline = block(css('JamPanel.module.css'), '.songTimeline')
    expect(timeline).toMatch(/flex: 1 1 \d+px/)
    expect(timeline).toContain('min-width: 0')
  })

  it('scrolls the BUTTONS sideways on a phone, never the timeline', () => {
    const sheet = css('JamPanel.module.css')
    const phone = sheet.slice(sheet.indexOf('@media (max-width: 640px)'))
    expect(block(phone, '.exerciseBar')).toContain('overflow-x: auto')
    expect(phone).not.toMatch(/\.transportRow \{[^}]*overflow-x/)
    expect(block(phone, '.songTimeline')).toContain('flex: 0 0 100%')
  })

  it('asks for a few words and grows, so the header never wraps for a name', () => {
    // A wrapping row breaks on what each item ASKS for before it shrinks
    // anything. Asking for the whole name (`flex: 0 1 auto`) made the header
    // a row taller at 1180px and 1280px -- measured, 38px to 60px.
    const chip = block(css('JamNowSinging.module.css'), '.chip')
    expect(chip).toMatch(/flex: 1 1 [\d.]+rem/)
    expect(chip).toContain('max-width: max-content')
    // ...and never less than it asked for: squeezed, it was a note and an
    // ellipsis 22px wide.
    expect(chip).toMatch(/min-width: min\([\d.]+rem, 100%\)/)
    expect(block(css('JamNowSinging.module.css'), '.name')).toContain(
      'text-overflow: ellipsis',
    )
  })

  it('keeps no bar of its own on the stage', () => {
    const stage = css('JamSongStage.module.css')
    expect(stage).not.toMatch(/^\.transport \{/m)
    expect(stage).not.toMatch(/^\.scrub \{/m)
  })
})
