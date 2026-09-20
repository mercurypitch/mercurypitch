// ============================================================
// The jam room's playback controls: a capsule, and a More button
// ============================================================
//
// Owner request, 2026-09-20: the live-pitch toggle was a lone box between
// the transport and the room's mode, and Unison / Harmony Stack / Relay sat
// beside a karaoke song they do nothing to. So the toggle joined the
// transport's capsule, and the tempo and the mode went behind a More button
// that remembers being opened -- the deal the practice bars already make.
//
// What these pin is who gets WHAT. The mode deals a DRILL's melody out into
// parts and the tempo runs a drill's beats; a song has neither, so on a song
// there is no More button rather than one with nothing useful behind it.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const room = vi.hoisted(() => ({
  host: true,
  song: false,
  getMelody: null as unknown as () => object | null,
  getShowPitch: null as unknown as () => boolean,
  setShowPitch: null as unknown as (fn: (v: boolean) => boolean) => void,
  getMode: null as unknown as () => string,
  selectMode: null as unknown as (mode: string) => void,
  getBpm: null as unknown as () => number,
  setBpm: null as unknown as (fn: (v: number) => number) => void,
}))

vi.mock('@/stores/jam-store', () => ({
  jamIsHost: () => room.host,
  jamIsSongRoom: () => room.song,
  jamExerciseMelody: () => room.getMelody(),
  jamExerciseLoop: () => false,
  setJamExerciseLoop: () => {},
  jamExerciseBpm: () => room.getBpm(),
  setJamExerciseBpm: (fn: (v: number) => number) => room.setBpm(fn),
  jamShowPitch: () => room.getShowPitch(),
  setJamShowPitch: (fn: (v: boolean) => boolean) => room.setShowPitch(fn),
  jamRoomMode: () => room.getMode(),
  selectJamRoomMode: (mode: string) => room.selectMode(mode),
}))

// The real transport reads a dozen more signals and installs a key
// listener; all this file needs from it is that it was asked to draw bare.
vi.mock('@/components/jam/JamTransport', () => ({
  JamTransport: (props: { bare?: boolean }) => (
    <div data-testid="transport" data-bare={String(props.bare === true)} />
  ),
}))

const { JamControlBar } = await import('@/components/jam/JamControlBar')
const { JAM_MORE_CONTROLS_KEY, setJamMoreControlsPinned } =
  await import('@/lib/jam/jam-view-prefs')

const [melody, setMelody] = createSignal<object | null>(null)
const [showPitch, setShowPitch] = createSignal(true)
const [mode, setMode] = createSignal('unison')
const [bpm, setBpm] = createSignal(120)
room.getMelody = melody
room.getShowPitch = showPitch
room.setShowPitch = setShowPitch
room.getMode = mode
room.selectMode = setMode
room.getBpm = bpm
room.setBpm = setBpm

afterEach(() => {
  cleanup()
  room.host = true
  room.song = false
  setMelody(null)
  setShowPitch(true)
  setMode('unison')
  setBpm(120)
  setJamMoreControlsPinned(false)
  localStorage.clear()
})

const mount = () =>
  render(() => <JamControlBar onSelectExercise={() => {}} pickerOpen={false} />)

