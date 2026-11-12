// ============================================================
// Lesson 18 recall and quick check — Lessons 16 and 17's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 16's question 3 and
// Lesson 17's question 1, the very objects those pages ask, for everyone,
// since both lessons are this one's prerequisites (WEB-SPEC, Toys 4;
// FACTS 7), under its own prefix and keys, marking no lesson done; earlier
// answers are never shown, so the answers measure delayed retrieval. "Try
// Lesson 16, Step 4 again" and "Try Lesson 17, Step 1 again" open that
// lesson's page at the step in a new tab, so the viewer keeps their place
// here. Neither question plays anything.
//
// Before the Wrap, the quick check asks LESSON.md's four, three answers
// each, shuffled from the stored seed; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 18
// done. Question 4's Play sounds so, fa, mi loud, then after a beat the
// same three quiet, quarter notes at 60 BPM in the learner's octave, 7.0 s,
// in the soft tone at 1.0 and then 0.3 of its level (FACTS 75, 83), on the
// beat clock with no click. It is drawn as nothing, its button lit while it
// sounds, and it is the page's one sound. Both load after first paint, as a
// chunk of their own (main.ts).

import type { Hit, Run } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { BPM, F_LEVEL, P_LEVEL, scaleOf } from './tunes'

/** What question 4's play books: a note of the scale, by degree (do 0 to so 4), at a level. */
export interface LoudHit {
  readonly degree: number
  readonly level: number
}

/** Question 4's play, one bar of seven beats: so, fa, mi loud, a beat's rest, then the same quiet (FACTS 83). */
export const LOUD_THEN_QUIET: readonly Hit<LoudHit>[] = [4, 3, 2].flatMap(
  (degree, i) => [
    { beat: i, data: { degree, level: F_LEVEL } },
    { beat: 4 + i, data: { degree, level: P_LEVEL } },
  ],
)

/** Question 4's play, beats: 7.0 s at 60 BPM. */
export const LOUD_THEN_QUIET_BEATS = 7

/**
 * Handles question 4's Play wherever the quiz `host` renders it: a press
 * plays it from the start in the learner's octave at the moment of the
 * tap, stopping any sound before it, and its button stays lit while it
 * sounds.
 */
export function bindLoudQuietPlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="so-fa-mi"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const scale = scaleOf(VoiceChoice.voice === 'higher' ? 'treble' : 'bass')
    const r = BeatClock.start<LoudHit>({
      bar: bars([{ beats: LOUD_THEN_QUIET_BEATS, hits: LOUD_THEN_QUIET }]),
      bpm: () => BPM,
      audible: Sound.canPlay(),
      book: (h, when, bus) => {
        bookNote(hz(midiOf(scale[h.degree])), {
          when,
          dur: heldSeconds(1, BPM),
          kind: 'soft',
          levels: [{ at: 0, level: h.level }],
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
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 18,
    keys: QUIZ_KEYS,
    deck,
  })
  bindLoudQuietPlay(check.host)
  return { recall, check }
}
