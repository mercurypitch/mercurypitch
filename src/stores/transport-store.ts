import { createPersistedSignal } from '@/lib/storage'

export type CountInOption = 0 | 1 | 2 | 4

export const [countIn, setCountIn] = createPersistedSignal<CountInOption>(
  'pitchperfect_count_in',
  0,
)

export const [bpm, _setBpm] = createPersistedSignal<number>(
  'pitchperfect_bpm',
  60,
)

export function setBpm(value: number): void {
  const clamped = Math.max(40, Math.min(280, value))
  _setBpm(clamped)
}

export const [playbackSpeed, _setPlaybackSpeed] = createPersistedSignal<number>(
  'pitchperfect_playback_speed',
  1.0,
)

export function setPlaybackSpeed(speed: number): void {
  const clamped = Math.max(0.25, Math.min(2.0, speed))
  _setPlaybackSpeed(clamped)
}

