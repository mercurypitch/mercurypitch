// ============================================================
// The Guitar Night room drawer
// ============================================================
//
// Reported: "the dropdown is that ugly rooom selector, instead of proper like
// in piano night, please unify this for guitar night, and make the selector
// and that top rail nicer, with a proper popin right modal with room selector
// and other settings as needed".
//
// Both halves of that were the same decision. The room was a native
// `<select>` sitting in the top rail because Guitar Night's rooms were four
// strings in its own module — a list of names is all a list of names can
// show. With the rooms in the shared catalog they are pictures with an
// access state, which is what the shared picker draws, and the picker needs
// a panel rather than a rail. So the rail carries one button and everything
// that is about the venue rather than the music lives behind it.
//
// The catalog join itself is pinned in `guitar-rooms.test.ts`; the room
// visibility slider inside this drawer in `GuitarNightRoomGlass.test.tsx`.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { listBackgrounds } from '@/lib/backgrounds/background-catalog'
import { BACKGROUND_SELECTION_KEYS } from '@/lib/backgrounds/background-selection'
import { GuitarNightApp } from './GuitarNightApp'
import type { GuitarNightSongPort } from './song-port'

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
    setElectricAmpParameters: vi.fn(),
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

const roomButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Room' })
const drawer = (): HTMLElement => screen.getByTestId('guitar-night-room-drawer')
const backdrop = (): HTMLElement => screen.getByTestId('guitar-night-backdrop')
const railText = (): string =>
  screen.getByTestId('guitar-night-topbar').textContent ?? ''
/** Solid sets `inert` as a property; jsdom carries no attribute for it. */
const inert = (element: HTMLElement): boolean =>
  (element as HTMLElement & { inert?: boolean }).inert === true

afterEach(() => {
  cleanup()
  localStorage.removeItem(BACKGROUND_SELECTION_KEYS.guitar)
  localStorage.removeItem('pitchperfect_guitar_night_backdrop')
  vi.restoreAllMocks()
})

describe('the top rail', () => {
  it('has no dropdown left in it', () => {
    // The whole report in one assertion. A `<select>` in the rail is what
    // this replaced, and a rail is exactly where one must not come back.
    mountRoom()
    expect(document.querySelectorAll('select')).toHaveLength(0)
  })

  it('carries one button for the venue, and names the room beside it', () => {
    mountRoom()
    expect(roomButton().getAttribute('aria-controls')).toBe(
      'guitar-night-venue-menu',
    )
    expect(roomButton().getAttribute('aria-haspopup')).toBe('dialog')
    expect(railText()).toContain('Velvet Rehearsal')
  })

  it('keeps account access beside Room instead of hiding it in the drawer', async () => {
    mountRoom()

    const account = await screen.findByRole('button', {
      name: 'Sign in to MercuryPitch',
    })
    expect(screen.getByTestId('guitar-night-topbar')).toContainElement(account)

    fireEvent.click(roomButton())
    expect(drawer()).not.toContainElement(account)
  })
})

