// ============================================================
// Lesson sound, booked ahead — a caller's bus, and notes the clock releases
// ============================================================
//
// The beat clock (kit/beat-clock.ts) books every beat ahead on the audio
// clock, so what it books must stop on that clock too. A run gets a bus of
// its own on the house master (`openBus`): everything booked into it,
// sounds already booked ahead included, falls silent when the bus closes,
// and the Sound switch turned off, the hush and a hidden page close every
// open bus, as they stop every voice. A sung syllable on the beat is a note
// booked at its time and released by the audio clock, never by a timer
// (`bookNote`). Only Lesson 8 imports this module, so these stay off every
// other lesson's first paint; the voices themselves are kit/sound.ts's.

import type { Voice, VoiceOptions } from './sound'
import { build, handleOf, onStopAll, openMaster, SLACK, stopParts, } from './sound'

/**
 * A caller's own bus on the master: what it books plays into `node`, so
 * `close` silences it all at once, sounds already booked ahead included.
 */
export interface Bus {
  readonly context: AudioContext
  readonly node: GainNode
  /** False once closed. */
  readonly open: boolean
  /** Fades the bus out over `seconds` (default 0.03) and drops it. */
  close(seconds?: number): void
}

const buses = new Set<Bus>()

onStopAll(() => {
  buses.forEach((b) => b.close())
})

/** A bus at full level, or null while sound is not on; `onClose` hears it close, by its owner or by the page. */
export function openBus(onClose?: () => void): Bus | null {
  const out = openMaster()
  if (out === null) return null
  const { context } = out
  const node = context.createGain()
  node.connect(out.master)
  let open = true
  const b: Bus = {
    context,
    node,
    get open() {
      return open
    },
    close(seconds = 0.03) {
      if (!open) return
      open = false
      buses.delete(b)
      const now = context.currentTime
      node.gain.cancelScheduledValues(now)
      node.gain.setValueAtTime(node.gain.value, now)
      node.gain.setTargetAtTime(0, now, seconds / 5)
      // dropped once silent: nothing booked into it can sound after this
      setTimeout(() => node.disconnect(), (seconds + SLACK) * 1000)
      onClose?.()
    },
  }
  buses.add(b)
  return b
}

/** A note booked on the audio clock: when it starts, how long it lasts, and where it plays. */
export interface NoteOptions extends Omit<VoiceOptions, 'at' | 'dur'> {
  /** Its start, a time on the audio clock. */
  readonly when: number
  /** Seconds to the start of its release, which the audio clock schedules. */
  readonly dur: number
  /** A bus of the caller's, in place of the master. */
  readonly to?: AudioNode
}

/**
 * A voice booked ahead on the audio clock, started at `when` and released
 * `dur` later by the clock itself, never by a timer, as a sung line's
 * release is: a beat clock's sung syllable. Null while sound is not on.
 */
export function bookNote(freq: number, o: NoteOptions): Voice | null {
  const out = openMaster()
  if (out === null) return null
  const g = build(freq, { ...o, at: o.when - out.context.currentTime })
  if (g === null) return null
  if (o.to !== undefined) {
    g.level.disconnect()
    g.level.connect(o.to)
  }
  const { handle, retire } = handleOf(g)
  const end = g.t + Math.max(o.dur, g.attack)
  g.env.gain.setValueAtTime(1, end)
  g.env.gain.setTargetAtTime(0, end, g.release / 5)
  stopParts(g, end, g.release)
  const settle = end - g.context.currentTime + g.release + SLACK
  setTimeout(retire, settle * 1000)
  return handle
}
