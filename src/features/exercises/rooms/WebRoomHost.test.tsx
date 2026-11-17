// ============================================================
// WebRoomHost: the frame a room gets on the web
// ============================================================
//
// The host gives a room three things: the bar with its name, the slot on
// the bar's right that the room kit draws the level pill into, and ways out.
// A room can open another over itself (the Warm-up's stops), and then the
// ways out close the one on top. The room itself is a stand-in here; the
// rooms have their own tests, and web-warm-up.test.tsx walks the real path.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_HARMONY_LAKE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { pushedBarEnd } from '@/stores/native-shell-store'
import WebRoomHost from './WebRoomHost'

// The room is a stand-in with three controls: its own Done, one that opens
// Lip roll over it, as the Warm-up's path opens a stop, and the path's
// "Sing a song".
vi.mock('./web-room-screens', () => ({
  WEB_ROOM_SCREENS: new Proxy(
    {},
    {
      get:
        () =>
        (props: {
          onDone: () => void
          onOpenRoom: (id: string) => void
          onSong: () => void
        }) => (
          <>
            <button
              type="button"
              data-testid="room-stand-in"
              onClick={() => props.onDone()}
            >
              Done
            </button>
            <button
              type="button"
              data-testid="room-open-stop"
              onClick={() => props.onOpenRoom('lip-roll-bay')}
            >
              Open a stop
            </button>
            <button
              type="button"
              data-testid="room-sing-a-song"
              onClick={() => props.onSong()}
            >
              Sing a song
            </button>
          </>
        ),
    },
  ),
}))

/** The host is portalled to the body, outside the test's own container. */
const host = (): HTMLElement | null =>
  document.querySelector('[data-testid="web-room"]')

/** "Sing a song" is the page's to answer; most tests never press it. */
const onSong = vi.fn()

function open(onBack = vi.fn()) {
  render(() => (
    <WebRoomHost id={EXERCISE_HARMONY_LAKE} onBack={onBack} onSong={onSong} />
  ))
  return onBack
}

describe('WebRoomHost', () => {
  afterEach(cleanup)

  it("draws the room under a bar with the room's name", () => {
    open()

    expect(host()?.getAttribute('aria-label')).toBe('Harmony')
    expect(host()?.querySelector('h2')?.textContent).toBe('Harmony')
    expect(
      host()?.querySelector('[data-testid="room-stand-in"]'),
    ).not.toBeNull()
  })

  it('takes the dark stage, whatever the app theme', () => {
    open()

    expect(host()?.classList.contains('mp-dark-stage')).toBe(true)
  })

  it("registers the bar's right side as the slot the room kit draws into", () => {
    open()
    const slot = host()?.querySelector('[data-testid="web-room-end"]')

    expect(slot).not.toBeNull()
    expect(pushedBarEnd()).toBe(slot)

    cleanup()

    expect(pushedBarEnd()).toBeNull()
  })

  it("hands the focus to the room's name, not to Back", () => {
    open()

    expect(document.activeElement).toBe(host()?.querySelector('h2'))
  })

  it('leaves by Back', () => {
    const onBack = open()

    fireEvent.click(
      host()?.querySelector('[data-testid="web-room-back"]') as HTMLElement,
    )

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('leaves by Escape', () => {
    const onBack = open()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("leaves a room's own Escape to the room", () => {
    const onBack = open()
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    // A field of the room's own took the key first.
    event.preventDefault()

    document.dispatchEvent(event)

    expect(onBack).not.toHaveBeenCalled()
  })

  it("leaves by the room's own Done", () => {
    const onBack = open()

    fireEvent.click(
      host()?.querySelector('[data-testid="room-stand-in"]') as HTMLElement,
    )

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('hands "Sing a song" on to the page, and leaves the leaving to it', () => {
    onSong.mockClear()
    const onBack = open()

    fireEvent.click(
      host()?.querySelector('[data-testid="room-sing-a-song"]') as HTMLElement,
    )

    expect(onSong).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('holds the page under it still while it is open, and lets go after', () => {
    open()

    expect(document.documentElement.classList.contains('web-room-open')).toBe(
      true,
    )

    cleanup()

    expect(document.documentElement.classList.contains('web-room-open')).toBe(
      false,
    )
    expect(host()).toBeNull()
  })

  describe('with a room opened over it', () => {
    /** The Warm-up, with its first stop's room open over the path. */
    function openStop() {
      const onBack = vi.fn()
      render(() => (
        <WebRoomHost
          id={EXERCISE_WARM_UP_PATH}
          onBack={onBack}
          onSong={onSong}
        />
      ))
      fireEvent.click(
        host()?.querySelector('[data-testid="room-open-stop"]') as HTMLElement,
      )
      return onBack
    }
    const name = (): string | null | undefined =>
      host()?.querySelector('h2')?.textContent

    it('names the room on top, and hands the focus to its name', () => {
      openStop()

      expect(host()?.getAttribute('data-room')).toBe('lip-roll-bay')
      expect(host()?.getAttribute('aria-label')).toBe('Lip roll')
      expect(name()).toBe('Lip roll')
      expect(document.activeElement).toBe(host()?.querySelector('h2'))
    })

    it('Back closes the room on top alone, then leaves from the one under it', () => {
      const onBack = openStop()
      const back = () =>
        fireEvent.click(
          host()?.querySelector('[data-testid="web-room-back"]') as HTMLElement,
        )

      back()

      expect(onBack).not.toHaveBeenCalled()
      expect(host()?.getAttribute('data-room')).toBe(EXERCISE_WARM_UP_PATH)
      expect(name()).toBe('Warm-up')
      expect(document.activeElement).toBe(host()?.querySelector('h2'))

      back()

      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('Escape does what Back does, at each level', () => {
      const onBack = openStop()

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onBack).not.toHaveBeenCalled()
      expect(name()).toBe('Warm-up')

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it("the room on top's own end goes back to the one under it", () => {
      const onBack = openStop()

      fireEvent.click(
        host()?.querySelector('[data-testid="room-stand-in"]') as HTMLElement,
      )

      expect(onBack).not.toHaveBeenCalled()
      expect(host()?.getAttribute('data-room')).toBe(EXERCISE_WARM_UP_PATH)
    })
  })
})
