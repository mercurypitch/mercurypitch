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

/** The card an unfurl shows is square, this many pixels a side. One number
 *  for the three places that have to agree on it: the app draws it, the
 *  store refuses anything else, and the tags declare it to the crawler. */
export const OG_CARD_SIZE = 1080

/** The dev deploy and the PR previews: sites that are not the public one. */
function isStagingHost(hostname: string): boolean {
  return (
    hostname === 'dev.mercurypitch.com' || hostname.endsWith('.workers.dev')
  )
}

/**
 * Where a link carrying a voiceprint should point.
 *
 * The public Mirror, from anywhere people actually are. A staging site keeps
 * its links at home instead, for two reasons that are really one: the card
 * is stored beside the page that uploaded it, so a link sent off to the
 * public site would unfurl without it; and until a release ships, the
 * public site does not read the payload at all. Without this the feature
 * could only ever be tried on production.
 */
export function voiceprintShareBase(
  here: Pick<Location, 'hostname' | 'origin'> | undefined = (
    globalThis as { location?: Location }
  ).location,
): string {
  if (here !== undefined && isStagingHost(here.hostname)) {
    return `${here.origin}/mirror`
  }
  return SHARE_BASE
}

/** Kept fixed so card-driven traffic stays one series in GA4, continuous
 *  with the sessions recorded before the payload existed. Deliberately not
 *  a paid-campaign tag: a card reaching someone through a friend is
 *  organic, whoever seeded it. */
const SHARE_TAG = 'utm_source=voiceprint&utm_medium=share'

/** The query parameter carrying the encoded voiceprint. */
export const VOICEPRINT_PARAM = 'v'

/** The query parameter naming the stored card an unfurl should use. */
export const OG_CARD_PARAM = 'og'

/** The tagged Mirror URL with no voiceprint attached — what a card shares
 *  when there is nothing to carry. The single definition of this string;
 *  `card-renderer` re-exports it rather than keeping its own copy. */
export const MIRROR_SHARE_URL = `${SHARE_BASE}?${SHARE_TAG}`

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * A fresh id for a card this device is about to upload.
 *
 * Chosen here rather than asked of the server, so that the share sheet
 * opens on the same tap that produced it — Safari only honours a share
 * that begins inside the gesture, and a round trip would land outside it.
 * Ten base62 characters, the same shape and entropy as a share id.
 */
export function newOgCardId(): string {
  const bytes = new Uint8Array(10)
  // `globalThis.` on purpose: the bare global is on the restricted list,
  // and this module is read by the worker as well as the browser.
  globalThis.crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < 10; i++) id += BASE62[bytes[i] % 62]
  return id
}

/**
 * Store the card so the link unfurls as itself.
 *
 * Deliberately not awaited by its callers: the share sheet must never wait
 * on the network, and a failed upload costs only a stock unfurl. Errors are
 * swallowed here rather than left to an unowned tail — a rejected
 * fire-and-forget fetch outliving its test file fails an otherwise green
 * run.
 */
export function uploadOgCard(id: string, card: Blob): void {
  void fetch(`/api/og/card/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': card.type },
    body: card,
  }).catch(() => {
    // Nothing to do and nothing to tell the singer: the link still works.
  })
}

/**
 * Whether this link asks for that card. A take with nothing worth encoding
 * shares the bare Mirror URL, which names no card — and a card stored for a
 * link that does not mention it has left the device for nothing.
 */
export function linkNamesCard(link: string, id: string): boolean {
  return link.includes(`&${OG_CARD_PARAM}=${id}&`)
}

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
  ogCardId?: string | null,
): string {
  if (summary == null) return MIRROR_SHARE_URL

  const encoded = encodeVoiceprintForShare(summary, twin, displayName)
  // A payload the decoder would reject is worse than no payload: it would
  // open the recipient on an error instead of the ordinary invitation.
  if (decodeSharePayload(encoded) == null) return MIRROR_SHARE_URL

  // `og` names the stored card the link should unfurl with. It is only a
  // picture: the voiceprint itself travels in `v`, so a link whose card has
  // expired still opens on the right take.
  const card =
    ogCardId != null && ogCardId !== '' ? `&${OG_CARD_PARAM}=${ogCardId}` : ''

  return `${voiceprintShareBase()}?${VOICEPRINT_PARAM}=${encoded}${card}&${SHARE_TAG}`
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
  // Rounded because a link is something anyone can write: a note is named by
  // indexing twelve names, and 60.5 indexes none of them.
  const low = midiToNoteNameOctave(Math.round(data.lo))
  const high = midiToNoteNameOctave(Math.round(data.hi))
  return `${low} – ${high}`
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
