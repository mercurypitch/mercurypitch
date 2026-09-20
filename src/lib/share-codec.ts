// ============================================================
// Share Codec — Base64url self-contained payload encoding
//
// Encodes melodies, exercises, and daily routines into compact
// base64url strings suitable for URL hash fragments. When a
// recipient opens the URL, the app auto-loads the shared content.
//
// Format: base64url(JSON(SharePayload))
//   SharePayload = { v: 1, t: 'melody'|'exercise'|'routine', n?: string, d: ... }
//
// Melody items use positional tuples [midi, startBeat, dur, ...]
// to avoid repeating key names across many items.
// ============================================================

import { midiToFreq, midiToNote } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'

// ── Payload types ─────────────────────────────────────────────

export type ShareType = 'melody' | 'exercise' | 'routine' | 'voiceprint'

export interface SharePayload {
  v: 1
  t: ShareType
  n?: string
  d:
    | MelodyShareData
    | ExerciseShareData
    | RoutineShareData
    | VoiceprintShareData
}

// ── Melody share data (positional tuples) ─────────────────────

/**
 * CompactMelodyItem: positional tuple avoiding key-name repetition.
 *  [0] midi — integer, MIDI note number (or -1 for rest notes)
 *  [1] startBeat — number, rounded to 1 decimal
 *  [2] duration — number, rounded to 1 decimal
 *  [3] velocity? — 0–127, omitted for default 100 and for rests
 *  [4] effectType? — string, omitted when undefined or for rests
 *  [5] slideInterval? — signed integer semitones
 *  [6] vibratoAmplitude? — float 0.1–3.0
 *  [7] lyricText? — string
 */
export type CompactMelodyItem = [
  number, // midi
  number, // startBeat
  number, // duration
  number?, // velocity (omitted when 100)
  string?, // effectType
  number?, // slideInterval
  number?, // vibratoAmplitude
  string?, // lyricText
]

export interface MelodyShareData {
  n: string // melody name
  b: number // bpm
  k?: string // key
  s?: string // scale type
  tb?: number // total beats
  dk?: 1 // drum kit melody (absent = pitched; old decoders ignore it)
  i: CompactMelodyItem[] // items
}

// ── Exercise share data ───────────────────────────────────────

/**
 * A voiceprint, as it travels in a share link.
 *
 * Deliberately narrow: every field here is a number already printed on the
 * card face the recipient was sent, so the link discloses nothing the image
 * did not. No audio, no F0 frames, no user or device id, and no exact
 * timestamp — a take is identified by its numbers, never by who made it.
 * `n` is opt-in and absent unless the singer typed a name.
 */
export interface VoiceprintShareData {
  lo?: number // lowMidi
  hi?: number // highMidi
  st?: number // semitones of range
  ac?: number // accuracy score, 0-100 -- the number the card prints
  sd?: number // steadiness score, 0-100 -- likewise, and NOT cents
  tw?: string // twin legend name
  n?: string // display name — opt-in
}

export interface ExerciseShareData {
  e: string // ExerciseType
  tn?: string[] // target notes
  df?: number // difficulty
  dr?: number // duration seconds
}

// ── Routine share data ────────────────────────────────────────

export interface RoutineShareData {
  id: string
  n: string // routine name
  desc: string // description
  seg: Array<{
    k: string // SegmentKind: 'warmup' | 'exercise' | 'challenge-prep' | 'cooldown'
    d: number // durationSec
    c: Record<string, unknown> // config
  }>
}

// ── Base64url helpers ─────────────────────────────────────────

