// ── Jam room modes ───────────────────────────────────────────────────
// What the room does with the shared melody.
//
// One idea underneath all of them: the room broadcasts ONE melody, and
// each singer derives their OWN target from it plus their role. Nothing
// per-peer goes over the wire -- which is what keeps this cheap, and what
// keeps every peer's view of the room identical.
//
// Roles are assigned the way peer colours already are (see peer-colors.ts):
// sort the peer ids and take the index. Every peer computes the same
// assignment from the same set, so nobody has to be told theirs and there
// is no handshake to get out of sync. A peer joining or leaving reshuffles
// the room, which is honest -- a three-part chord with two people left is
// not the same chord.
//
// All three modes hold up under latency, which is the constraint the whole
// feature lives with (see docs/plans/jam-room-polish.md §1): nobody has to
// hear anybody else in time. Everyone sings to the same count-in, and only
// the scoreboard combines.

import { scaleDegreeSet } from '@/lib/scale-data'
import type { MelodyData, MelodyItem } from '@/types'

export type JamRoomMode = 'unison' | 'harmony' | 'relay'

export interface JamModeInfo {
  id: JamRoomMode
  label: string
  /** Shown in the picker: what the room is about to do. */
  blurb: string
  /** How a singer's part is named in this mode, by role index. */
  roleNames: readonly string[]
  /** Below this many singers the mode collapses into unison. */
  minPeers: number
}

export const JAM_MODES: readonly JamModeInfo[] = [
  {
    id: 'unison',
    label: 'Unison',
    blurb: 'Everyone sings the same line.',
    roleNames: ['Everyone'],
    minPeers: 1,
  },
  {
    id: 'harmony',
    label: 'Harmony Stack',
    blurb: 'One voice per chord tone — root, third, fifth. Build the chord.',
    roleNames: ['Root', 'Third', 'Fifth'],
    minPeers: 2,
  },
  {
    id: 'relay',
    label: 'Relay',
    blurb: 'Take a phrase each, round the room, and hand off.',
    roleNames: ['1st', '2nd', '3rd', '4th', '5th', '6th'],
    minPeers: 2,
  },
]

export function jamModeInfo(mode: JamRoomMode): JamModeInfo {
  return JAM_MODES.find((m) => m.id === mode) ?? JAM_MODES[0]!
}

/**
 * Which part a peer sings, by position in the sorted room.
 *
 * Returns 0 for a peer that is not in the room yet (or an empty id), which
 * lands them on the first part -- singing the melody as written is the
 * right thing to do while the room is still assembling.
 */
export function roleIndexOf(peerId: string | null, peerIds: string[]): number {
  if (peerId === null || peerId === '') return 0
  const sorted = [...peerIds].sort()
  const i = sorted.indexOf(peerId)
  return i < 0 ? 0 : i
}

/** How many distinct parts a mode splits into for a room of this size. */
export function roleCountFor(mode: JamRoomMode, peerCount: number): number {
  if (mode === 'unison') return 1
  const info = jamModeInfo(mode)
  if (peerCount < info.minPeers) return 1
  return Math.max(1, Math.min(peerCount, info.roleNames.length))
}

/** The name of a part, e.g. "Third" — for the badge next to your name. */
export function roleNameFor(
  mode: JamRoomMode,
  roleIndex: number,
  roleCount: number,
): string {
  if (roleCount <= 1) return jamModeInfo('unison').roleNames[0]!
  const names = jamModeInfo(mode).roleNames
  return names[roleIndex % names.length] ?? `Part ${roleIndex + 1}`
}

// ── Harmony ──────────────────────────────────────────────────────────

/**
 * Step a note up by whole scale degrees, staying in the room's key.
 *
 * Diatonic on purpose: a fixed +4/+7 semitones would put a major chord on
 * every degree of the scale, so a run up C major would harmonise the second
 * degree as D-F#-A and leave the key. Walking the scale's own pitch classes
 * gives D-F-A, which is the chord that belongs there.
 */
