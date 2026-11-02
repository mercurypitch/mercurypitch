// ============================================================
// Shared clock log — each state the app's one AudioContext takes
// ============================================================
//
// A room's song plays on the app's one AudioContext (the broker in
// packages/audio-io, lent to rooms by native-device.ts), and the console
// had nothing to say about it: a clock iOS interrupted, or one a room
// parked, left no line behind (owner, 2 Nov 2026, a song stuck on a TV over
// AirPlay: "logs don't say anything really"). This writes a line for every
// state the clock takes, iOS's 'interrupted' included, which the DOM's own
// type does not name:
//
//   [audio clock] shared: running -> interrupted, at 61.504 s
//
// with `[hidden]` when the page was. A clock that stops without changing
// state is the Karaoke room's watch to see (src/features/stem-mixer/
// clock-watchdog.ts); this is the state alone. Here, beside the lease that
// makes the clock, because only the native app has one to share.
//
// Routine lines (console.log): kept when the console keeps routine logs,
// and in the crash card's log on a store build. A test build's audio record
// has each state too (audio-census.ts, `context-state`).
//
// A context is watched once, however many leases hand it out, and is never
// let go: the shared clock lives as long as the app.

const watched = new WeakSet<BaseAudioContext>()

const hiddenMark = (): string =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? ' [hidden]'
    : ''

/** The clock's time to the millisecond, as the audio record writes it. */
const at = (context: BaseAudioContext): string =>
  `${(Math.round(context.currentTime * 1000) / 1000).toFixed(3)} s`

/** Write a line for the state `context` is in now, and for every change. */
export function logClockStates(context: BaseAudioContext, name: string): void {
  if (watched.has(context) || typeof context.addEventListener !== 'function')
    return
  watched.add(context)
  let last = String(context.state)
  console.log(`[audio clock] ${name}: ${last}, first seen${hiddenMark()}`)
  context.addEventListener('statechange', () => {
    const next = String(context.state)
    if (next === last) return
    console.log(
      `[audio clock] ${name}: ${last} -> ${next}, at ${at(context)}${hiddenMark()}`,
    )
    last = next
  })
}