describe('the drawer', () => {
  it('starts closed, and closed means unreachable', () => {
    mountRoom()
    expect(roomButton().getAttribute('aria-expanded')).toBe('false')
    expect(drawer().getAttribute('aria-hidden')).toBe('true')
    expect(inert(drawer())).toBe(true)
  })

  it('opens as a dialog', () => {
    mountRoom()
    fireEvent.click(roomButton())
    expect(roomButton().getAttribute('aria-expanded')).toBe('true')
    expect(drawer().getAttribute('role')).toBe('dialog')
    expect(drawer().getAttribute('aria-modal')).toBe('true')
    expect(inert(drawer())).toBe(false)
  })

  it('takes the room behind it out of reach while it is open', () => {
    // It is a dialog over a scrim, so a Tab out of the last control must not
    // land on something the scrim is covering. The rail is deliberately left
    // reachable: the button that closes the drawer lives there.
    mountRoom()
    const main = document.getElementById('guitar-night-main')
    expect(inert(main as HTMLElement)).toBe(false)

    fireEvent.click(roomButton())
    expect(inert(main as HTMLElement)).toBe(true)
    expect(main?.getAttribute('aria-hidden')).toBe('true')
    expect(inert(screen.getByTestId('guitar-night-topbar'))).toBe(false)

    fireEvent.click(roomButton())
    expect(inert(main as HTMLElement)).toBe(false)
    expect(main?.getAttribute('aria-hidden')).toBeNull()
  })

  it('cycles focus inside the open drawer instead of onto covered topbar actions', async () => {
    mountRoom()
    fireEvent.click(roomButton())

    const fullStudio = screen.getByRole('link', { name: 'Full studio' })
    fullStudio.focus()
    fireEvent.keyDown(fullStudio, { key: 'Tab' })

    const close = drawer().querySelector<HTMLButtonElement>(
      '[aria-label="Close room settings"]',
    )
    await waitFor(() => expect(close).toHaveFocus())
  })

  it('shows every room as a picture with its access state', () => {
    // What a `<select>` could not do, and the reason the supporter rooms had
    // nowhere to land: an `<option>` has no room to show the room.
    mountRoom()
    fireEvent.click(roomButton())
    for (const label of [
      'Velvet Rehearsal',
      'Valve Corner',
      'Blue-hour Roof',
      'Daylight Loft',
    ]) {
      expect(
        screen
          .getAllByRole('button')
          .some((button) => button.textContent?.includes(label)),
      ).toBe(true)
    }
    // Counted from the catalog rather than written down, so a room added to
    // the surface does not fail this for the wrong reason.
    expect(screen.getAllByText('Included').length).toBe(
      listBackgrounds('guitar').filter((room) => room.access.kind === 'free')
        .length,
    )
  })

  it('keeps the studio actions, which used to be in the rail', () => {
    mountRoom()
    fireEvent.click(roomButton())
    const inDrawer = (name: string): boolean =>
      drawer().textContent?.includes(name) === true
    expect(inDrawer('Learn')).toBe(true)
    expect(inDrawer('Full studio')).toBe(true)
    expect(inDrawer('Room visibility')).toBe(true)
  })

  it('stays open while you are using it', () => {
    // The panel is a sibling of the rail now rather than a child, so the
    // outside-click guard has to spare both boxes. When it only spared the
    // rail, choosing a room closed the drawer on the way in.
    mountRoom()
    fireEvent.click(roomButton())
    fireEvent.pointerDown(screen.getByTestId('guitar-night-room-glass'))
    expect(roomButton().getAttribute('aria-expanded')).toBe('true')
  })

  it('closes on a tap outside it', () => {
    mountRoom()
    fireEvent.click(roomButton())
    fireEvent.pointerDown(document.body)
    expect(roomButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape and hands focus back', async () => {
    mountRoom()
    fireEvent.click(roomButton())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(roomButton().getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => expect(document.activeElement).toBe(roomButton()))
  })

  it('is out of hit testing entirely when closed, not merely faded', () => {
    // A drawer that only fades and slides keeps a full-size box off the right
    // edge, and everything that asks "is this on screen?" — hit testing, the
    // tab order, a test — still gets yes. That was measured, not guessed:
    // the browser suite caught it as a closed panel reporting itself visible.
    const css = readFileSync(
      'src/features/guitar-night/GuitarNightApp.module.css',
      'utf8',
    )
    const closed = css.slice(
      css.indexOf('.venueMenu {'),
      css.indexOf('}', css.indexOf('.venueMenu {')),
    )
    const open = css.slice(
      css.indexOf('.venueMenuOpen {'),
      css.indexOf('}', css.indexOf('.venueMenuOpen {')),
    )
    expect(closed).toContain('visibility: hidden')
    expect(closed).toContain('pointer-events: none')
    expect(open).toContain('visibility: visible')
  })

  it('sends focus back to its own button when Learn closes', async () => {
    // Learn opens from inside the drawer, and opening it closes the drawer.
    // The trigger is still in the document — the drawer slides away rather
    // than unmounting — so "focus what opened this" would hand focus to an
    // off-screen inert button and drop it on the floor.
    mountRoom()
    // Held by reference: with the shelf open the whole rail goes inert, so
    // the button cannot be looked up by role while that is true.
    const trigger = roomButton()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Learn' }))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('the tuner, opened from the drawer', () => {
  it('hands focus back to the drawer button when it closes', async () => {
    // Same shape as Learn: the trigger is inside a drawer that closes behind
    // it, so the only control that can still be focused is the one that
    // opens the drawer.
    mountRoom()
    const trigger = roomButton()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Tune guitar' }))

    const back = await screen.findByRole('button', { name: 'Back' })
    fireEvent.click(back)
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('choosing a room', () => {
  it('changes the room behind the app and names it in the rail', () => {
    mountRoom()
    fireEvent.click(roomButton())
    const card = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Valve Corner'))
    expect(card).toBeTruthy()
    fireEvent.click(card as HTMLElement)

    expect(backdrop().dataset.backdrop).toBe('valve-corner')
    expect(backdrop().style.getPropertyValue('--room-backdrop')).toContain(
      '/guitar-night/valve-corner.webp',
    )
    expect(railText()).toContain('Valve Corner')
  })

  it('remembers it under the catalog key', () => {
    mountRoom()
    fireEvent.click(roomButton())
    const card = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Blue-hour Roof'))
    fireEvent.click(card as HTMLElement)

    expect(localStorage.getItem(BACKGROUND_SELECTION_KEYS.guitar)).toBe(
      'blue-hour-roof',
    )
  })
})
