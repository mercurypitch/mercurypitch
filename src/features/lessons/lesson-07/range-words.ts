// ============================================================
// Lesson 7 chart words — what the range chart says, to the eye and the ear
// ============================================================
//
// The chart is a picture, so every state has words (WEB-SPEC, Toys 1,
// "Keyboard and screen readers"): a readout for the eye, with a ♯ shown as
// the sign and read as its word (`nameHtml`), and a summary for a screen
// reader in spoken names only, "C sharp 4", never the sign. Pure, so the
// copy tests hold every line to LESSON.md and the house rules
// (copy.test.ts): no number in the push gauge's words, no sign in anything
// spoken, no span or end named for a voice.

import { nameHtml, sharpOf } from '@/features/lessons/kit/notes'
import type { SirenSound } from '@/features/lessons/kit/timbre'
import type { ChartVoice, SingerId, VoiceBand } from './range-data'
import { BANDS, bandSaid, SINGERS, sirenEnds, slideReadout, spoken, TWINKLE_SPAN, twinkleDo, } from './range-data'

/** Each of the siren's three sounds, as the summary and the readout name it. */
export const SOUND_WORDS: Readonly<Record<SirenSound, string>> = {
  ng: 'on “ng”',
  trill: 'on a lip trill',
  oo: 'on “oo”',
}

/** The siren states' summary: "Merc's siren, from E 3 up to C sharp 4 and back". */
export function sirenSaid(v: ChartVoice, sound: SirenSound | null): string {
  const { low, high } = sirenEnds(v)
  const on = sound === null ? '' : ` ${SOUND_WORDS[sound]}`
  return `Merc's siren${on}, from ${spoken(low)} up to ${spoken(high)} and back`
}

/** The siren states' readout, as markup: "Merc's siren: E3 up to C♯4 and back". */
export function sirenShown(v: ChartVoice, sound: SirenSound | null): string {
  const { low, high } = sirenEnds(v)
  const on = sound === null ? '' : ` ${SOUND_WORDS[sound]}`
  return `Merc's siren${on}: ${nameHtml(sharpOf(low))} up to ${nameHtml(sharpOf(high))} and back`
}

/** Step 3's summary: "Twinkle, moved up 2 semitones: all of it in the lit middle". */
export function songSaid(v: ChartVoice, doMidi: number): string {
  const line = slideReadout(v, doMidi)
  return `Twinkle, ${line.charAt(0).toLowerCase()}${line.slice(1)}`
}

/** The cold open's live words, before the reveal: they name no note. */
export const HERO_BEFORE = 'Twinkle, Twinkle, its first two lines'

/** After the reveal: "Twinkle, Twinkle, from E 3 up to C sharp 4 and back: 9 of the column's 24 semitones". */
export function heroAfter(v: ChartVoice): string {
  const d = twinkleDo(v)
  return `Twinkle, Twinkle, from ${spoken(d + TWINKLE_SPAN.low)} up to ${spoken(d + TWINKLE_SPAN.high)} and back: ${TWINKLE_SPAN.high - TWINKLE_SPAN.low} of the column's 24 semitones`
}

/** The range both singers share, in words and in signs. */
const SHARED = SINGERS.a

/** The range bar's words beside it: the shared range before a singer is picked. */
export function singerLines(id: SingerId | null): string[] {
  const range = `${signsText(SHARED.lo)} to ${signsText(SHARED.hi)}`
  if (id === null) return ['Two singers, one range', range]
  const s = SINGERS[id]
  return [
    s.name,
    `comfortable ${signsText(s.lit.lo)} to ${signsText(s.lit.hi)}`,
    s.probably,
  ]
}

/** A note in signs, for the canvas's words: "A3", "C6". */
const signsText = (midi: number): string => {
  const s = sharpOf(midi)
  return `${s.letter}${s.alter === 1 ? '♯' : ''}${s.octave}`
}

/** What Step 5's chart says: the two singers, one of them, or the six bands. */
export function typesSaid(o: {
  readonly singer: SingerId | null
  readonly all: boolean
  readonly band: VoiceBand | null
}): string {
  if (o.band !== null) return bandSaid(o.band)
  if (o.all)
    return `The six voice types the Vocal Range Test uses, low to high: ${BANDS.map((b) => `${b.name.toLowerCase()}, ${spoken(b.lo)} to ${spoken(b.hi)}`).join('; ')}`
  const range = `${spoken(SHARED.lo)} to ${spoken(SHARED.hi)}`
  if (o.singer === null) return `Two singers, one range: ${range}`
  const s = SINGERS[o.singer]
  return `${s.name}: ${range}, comfortable from ${spoken(s.lit.lo)} to ${spoken(s.lit.hi)}: ${s.probably}`
}

/** Step 5's readout, as markup: the singer picked, or nothing. */
export function typesShown(id: SingerId | null): string {
  if (id === null) return ''
  const s = SINGERS[id]
  return `${s.name}: comfortable ${nameHtml(sharpOf(s.lit.lo))} to ${nameHtml(sharpOf(s.lit.hi))}, ${s.probably}`
}

/** The six voice types, for the words strip's live line. */
export const TYPES_NAMED =
  'The six voice types, low to high: bass, baritone, tenor, alto, mezzo-soprano and soprano.'
