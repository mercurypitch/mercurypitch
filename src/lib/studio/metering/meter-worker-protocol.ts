// Studio meter worker protocol — one bounded chunk in flight and explicit terminal measurements.
import type { StudioLoudnessMeasurement, StudioMeterOptions, } from './stream-meter'

export type MeterWorkerPayload =
  | { kind: 'start'; options: StudioMeterOptions }
  | { kind: 'push'; channels: Float32Array[] }
  | { kind: 'finish' }
export type MeterWorkerRequest = MeterWorkerPayload & { id: number }
export interface MeterWorkerResponse {
  id: number
  error?: string
  measurement?: StudioLoudnessMeasurement
}
