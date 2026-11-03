// ============================================================
// Studio automation line — what a lane's automation stage has been told, so a change cuts in without a step
// ============================================================
//
// A lane's lines play on a stage of two gains, left and right, after its
// faders and after each of its reverb sends' (lane-automation.ts). The
// stage is written as straight ramps a few seconds ahead of the clock
// (graph-automation.ts). A change cuts that line at a time the clock has
// not reached: first a ramp to the value the line has there, which splits
// the ramp it falls in, then everything after it is cancelled, and the new
// line goes on from it. Cancelling alone would take away the ramp under
// way, and the gain would jump back to where that ramp began. A browser
// does not say what it was told, so the line keeps its own copy of every
// event, to know its value at the cut.
import type { StudioTrack } from '../model/types'
import type { StudioLaneKnot } from './lane-automation'
import { studioLaneAutomationKey, studioLaneKnots } from './lane-automation'

/** Left and right gains. */
export type StudioStageGains = readonly [number, number]

/** A stage's params, a left and a right for each gain pair the line drives. */
export type StudioStageParams = readonly (readonly AudioParam[])[]

interface LineEvent {
  readonly time: number
  readonly gains: StudioStageGains
}

/** What every gain pair of a lane's stage has been told: a set, then straight ramps, oldest first. */
export interface StudioAutomationLine {
  events: LineEvent[]
}

/** A lane's lines as its graph plays them. */
export interface StudioLaneAutomation {
  /** What its knots were made from (lane-automation.ts); null without lines. */
  key: string | null
  knots: readonly StudioLaneKnot[] | null
  readonly line: StudioAutomationLine
  /** The pass and frame the line is written up to; null when nothing is left to write. */
  cursor: { pass: number; frame: number } | null
  /** How far ahead the graph was last scheduled, so a cut writes as far again. */
  horizon: number
}

export const UNITY_GAINS: StudioStageGains = [1, 1]

/** How far past a cut the cancel starts: under a frame, so only the cut's own time is kept. */
const CUT_EPSILON = 1e-7

export function createLaneAutomation(track: StudioTrack): StudioLaneAutomation {
  return {
    key: studioLaneAutomationKey(track),
    knots: studioLaneKnots(track),
    line: { events: [] },
    cursor: null,
    horizon: -Infinity,
  }
}

/** The stage pair between a lane's faders and its merge: `mixes[side]` → stage → `merge` input `side`. */
export function connectAutomationStage(
  ctx: BaseAudioContext,
  mixes: readonly GainNode[],
  merge: AudioNode,
): GainNode[] {
  return mixes.map((mix, side) => {
    const stage = ctx.createGain()
    mix.connect(stage)
    stage.connect(merge, 0, side)
    return stage
  })
}

/** The time the line was last written to; -Infinity when it was never written. */
export function lineEnd(line: StudioAutomationLine): number {
  return line.events.at(-1)?.time ?? -Infinity
}

/** The line's gains at `time`, as the browser plays them: straight between events, flat after the last. */
export function lineGainsAt(
  line: StudioAutomationLine,
  time: number,
): StudioStageGains {
  const events = line.events
  if (events.length === 0) return UNITY_GAINS
  let index = events.length - 1
  while (index > 0 && events[index].time > time) index--
  const from = events[index]
  const to = events.at(index + 1)
  if (from.time > time || to === undefined) return from.gains
  const at = (time - from.time) / (to.time - from.time)
  return [
    from.gains[0] + (to.gains[0] - from.gains[0]) * at,
    from.gains[1] + (to.gains[1] - from.gains[1]) * at,
  ]
}

function eachParam(
  params: StudioStageParams,
  write: (param: AudioParam, side: number) => void,
): void {
  for (const pair of params)
    for (const [side, param] of pair.entries()) write(param, side)
}

/** Start the line afresh at `time`, at `gains`: only while nothing is heard through it. */
export function restartLine(
  params: StudioStageParams,
  line: StudioAutomationLine,
  time: number,
  gains: StudioStageGains,
): void {
  eachParam(params, (param, side) => {
    param.cancelScheduledValues(0)
    param.setValueAtTime(gains[side], time)
  })
  line.events = [{ time, gains }]
}

/** Ramp the line straight on to `gains` at `time`, after everything it was told. */
export function rampLine(
  params: StudioStageParams,
  line: StudioAutomationLine,
  time: number,
  gains: StudioStageGains,
): void {
  eachParam(params, (param, side) =>
    param.linearRampToValueAtTime(gains[side], time),
  )
  line.events.push({ time, gains })
}

/** Cut the line at `time`, which the clock has not reached: it plays on to there and holds. */
export function cutLine(
  params: StudioStageParams,
  line: StudioAutomationLine,
  time: number,
): void {
  const gains = lineGainsAt(line, time)
  const started = line.events.length > 0
  eachParam(params, (param, side) => {
    if (!started) {
      param.setValueAtTime(gains[side], time)
      return
    }
    param.linearRampToValueAtTime(gains[side], time)
    param.cancelScheduledValues(time + CUT_EPSILON)
  })
  const kept = line.events.filter((event) => event.time <= time)
  line.events = [...kept, { time, gains }]
}

/** Drop what the clock has played, keeping the event it last passed. */
export function pruneLine(line: StudioAutomationLine, now: number): void {
  let first = 0
  while (first + 1 < line.events.length && line.events[first + 1].time <= now)
    first++
  if (first > 0) line.events = line.events.slice(first)
}

/** Bring new gain pairs onto the line from `now`: a send built while the line plays. */
export function adoptLine(
  params: StudioStageParams,
  line: StudioAutomationLine,
  now: number,
): void {
  if (line.events.length === 0) return
  const start = lineGainsAt(line, now)
  eachParam(params, (param, side) => param.setValueAtTime(start[side], now))
  for (const event of line.events) {
    if (event.time <= now) continue
    eachParam(params, (param, side) =>
      param.linearRampToValueAtTime(event.gains[side], event.time),
    )
  }
}
