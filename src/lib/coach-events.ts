// ============================================================
// Coach events — what the singer just did, told to a Merc tour that waits for it
// ============================================================
//
// A Merc tour's do-step waits for the singer to do something: start the mic,
// sing a note, put a song on stage, get through a song and close its score
// card. The code that knows (the Sing tab's practice controller, Karaoke
// Night's stage host) says so here, and so does a mic that would not start,
// so the step can say why. The coach (src/features/tours/coach/) listens
// while a step waits. It is an event on `window`, so the two halves share
// nothing but this file: Karaoke Night's stage and the coach are chunks of
// their own, and neither imports the other.
//
// The emits sit on hot paths (a pitch arrives every frame while a note is
// held), so an emit with no tour listening is one comparison: nothing is
// dispatched until a listener is registered. A browser check can still play
// the singer's part by dispatching the event itself, by name.
//
// This file imports nothing, so any entry can load it without pulling the app
// in.

/**
 * What a do-step can wait for, or hear go wrong. `mic-on` comes once the
 * engine has the mic, not on the tap that asked for it; `mic-failed` when it
 * could not have it (a refused permission, no device). `score-closed` when
 * Karaoke's score card has gone after a song, however it went;
 * `song-unscored` when a song stopped (at its end, or Stop) with no score
 * card to show, and `stage-left` when the singer took Back off the stage.
 */
export type CoachEventName =
  | 'mic-on'
  | 'mic-failed'
  | 'pitch-detected'
  | 'song-staged'
  | 'score-closed'
  | 'song-unscored'
  | 'stage-left'

/** The window event's type; its `detail` is the CoachEventName. */
export const COACH_EVENT = 'mp:coach'

/** How many listeners are registered: while none is, nothing is dispatched. */
let listening = 0

/** Tells a waiting tour what the singer just did. Free while no tour listens. */
export function emitCoachEvent(name: CoachEventName): void {
  if (listening === 0) return
  window.dispatchEvent(new CustomEvent(COACH_EVENT, { detail: name }))
}

/**
 * Calls `fn` each time `name` happens, until the returned function is called.
 * Calling that more than once is harmless.
 */
export function onCoachEvent(name: CoachEventName, fn: () => void): () => void {
  const heard = (event: Event): void => {
    if (event instanceof CustomEvent && event.detail === name) fn()
  }
  window.addEventListener(COACH_EVENT, heard)
  listening += 1
  let on = true
  return () => {
    if (!on) return
    on = false
    listening -= 1
    window.removeEventListener(COACH_EVENT, heard)
  }
}
