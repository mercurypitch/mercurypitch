// ============================================================
// Lesson 17 recall and quick check — two quizzes on the kit's quiz
// ============================================================
//
// The recall, straight after the hero, is shown to everyone, because
// Lesson 8 is this lesson's prerequisite (WEB-SPEC, Toys 9; FACTS 7):
// Lesson 8's questions 2 and 4, under their own ids (quiz-questions.ts).
// The kit's quiz runs them under its own id prefix and storage keys, with
// a seed of their own, and marks no lesson done; earlier answers are never
// shown, so the answers measure delayed retrieval. "Try Lesson 8, Step N
// again" opens Lesson 8's page at that step in a new tab, so the viewer
// keeps their place here. Question 2's Play two bars is Lesson 8's own,
// played by Lesson 8's handler on this quiz's host, the page's one sound.
//
// The quick check's four questions mark Lesson 17 done once each has an
// answer. Question 4's Play the rhythm plays two eighths and a quarter at
// 60 BPM over two clicks, 2 s (FACTS 68), on the beat clock as the steps'
// bars play: the woodblock on each beat, beat 1's higher, and each note at
// the stored voice's A, held for its length less the gap. It is drawn as
// nothing, its button lit while it sounds, and it is the page's one sound.
// Both load after first paint, as a chunk of their own (main.ts).

import type { Hit, Run } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bookWood } from '@/features/lessons/kit/woodblock'
import { bindQuizPlays } from '@/features/lessons/lesson-08/quiz-play'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'

/** What question 4's rhythm books: a knock, or a note held for some beats. */
export type RhythmHit =
  | { readonly k: 'click'; readonly high: boolean }
  | { readonly k: 'note'; readonly beats: number }

/** Question 4's tempo, BPM. */
export const QUIZ_RHYTHM_BPM = 60

/** Question 4's rhythm, one bar of two beats: two eighths, then a quarter, over two clicks (FACTS 68). */
export const QUIZ_RHYTHM: readonly Hit<RhythmHit>[] = [
  { beat: 0, data: { k: 'click', high: true } },
  { beat: 1, data: { k: 'click', high: false } },
  { beat: 0, data: { k: 'note', beats: 0.5 } },
  { beat: 0.5, data: { k: 'note', beats: 0.5 } },
  { beat: 1, data: { k: 'note', beats: 1 } },
]

/**
 * Handles the quick check's Play the rhythm wherever the quiz `host`
 * renders it: a press plays it from the start, stopping any sound before
 * it, and its button stays lit while it sounds.
 */
export function bindRhythmPlay(host: HTMLElement): void {
  let run: Run | null = null
  let lit: HTMLButtonElement | null = null

  function stop(): void {
    run?.stop()
    run = null
    lit?.classList.remove('is-on')
    lit = null
    NowPlaying.release(stop)
  }

  host.addEventListener('click', (e) => {
    const button =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-rhythm]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const freq = hz(VoiceChoice.voice === 'higher' ? A4 : A3)
    const r = BeatClock.start<RhythmHit>({
      bar: bars([{ beats: 2, hits: QUIZ_RHYTHM }]),
      bpm: () => QUIZ_RHYTHM_BPM,
      audible: Sound.canPlay(),
      book: (h, when, bus) => {
        if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
        else
          bookNote(freq, {
            when,
            dur: heldSeconds(h.beats, QUIZ_RHYTHM_BPM),
            kind: 'soft',
            to: bus.node,
          })
      },
    })
    run = r
    void r.done.then(() => {
      if (run === r) stop()
    })
  })
}

/** Mounts the recall and the quick check; the quick check's step links use `deck`. */
export function initQuizzes(deck: StepDeck): { recall: Quiz; check: Quiz } {
  const recall = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
  bindQuizPlays(recall.host)
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 17,
    keys: QUIZ_KEYS,
    deck,
  })
  bindRhythmPlay(check.host)
  return { recall, check }
}
