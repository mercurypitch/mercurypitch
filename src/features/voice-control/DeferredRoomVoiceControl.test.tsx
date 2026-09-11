// ============================================================
// DeferredRoomVoiceControl
// ============================================================
// The standalone rooms audit what their first paint touches, and voice
// control is a speech stack: a recognizer, the mic manager, the
// notifications store. `lazy()` alone does not keep the room's promise,
// because Solid starts the import the moment the component renders. What
// makes this correct is that it renders NOTHING until somebody uses the
// room — so that is what is worth a test.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeferredRoomVoiceControl } from './DeferredRoomVoiceControl'

afterEach(cleanup)

/**
 * Long enough for a real dynamic import to have resolved if one had started.
 *
 * `findByTestId` proves the pill arrives; proving it does NOT needs a wait
 * that would have been generous, and a handful of microtasks is not one —
 * `import()` is a module load, not a microtask.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

describe('DeferredRoomVoiceControl', () => {
  it('renders nothing into a room nobody has touched', async () => {
    render(() => <DeferredRoomVoiceControl />)
    await settle()

    expect(screen.queryByTestId('voice-control-pill')).toBeNull()
  })

  it.each(['pointerdown', 'pointermove', 'touchstart', 'wheel', 'scroll'])(
    'wakes on %s',
    async (type) => {
      render(() => <DeferredRoomVoiceControl />)
      window.dispatchEvent(new Event(type))

      expect(await screen.findByTestId('voice-control-pill')).toBeTruthy()
    },
  )

  it('wakes on a key, which is how a desktop reaches the V shortcut', async () => {
    render(() => <DeferredRoomVoiceControl />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

    expect(await screen.findByTestId('voice-control-pill')).toBeTruthy()
  })

  it('lets go of the room once it has woken', async () => {
    // A capturing listener in front of the whole room is not something to
    // leave behind. Removing one needs the same `true` it was added with,
    // which is the half that is easy to get wrong and impossible to see:
    // the pill still appears either way.
    const added = new Map<string, unknown>()
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    render(() => <DeferredRoomVoiceControl />)
    for (const [type, , options] of addSpy.mock.calls) {
      added.set(type, (options as AddEventListenerOptions | undefined)?.capture)
    }
    expect(added.size).toBeGreaterThan(0)

    window.dispatchEvent(new Event('pointerdown'))
    await screen.findByTestId('voice-control-pill')

    for (const [type, capture] of added) {
      expect(
        removeSpy.mock.calls.some(
          ([removedType, , options]) =>
            removedType === type && Boolean(options) === Boolean(capture),
        ),
        `${type} listener was never removed with capture=${String(capture)}`,
      ).toBe(true)
    }

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('does not swallow the very shortcut that woke it', async () => {
    render(() => <DeferredRoomVoiceControl />)

    // The V handler registers when the lazy child mounts, so the keypress
    // that started the import reached nothing. A keyboard-only visitor
    // pressing Shift+V first would have had to press it twice.
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyV', shiftKey: true }),
    )
    await screen.findByTestId('voice-commands-overlay')
  })

  it('replays only the shortcuts, so a room keeps its own keys', async () => {
    const heard: string[] = []
    const spy = (e: Event) => heard.push((e as KeyboardEvent).code)
    window.addEventListener('keydown', spy)
    render(() => <DeferredRoomVoiceControl />)

    // A replay is a real event on the real window, where the room's own
    // transport listens. Sending Space back would play the take twice.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    await screen.findByTestId('voice-control-pill')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(heard.filter((code) => code === 'Space')).toHaveLength(1)
    window.removeEventListener('keydown', spy)
  })

  it('leaves a V typed into a field where it was typed', async () => {
    const field = document.createElement('input')
    document.body.append(field)
    const heard: string[] = []
    const spy = (e: Event) => heard.push((e as KeyboardEvent).code)
    window.addEventListener('keydown', spy)
    render(() => <DeferredRoomVoiceControl />)

    field.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }),
    )
    await screen.findByTestId('voice-control-pill')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(heard.filter((code) => code === 'KeyV')).toHaveLength(1)
    window.removeEventListener('keydown', spy)
    field.remove()
  })
})