function toBase64url(raw: string): string {
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(encoded: string): string | null {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4 !== 0) base64 += '='
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

// ── Rounding ──────────────────────────────────────────────────

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Encode: Melody ────────────────────────────────────────────

export function encodeMelodyForShare(
  items: MelodyItem[],
  bpm: number,
  key?: string,
  scaleType?: string,
  totalBeats?: number,
  name?: string,
  kind?: 'melody' | 'drums',
): string {
  const compact: CompactMelodyItem[] = items.map((item) => {
    // Rest notes use midi=-1 sentinel (valid MIDI range is 21-108)
    if (item.isRest === true) {
      return [-1, r1(item.startBeat), r1(item.duration)] as CompactMelodyItem
    }
    const tuple = [
      item.note.midi,
      r1(item.startBeat),
      r1(item.duration),
      item.velocity != null && item.velocity !== 100
        ? item.velocity
        : undefined,
      item.effectType || undefined,
      item.slideInterval ?? undefined,
      item.vibratoAmplitude ?? undefined,
      item.lyricText != null && item.lyricText !== ''
        ? item.lyricText
        : undefined,
    ]
    while (tuple.length > 3 && tuple[tuple.length - 1] === undefined)
      tuple.pop()
    return tuple as CompactMelodyItem
  })

  const payload: SharePayload = {
    v: 1,
    t: 'melody',
    n: name,
    d: {
      n: name ?? 'Shared Melody',
      b: bpm,
      k: key != null && key !== '' ? key : undefined,
      s: scaleType != null && scaleType !== '' ? scaleType : undefined,
      tb:
        totalBeats != null && totalBeats !== 0 && !Number.isNaN(totalBeats)
          ? totalBeats
          : undefined,
      dk: kind === 'drums' ? 1 : undefined,
      i: compact,
    },
  }

  return toBase64url(JSON.stringify(payload))
}

// ── Encode: Exercise ──────────────────────────────────────────

export function encodeExerciseForShare(
  exerciseType: string,
  targetNotes?: string[],
  difficulty?: number,
  duration?: number,
  name?: string,
): string {
  const data: ExerciseShareData = {
    e: exerciseType,
    tn: targetNotes && targetNotes.length > 0 ? targetNotes : undefined,
    df: difficulty ?? undefined,
    dr: duration ?? undefined,
  }

  const payload: SharePayload = {
    v: 1,
    t: 'exercise',
    n: name,
    d: data,
  }

  return toBase64url(JSON.stringify(payload))
}

// ── Encode: Routine ───────────────────────────────────────────

export function encodeRoutineForShare(template: {
  id: string
  name: string
  description: string
  segments: Array<{
    type: string
    durationSec: number
    config: Record<string, unknown>
  }>
}): string {
  const seg = template.segments.map((s) => ({
    k: s.type,
    d: s.durationSec,
    c: s.config,
  }))

  const data: RoutineShareData = {
    id: template.id,
    n: template.name,
    desc: template.description,
    seg,
  }

  const payload: SharePayload = {
    v: 1,
    t: 'routine',
    n: template.name,
    d: data,
  }

  return toBase64url(JSON.stringify(payload))
}

// ── Encode: Voiceprint ────────────────────────────────────────

/**
 * Encode a voiceprint summary for a share link. Null-valued metrics are
 * omitted rather than encoded as null, so a partial take (range only, say)
 * produces a short payload and the decoder can tell "absent" from "zero".
 */
export function encodeVoiceprintForShare(
  summary: {
    lowMidi?: number | null
    highMidi?: number | null
    semitones?: number | null
    accuracy?: number | null
    steadiness?: number | null
  },
  twin?: string | null,
  displayName?: string | null,
): string {
  const num = (v: number | null | undefined): number | undefined =>
    v == null || Number.isNaN(v) ? undefined : r1(v)

  const data: VoiceprintShareData = {
    lo: num(summary.lowMidi),
    hi: num(summary.highMidi),
    st: num(summary.semitones),
    ac: num(summary.accuracy),
    sd: num(summary.steadiness),
    tw: twin != null && twin !== '' ? twin : undefined,
    n: displayName != null && displayName !== '' ? displayName : undefined,
  }

  const payload: SharePayload = {
    v: 1,
    t: 'voiceprint',
    n: displayName ?? undefined,
    d: data,
  }

  return toBase64url(JSON.stringify(payload))
}

// ── Decode ────────────────────────────────────────────────────

/** The most each voiceprint number can be. Notes are MIDI, so 127; a span
 *  cannot outrun the keyboard it is measured on; accuracy and steadiness are
 *  the card's two scores, which stop at 100. */
const VOICEPRINT_NUMBER_LIMITS = [
  ['lo', 127],
  ['hi', 127],
  ['st', 127],
  ['ac', 100],
  ['sd', 100],
] as const

/** A twin or a display name is a name. Longer than this is someone using
 *  the link to put a paragraph on our page. */
const VOICEPRINT_TEXT_MAX = 80

function validateShareData(t: string, d: unknown): boolean {
  if (d == null || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  switch (t) {
    case 'melody':
      return (
        typeof o.n === 'string' && typeof o.b === 'number' && Array.isArray(o.i)
      )
    case 'exercise':
      return typeof o.e === 'string'
    case 'routine':
      return (
        typeof o.id === 'string' &&
        typeof o.n === 'string' &&
        Array.isArray(o.seg)
      )
    case 'voiceprint': {
      const text = ['tw', 'n'] as const
      // Anyone can write a link, so a number has to be one a take could have
      // produced. `1e999` parses to Infinity, and a note named from it reads
      // "undefinedNaN" on a page and in an unfurl that both carry our name.
      for (const [key, max] of VOICEPRINT_NUMBER_LIMITS) {
        const value = o[key]
        if (value === undefined) continue
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
        if (value < 0 || value > max) return false
      }
      if (typeof o.lo === 'number' && typeof o.hi === 'number' && o.hi < o.lo)
        return false
      for (const key of text) {
        const value = o[key]
        if (value === undefined) continue
        if (typeof value !== 'string') return false
        if (value.length > VOICEPRINT_TEXT_MAX) return false
      }
      // A card with no numbers on it is not a voiceprint; reject rather than
      // render an empty frame to someone who followed a link to see one.
      return VOICEPRINT_NUMBER_LIMITS.some(([k]) => typeof o[k] === 'number')
    }
    default:
      return false
  }
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  const raw = fromBase64url(encoded)
  if (raw == null || raw === '') return null

  try {
    const obj = JSON.parse(raw)
    if (obj == null || typeof obj !== 'object') return null
    if (obj.v !== 1) return null // unknown version
    if (typeof obj.t !== 'string') return null
    if (obj.d == null || typeof obj.d !== 'object') return null
    if (!validateShareData(obj.t, obj.d)) return null

    return obj as SharePayload
  } catch {
    return null
  }
}

// ── Reconstruct MelodyItem[] from compact tuples ──────────────

export function generateMelodyItemsFromCompact(
  items: CompactMelodyItem[],
): MelodyItem[] {
  return items
    .map((tuple, idx) => {
      const midi = tuple[0]
      const startBeat = tuple[1]
      const duration = tuple[2]

      // Validate
      const isRest = midi === -1
      if (!isRest && (midi < 21 || midi > 108)) return null
      if (startBeat < 0 || duration <= 0) return null

      if (isRest) {
        return {
          id: idx + 1,
          note: { midi: 60, name: 'C', octave: 4, freq: 0 },
          startBeat,
          duration,
          velocity: 100,
          isRest: true,
        } as MelodyItem
      }

      const velocity =
        tuple.length > 3 && typeof tuple[3] === 'number' ? tuple[3] : 100
      const effectType =
        tuple.length > 4 && typeof tuple[4] === 'string' ? tuple[4] : undefined
      const slideInterval =
        tuple.length > 5 && typeof tuple[5] === 'number' ? tuple[5] : undefined
      const vibratoAmplitude =
        tuple.length > 6 && typeof tuple[6] === 'number' ? tuple[6] : undefined
      const lyricText =
        tuple.length > 7 && typeof tuple[7] === 'string' ? tuple[7] : undefined

      const noteInfo = midiToNote(midi)

      return {
        id: idx + 1,
        note: {
          midi,
          name: noteInfo.name,
          octave: noteInfo.octave,
          // Recompute from MIDI — the compact share format drops freq, and a
          // freq of 0 makes the guitar pluck synth build a Float32Array of
          // length sampleRate/0 = Infinity and throw.
          freq: midiToFreq(midi),
        },
        startBeat,
        duration,
        velocity: velocity as MelodyItem['velocity'],
        effectType: effectType as MelodyItem['effectType'],
        slideInterval: slideInterval as MelodyItem['slideInterval'],
        vibratoAmplitude: vibratoAmplitude as MelodyItem['vibratoAmplitude'],
        lyricText,
      } as MelodyItem
    })
    .filter((item) => item !== null) as MelodyItem[]
}

// ── URL helpers ───────────────────────────────────────────────

export function generateShareHashUrl(encoded: string): string {
  return `#/share/${encoded}`
}

export function generateShareFullUrl(encoded: string): string {
  if (typeof window === 'undefined') return generateShareHashUrl(encoded)
  return `${window.location.origin}${window.location.pathname}#/share/${encoded}`
}

async function tryShortenUrl(payload: string): Promise<string | null> {
  try {
    const res = await fetch('/api/share/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    })
    if (!res.ok) return null
    const { id } = await res.json()
    if (typeof id !== 'string' || id.length === 0) return null
    return `${window.location.origin}${window.location.pathname}#/s/${id}`
  } catch {
    return null
  }
}

export async function fetchShortPayload(
  shortId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`/api/share/s/${encodeURIComponent(shortId)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { payload: string }
    return typeof data.payload === 'string' ? data.payload : null
  } catch {
    return null
  }
}

export async function copyShareUrl(encoded: string): Promise<boolean> {
  let url: string
  try {
    const shortUrl = await tryShortenUrl(encoded)
    url = shortUrl ?? generateShareFullUrl(encoded)
  } catch {
    url = generateShareFullUrl(encoded)
  }
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}
