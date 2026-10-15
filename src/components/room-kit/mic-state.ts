// ============================================================
// The mic's four states: ready, wait, sing and done
// ============================================================
//
// A premium room's mic says two things at a glance: whether it is open,
// and whether it is the singer's turn. Until 15 Oct 2026 its ring pulsed
// the same while Merc sang and while the singer did, and the owner could
// not tell from the button whether it was hearing him. Each room now names
// the state from its own phases (echoMicState, lipMicState, ngMicState,
// longNoteMicState) and the kit draws it (MicButton, RoomControls.tsx):
//
//   ready  closed, waiting for the tap that starts a take. The only state
//          that moves by itself: a slow breathing glow. The room's hint
//          sits over it (the demo kit's tip, useExerciseDemo.ts).
//   wait   open, but not the singer's turn: a count-in, Merc's call, a cue
//          note, a breath between waves, the demo. Dimmed and still.
//   sing   open, and the singer's turn: lit in the room's colour, with a
//          ring that follows the voice's loudness frame by frame. Silence
//          leaves it still; a voice moves it.
//   done   closed, at a result: an outline, still.
//
// The ring's numbers are here, pure, so a test can feed it frames.

export type MicState = 'ready' | 'wait' | 'sing' | 'done'

/**
 * The mic's accessible name in a state: what it is doing, and what a tap
 * does. `start` is the room's own ready line ("Start: buzz your lips over
 * the waves"); a room says its own words where a phase has them (the mic
 * opening, the settle, Long note's hold).
 */
export function micLabel(state: MicState, start: string): string {
  switch (state) {
    case 'ready':
      return start
    case 'wait':
      return 'Wait for your turn. Tap to stop'
    case 'sing':
      return 'Listening. Tap to stop'
    case 'done':
      return 'Microphone off'
  }
}

/** How quickly the ring rises to a louder voice, ms (time constant). */
export const RING_ATTACK_MS = 45
/** How slowly it falls back as the voice softens or stops, ms. */
export const RING_RELEASE_MS = 280

/**
 * Below this loudness (0..1, levelFromRms) the input is the room, not a
 * voice, and the ring stays at rest: 0.125 is -45 dBFS.
 */
export const RING_FLOOR = 0.125

/** How far past its rest a full voice pushes the ring (added scale). */
export const RING_REACH = 0.3
/** The ring's opacity at rest, while the mic waits for a voice. */
export const RING_REST_OPACITY = 0.45
/**
 * Reduced motion: the ring keeps its size and brightens a step at each of
 * these levels. The first is low, so a quiet voice still shows.
 */
export const RING_STEP_AT: readonly number[] = [0.06, 0.4, 0.75]

/** One frame of the ring's level: quick to rise, slower to fall. */
export function smoothLevel(
  current: number,
  target: number,
  dtMs: number,
): number {
  const tau = target > current ? RING_ATTACK_MS : RING_RELEASE_MS
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tau)
  return current + (target - current) * k
}

/** The loudness the ring shows, 0..1: the room's floor taken away. */
export function ringLevel(loudness: number): number {
  if (!(loudness > RING_FLOOR)) return 0
  return Math.min(1, (loudness - RING_FLOOR) / (1 - RING_FLOOR))
}

export interface RingLook {
  readonly scale: number
  readonly opacity: number
}

/**
 * The ring at a level. It grows and brightens with the voice; with
 * reduced motion it keeps its size and brightens in steps, because it
 * still says whether the mic hears the singer.
 */
export function ringLook(level: number, reduced: boolean): RingLook {
  const l = Math.min(1, Math.max(0, level))
  if (reduced) {
    let steps = 0
    for (const at of RING_STEP_AT) if (l >= at) steps += 1
    return {
      scale: 1,
      opacity:
        RING_REST_OPACITY +
        ((1 - RING_REST_OPACITY) * steps) / RING_STEP_AT.length,
    }
  }
  return {
    scale: 1 + RING_REACH * l,
    opacity: RING_REST_OPACITY + (1 - RING_REST_OPACITY) * l,
  }
}
