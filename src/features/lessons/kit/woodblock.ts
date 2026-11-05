// ============================================================
// Woodblock — the Ear Lab's knock, booked on a run's bus
// ============================================================
//
// The click under every written rhythm (Lesson 17 WEB-SPEC, Audio; FACTS
// 62): the Ear Lab's `wood` voice (src/features/ear-lab/click-synth.ts), a
// triangle at 1,050 Hz whose pitch falls by half over its 50 ms, with beat 1
// knocking higher at 1,575 Hz, Lesson 8's ratio of 1.5 between its beat-1
// click and the others. The Ear Lab wires its clicks straight to the
// context's output, past any bus, so the kit takes the voice's shape and
// books each knock into a run's own bus (kit/sound-ahead.ts, `openBus`) at a
// time on the audio clock, as the beat clock books every sound: closing the
// bus, as leaving a step does, silences what it booked. The Ear Lab keeps
// its own. The level is the caller's.

import type { Bus } from './sound-ahead'

/** The knock's shape, the Ear Lab's `wood` voice's. */
export const WOOD = {
  hz: 1050,
  /** Beat 1's, 1.5 times the others'. */
  highHz: 1575,
  /** The pitch at the end, as a ratio of the start's. */
  fall: 0.5,
  /** The whole knock, s. */
  len: 0.05,
  /** The onset's ramp, s: a point in time, with no pop. */
  attack: 0.001,
  /** The peak held after the ramp, s. */
  hold: 0.004,
} as const

/**
 * Books a knock into the bus at `when` on the audio clock (now, if that has
 * passed), beat 1's higher; nothing once the bus has closed.
 */
export function bookWood(
  bus: Bus,
  when: number,
  high: boolean,
  level: number,
): void {
  if (!bus.open) return
  const ctx = bus.context
  const t = Math.max(ctx.currentTime, when)
  const hz = high ? WOOD.highHz : WOOD.hz
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(hz, t)
  osc.frequency.exponentialRampToValueAtTime(hz * WOOD.fall, t + WOOD.len)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(level, t + WOOD.attack)
  gain.gain.setValueAtTime(level, t + WOOD.attack + WOOD.hold)
  gain.gain.linearRampToValueAtTime(0, t + WOOD.len)
  osc.connect(gain)
  gain.connect(bus.node)
  osc.start(t)
  osc.stop(t + WOOD.len + 0.01)
}
