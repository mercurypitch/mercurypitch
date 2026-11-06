// ============================================================
// Lesson 19 four words — accent, offbeat, triplet and syncopation, each heard on its figure
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure drawn by the kit's rhythm bar and left
// as it played (WEB-SPEC, Toys 4; FACTS 66). Accent is six pads alone,
// nothing written: six closed hi-hats a third of a second apart, the first
// at full level and the rest at 0.7, the first pad lit larger as it sounds
// (lesson-19.css), 2 s, with no click. The other three are written as they
// play and kept, on one line in their metre, over the click: Offbeat, a
// bar of 4/4 at 60 BPM, an eighth rest and then a clap on each beat's
// "and", the app's clap at 0.7, 4 s; Triplet, a bar of 2/4 at 60 BPM, two
// eighths on beat 1 and a triplet on beat 2, on the stored voice's A, 2 s;
// Syncopation, Step 4's moved bar, its third note on "2 and" and held over
// beat 3, 4 s. No figure has the stopwatch strip, the counts or the pitch
// line, as no step's does (Toys 1, 6). The figures are hidden from a
// screen reader, whose words are the button's, and the section's polite
// region says each play once it is heard to its end. A play is the page's
// one sound: its bar claims the page's owner as it starts, so a newer
// sound anywhere stops it and its button goes out.

import { q } from '@/features/lessons/kit/dom'
import type { DrumHit } from '@/features/lessons/kit/drum-hits'
import { bookDrum, DRUM_LEVEL } from '@/features/lessons/kit/drum-hits'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayPart, RhythmBar, RhythmView, } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import type { RhythmRow } from '@/features/lessons/kit/rhythm-layout'
import type { NoteValue, Written } from '@/features/lessons/kit/rhythm-model'
import { SIX_EIGHT, TWO_FOUR } from '@/features/lessons/kit/rhythm-model'
import { figureWords } from '@/features/lessons/kit/rhythm-words'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { SIX_BPM, SIX_EIGHTHS, STEP_BPM, syncBar } from './rhythm-views'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'accent' | 'offbeat' | 'triplet' | 'syncopation'
export const WORD_IDS: readonly WordId[] = [
  'accent',
  'offbeat',
  'triplet',
  'syncopation',
]

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })
const times = (k: number, w: Written): Written[] =>
  Array.from({ length: k }, () => w)

/** Each word's figure, one row on one line (FACTS 66). */
export const WORD_ROWS: Readonly<Record<WordId, RhythmRow>> = {
  // six eighths a third of a second apart, drawn as six pads alone
  accent: { bars: [SIX_EIGHTHS], bpm: SIX_BPM, metre: SIX_EIGHT },
  // an eighth rest, then an eighth, on each beat
  offbeat: {
    bars: [times(4, rest(0.5)).flatMap((r) => [r, note(0.5)])],
    bpm: STEP_BPM,
  },
  // two eighths on beat 1, a triplet on beat 2
  triplet: {
    bars: [[...times(2, note(0.5)), ...times(3, note(0.5, { triplet: true }))]],
    bpm: STEP_BPM,
    metre: TWO_FOUR,
  },
  syncopation: { bars: [syncBar('on-2-and')], bpm: STEP_BPM },
}

/** The accent's hi-hats, one an eighth: the first at full level, the rest at 0.7 (FACTS 66). */
export const ACCENT_HATS: readonly DrumHit[] = Array.from(
  { length: 6 },
  (_, k) => ({ voice: 'hh-closed', level: k === 0 ? 1 : DRUM_LEVEL }),
)

/** The offbeat's claps, one on each "and": the app's clap at 0.7, as a tap's (FACTS 31, 66). */
export const OFFBEAT_CLAPS: readonly DrumHit[] = Array.from(
  { length: 4 },
  () => ({ voice: 'clap', level: DRUM_LEVEL }),
)

/** What each figure shows, as its group is named. */
const LABELS: Readonly<Record<WordId, string>> = {
  accent: 'Six pads, numbered 1 to 6, with nothing written',
  offbeat: figureWords(WORD_ROWS.offbeat.bars, 'line'),
  triplet: figureWords(WORD_ROWS.triplet.bars, 'line', TWO_FOUR),
  syncopation: figureWords(WORD_ROWS.syncopation.bars, 'line'),
}

/** What each play says once heard to its end. */
export const WORD_LINES: Readonly<Record<WordId, string>> = {
  accent:
    'Six closed hi-hats a third of a second apart, the first louder: 2 seconds.',
  offbeat:
    'One bar of 4/4 at 60 beats per minute, a clap on each “and”, over the click: 4 seconds.',
  triplet:
    'One bar of 2/4 at 60 beats per minute, two eighth notes, then a triplet: 2 seconds.',
  syncopation:
    'One bar of 4/4 at 60 beats per minute, a note on “2 and”, held over beat 3: 4 seconds.',
}

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** A word's figure, compact, with no strip: the accent's six pads alone, or the written three on one line with no pads. */
export function wordView(word: WordId): RhythmView {
  const accent = word === 'accent'
  return {
    scene: {
      staff: 'line',
      rows: [WORD_ROWS[word]],
      compact: true,
      strip: false,
      pads: accent,
      padEvery: accent ? 0.5 : 1,
      notation: !accent,
    },
    label: LABELS[word],
    pads: null,
  }
}

/** A word's play: the accent's hi-hats with no click, the offbeat's claps over it, the others' notes over it. */
export function wordPart(word: WordId, view: RhythmView): PlayPart {
  const bpm = WORD_ROWS[word].bpm
  if (word === 'accent')
    return { view, bpm: () => bpm, click: false, drums: ACCENT_HATS }
  if (word === 'offbeat') return { view, bpm: () => bpm, drums: OFFBEAT_CLAPS }
  return { view, bpm: () => bpm }
}

export interface Words {
  readonly bars: Readonly<Record<WordId, RhythmBar>>
}

export function initWords(): Words {
  const said = q('[data-words-said]')
  const midi = (): number => (VoiceChoice.voice === 'higher' ? A4 : A3)
  const bars = {} as Record<WordId, RhythmBar>
  for (const word of WORD_IDS) {
    bars[word] = mountRhythmBar({
      figure: q(`[data-word-fig="${word}"]`),
      pads: null,
      said,
      freq: () => hz(midi()),
      voice: () => (midi() === A4 ? 'tavi' : 'merc'),
      owner: NowPlaying,
      drum: bookDrum,
    })
    bars[word].show(wordView(word))
  }
  // the bar claims the page's owner, so the strip takes none: a newer sound
  // stops the bar, its play ends, and the strip puts its button out
  bindWordPlays(q('#words'), async (w) => {
    if (!isWord(w)) return
    const bar = bars[w]
    await bar.play([wordPart(w, bar.view ?? wordView(w))], {
      line: WORD_LINES[w],
    })
  })
  return { bars }
}
