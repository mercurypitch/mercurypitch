// ============================================================
// A voiceprint that travelled — link building and link reading
// ============================================================
//
// The Mirror's share card is generated ~310 times a month and used to
// send people to the *generic* Mirror page, where a recipient found an
// empty instrument asking them to sing. They came to look at what they
// were sent, not to perform, and they left in about three seconds.
//
// So a share link now carries the voiceprint itself. The payload is
// self-contained rather than a short id on purpose: short ids in
// SHARE_STORE expire after 60 days (src/share-handler.ts) and a
// voiceprint is a keepsake — a link someone opens next year should
// still open. See docs/plans/voiceprint-share-link.md.

import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { VoiceprintShareData } from '@/lib/share-codec'
import { decodeSharePayload, encodeVoiceprintForShare } from '@/lib/share-codec'

/** Where a shared voiceprint opens. */
const SHARE_BASE = 'https://mercurypitch.com/mirror'

/** Kept fixed so card-driven traffic stays one series in GA4, continuous
 *  with the sessions recorded before the payload existed. Deliberately not
 *  a paid-campaign tag: a card reaching someone through a friend is
 *  organic, whoever seeded it. */
const SHARE_TAG = 'utm_source=voiceprint&utm_medium=share'

/** The query parameter carrying the encoded voiceprint. */
export const VOICEPRINT_PARAM = 'v'

/** The tagged Mirror URL with no voiceprint attached — what a card shares
 *  when there is nothing to carry. The single definition of this string;
 *  `card-renderer` re-exports it rather than keeping its own copy. */
export const MIRROR_SHARE_URL = `${SHARE_BASE}?${SHARE_TAG}`

export interface ShareableVoiceprint {
  lowMidi?: number | null
  highMidi?: number | null
  semitones?: number | null
  accuracy?: number | null
  steadiness?: number | null
}

/**
 * Build the link that opens this voiceprint for whoever receives it.
 * Falls back to the bare tagged Mirror URL when there is nothing worth
 * encoding, so a caller never has to decide whether it has enough data.
 */
export function voiceprintShareUrl(
  summary: ShareableVoiceprint | null | undefined,
  twin?: string | null,
  displayName?: string | null,
): string {
  if (summary == null) return MIRROR_SHARE_URL

  const encoded = encodeVoiceprintForShare(summary, twin, displayName)
  // A payload the decoder would reject is worse than no payload: it would
  // open the recipient on an error instead of the ordinary invitation.
  if (decodeSharePayload(encoded) == null) return MIRROR_SHARE_URL

  return `${SHARE_BASE}?${VOICEPRINT_PARAM}=${encoded}&${SHARE_TAG}`
}

/**
 * Read a shared voiceprint out of a location. Accepts the query string the
 * links above produce. Returns null for an absent, malformed, or
 * wrong-type payload — every one of which means "show the ordinary
 * Mirror", never an error screen.
 */
export function parseVoiceprintLink(
  search: string,
): VoiceprintShareData | null {
  let encoded: string | null
  try {
    encoded = new URLSearchParams(search).get(VOICEPRINT_PARAM)
  } catch {
    return null
  }
  if (encoded == null || encoded === '') return null

  const payload = decodeSharePayload(encoded)
  if (payload == null || payload.t !== 'voiceprint') return null

  return payload.d as VoiceprintShareData
}

/**
 * How the recipient's view names the sender. Anonymous unless the singer
 * opted into a name — the payload carries none by default.
 */
export function sharedVoiceprintTitle(data: VoiceprintShareData): string {
  const name = data.n
  return name != null && name !== '' ? `${name}'s voiceprint` : 'A voiceprint'
}

/**
 * The range, as the card says it: "C3 – D5". Null when the payload carried
 * no range — a take can measure accuracy without completing the glide.
 */
export function sharedRangeNotes(data: VoiceprintShareData): string | null {
  if (data.lo == null || data.hi == null) return null
  return `${midiToNoteNameOctave(data.lo)} – ${midiToNoteNameOctave(data.hi)}`
}

/**
 * A semitone count in the words the Mirror uses: "2 octaves + 2 semitones".
 * Exact octaves drop the remainder, and a single unit is singular, because
 * "1 octaves + 1 semitones" is the kind of detail that makes a shared card
 * look automated.
 */
export function formatSpan(
  semitones: number | null | undefined,
): string | null {
  if (semitones == null || !Number.isFinite(semitones) || semitones <= 0) {
    return null
  }
  const whole = Math.floor(semitones / 12)
  const rest = Math.round(semitones % 12)
  const plural = (n: number, word: string): string =>
    `${n} ${word}${n === 1 ? '' : 's'}`

  if (whole === 0) return plural(rest, 'semitone')
  if (rest === 0) return plural(whole, 'octave')
  return `${plural(whole, 'octave')} + ${plural(rest, 'semitone')}`
}
