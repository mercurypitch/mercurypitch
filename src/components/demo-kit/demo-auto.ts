// ============================================================
// A first visit's demo, before it starts: told to whoever records it
// ============================================================
//
// A premium room's first visit opens on its demo a moment after the room
// does (useExerciseDemo's AUTO_PLAY_MS). The demo's own turns show on the
// room's `data-demo`; the wait before it does not, and neither does a wait
// the app going away held back. A test build's audio record words each
// step (apps/mercurypitch shell/audio-record.ts):
//
//   waiting   the demo starts by itself in `ms`: on the room's first
//             visit, or once the singer is back from a pull that held it
//   held      the app or the page went before it started; it waits for
//             the singer to be back, the room as it was
//   starting  the wait is over and it asks for the audio clock; what the
//             clock answers shows as the demo's next turn

export type DemoAutoStep =
  | { readonly step: 'waiting'; readonly ms: number }
  | { readonly step: 'held' }
  | { readonly step: 'starting' }

type Listener = (step: DemoAutoStep) => void

const listeners = new Set<Listener>()

/** Every step of a first visit's wait. Returns the unsubscribe. */
export function onDemoAuto(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function tellDemoAuto(step: DemoAutoStep): void {
  for (const listener of [...listeners]) {
    try {
      listener(step)
    } catch {
      // A record that broke must not keep a demo from starting.
    }
  }
}
