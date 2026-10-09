// ============================================================
// Load hold target — the Long note's note, from this device's voiceprints
// ============================================================
//
// The thin, impure half of `hold-target.ts`: reads the voiceprints stored on
// the device and hands them to the pure picker. The voice type is an
// argument because lib must not read the settings store; the web room passes
// `vocalRangePreset()`, the native room leaves the tenor default.

import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import type { HoldTarget, HoldVoicePreset } from './hold-target'
import { HOLD_DEFAULT_PRESET, pickHoldTarget } from './hold-target'

export function loadHoldTarget(
  preset: HoldVoicePreset = HOLD_DEFAULT_PRESET,
): HoldTarget {
  return pickHoldTarget(loadLocalVoiceprints(), preset)
}
