// The tap rule: when a pointer or key event is a tap, and when it was
// ============================================================
//
// The Ear Lab's rhythm drills (its TapPad, src/features/ear-lab/EarStage.tsx)
// and the lessons' tap pad (src/features/lessons/kit/tap-pad.ts) take a tap
// by this one rule, so the two cannot drift. A tap is a pointer down with
// the primary button (touch and pen report 0; a click would arrive a frame
// or two late), or Space or Enter, a held key's repeats ignored. Its time is
// the event's own `timeStamp`, on the page's clock, not a later
// performance.now(), so the timing measures the touch and not the render.
// The pad flashes for TAP_FLASH_MS after each tap.

/** How long a pad flashes after a tap, ms. */
export const TAP_FLASH_MS = 110

/** The parts of a pointer event the rule reads. */
export interface PointerTapEvent {
  readonly button: number
  readonly timeStamp: number
}

/** The parts of a key event the rule reads. */
export interface KeyTapEvent {
  readonly key: string
  readonly repeat: boolean
  readonly timeStamp: number
}

/** A pointer down's tap time, ms on the page's clock, or null for a secondary button. */
export function pointerTap(event: PointerTapEvent): number | null {
  return event.button > 0 ? null : event.timeStamp
}

/** A key down's tap time, ms on the page's clock, or null for another key or a held key's repeat. */
export function keyTap(event: KeyTapEvent): number | null {
  if (event.repeat) return null
  if (event.key !== ' ' && event.key !== 'Enter') return null
  return event.timeStamp
}
