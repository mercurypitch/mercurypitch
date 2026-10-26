// Studio fade regression fixture — a legal trimmed take and captured native AudioParam events.
import type { StudioPlannedSegment } from '../model/arrangement-plan'
import { scheduleStudioSegmentGain } from './edge-envelope'

export const trimmedFadeSegment: StudioPlannedSegment = {
  clipIds: ['trimmed'],
  assetId: 'asset',
  startFrame: 12000,
  sourceInFrame: 12000,
  sourceOutFrame: 552000,
  groupStartFrame: 12000,
  groupEndFrame: 552000,
  gainDb: 0,
  preparationGainDb: 0,
  fades: {
    curve: 'linear-amplitude',
    in: { fromSourceFrame: 12000, toSourceFrame: 14400 },
    out: { fromSourceFrame: 537600, toSourceFrame: 552000 },
  },
}
export type StudioEnvelopeEvent =
  | { kind: 'set'; value: number; time: number }
  | { kind: 'curve'; values: number[]; time: number; duration: number }

export function captureStudioEnvelope(when: number): StudioEnvelopeEvent[] {
  const events: StudioEnvelopeEvent[] = []
  const param = {
    setValueAtTime(value: number, time: number) {
      events.push({ kind: 'set', value, time })
      return this
    },
    setValueCurveAtTime(values: Float32Array, time: number, duration: number) {
      events.push({ kind: 'curve', values: [...values], time, duration })
      return this
    },
  }
  scheduleStudioSegmentGain(
    param as unknown as AudioParam,
    trimmedFadeSegment,
    when,
  )
  return events
}
