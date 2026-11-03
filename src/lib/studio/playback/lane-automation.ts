// ============================================================
// Studio lane curves — a lane's volume and pan lines as the gains its automation stage ramps through
// ============================================================
//
// A lane's faders stand where its fader and pan knob are (graph-lanes.ts
// laneGains). Its lines move it through a stage after them, a gain per
// side, which plays what the lines ask for over what the faders give. So a
// lane without lines plays through gains at exactly 1; a line drawn or
// cleared while the song plays moves that stage alone; and Mute, Solo and
// auto-balance keep moving the faders as they always did. While a pan line
// moves a lane, its faders hold it a hair off a hard side, so neither side
// sits at zero for the stage to multiply.
//
// The stage plays straight ramps between knots (graph-automation.ts). A
// volume line is straight in decibels and the pan law bends a pan line, so
// each stretch between two points is cut into knots, one a decibel and 16
// across the knob's travel, which keeps every ramp within 0.02 dB of its
// line (lane-automation.test.ts).
import { dbToGain } from '@/lib/studio-fx/dsp'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { studioPanGains } from '../model/arrangement-plan'
import { hasStudioAutomation, studioAutomationLine, studioLaneValueAt, } from '../model/automation'
import type { StudioTrack } from '../model/types'

/** A place the stage ramps through: its left and right gains at a frame of the song. */
export interface StudioLaneKnot {
  readonly frame: number
  readonly gains: readonly [number, number]
}

/** How far a line runs before it needs another knot: a decibel of volume, a sixteenth of the knob. */
const VOLUME_STEP_DB = 1
const PAN_STEP = 1 / 16

/** Where a lane's faders hold its pan while a pan line moves it: a hair off either hard side. */
const PAN_BASE_LIMIT = 0.999

/** The pan a lane's faders stand at: its knob's, kept off a hard side while a pan line moves the lane. */
export function automatedPanBase(track: StudioTrack): number {
  if (!hasStudioAutomation(track, 'pan')) return track.pan
  return Math.max(-PAN_BASE_LIMIT, Math.min(PAN_BASE_LIMIT, track.pan))
}

/** The stage's gains at `frame`: what the lines ask for over what the faders give. */
function stageGains(track: StudioTrack, frame: number): [number, number] {
  const volume = hasStudioAutomation(track, 'volume')
    ? dbToGain(studioLaneValueAt(track, 'volume', frame) - track.gainDb)
    : 1
  if (!hasStudioAutomation(track, 'pan')) return [volume, volume]
  const [left, right] = studioPanGains(studioLaneValueAt(track, 'pan', frame))
  const [baseLeft, baseRight] = studioPanGains(automatedPanBase(track))
  return [(volume * left) / baseLeft, (volume * right) / baseRight]
}

/** How many ramps the stretch between two points takes to stay on its lines. */
function piecesBetween(track: StudioTrack, from: number, to: number): number {
  const span = (param: 'volume' | 'pan') =>
    Math.abs(
      studioLaneValueAt(track, param, to) -
        studioLaneValueAt(track, param, from),
    )
  const pieces = Math.ceil(
    Math.max(span('volume') / VOLUME_STEP_DB, span('pan') / PAN_STEP),
  )
  return Math.max(1, Math.min(to - from, pieces))
}

/** A lane's knots, frames rising: flat before the first and after the last. Null without lines. */
export function studioLaneKnots(track: StudioTrack): StudioLaneKnot[] | null {
  if (!hasStudioAutomation(track)) return null
  const frames = [
    ...new Set(
      [
        ...studioAutomationLine(track, 'volume'),
        ...studioAutomationLine(track, 'pan'),
      ].map((point) => point.frame),
    ),
  ].sort((a, b) => a - b)
  const knots: StudioLaneKnot[] = []
  for (const [index, from] of frames.entries()) {
    knots.push({ frame: from, gains: stageGains(track, from) })
    const to = frames.at(index + 1)
    if (to === undefined) break
    const pieces = piecesBetween(track, from, to)
    for (let piece = 1; piece < pieces; piece++) {
      const frame = from + Math.round(((to - from) * piece) / pieces)
      knots.push({ frame, gains: stageGains(track, frame) })
    }
  }
  return knots
}

/** The stage's gains at `frame` as its ramps play them: straight between knots, flat beyond. */
export function studioKnotGainsAt(
  knots: readonly StudioLaneKnot[],
  frame: number,
): readonly [number, number] {
  const last = knots.length - 1
  if (frame <= knots[0].frame) return knots[0].gains
  if (frame >= knots[last].frame) return knots[last].gains
  let low = 0
  let high = last
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (knots[middle].frame <= frame) low = middle
    else high = middle
  }
  const from = knots[low]
  const to = knots[high]
  const at = (frame - from.frame) / (to.frame - from.frame)
  return [
    from.gains[0] + (to.gains[0] - from.gains[0]) * at,
    from.gains[1] + (to.gains[1] - from.gains[1]) * at,
  ]
}

/**
 * What a lane's knots are made from: each line and the control under it.
 * Null without lines. Balance, Mute and Solo move the faders alone.
 */
export function studioLaneAutomationKey(track: StudioTrack): string | null {
  if (!hasStudioAutomation(track)) return null
  const volume = studioAutomationLine(track, 'volume')
  const pan = studioAutomationLine(track, 'pan')
  return JSON.stringify([
    volume.length > 0 ? [volume, track.gainDb] : null,
    pan.length > 0 ? [pan, track.pan] : null,
  ])
}

/** Whether any lane of `plan` follows a line. */
export function studioPlanAutomated(plan: StudioArrangementPlan): boolean {
  return plan.lanes.some((lane) => hasStudioAutomation(lane.track))
}
