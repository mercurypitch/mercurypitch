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
//
// A click with no pointer or key gesture just before it is a tap too: it is
// how a screen reader activates the pad (VoiceOver's VO+Space, NVDA's Enter
// in browse mode), and how a switch or voice control does, all of which
// send the click alone. A click that follows a pointer, or Space or Enter,
// is that gesture's own echo, already taken. Only those keys make a click,
// so only they time an echo: the Control and Option of a quick VO+Space
// may reach the page, and VoiceOver's click after them is a tap.

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

/** True for the keys that tap and make a click of themselves, Space and Enter. */
export function isTapKey(key: string): boolean {
  return key === ' ' || key === 'Enter'
}

/** A key down's tap time, ms on the page's clock, or null for another key or a held key's repeat. */
export function keyTap(event: KeyTapEvent): number | null {
  if (event.repeat || !isTapKey(event.key)) return null
  return event.timeStamp
}

/** A click this soon after the pad's last pointer up, or Space or Enter down or up, is that gesture's echo, ms. */
export const CLICK_ECHO_MS = 100

/** The parts of a click the rule reads. */
export interface ClickTapEvent {
  readonly timeStamp: number
}

/**
 * A click's tap time, ms on the page's clock, or null when it echoes the
 * gesture at `lastGesture` (the pad's latest pointer up, or Space or Enter
 * down or up), which was already a tap.
 */
export function clickTap(
  event: ClickTapEvent,
  lastGesture: number,
): number | null {
  return event.timeStamp - lastGesture < CLICK_ECHO_MS ? null : event.timeStamp
}
