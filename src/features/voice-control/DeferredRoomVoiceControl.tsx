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

const RoomVoiceControl = lazy(() => import('./RoomVoiceControl'))

/** Anything a person does with a page, and nothing a page does by itself. */
const INTENT_EVENTS = [
  'pointerdown',
  'pointermove',
  'touchstart',
  'keydown',
  'wheel',
  'scroll',
] as const

export const DeferredRoomVoiceControl: Component = () => {
  const [awake, setAwake] = createSignal(false)

  const wake = (): void => {
    setAwake(true)
    release()
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
