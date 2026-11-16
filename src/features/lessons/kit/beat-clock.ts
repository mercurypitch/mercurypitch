// ============================================================
// Beat clock — a lookahead scheduler on the audio clock
// ============================================================
//
// A run is bars of hits (a click, a drum hit, a sung note, a Merc's hop),
// each at a beat of its bar, at a tempo read beat by beat, so a change of
// tempo applies from the next beat. It starts a lead after the tap that
// starts it (0.1 s, or a take's 0.6 s). On every frame of the kit's frame
// loop it books each hit that falls within the next 0.1 s at its exact time
// on the audio clock (`start(when)`, through `book`); a hit whose time has
// already passed when it comes up is skipped, never played late. Each run
// plays into its own bus on the kit's master (kit/sound-ahead.ts), so Stop fades
// that bus out over 30 ms and drops it, and every hit already booked goes
// silent with it: leaving a step cancels what it booked, not only what is
// sounding. The Sound switch, the hush and a hidden page close the bus too,
// and the run ends with it. Nothing is started or stopped by a timer.
//
// The two clocks. What the page draws (a lit beat, the metronome's arm, a
// Merc's hop) follows the sound as heard: an audio-clock time is mapped
// onto the page's clock by the context's output timestamp, read on every
// frame, the latest reading whose `performanceTime` is above 0; with none,
// by `currentTime` and `performance.now()` read together as the run starts,
// as the Ear Lab's Pulse does. A run with no sound (sound off) keeps time on
// the page's clock alone and still draws every hit.
//
// Lesson 8's page drives every sound it makes through this clock; the clock
// is generic, so a later rhythm lesson can drive its own.
//
// The clock itself is beat-clock-core.ts, which imports nothing of a page
// and so can run on another audio context (the app's Sing It in Time
// drill); this module binds it to the page's sound and frame loop and
// hands every lesson both.

import type { ClockEnv, Run, RunOptions } from './beat-clock-core'
import { createBeatClock } from './beat-clock-core'
import { addDrawer, wake } from './frame-loop'
import { Sound } from './sound'
import { openBus } from './sound-ahead'

export type {
  Bar,
  ClockEnv,
  Hit,
  OutputStamp,
  Run,
  RunOptions,
  Spot,
} from './beat-clock-core'
export { bars, createBeatClock, LOOKAHEAD } from './beat-clock-core'

/** The page's clock on the page's audio context. */
const pageEnv: ClockEnv = {
  now: () => performance.now(),
  audioTime: () => Sound.context()?.currentTime ?? null,
  outputStamp() {
    const c = Sound.context()
    if (c === null || typeof c.getOutputTimestamp !== 'function') return null
    const s = c.getOutputTimestamp()
    return s.contextTime === undefined || s.performanceTime === undefined
      ? null
      : { contextTime: s.contextTime, performanceTime: s.performanceTime }
  },
  bus: (onClose) => openBus(onClose),
}

const clock = createBeatClock(pageEnv)
let drawing = false

/** The page's beat clock, on the kit's frame loop; a hidden page stops every run, silent ones too. */
export const BeatClock = {
  start<T>(o: RunOptions<T>): Run {
    if (!drawing) {
      drawing = true
      addDrawer({
        active: () => clock.busy,
        wants: () => clock.busy,
        draw: () => clock.pump(),
      })
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) clock.stopAll()
      })
    }
    const run = clock.start(o)
    wake()
    return run
  },
}
