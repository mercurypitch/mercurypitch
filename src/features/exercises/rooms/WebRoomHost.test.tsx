// ============================================================
// WebRoomHost: the frame a room gets on the web
// ============================================================
//
// The host gives a room three things: the bar with its name, the slot on
// the bar's right that the room kit draws the level pill into, and ways out.
// The room itself is a stand-in here; the rooms have their own tests.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_HARMONY_LAKE } from '@/lib/domain/exercise-contracts'
import { pushedBarEnd } from '@/stores/native-shell-store'
import WebRoomHost from './WebRoomHost'

// The room is a stand-in with one control: its own Done.
vi.mock('./web-room-screens', () => ({
  WEB_ROOM_SCREENS: new Proxy(
    {},
    {
      get: () => (props: { onDone: () => void }) => (
        <button
          type="button"
          data-testid="room-stand-in"
          onClick={() => props.onDone()}
        >
          Done
        </button>
      ),
    },
  ),
}))

/** The host is portalled to the body, outside the test's own container. */
const host = (): HTMLElement | null =>
  document.querySelector('[data-testid="web-room"]')

function open(onBack = vi.fn()) {
  render(() => <WebRoomHost id={EXERCISE_HARMONY_LAKE} onBack={onBack} />)
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
})