describe('the capsule', () => {
  it('holds the transport, drawn bare, and the live-pitch toggle', () => {
    const { getByTestId } = mount()
    const capsule = getByTestId('jam-controls')
    expect(capsule.contains(getByTestId('transport'))).toBe(true)
    expect(getByTestId('transport').dataset.bare).toBe('true')
    expect(capsule.contains(getByTestId('jam-pitch-toggle'))).toBe(true)
  })

  it('is what a guest gets too, with the one button that is theirs', () => {
    room.host = false
    const { getByTestId, queryByTestId } = mount()
    expect(
      getByTestId('jam-controls').contains(getByTestId('jam-pitch-toggle')),
    ).toBe(true)
    expect(queryByTestId('jam-more-toggle')).toBeNull()
  })

  it('turns the live pitch off and on, and says which it will do', () => {
    const { getByTestId } = mount()
    const toggle = getByTestId('jam-pitch-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.getAttribute('title')).toBe('Hide the live pitch')
    fireEvent.click(toggle)
    expect(room.getShowPitch()).toBe(false)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('Show the live pitch')
  })
})

describe('More', () => {
  it('starts folded: the mode and the tempo are not in the page at all', () => {
    setMelody({})
    const { getByTestId, queryByTestId, queryByRole } = mount()
    const more = getByTestId('jam-more-toggle')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(more.getAttribute('aria-label')).toBe('More controls')
    expect(queryByTestId('jam-more-controls')).toBeNull()
    expect(queryByRole('group', { name: 'Room mode' })).toBeNull()
    expect(queryByRole('spinbutton', { name: 'Playback BPM' })).toBeNull()
  })

  it('opens onto the room mode, and the tempo once a drill is loaded', () => {
    const { getByTestId, getByRole, queryByRole } = mount()
    fireEvent.click(getByTestId('jam-more-toggle'))
    const more = getByTestId('jam-more-toggle')
    expect(more.getAttribute('aria-expanded')).toBe('true')
    expect(more.getAttribute('aria-label')).toBe('Hide extra controls')
    expect(more.getAttribute('aria-controls')).toBe(
      getByTestId('jam-more-controls').id,
    )

    const modes = getByRole('group', { name: 'Room mode' })
    expect(
      Array.from(modes.querySelectorAll('button')).map((b) => b.textContent),
    ).toEqual(['Unison', 'Harmony Stack', 'Relay'])

    // No drill, no tempo: there is nothing for it to be the tempo of.
    expect(queryByRole('spinbutton', { name: 'Playback BPM' })).toBeNull()
    setMelody({})
    expect(getByRole('spinbutton', { name: 'Playback BPM' })).toBeTruthy()
  })

  it('still drives the room from in there', () => {
    setMelody({})
    const { getByTestId, getByRole } = mount()
    fireEvent.click(getByTestId('jam-more-toggle'))
    fireEvent.click(getByRole('button', { name: 'Harmony Stack' }))
    expect(room.getMode()).toBe('harmony')
    expect(
      getByRole('button', { name: 'Harmony Stack' }).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true')
    fireEvent.click(getByRole('button', { name: 'Increase BPM by 5' }))
    expect(room.getBpm()).toBe(125)
  })

  it('remembers being opened, on this device', () => {
    const first = mount()
    fireEvent.click(first.getByTestId('jam-more-toggle'))
    expect(localStorage.getItem(JAM_MORE_CONTROLS_KEY)).toBe('true')
    first.unmount()

    // A second visit: still open, without a click.
    const second = mount()
    expect(second.getByTestId('jam-more-controls')).toBeTruthy()
    fireEvent.click(second.getByTestId('jam-more-toggle'))
    expect(localStorage.getItem(JAM_MORE_CONTROLS_KEY)).toBe('false')
    expect(second.queryByTestId('jam-more-controls')).toBeNull()
  })

  it('is not drawn on a song, where there is nothing behind it', () => {
    room.song = true
    setMelody({})
    // Left open by a drill earlier in the same visit.
    setJamMoreControlsPinned(true)
    const { queryByTestId, queryByRole } = mount()
    expect(queryByTestId('jam-more-toggle')).toBeNull()
    expect(queryByTestId('jam-more-controls')).toBeNull()
    expect(queryByRole('group', { name: 'Room mode' })).toBeNull()
    expect(queryByRole('spinbutton', { name: 'Playback BPM' })).toBeNull()
  })

  it("is the host's: a guest has no tempo and no mode to open", () => {
    room.host = false
    setMelody({})
    setJamMoreControlsPinned(true)
    const { queryByTestId } = mount()
    expect(queryByTestId('jam-more-toggle')).toBeNull()
    expect(queryByTestId('jam-more-controls')).toBeNull()
  })
})

// ── The stylesheet's half of the contract ───────────────────────────
// jsdom lays nothing out, so what CSS has to hold is pinned as text.

const css = (file: string): string =>
  readFileSync(resolve(__dirname, '../components/jam', file), 'utf8')

const block = (sheet: string, selector: string): string => {
  const at = sheet.indexOf(`${selector} {`)
  if (at === -1) throw new Error(`${selector} is not in the stylesheet`)
  return sheet.slice(at, sheet.indexOf('}', at))
}

describe('the stylesheet', () => {
  it('lets the opened controls wrap one at a time, as items of the row', () => {
    expect(block(css('JamControlBar.module.css'), '.extras')).toContain(
      'display: contents',
    )
  })

  it('never lets the capsule squeeze its buttons', () => {
    expect(block(css('JamControlBar.module.css'), '.capsule')).toContain(
      'flex-shrink: 0',
    )
  })

  it('hides its copy of the live-pitch toggle on a phone, and an empty box', () => {
    const sheet = css('JamControlBar.module.css')
    const phone = sheet.slice(sheet.indexOf('@media (max-width: 640px)'))
    expect(block(phone, '.deskOnly')).toContain('display: none')
    expect(block(phone, '.capsuleGuest')).toContain('display: none')
  })

  it('declares nothing the phone block overrides BELOW the phone block', () => {
    // A media query adds no specificity: a base rule after the block wins
    // on source order, which is how this toggle once showed up twice.
    const sheet = css('JamControlBar.module.css')
    const after = sheet.slice(sheet.indexOf('@media (max-width: 640px)'))
    const rest = after.slice(after.indexOf('\n}\n') + 3)
    for (const selector of ['.deskOnly', '.capsuleGuest', '.modeBtn']) {
      expect(rest).not.toContain(`${selector} {`)
    }
  })

  it('only draws a hover where there is a pointer to hover with', () => {
    // A tablet keeps :hover on the last thing tapped, so a folded More went
    // on looking pressed. Every :hover in the sheet sits behind the gate.
    const sheet = css('JamControlBar.module.css').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const gated = sheet.match(/@media \(hover: hover\) \{[\s\S]*?\n\}\n/g) ?? []
    const hovers = sheet.match(/:hover/g) ?? []
    const gatedHovers = gated.join('').match(/:hover/g) ?? []
    expect(hovers.length).toBeGreaterThan(0)
    expect(gatedHovers.length).toBe(hovers.length)
  })

  it('leaves the panel no rule for the controls that moved out of it', () => {
    const panel = css('JamPanel.module.css')
    for (const gone of [
      '.viewToggles',
      '.pitchToggleBtn',
      '.modePicker',
      '.modeBtn',
      '.bpmControl',
    ]) {
      expect(panel).not.toContain(`${gone} {`)
    }
  })

  it('draws the transport without a box inside the capsule', () => {
    expect(block(css('JamTransport.module.css'), '.barBare')).toContain(
      'display: contents',
    )
  })
})