export function diatonicStepUp(
  midi: number,
  key: string,
  scaleType: string,
  steps: number,
): number {
  if (steps <= 0) return midi
  const set = scaleDegreeSet(key, scaleType)
  // A chromatic note (or an unknown scale) has no diatonic neighbours to
  // walk, so fall back to the plain major-third/fifth shape rather than
  // wandering the chromatic scale a semitone at a time.
  if (!set.has(((midi % 12) + 12) % 12)) return midi + (steps === 2 ? 4 : 7)

  let current = midi
  let remaining = steps
  // Bounded: a scale has at most 12 pitch classes, so a step is at most 12
  // semitones away and this cannot run away on a malformed scale.
  let guard = steps * 12 + 12
  while (remaining > 0 && guard-- > 0) {
    current += 1
    if (set.has(((current % 12) + 12) % 12)) remaining--
  }
  return current
}

/** Transpose a whole melody up N scale degrees, in its own key. */
function harmoniseItems(
  items: MelodyItem[],
  key: string,
  scaleType: string,
  steps: number,
): MelodyItem[] {
  if (steps === 0) return items
  return items.map((item) => {
    const midi = diatonicStepUp(item.note.midi, key, scaleType, steps)
    return {
      ...item,
      note: {
        ...item.note,
        midi,
        octave: Math.floor(midi / 12) - 1,
        freq: 440 * 2 ** ((midi - 69) / 12),
      },
    }
  })
}

// ── Relay ────────────────────────────────────────────────────────────

/**
 * Split into phrases and keep only the ones that are mine.
 *
 * A phrase is a contiguous run of notes; the melody is cut into as many
 * phrases as there are singers, so everyone gets a turn per pass. Notes
 * that are not mine are dropped from MY target rather than kept silent,
 * because scoring counts an unsung target note as zero -- leaving someone
 * else's phrase in my target would score me on their turn.
 */
function relayItems(
  items: MelodyItem[],
  roleIndex: number,
  roleCount: number,
): MelodyItem[] {
  if (roleCount <= 1 || items.length === 0) return items
  // Never more phrases than notes. Six singers on an eight-note melody at
  // ceil(8/6)=2 notes a phrase only fills four phrases, and singers five
  // and six were handed an empty part: blank canvas, zero score, nothing
  // said. Capping the phrase count means two of them share a phrase
  // instead, which is a relay, whereas silence is a bug.
  const parts = Math.min(roleCount, items.length)
  const mine = roleIndex % parts
  // Distribute notes INTO `parts` buckets rather than cutting fixed-size
  // phrases: with eight notes and six singers, phrases of ceil(8/6)=2 fill
  // only four buckets however you cap them, and the last two singers get
  // nothing. Scaling the index guarantees every bucket is non-empty, at the
  // cost of uneven phrase lengths -- which a relay can carry, and silence
  // cannot.
  return items.filter(
    (_item, i) => Math.floor((i * parts) / items.length) === mine,
  )
}

// ── The one thing the room asks for ──────────────────────────────────

/**
 * My part: the melody as I should sing it.
 *
 * The canvas renders this and the scorer scores against it, so a mode only
 * has to answer "what are MY notes" and everything downstream -- the piano
 * roll, the MIDI range, the per-note scoring, the take chip -- follows.
 */
export function targetForRole(
  melody: MelodyData | null,
  mode: JamRoomMode,
  roleIndex: number,
  roleCount: number,
): MelodyData | null {
  if (melody === null) return melody
  if (mode === 'unison' || roleCount <= 1) return melody

  const role = roleIndex % roleCount
  if (mode === 'harmony') {
    // Role 0 sings it as written, then thirds and fifths above: two scale
    // steps per stacked voice, so a fourth singer lands on the seventh.
    const items = harmoniseItems(
      melody.items,
      melody.key,
      melody.scaleType,
      role * 2,
    )
    return { ...melody, items }
  }

  return { ...melody, items: relayItems(melody.items, role, roleCount) }
}
