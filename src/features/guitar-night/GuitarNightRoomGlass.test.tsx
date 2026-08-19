// ============================================================
// The room slider, from the control to the custom property
// ============================================================
//
// The stylesheet half — which rules follow the token, and which deliberately
// do not — is pinned in `src/tests/guitar-night-room-glass.test.ts`. This is
// the other half: the control exists, it is reachable, moving it writes the
// property the whole stylesheet reads, and the choice survives a remount.
//
// jsdom resolves no `calc()` and composites no blur, so what can be asserted
// here is the plumbing. That the plumbing actually moves real pixels was
// measured in Chromium against the running app: at 0 the entry panel is
// `blur(18px)` over `rgba(22, 17, 14, 0.94)` — byte-identical to before this
// existed — and at 1 it is `blur(3.6px)` over `rgba(22, 17, 14, 0.424)`.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { GuitarNightApp } from './GuitarNightApp'
import type { GuitarNightSongPort } from './song-port'
import { GUITAR_NIGHT_GLASS } from './stage-glass'

function silentPort(): GuitarNightSongPort {
  return {
    initialize: vi.fn(async () => undefined),
    completedSongs: () => [],
    openSession: vi.fn(async () => ({ ok: false, code: 'not-found' })),
  } as unknown as GuitarNightSongPort
}

function idleTransport(): GuitarBackingTransport {
  return {
    configure: vi.fn(),
    activate: vi.fn(async () => true),
    play: vi.fn(async () => true),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(async () => true),
    setMasterVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    getAudioContext: () => null,
    getAudioGraph: () => null,
    getLoadMode: () => null,
    getLoadProgress: () => null,
    getStatus: () => 'idle',
    getCurrentTime: () => 0,
    getDuration: () => 0,
    getPlaybackRate: () => 1,
    getMasterVolume: () => 1,
    getTrackStates: () => [],
    getError: () => null,
    subscribe: () => () => undefined,
    dispose: vi.fn(async () => undefined),
  } as unknown as GuitarBackingTransport
}

function mountRoom(): void {
  render(() => (
    <GuitarNightApp
      loadSongPort={() => Promise.resolve(silentPort())}
      createBackingTransport={idleTransport}
    />
  ))
}

/**
 * The rooms and this slider live in the right-hand drawer now, which is
 * `inert` and `aria-hidden` until it is opened. Everything an assistive
 * technology can reach is therefore behind this one tap — which is the point
 * of asserting it, rather than reaching past it to the input.
 */
function openRoomDrawer(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Room' }))
}

const slider = (): HTMLInputElement =>
  screen.getByTestId('guitar-night-room-glass') as HTMLInputElement

const shellGlass = (): string =>
  screen.getByTestId('guitar-night-shell').style.getPropertyValue('--gn-glass')

describe('the Guitar Night room visibility slider', () => {
  beforeEach(() => {
    localStorage.removeItem(GUITAR_NIGHT_GLASS.storageKey)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.removeItem(GUITAR_NIGHT_GLASS.storageKey)
    window.history.replaceState(null, '', '/guitar-night')
  })

  it('offers the control with the slider bounds it was specified with', () => {
    mountRoom()
    const control = slider()
    expect(control.type).toBe('range')
    expect(control.min).toBe(String(GUITAR_NIGHT_GLASS.min))
    expect(control.max).toBe(String(GUITAR_NIGHT_GLASS.max))
    expect(control.step).toBe(String(GUITAR_NIGHT_GLASS.step))
  })

  it('names itself for anyone who cannot see the room change', () => {
    mountRoom()
    openRoomDrawer()
    // The visible part is a bare track, so the whole control depends on this.
    expect(screen.getByRole('slider', { name: 'Room visibility' })).toBe(
      slider(),
    )
  })

  it('starts at the default, already partway open', () => {
    mountRoom()
    expect(slider().value).toBe(String(GUITAR_NIGHT_GLASS.defaultValue))
    expect(shellGlass()).toBe(String(GUITAR_NIGHT_GLASS.defaultValue))
  })

  it('writes the property the whole stylesheet reads', () => {
    mountRoom()
    fireEvent.input(slider(), { target: { value: '0.8' } })
    expect(shellGlass()).toBe('0.8')
  })

  it('can be taken all the way back to the room as it shipped', () => {
    // Zero is not a rounding artefact of the range — it is the contract that
    // makes shipping a non-zero default safe.
    mountRoom()
    fireEvent.input(slider(), { target: { value: '0' } })
    expect(shellGlass()).toBe('0')
  })

  it('remembers the choice for the next visit', () => {
    mountRoom()
    fireEvent.input(slider(), { target: { value: '0.7' } })
    cleanup()

    mountRoom()
    expect(slider().value).toBe('0.7')
    expect(shellGlass()).toBe('0.7')
  })

  it('clamps a value from outside the slider before it reaches the room', () => {
    // A range input will not produce this, but a restored preference from a
    // build with different bounds can, and the property must never carry it.
    mountRoom()
    fireEvent.input(slider(), { target: { value: '5' } })
    expect(shellGlass()).toBe(String(GUITAR_NIGHT_GLASS.max))
  })

  it('sits in the Room drawer, beside the rooms it acts on', () => {
    mountRoom()
    const menu = document.getElementById('guitar-night-venue-menu')
    expect(menu).not.toBeNull()
    expect(menu?.contains(slider())).toBe(true)
  })

  it('is inert until the drawer is opened, and reachable after', () => {
    // The drawer is a dialog: closed, nothing inside it may be focusable or
    // announced, or a swipe through the page would land in a hidden panel.
    mountRoom()
    const menu = document.getElementById('guitar-night-venue-menu')
    expect(menu?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('slider', { name: 'Room visibility' })).toBeNull()

    openRoomDrawer()
    expect(menu?.getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByRole('slider', { name: 'Room visibility' })).toBeTruthy()
  })
})
