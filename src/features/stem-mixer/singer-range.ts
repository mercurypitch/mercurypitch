// ============================================================
// Singer range — where "find my key" learns the singer's voice
// ============================================================
//
// In order: the newest voiceprint that measured a range (what the singer
// actually sang), then the voice type they picked in Settings. The default
// voice type is not a choice — nobody picked it — so without either there is
// no range, and the caller asks.

import { listVoiceprints } from '@/db/services/voiceprint-service'
import type { SingerRange } from '@/lib/key-shift/key-suggest'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'

export interface ResolvedSingerRange {
  range: SingerRange
  source: 'voiceprint' | 'voice-type'
}

/** Mirrors `createPersistedSignal('pitchperfect_vocal_range', …)`. */
const VOICE_TYPE_KEY = 'pitchperfect_vocal_range'
/** Narrower than a fifth is a note held, not a range. */
const MIN_MEASURED_SPAN = 5

function isMeasured(low: number | null, high: number | null): boolean {
  return (
    low !== null &&
    high !== null &&
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    high - low >= MIN_MEASURED_SPAN
  )
}

function voiceTypeWasPicked(): boolean {
  try {
    return localStorage.getItem(VOICE_TYPE_KEY) !== null
  } catch {
    return false
  }
}

/** The picked voice type's range; null while nobody has picked one. */
export function voiceTypeRange(): ResolvedSingerRange | null {
  if (!voiceTypeWasPicked()) return null
  const preset = VOCAL_RANGES[vocalRangePreset()]
  return {
    range: { lowMidi: preset.lowMidi, highMidi: preset.highMidi },
    source: 'voice-type',
  }
}

async function measuredRange(): Promise<SingerRange | null> {
  try {
    for (const take of await listVoiceprints()) {
      const { lowMidi, highMidi } = take.summary
      if (
        lowMidi !== null &&
        highMidi !== null &&
        isMeasured(lowMidi, highMidi)
      )
        return { lowMidi, highMidi }
    }
  } catch {
    // Takes unreadable (offline cloud read, storage error): use the voice type.
  }
  return null
}

export async function resolveSingerRange(): Promise<ResolvedSingerRange | null> {
  const measured = await measuredRange()
  if (measured !== null) return { range: measured, source: 'voiceprint' }
  return voiceTypeRange()
}
