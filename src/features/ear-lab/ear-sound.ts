// ============================================================
// Ear Lab sound — the stage's level, and the Grid's click voice.
//
// One number for how loud the bench is, on top of the app's own
// volume: every tone the drills play carries it as a trim on the
// engine, and the Grid's clicks take it directly. The click voice
// is a matter of ears and headphones — the bright tick that makes a
// perfect onset also pierces on earbuds — so the default is the
// woodblock and the tick stays a choice.
// ============================================================

import { createClampedPreference } from '@/lib/clamped-preference'
import { createPersistedSignal } from '@/lib/storage'
import type { ClickVoice } from './click-synth'

const volume = createClampedPreference({
  storageKey: 'pitchperfect_ear_volume',
  defaultValue: 0.7,
  min: 0,
  max: 1,
  step: 0.05,
})

export const EAR_VOLUME = volume.spec

export const loadEarVolume = volume.load

export const persistEarVolume = volume.persist

export function formatEarVolume(value: number): string {
  return `${Math.round(value * 100)}%`
}

export const CLICK_VOICES: { id: ClickVoice; label: string; note: string }[] = [
  { id: 'wood', label: 'Wood', note: 'a woodblock — round, kind to earbuds' },
  { id: 'tick', label: 'Tick', note: 'bright and sharp' },
  { id: 'soft', label: 'Soft', note: 'low and gentle' },
]

const isClickVoice = (value: unknown): value is ClickVoice =>
  value === 'tick' || value === 'wood' || value === 'soft'

export const [earClickVoice, setEarClickVoice] =
  createPersistedSignal<ClickVoice>('pitchperfect_ear_click_voice', 'wood', {
    validator: isClickVoice,
  })
