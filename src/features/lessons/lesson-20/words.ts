// ============================================================
// Lesson 20 four words — run, pentatonic scale, minor pentatonic, agility
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure lit as its sound plays (WEB-SPEC, Toys
// 4; FACTS 28). Run plays Merc's run slowly, D3 at 0.6 s a note, 5.40 s, on
// a small run chart (run-chart.ts), its nine beads on their string, each
// glowing as its note sounds. Pentatonic scale plays C4, D4, E4, G4, A4 and
// C5 on the five-note staircase, and Minor pentatonic A3, C4, D4, E4, G4
// and A4 on the same staircase with the house on A, each in the soft tone
// at 0.45 s a note with the last 0.9 s, 3.15 s, each stair lighting as it
// sounds (kit/stairs-core.ts, compact). Agility has no play and no figure.
// The figures are hidden from a screen reader, whose words are the
// buttons', and the words' polite line says each play once it is heard to
// its end. The plays are the same for everyone, before the voice choice,
// and each is the page's one sound (kit/now-playing.ts): a press stops the
// sound before it, anywhere on the page, and a newer one stops it.

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLine, playNotes } from '@/features/lessons/kit/run'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import { scaleUp } from '@/features/lessons/kit/stairs-plays'
import type { Degrees } from '@/features/lessons/kit/stairs-scales'
import { MAJOR_FIVE, MINOR_FIVE } from '@/features/lessons/kit/stairs-scales'
import { summary } from '@/features/lessons/kit/stairs-words'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import type { RunChart } from './run-chart'
import { mountRunChart } from './run-chart'
import { runDo, runLine, runNotes } from './sounds'

/** Run's play: Merc's run slowly, a note every 0.6 s (FACTS 28). */
export const WORD_RUN_TEMPO = 0.6

/** The two staircases' words. */
export type StairsWord = 'pentatonic' | 'minor'

/** Their scales: the major five on C4, and the minor five on A3, the house on A (FACTS 28). */
export const WORD_SCALES: Readonly<
  Record<StairsWord, { readonly tonic: number; readonly degrees: Degrees }>
> = {
  pentatonic: { tonic: 60, degrees: MAJOR_FIVE },
  minor: { tonic: 57, degrees: MINOR_FIVE },
}

const isStairsWord = (w: string): w is StairsWord => w in WORD_SCALES

/** What a word's play says on the words' polite line: Run's tempo, or the scale in words. */
export function wordSaid(word: string): string {
  if (word === 'run')
    return `Merc's run, slowly: a note every ${WORD_RUN_TEMPO} seconds.`
  if (!isStairsWord(word)) return ''
  const s = WORD_SCALES[word]
  return summary(s.tonic, s.degrees)
}

export interface Words {
  readonly run: RunChart
  readonly stairs: Readonly<Record<StairsWord, StairsCore>>
}

export function initWords(): Words {
  const root = q('#words')
  const said = q('[data-words-said]', root)
  const runFig = q('[data-word-fig="run"]', root)
  const run = mountRunChart(runFig, {
    active: watch(q('canvas', runFig)),
    doMidi: runDo(null),
    names: false,
  })
  run.setTempo(WORD_RUN_TEMPO)

  function stairsFig(word: StairsWord): StairsCore {
    const canvas = q<HTMLCanvasElement>(
      'canvas',
      q(`[data-word-fig="${word}"]`, root),
    )
    const s = WORD_SCALES[word]
    return mountStairs({
      canvas,
      compact: true,
      active: watch(canvas),
      range: { lo: s.tonic, hi: s.tonic },
      degrees: s.degrees,
    })
  }
  const stairs = {
    pentatonic: stairsFig('pentatonic'),
    minor: stairsFig('minor'),
  }

  let sounding: Run | null = null
  bindWordPlays(
    root,
    async (word, audible, stopped) => {
      said.textContent = ''
      if (isStairsWord(word)) {
        const core = stairs[word]
        await core.play(scaleUp(core.tonic, 1, core.degrees), audible)
      } else if (word === 'run') {
        const doMidi = run.doMidi
        sounding = allOf([
          playLine(runLine(doMidi, WORD_RUN_TEMPO), { audible, kind: 'merc' }),
          // the beads light on the line's own clock, silently
          playNotes(runNotes(doMidi, WORD_RUN_TEMPO), {
            audible: false,
            onNote: (n, i) => {
              if (!stopped()) run.glow(i, n.dur)
            },
          }),
        ])
        await sounding.done
      }
      // a play cut short says nothing: the newer sound speaks for itself
      if (!stopped()) said.textContent = wordSaid(word)
    },
    {
      owner: NowPlaying,
      stop: (word) => {
        if (isStairsWord(word)) stairs[word].stop()
        else if (word === 'run') {
          sounding?.stop()
          run.rest()
        }
      },
    },
  )
  return { run, stairs }
}
