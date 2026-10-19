// ============================================================
// Slow motion — a vibration slowed 220 times, one cycle you can count
// ============================================================
//
// A note's vibration is far too fast to see, so a figure slows it 220
// times: Lesson 1's string at 220 Hz then swings once a second, and Lesson
// 3's vocal folds open and close once a second at A3 and twice at A4 (FACTS
// 22). This clock counts those slowed cycles at whatever pitch the figure
// sets: it integrates the slowed rate, so a pitch that changes mid-count
// changes the speed without jumping the phase. Pure: the figure draws the
// phase and sounds the tick that marks each cycle.

/** How many times slower slow motion runs. */
export const SLOW_FACTOR = 220

export interface SlowClock {
  /** Whole cycles since the last reset. */
  readonly cycles: number
  /** Where the vibration is in its cycle, 0 up to 1. */
  readonly phase: number
  /** Advances `dt` seconds of real time at `hz`; true when that completed a cycle. */
  advance(dt: number, hz: number): boolean
  reset(): void
}

// whole cycles, forgiving the float error that sixty steps of 1/60 s leave behind
const whole = (turns: number): number => Math.floor(turns + 1e-9)

export function createSlowClock(factor = SLOW_FACTOR): SlowClock {
  let turns = 0
  return {
    get cycles() {
      return whole(turns)
    },
    get phase() {
      return Math.max(0, turns - whole(turns))
    },
    advance(dt, hz) {
      const before = whole(turns)
      turns += (Math.max(0, dt) * hz) / factor
      return whole(turns) > before
    },
    reset() {
      turns = 0
    },
  }
}

/** Slowed cycles a second, as a readout says them: "1", "1.5", "2". */
export function slowRate(hz: number, factor = SLOW_FACTOR): string {
  const r = Math.round((hz / factor) * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
