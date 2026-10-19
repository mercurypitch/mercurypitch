// ============================================================
// Lesson 2 quiz pair — question 2's two steps, played by ear
// ============================================================
//
// "Listen to two steps. Which one is the semitone?" plays A4 to B4, then B4
// to C5 (FACTS 52, the film's `quiz-pair`): two white-key steps neither the
// film nor the page has played before, so no option can be answered from
// memory of the pair. "1st" and "2nd" light in turn as each step sounds. The
// button and its chips sit in the question's slot, outside the heading that
// names its answers. The quiz rebuilds its questions on every answer and
// keeps the slot, so the button is handled by one listener on the quiz's
// host, which any page asking question 2 binds (Lesson 3's recall does).

import { hz } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import { QUIZ_PAIR, schedule } from './examples'

/** The slot's markup: the play button, then the two chips it lights. */
export const QUIZ_PAIR_SLOT =
  '<button class="btn sm tint" type="button" data-quiz-pair style="--c: var(--chrome)"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play the two steps</button><span class="pair-chip" data-pair-chip="1">1st</span><span class="pair-chip" data-pair-chip="2">2nd</span>'

/** The step each note belongs to: notes 0 and 1 are the 1st, 2 and 3 the 2nd. */
const stepOf = (i: number): '1' | '2' => (i < 2 ? '1' : '2')

/** Lights a chip from its step's first note to the end of its second. */
function light(slot: Element, step: '1' | '2', on: boolean): void {
  slot.querySelector(`[data-pair-chip="${step}"]`)?.classList.toggle('on', on)
}

/** Buttons whose two steps are sounding; a press waits for them (the button keeps its focus). */
const playing = new WeakSet<HTMLButtonElement>()

/** Plays the two steps, lighting each chip as its step sounds. */
async function playPair(button: HTMLButtonElement): Promise<void> {
  const slot = button.parentElement
  if (slot === null || playing.has(button)) return
  const audible = Sound.canPlay()
  playing.add(button)
  button.classList.add('is-on')
  await schedule(QUIZ_PAIR, (e, i) => {
    if (audible) Sound.voice(hz(e.midi), { dur: e.dur })
    if (i % 2 === 0) light(slot, stepOf(i), true)
    else window.setTimeout(() => light(slot, stepOf(i), false), e.dur * 1000)
  })
  playing.delete(button)
  button.classList.remove('is-on')
}

/** Handles question 2's play button wherever the quiz `host` renders it. */
export function bindQuizPair(host: HTMLElement): void {
  host.addEventListener('click', (e) => {
    const button =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-pair]')
        : null
    if (button !== null) void playPair(button)
  })
}
