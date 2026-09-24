// Merc encore examples — exact authored contours in the player's selected key and pace.
import type { CompiledMelody } from '../core/melody-contour'
import type { MelodyJudgePolicy } from '../core/melody-judge'
import type { GlassMelodyId } from './melodies'

export interface MercEncorePhrase {
  melodyId: GlassMelodyId
  words: string
  melodyVersion: number
}

export interface MercEncoreVariant extends MercEncorePhrase {
  assetId: string
  assetPath: string
  rootMidi: number
  pace: number
}

export const MERC_ENCORE_JUDGE_POLICY = {
  // The exact-lyric natural `sparks` consonants span 0.36267s at 48 kHz.
  // Heard-anchor evidence still rejects the former 0.768s stretched gap.
  dropoutGraceSeconds: 0.4,
  minimumAnchorEvidenceSeconds: 0.12,
} as const satisfies Partial<MelodyJudgePolicy>

export type MercEncoreFallbackReason =
  | 'find-note'
  | 'key'
  | 'melody-version'
  | 'pace'
  | 'shape'
  | 'unverified-voice'

export type MercEncoreAvailability =
  | { kind: 'voice'; phrase: MercEncorePhrase; variant: MercEncoreVariant }
  | {
      kind: 'guide'
      phrase?: MercEncorePhrase
      reason: MercEncoreFallbackReason
    }

export const MERC_ENCORE_PHRASES: Readonly<
  Partial<Record<GlassMelodyId, MercEncorePhrase>>
> = {
  'first-arc': {
    melodyId: 'first-arc',
    words: 'Let it shine',
    melodyVersion: 1,
  },
  'sunlit-steps': {
    melodyId: 'sunlit-steps',
    words: 'Tiny sparks can glow',
    melodyVersion: 1,
  },
  'gallery-arch': {
    melodyId: 'gallery-arch',
    words: 'Another beautiful mess',
    melodyVersion: 1,
  },
}

export const MERC_ENCORE_ROOTS = Object.freeze(
  Array.from({ length: 13 }, (_, index) => 48 + index),
)
export const MERC_ENCORE_PACES = [0.8, 1, 1.25] as const

const GALLERY_APPROVED_KEYS = new Set([
  '48:100',
  '49:100',
  '50:100',
  '51:100',
  '54:100',
  '56:100',
  '58:100',
  '59:125',
  '60:100',
  '60:125',
])

function paceCode(pace: number): string {
  return Math.round(pace * 100)
    .toString()
    .padStart(3, '0')
}

function approvedVariant(
  melodyId: GlassMelodyId,
  rootMidi: number,
  pace: number,
): boolean {
  if (melodyId !== 'gallery-arch') return true
  return GALLERY_APPROVED_KEYS.has(`${rootMidi}:${paceCode(pace)}`)
}

export const MERC_ENCORE_VARIANTS: readonly MercEncoreVariant[] = Object.freeze(
  (Object.keys(MERC_ENCORE_PHRASES) as GlassMelodyId[]).flatMap((melodyId) => {
    const phrase = MERC_ENCORE_PHRASES[melodyId]!
    return MERC_ENCORE_ROOTS.flatMap((rootMidi) =>
      MERC_ENCORE_PACES.filter((pace) =>
        approvedVariant(melodyId, rootMidi, pace),
      ).map((pace) => {
        const suffix = `r${rootMidi}-p${paceCode(pace)}`
        return {
          ...phrase,
          assetId: `merc-encore-${melodyId}-${suffix}-v6`,
          assetPath: `adventure-voice-v6/${melodyId}/${suffix}.mp3`,
          rootMidi,
          pace,
        }
      }),
    )
  }),
)

const VARIANT_BY_KEY = new Map(
  MERC_ENCORE_VARIANTS.map((variant) => [
    `${variant.melodyId}:${variant.melodyVersion}:${variant.rootMidi}:${paceCode(variant.pace)}`,
    variant,
  ]),
)

export function mercEncoreAvailability(
  melodyId: GlassMelodyId,
  contour: CompiledMelody | null,
): MercEncoreAvailability {
  const phrase = MERC_ENCORE_PHRASES[melodyId]
  if (phrase === undefined) return { kind: 'guide', reason: 'shape' }
  if (contour === null) return { kind: 'guide', phrase, reason: 'find-note' }
  if (contour.id !== melodyId || contour.version !== phrase.melodyVersion)
    return { kind: 'guide', phrase, reason: 'melody-version' }
  if (
    !MERC_ENCORE_PACES.includes(
      contour.pace as (typeof MERC_ENCORE_PACES)[number],
    )
  )
    return { kind: 'guide', phrase, reason: 'pace' }
  const rootMidi = contour.rootMidi + contour.transposeSemitones
  if (!Number.isInteger(rootMidi) || !MERC_ENCORE_ROOTS.includes(rootMidi))
    return { kind: 'guide', phrase, reason: 'key' }
  const variant = VARIANT_BY_KEY.get(
    `${melodyId}:${contour.version}:${rootMidi}:${paceCode(contour.pace)}`,
  )
  return variant === undefined
    ? { kind: 'guide', phrase, reason: 'unverified-voice' }
    : { kind: 'voice', phrase, variant }
}
