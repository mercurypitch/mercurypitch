// ============================================================
// Lesson 17 four words — note value, rest, dot and tie, each written as it plays
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure a short rhythm on one line, drawn by
// the kit's rhythm bar, written as it plays and kept, with its stopwatch
// strip (WEB-SPEC, Toys 4; FACTS 65), all at 60 BPM: Note value is a whole
// note, then two halves (8 s); Rest, a quarter, a quarter rest, a quarter
// and a quarter rest (4 s); Dot, a dotted half, then a quarter (4 s); Tie,
// two quarters, then, after a beat's pause, the same two tied (5 s), its
// strip reading "1 s, 1 s", then "2 s". A figure is a short rhythm, not a
// bar: no 4/4 and no bar line, so it need not fill one (the kit's `bare`
// scene), and the tie curves below the heads, opposite their stems (FACTS
// 29). The tickets are too small for a second view, so none has the pitch
// line (Toys 1). The figures are hidden from a screen reader, whose words
// are the button's, and the section's polite region says each play's
// lengths once it is heard to its end. A play is the page's one sound:
// its bar claims the page's owner as it starts, so a newer sound anywhere
// stops it and its button goes out.

import { q } from '@/features/lessons/kit/dom'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import type { RhythmRow } from '@/features/lessons/kit/rhythm-layout'
import type { NoteValue, Written } from '@/features/lessons/kit/rhythm-model'
import { lengthsWords } from '@/features/lessons/kit/rhythm-words'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'value' | 'rest' | 'dot' | 'tie'
export const WORD_IDS: readonly WordId[] = ['value', 'rest', 'dot', 'tie']

/** The words' tempo, BPM (FACTS 65). */
export const WORD_BPM = 60

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })

/** Each word's figure, one row on one line (FACTS 65). */
export const WORD_ROWS: Readonly<Record<WordId, RhythmRow>> = {
  value: { bars: [[note(4)], [note(2), note(2)]], bpm: WORD_BPM },
  rest: { bars: [[note(1), rest(1), note(1), rest(1)]], bpm: WORD_BPM },
  dot: { bars: [[note(2, { dotted: true }), note(1)]], bpm: WORD_BPM },
  // two quarters, a beat's pause, then the same two tied
  tie: {
    bars: [
      [note(1), note(1)],
      [note(1, { tie: true }), note(1)],
    ],
    bpm: WORD_BPM,
    starts: [0, 3],
    beats: 5,
  },
}

/** What each figure shows, as its group is named. */
const LABELS: Readonly<Record<WordId, string>> = {
  value: 'A whole note, then two half notes, on one line',
  rest: 'A quarter note, a quarter rest, a quarter note and a quarter rest, on one line',
  dot: 'A dotted half note, then a quarter note, on one line',
  tie: 'Two quarter notes, then the same two tied, on one line',
}

/** What each play says once heard to its end: the kit's lengths, and the tie's in its own words. */
export const WORD_LINES: Readonly<Record<WordId, string>> = {
  value: lengthsWords(WORD_ROWS.value.bars, WORD_BPM),
  rest: lengthsWords(WORD_ROWS.rest.bars, WORD_BPM),
  dot: lengthsWords(WORD_ROWS.dot.bars, WORD_BPM),
  tie: 'Two quarter notes, then the same two tied, at 60 beats per minute: 1 second each, then 2 seconds.',
}

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** A word's figure: a bare short rhythm, compact, with its strip and no pads. */
export function wordView(word: WordId): RhythmView {
  return {
    scene: {
      staff: 'line',
      rows: [WORD_ROWS[word]],
      compact: true,
      bare: true,
      pads: false,
    },
    label: LABELS[word],
    pads: null,
  }
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
    })
    bars[word].show(wordView(word))
  }
  // the bar claims the page's owner, so the strip takes none: a newer sound
  // stops the bar, its play ends, and the strip puts its button out
  bindWordPlays(q('#words'), async (w) => {
    if (!isWord(w)) return
    const bar = bars[w]
    await bar.play([{ view: bar.view ?? wordView(w), bpm: () => WORD_BPM }], {
      line: WORD_LINES[w],
    })
  })
  return { bars }
}
