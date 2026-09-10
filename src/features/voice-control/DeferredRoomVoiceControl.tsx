// ============================================================
// Deferred room voice control — the pill arrives, but not at first paint
// ============================================================
//
// `RoomVoiceControl` is a speech stack: a recognizer, the command grammar,
// the mic manager and the notifications store. Reaching the microphone at
// all means reaching `pitch-core`, and there is no chunk arrangement that
// avoids it — the ear IS the feature.
//
// The standalone rooms promise a first paint that touches nothing: no audio
// context, no database, no microphone, and a resource list their own smoke
// tests read back. `lazy()` alone does not keep that promise, because Solid
// starts the import the moment the component renders — which is first paint.
//
// So the room renders this instead, and it renders nothing until the person
// using the room does something. A pointer move, a touch, a key, a scroll:
// any of them, once. Voice control in a room starts disabled and needs a
// tap to enable, so nothing is lost by the pill arriving on the same tap
// that would have enabled it — and a room nobody has touched yet is exactly
// the room that should not be loading a speech stack.

import type { Component } from 'solid-js'
import { createSignal, lazy, onCleanup, Show, Suspense } from 'solid-js'

const loadRoomVoiceControl = () => import('./RoomVoiceControl')
const RoomVoiceControl = lazy(loadRoomVoiceControl)

/** Anything a person does with a page, and nothing a page does by itself. */
const INTENT_EVENTS = [
  'pointerdown',
  'pointermove',
  'touchstart',
  'keydown',
  'wheel',
  'scroll',
] as const

/**
 * Whether a key is one the child would have answered.
 *
 * V toggles voice, Shift+V and "?" open the command list — see
 * `useVoiceToggleKey`, which is the handler that only exists once the child
 * has mounted. Deliberately narrow: this decides what gets sent to the
 * window a second time, and a room's own shortcuts are on that window too.
 * Replaying Space here would play the take twice.
 */
function isVoiceShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey) return false
  return event.code === 'KeyV' || event.key === '?'
}

export const DeferredRoomVoiceControl: Component = () => {
  const [awake, setAwake] = createSignal(false)

  const wake = (event: Event): void => {
    setAwake(true)
    release()
    replayShortcut(event)
  }

  /**
   * Give the keypress that woke us a second chance to be heard.
   *
   * The handler that answers V registers when the child mounts, so the press
   * that STARTED that mount reached nothing at all: a visitor who reaches for
   * the keyboard first — the one most likely to know the shortcut — had to
   * press it twice, once to summon the feature and again to use it.
   *
   * Only the two shortcuts, and only when the press did not belong to a
   * field: a replay is a real event on the real window, and the room's own
   * keyboard handlers are listening there too.
   */
  const replayShortcut = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || !isVoiceShortcut(event)) return
    if (
      event.target instanceof Element &&
      event.target.closest('input,textarea,select,[contenteditable]') !== null
    )
      return
    const again = new KeyboardEvent(event.type, {
      code: event.code,
      key: event.key,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    })
    // After the module resolves AND after the render it triggers: a
    // microtask would land while `lazy` is still swapping the placeholder.
    void loadRoomVoiceControl().then(() => {
      setTimeout(() => window.dispatchEvent(again))
    })
  }
  const release = (): void => {
    for (const event of INTENT_EVENTS) {
      // The capture flag is part of a listener's identity: remove it with
      // the same `true` it was added with, or the listener stays.
      window.removeEventListener(event, wake, true)
    }
  }
  for (const event of INTENT_EVENTS) {
    // Passive and capturing: this listens in front of the whole room and
    // must never be the reason a scroll janks or a gesture is swallowed.
    window.addEventListener(event, wake, { capture: true, passive: true })
  }
  onCleanup(release)

  return (
    <Show when={awake()}>
      <Suspense>
        <RoomVoiceControl />
      </Suspense>
    </Show>
  )
}

export default DeferredRoomVoiceControl
