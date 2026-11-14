// ============================================================
// Lesson 25 four words — natural, harmonic and melodic minor, and relative keys
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), as Lessons 7 to 10 and 23 use it (WEB-SPEC, Toys
// 4; FACTS 60). Each figure is a small staircase of the steps' toy in the
// learner's octave, on the toy's rows, lighting as its scale plays in the
// soft tone, a note every 0.4 s, each 0.35 s:
//
// - Natural minor: A natural minor up, 3.15 s.
// - Harmonic minor: A harmonic minor up, 3.15 s, its te stair lifting to
//   ti as the play starts, before ti sounds.
// - Melodic minor: up and down, 5.95 s, le and te lifting as the scale
//   starts and settling as it turns to come down.
// - Relative keys: C major up, then A minor up, 6.8 s, on one staircase of
//   white piano keys, the house gliding from C down to A (0.6 s) as A
//   minor starts, where it stays until the next play.
//
// Each is the steps' own figure (sounds.ts), so a word and the step that
// teaches it play the same notes in the same time. None plays or draws a
// chord (FACTS 1a). The three minor words stand on natural minor, and a
// raised stair settles back as its play ends, or as it is cut short. The figures follow Sing it's voice
// choice at once, as the steps' toy does. They are hidden from a screen
// reader, whose words are the buttons'; the words' polite line says each
// play once it is heard to its end. Each play is the page's one sound
// (kit/now-playing.ts): a press stops the sound before it, anywhere on the
// page, and a newer one stops it.

import { HARMONIC_MINOR_DEGREES, minorScale, NATURAL_MINOR_DEGREES, } from '@/features/lessons/kit/chords'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import type { NoteEvent } from '@/features/lessons/kit/stairs-plays'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { FIGURE_SAID, lookSaid } from './minor-words'
import type { Figure, Look, Play } from './sounds'
import { cDo, cMajorThenAMinor, GLIDE_SEC, HARMONIC, MELODIC, minorDo, NATURAL, rowsOf, scaleUp, upAndDown, } from './sounds'
import { clefOf } from './steps'

/** The four words, by their buttons' `data-word-play`. */
export type Word = 'natural' | 'harmonic' | 'melodic' | 'relative'

export const WORDS: readonly Word[] = [
  'natural',
  'harmonic',
  'melodic',
  'relative',
]

const isWord = (w: string): w is Word =>
  (WORDS as readonly string[]).includes(w)

/** A word's sound: its notes on the staircase, and how the staircase moves as they play. */
export interface WordPlay {
  readonly events: readonly NoteEvent[]
  /** Where the staircase stands before the play, and as it starts. */
  readonly from: Look
  /** Each figure's staircase, taken as the figure starts, at `at` s. */
  readonly moves: readonly { readonly at: number; readonly look: Look }[]
  /** What the polite line says once the play is heard. */
  readonly said: string
}

/** A figure's notes as the staircase lights them, each on its stair: up from do, or down from te or ti. */
function eventsOf(f: Figure): NoteEvent[] {
  const midis = f.notes.map((n) => midiOf(n.note))
  const down = midis[0] > midis[midis.length - 1]
  return f.notes.map((n, i) => ({
    midi: midis[i],
    at: f.at + n.t,
    dur: n.dur,
    stair: down ? midis.length - 1 - i : i,
  }))
}

/** A word's play in `clef`'s octave, from the steps' own figures (FACTS 60). */
export function wordPlay(word: Word, clef: Clef): WordPlay {
  const tonic = minorDo(clef)
  const natural: Look = { degrees: NATURAL_MINOR_DEGREES, tonic }
  const figures: Play =
    word === 'natural'
      ? [scaleUp(minorScale(tonic, NATURAL), NATURAL_MINOR_DEGREES)]
      : word === 'harmonic'
        ? [scaleUp(minorScale(tonic, HARMONIC), HARMONIC_MINOR_DEGREES)]
        : word === 'melodic'
          ? upAndDown(clef, MELODIC)
          : cMajorThenAMinor(clef)
  const said: Readonly<Record<Word, string>> = {
    natural: lookSaid(figures[0].look),
    harmonic: lookSaid(figures[0].look),
    melodic: `${lookSaid(figures[0].look)} ${FIGURE_SAID.melodic?.[1] ?? ''}`,
    relative: (FIGURE_SAID.relative ?? []).join(' '),
  }
  return {
    events: figures.flatMap(eventsOf),
    // the minor words stand on natural minor, Relative keys on C major
    from: word === 'relative' ? figures[0].look : natural,
    moves: figures.map((f) => ({ at: f.at, look: f.look })),
    said: said[word],
  }
}

/** A word's whole play, s: the end of its last note. */
export const wordLength = (p: WordPlay): number =>
  Math.max(...p.events.map((e) => e.at + e.dur))

export interface Words {
  readonly stairs: Readonly<Record<Word, StairsCore>>
  /** Each figure in `clef`'s octave, at once: what plays stops. */
  setClef(clef: Clef): void
}

export function initWords(): Words {
  const root = q('#words')
  const said = q('[data-words-said]', root)
  let clef: Clef = clefOf(VoiceChoice.voice)

  function figure(word: Word): StairsCore {
    const canvas = q<HTMLCanvasElement>(
      'canvas',
      q(`[data-word-fig="${word}"]`, root),
    )
    const rest = wordPlay(word, clef).from
    const core = mountStairs({
      canvas,
      compact: true,
      active: watch(canvas),
      // Relative keys' house moves between A and C; the rows stand still
      range: { lo: minorDo(clef), hi: cDo(clef) },
      degrees: rest.degrees,
      numbers: true,
      room: {
        get rows() {
          return rowsOf(clef)
        },
      },
    })
    core.setTonic(rest.tonic, 0)
    core.set({ steps: true })
    return core
  }
  const stairs: Record<Word, StairsCore> = {
    natural: figure('natural'),
    harmonic: figure('harmonic'),
    melodic: figure('melodic'),
    relative: figure('relative'),
  }

  /** A word's staircase as its play starts, at once. */
  function stand(core: StairsCore, look: Look): void {
    core.setDegrees(look.degrees)
    core.setTonic(look.tonic, 0)
  }

  // each move's timer, per word, cleared as its play ends or stops; a
  // clef change ends a play too, and the play it ended says nothing
  const moving: Partial<Record<Word, number[]>> = {}
  let clefs = 0

  function settle(word: Word): void {
    for (const id of moving[word] ?? []) window.clearTimeout(id)
    moving[word] = []
    const core = stairs[word]
    core.stop()
    // a raised stair settles back; Relative keys stays on the key it reached
    if (word !== 'relative') core.slideDegrees(NATURAL_MINOR_DEGREES)
  }

  bindWordPlays(
    root,
    async (w, audible, stopped) => {
      said.textContent = ''
      if (!isWord(w)) return
      const core = stairs[w]
      const p = wordPlay(w, clef)
      const mine = clefs
      stand(core, p.from)
      moving[w] = p.moves.map((m) =>
        window.setTimeout(() => {
          if (stopped()) return
          const glide = m.look.tonic !== core.tonic
          core.slideDegrees(m.look.degrees, glide ? GLIDE_SEC : undefined)
          core.setTonic(m.look.tonic, GLIDE_SEC)
        }, m.at * 1000),
      )
      await core.play(p.events, audible)
      if (stopped() || mine !== clefs) return
      settle(w)
      // a play cut short says nothing: the newer sound speaks for itself
      said.textContent = p.said
    },
    {
      owner: NowPlaying,
      stop: (w) => {
        if (isWord(w)) settle(w)
      },
    },
  )

  const api: Words = {
    stairs,
    setClef(next) {
      if (next === clef) return
      clef = next
      clefs += 1
      for (const w of WORDS) {
        settle(w)
        stairs[w].setRange(
          { lo: minorDo(clef), hi: cDo(clef) },
          wordPlay(w, clef).from.tonic,
        )
        stairs[w].setDegrees(wordPlay(w, clef).from.degrees)
      }
    },
  }
  // the figures follow Sing it's voice choice at once, as the steps' toy does
  VoiceChoice.subscribe((v) => api.setClef(clefOf(v)))
  return api
}
