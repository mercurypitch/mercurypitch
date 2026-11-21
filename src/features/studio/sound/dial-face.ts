// ============================================================
// Studio dial face — the macro dial's drawing in its 48-unit box, and the value it prints
// ============================================================
//
// The value sits in the cap, and the pointer mark used to sit in the cap
// too, from 7.5 to 11.5 units out. Between about 30 and 100 either way the
// mark ran through the value, and a negative value's minus sign took the
// brunt: the mark swings left for a negative value, where the sign stands.
// The mark now runs from just outside the cap onto the ring, where it
// crosses the value arc's end, so nothing in the cap can meet it. The sign hangs left of the digits instead of being centred
// with them, so the digits stay on the dial's centre whatever their sign.

/** The drawing, in the units of the dial's 48 by 48 viewBox. */
export const DIAL_FACE = {
  centre: 24,
  /** The travel ring and the value arc on it. */
  ring: { radius: 18, width: 3 },
  /** The cap the value is printed on, and its outline. */
  cap: { radius: 12.5, outline: 1 },
  /** The pointer mark: a round-capped stroke from `from` to `to` units out, clear of the cap and ending on the ring's middle. */
  pointer: { from: 14.5, to: 18, width: 2 },
} as const

export interface StudioDialReadout {
  /** A true minus sign below the centre, a plus above it, none at it. */
  readonly sign: '' | '+' | '−'
  readonly digits: string
}

/** A macro's value as the dial prints it: the sign apart from the digits. */
export function studioDialReadout(value: number): StudioDialReadout {
  const whole = Math.round(value)
  return {
    sign: whole > 0 ? '+' : whole < 0 ? '−' : '',
    digits: String(Math.abs(whole)),
  }
}
