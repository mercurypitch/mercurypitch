// ============================================================
// The camera tray: on a tablet too, and beside the chat
// ============================================================
//
// Owner report, 2026-09-20: "On my tablet, the camera when enabled, it's
// somehow missing to see that chip so I see myself."
//
// Two rules disagreed. The tray started hidden wherever `isMobile()` was
// true -- which is every touch screen, a 1180px tablet included -- and the
// switch that brings it back is drawn only under 640px. So a tablet had a
// hidden tray and no way to show it.
//
// And where it sat was worked out against a chat window assumed to be open
// (340 by 440), so with the chat shut it landed 440px in from the corner,
// beside nothing. It docks against the chat's real box now.

import { cleanup, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/jam-store', () => ({
  jamLocalStream: () => null,
  jamPeerId: () => 'me',
  jamPeers: () => [],
  jamPitchHistory: () => ({}),
  jamRemoteStreams: () => ({}),
  jamVideoEnabled: () => true,
}))

const { JamCameraWidget } = await import('@/components/jam/JamCameraWidget')

const repo = resolve(__dirname, '../..')
const read = (file: string): string => readFileSync(resolve(repo, file), 'utf8')

let resizeCallbacks: (() => void)[] = []
let chat: HTMLDivElement

/** The chat's box, as the browser would report it. */
const chatIs = (box: {
  left: number
  top: number
  width: number
  height: number
}): void => {
  chat.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON: () => ({}),
    }) as DOMRect
}

// jsdom's window is 1024 by 768. The chat hangs 20px off the corner.
const BUBBLE = { left: 948, top: 692, width: 56, height: 56 }
const CHAT_WINDOW = { left: 684, top: 280, width: 320, height: 468 }
// What the tray is taken to measure before jsdom can say (it never can).
const TRAY_W = 100
const TRAY_H = 76

beforeEach(() => {
  resizeCallbacks = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  chat = document.createElement('div')
  chat.setAttribute('data-jam-chat', '')
  document.body.append(chat)
  chatIs(BUBBLE)
})

afterEach(() => {
  cleanup()
  chat.remove()
  vi.unstubAllGlobals()
})

const trayOf = (container: HTMLElement): HTMLElement => {
  const tray = container.firstElementChild
  if (!(tray instanceof HTMLElement)) throw new Error('no tray')
  return tray
}

describe('the camera tray', () => {
  it('starts beside the chat bubble, bottoms level', () => {
    const { container } = render(() => <JamCameraWidget />)
    const tray = trayOf(container)

    expect(tray.style.left).toBe(`${BUBBLE.left - 12 - TRAY_W}px`)
    expect(tray.style.top).toBe(`${BUBBLE.top + BUBBLE.height - TRAY_H}px`)
  })

  it('moves aside when the chat opens, and back when it shuts', () => {
    const { container } = render(() => <JamCameraWidget />)
    const tray = trayOf(container)

    chatIs(CHAT_WINDOW)
    for (const callback of resizeCallbacks) callback()
    expect(tray.style.left).toBe(`${CHAT_WINDOW.left - 12 - TRAY_W}px`)

    chatIs(BUBBLE)
    for (const callback of resizeCallbacks) callback()
    expect(tray.style.left).toBe(`${BUBBLE.left - 12 - TRAY_W}px`)
  })

  it('takes the corner itself in a room with no chat on screen', () => {
    chat.remove()
    const { container } = render(() => <JamCameraWidget />)
    const tray = trayOf(container)

    expect(tray.style.left).toBe(`${1024 - 20 - TRAY_W}px`)
    expect(tray.style.top).toBe(`${768 - 20 - TRAY_H}px`)
  })
})

describe('whether the tray starts on screen', () => {
  const panel = read('src/components/jam/JamPanel.tsx')
  const css = read('src/components/jam/JamPanel.module.css')

  it('is decided by the width that draws its switch, not by touch', () => {
    // `isMobile()` is true of every touch screen. A tablet is one, and has
    // no switch: hidden by that rule, it stayed hidden.
    expect(panel).not.toMatch(/createSignal\(!isMobile\(\)\)/)
    expect(panel).toContain('createSignal(!cameraSwitchIsShown())')
  })

  it('reads the same width the stylesheet shows the switch at', () => {
    const query = /CAMERA_SWITCH_QUERY = '\(max-width: (\d+)px\)'/.exec(panel)
    expect(query).not.toBeNull()

    // The phone block is the one that un-hides `.phoneOnlyAction`.
    const block = css.slice(css.lastIndexOf('.phoneOnlyAction'))
    const opened = css.lastIndexOf(
      '@media',
      css.lastIndexOf('.phoneOnlyAction'),
    )
    expect(block).toContain('display: flex')
    expect(css.slice(opened, opened + 40)).toContain(
      `(max-width: ${query?.[1] ?? ''}px)`,
    )
  })
})
