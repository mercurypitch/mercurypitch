// Reference duration preference — development-only tuning leaves release examples at the sustained default.
import { createSignal } from 'solid-js'
import type { GlassGameHost } from '../host'
import { parseReferenceNoteHold, REFERENCE_NOTE_HOLD, REFERENCE_NOTE_HOLD_PREFERENCE, } from '../reference-note'
import { hasDevelopmentTuning } from './development-tuning'

export function createReferenceNotePreference(
  host: Pick<
    GlassGameHost,
    'readPreference' | 'writePreference' | 'developmentTuning'
  >,
) {
  const enabled = hasDevelopmentTuning(host)
  const [referenceNoteHoldSeconds, setReferenceNoteHoldSeconds] = createSignal(
    enabled
      ? parseReferenceNoteHold(
          host.readPreference(REFERENCE_NOTE_HOLD_PREFERENCE),
        )
      : REFERENCE_NOTE_HOLD.default,
  )
  return {
    referenceNoteHoldSeconds,
    changeReferenceNoteHold(value: number): void {
      if (!enabled) return
      const seconds = parseReferenceNoteHold(value)
      setReferenceNoteHoldSeconds(seconds)
      host.writePreference(REFERENCE_NOTE_HOLD_PREFERENCE, String(seconds))
    },
  }
}
