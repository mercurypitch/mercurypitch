// ============================================================
// Lesson 18 four words — count-in, dynamics, staccato and slur, each written as it plays
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure drawn by the kit's rhythm bar across
// the top of its ticket (WEB-SPEC, Toys 3; FACTS 77): Count-in is four
// beat pads, each lighting on its click, four woodblock clicks at 60 BPM,
// beat 1 higher; Dynamics, Staccato and Slur are small staves in the
// learner's clef, quarter notes with no time signature, no bar line and no
// beat grid, played at 60 BPM as written, each mark written as its sound
// plays and staying written (kit/read-marks.ts): mi, re, do quiet with p,
// then after a beat loud with f; do, mi, so with their dots; do, re, mi
// under the slur. The figures are hidden from a screen reader, whose words
// are the buttons', and the section's polite region says each play once
// heard. A play is the page's one sound: its bar claims the page's owner.

import { q } from '@/features/lessons/kit/dom'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { createReadMarks } from '@/features/lessons/kit/read-marks'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import type { Written } from '@/features/lessons/kit/rhythm-model'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { levelAt, MARK_LINES, marksAt, marksDrawn } from './reads'
import type { Short } from './tunes'
import { BPM, DO, SHORTS, shortScene } from './tunes'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'countin' | 'dynamics' | 'staccato' | 'slur'
export const WORD_IDS: readonly WordId[] = [
  'countin',
  'dynamics',
  'staccato',
  'slur',
]

/** What each play says once heard to its end. */
export const WORD_LINES: Readonly<Record<WordId, string>> = {
  countin: 'Count-in: four clicks at 60 beats per minute, the first higher.',
  dynamics: MARK_LINES.dynamics,
  staccato: MARK_LINES.staccato,
  slur: MARK_LINES.slur,
}

const REST: Written = { kind: 'rest', value: 1 }

/** The count-in's figure: four beat pads, nothing written, a click a beat. */
const COUNT_IN_VIEW: RhythmView = {
  scene: {
    staff: 'line',
    rows: [{ bars: [[REST, REST, REST, REST]], bpm: BPM }],
    notation: false,
    pads: true,
    strip: false,
    compact: true,
  },
  label: 'Four beat pads, numbered 1 to 4',
  pads: null,
}

const shortOf = (w: Exclude<WordId, 'countin'>): Short => SHORTS[w]

/** A word's staff figure in a clef: a short figure, compact. */
function staffView(w: Exclude<WordId, 'countin'>, clef: Clef): RhythmView {
  return {
    scene: shortScene(shortOf(w), clef, { compact: true }),
    label: `${clef === 'bass' ? 'Bass' : 'Treble'} staff, a short figure`,
    pads: null,
  }
}

const clefOf = (): Clef => (VoiceChoice.voice === 'higher' ? 'treble' : 'bass')

export interface Words {
  readonly bars: Readonly<Record<WordId, RhythmBar>>
}

export function initWords(): Words {
  const said = q('[data-words-said]')
  const bars = {} as Record<WordId, RhythmBar>
  const plays = {} as Record<WordId, () => Promise<boolean>>
  // the words whose marks have been heard, kept written through a redraw
  const heard = new Set<WordId>()

  for (const word of WORD_IDS) {
    const marks = createReadMarks()
    // the frame handler of the word's play while it plays
    let frame: ((beats: number) => void) | null = null
    const bar = mountRhythmBar({
      figure: q(`[data-word-fig="${word}"]`),
      pads: null,
      said,
      freq: () => hz(midiOf(DO[clefOf()])),
      voice: () => 'merc',
      owner: NowPlaying,
      onFrame: (beats) => {
        if (beats !== null) frame?.(beats)
      },
      onDraw: (fig, svg) => {
        const v = bar.view
        if (v !== null && word !== 'countin') marks.draw(fig, svg, v.scene)
      },
    })
    bars[word] = bar

    if (word === 'countin') {
      bar.show(COUNT_IN_VIEW)
      plays[word] = () =>
        bar.play([{ view: COUNT_IN_VIEW, bpm: () => BPM }], {
          line: WORD_LINES.countin,
        })
      continue
    }

    const short = shortOf(word)
    const show = (): void => {
      const clef = clefOf()
      bar.show(staffView(word, clef), () => true)
      marks.set({
        home: DO[clef],
        marks: heard.has(word) ? marksDrawn(short) : [],
        level: null,
      })
    }
    show()
    // the learner's clef, set by the voice chosen in Sing it
    VoiceChoice.subscribe(() => {
      bar.stop()
      show()
    })
    plays[word] = async () => {
      marks.set({ marks: [] })
      frame = (beats) => {
        marks.set({
          marks: marksAt(short, beats),
          level: levelAt(short, beats),
        })
      }
      const done = await bar.play(
        [
          {
            view: bar.view ?? staffView(word, clefOf()),
            bpm: () => BPM,
            click: false,
            shape: short.shape,
          },
        ],
        { line: WORD_LINES[word] },
      )
      frame = null
      if (done) heard.add(word)
      // a play cut short leaves nothing written; one heard keeps its marks
      marks.set({
        marks: heard.has(word) ? marksDrawn(short) : [],
        level: null,
      })
      return done
    }
  }

  // the bar claims the page's owner, so the strip takes none: a newer sound
  // stops the bar, its play ends, and the strip puts its button out
  bindWordPlays(q('#words'), async (w) => {
    if ((WORD_IDS as readonly string[]).includes(w)) await plays[w as WordId]()
  })
  return { bars }
}
