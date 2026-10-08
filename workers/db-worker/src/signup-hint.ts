// ============================================================
// Sign-up hint — what a new account's first mail may say about the singer
// ============================================================
//
// The welcome and confirm mails are rendered inside the sign-up request,
// before the app adopts the device's voiceprints into the new account. So
// the app sends a small hint along: the newest voiceprint twin the sign-up
// will adopt, and whether the sign-up started on Karaoke Night. This module
// decides what of it to believe.
//
// A hint only picks the mail's variant and fills its voiceprint panel. It is
// stored nowhere, and anything malformed means "no hint", never a failed
// sign-up. A forged hint can change only what a person's own mail says about
// them, and only to a catalogue legend and bounded numbers.

import { VOICE_LEGENDS, VOICE_TYPE_BANDS, } from '../../../src/lib/mirror/legend-catalog'
import { midiToNoteNameOctave } from '../../../src/lib/note-utils'

/** A validated voiceprint, in the shape the mail renderers take. */
export interface SignupVoiceprint {
  /** Catalogue id, which names the portrait file. */
  legendId: string
  /** The legend's display name, exactly as the catalogue spells it. */
  twin: string
  /** The legend's broad voice band, for example "Baritone". */
  voiceType: string
  lowMidi: number
  highMidi: number
  accuracy: number | null
  steadiness: number | null
}

/** Where the sign-up started. Only Karaoke Night changes the mail. */
export type SignupSource = 'karaoke'

// Wide enough for any voice the Mirror measures, narrow enough that a
// forged hint cannot put nonsense in the panel.
const MIDI_FLOOR = 24
const MIDI_CEILING = 96
const MAX_SPAN = 48

function isMidi(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIDI_FLOOR &&
    value <= MIDI_CEILING
  )
}

/** A 0..100 score, null when absent; undefined when present but invalid. */
function score(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value < 0 || value > 100) return undefined
  return Math.round(value)
}

export function parseVoiceprintHint(raw: unknown): SignupVoiceprint | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }
  const hint = raw as Record<string, unknown>
  const legend =
    typeof hint.twin === 'string'
      ? VOICE_LEGENDS.find((entry) => entry.name === hint.twin)
      : undefined
  if (legend === undefined) return null
  const { lowMidi, highMidi } = hint
  if (!isMidi(lowMidi) || !isMidi(highMidi)) return null
  if (lowMidi >= highMidi || highMidi - lowMidi > MAX_SPAN) return null
  const accuracy = score(hint.accuracy)
  const steadiness = score(hint.steadiness)
  if (accuracy === undefined || steadiness === undefined) return null
  const band = VOICE_TYPE_BANDS.find((entry) => entry.id === legend.band)
  return {
    legendId: legend.id,
    twin: legend.name,
    voiceType: band?.label ?? legend.band,
    lowMidi,
    highMidi,
    accuracy,
    steadiness,
  }
}

export function parseSignupSource(raw: unknown): SignupSource | null {
  return raw === 'karaoke' ? 'karaoke' : null
}

/**
 * The form that rides in the signed Google state, which travels in a URL:
 * the legend's name, then low, high, accuracy and steadiness. It goes back
 * through parseVoiceprintHint on the way out, so there is one validator.
 */
export type PackedVoiceprintHint = [
  string,
  number,
  number,
  number | null,
  number | null,
]

export function packVoiceprintHint(
  voiceprint: SignupVoiceprint,
): PackedVoiceprintHint {
  return [
    voiceprint.twin,
    voiceprint.lowMidi,
    voiceprint.highMidi,
    voiceprint.accuracy,
    voiceprint.steadiness,
  ]
}

export function unpackVoiceprintHint(raw: unknown): SignupVoiceprint | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null
  const [twin, lowMidi, highMidi, accuracy, steadiness] = raw as unknown[]
  return parseVoiceprintHint({ twin, lowMidi, highMidi, accuracy, steadiness })
}

/** "E2" for 40: scientific pitch, the way the app names notes. */
export function noteName(midi: number): string {
  return midiToNoteNameOctave(midi)
}

/**
 * The newest voiceprint with a twin already on an account, for a mail sent
 * after sign-up (a confirm link sent again), when the account is the source
 * and no hint is needed. A row that does not pass the hint's checks counts as
 * no voiceprint, exactly as a bad hint does.
 */
export async function readAccountVoiceprint(
  db: D1Database,
  userId: string,
): Promise<SignupVoiceprint | null> {
  const row = await db
    .prepare(
      'SELECT twin, summary FROM voiceprints WHERE userId = ? AND twin IS NOT NULL ORDER BY takenAt DESC LIMIT 1',
    )
    .bind(userId)
    .first<{ twin: string; summary: string }>()
  if (row === null) return null
  let summary: unknown
  try {
    summary = JSON.parse(row.summary)
  } catch {
    return null
  }
  if (typeof summary !== 'object' || summary === null) return null
  const { lowMidi, highMidi, accuracy, steadiness } = summary as Record<
    string,
    unknown
  >
  return parseVoiceprintHint({
    twin: row.twin,
    lowMidi,
    highMidi,
    accuracy,
    steadiness,
  })
}
