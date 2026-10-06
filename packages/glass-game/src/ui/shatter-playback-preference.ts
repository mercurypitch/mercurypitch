// Shatter playback preference — validated visual timing shared by galleries and runners.
import { createSignal } from 'solid-js'
import { parseShatterPlaybackSpeed, SHATTER_PLAYBACK_SPEED, } from '../core/shatter-presentation'
import type { GlassGameHost } from '../host'
import { hasDevelopmentTuning } from './development-tuning'

export const SHATTER_PLAYBACK_SPEED_PREFERENCE = 'shatter-playback-speed:v1'

export function createShatterPlaybackPreference(
  host: Pick<
    GlassGameHost,
    'readPreference' | 'writePreference' | 'developmentTuning'
  >,
  apply: (speed: number) => void,
) {
  const enabled = hasDevelopmentTuning(host)
  const [shatterPlaybackSpeed, setShatterPlaybackSpeed] = createSignal(
    enabled
      ? parseShatterPlaybackSpeed(
          host.readPreference(SHATTER_PLAYBACK_SPEED_PREFERENCE),
        )
      : SHATTER_PLAYBACK_SPEED.default,
  )
  return {
    shatterPlaybackSpeed,
    changeShatterPlaybackSpeed(value: number): void {
      if (!enabled) return
      const speed = parseShatterPlaybackSpeed(value)
      setShatterPlaybackSpeed(speed)
      host.writePreference(SHATTER_PLAYBACK_SPEED_PREFERENCE, String(speed))
      apply(speed)
    },
  }
}
