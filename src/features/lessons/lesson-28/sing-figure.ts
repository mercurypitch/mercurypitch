// ============================================================
// Lesson 28 Sing it's figure — the staffs, the count-in's dots and the lights
// ============================================================
//
// The figure beside Your turn (WEB-SPEC, Toys 6), on the kit's score
// (kit/score.ts): until the cold open's choice the hero's ten empty bars, a
// still copy of its strip, as the steps' figure draws them; from the
// choice bars 1 to 8 on two staffs, with the breaths and the house on do,
// in the parts' own colours until a voice is chosen, then the learner's
// part amber and the other part's notes chrome. The cursor stands at the
// beat and the notes sounding there light: the learner's alone, the
// other's alone, or both. Over the staffs four dots count in, beat 1's
// the larger, a dot lit a click, shown once a voice is chosen: the
// listening path counts nothing in. A play follows its own clock: the
// cursor at the beat from its bar 1, about 30 times a second, or a take's
// frames. The figure says what it holds in words; after a run the pitch
// line draws under it, in the card's chart (sing.ts).

import { q, qa } from '@/features/lessons/kit/dom'
import type { Score } from '@/features/lessons/kit/score'
import { mountScore } from '@/features/lessons/kit/score'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { addLockedStrip } from './locked-strip'
import { LOCKED_SAID } from './score-plays'
import { scoreWords, singScene } from './sing-plan'
import { BEAT_SEC } from './song'

/** Beats across bars 1 to 8: the cursor stands nowhere after them. */
const BARS_BEATS = 32

export interface SingFigure {
  readonly score: Score
  /** Whether the staffs wait for the cold open's choice. */
  readonly held: boolean
  /** The choice: the staffs draw bars 1 to 8. */
  unlock(): void
  /** The voice the learner sings with, or none yet: the staffs' colours. */
  voice(v: Voice | null): void
  /** The cursor at `beat` from bar 1 and the notes sounding there lit, only `staffs`' where given; or neither (null). */
  at(beat: number | null, staffs?: readonly number[]): void
  /** A draw a frame for a play whose bar 1 falls at `origin` ms on the page's clock: the cursor at the beat, `staffs`' notes lit. */
  follow(origin: number, staffs: readonly number[]): () => void
  /** Draws `follow`'s about 30 times a second until `done`, and resolves then. */
  track(
    origin: number,
    staffs: readonly number[],
    done: () => boolean,
  ): Promise<void>
  /** The count-in's dots with `n` lit, 0 to 4. */
  count(n: number): void
}

/** The figure in `[data-sing-score]`, drawing the hero's strip, `strip`, until the choice. */
export function mountSingFigure(strip: Element | null): SingFigure {
  const figure = q('[data-sing-score]')
  const dots = q('[data-sing-count]')
  const score = mountScore(figure)
  addLockedStrip(figure, strip)
  let held = true
  let voice: Voice | null = null

  function draw(): void {
    figure.classList.toggle('is-locked', held)
    dots.hidden = held || voice === null
    if (!held) score.show(singScene(voice))
    figure.setAttribute('aria-label', held ? LOCKED_SAID : scoreWords(voice))
  }
  draw()

  const at = (beat: number | null, staffs?: readonly number[]): void => {
    if (!held) score.at(beat, staffs)
  }
  const follow = (origin: number, staffs: readonly number[]) => (): void => {
    const beat = (performance.now() - origin) / 1000 / BEAT_SEC
    at(beat >= 0 && beat < BARS_BEATS ? beat : null, staffs)
  }

  return {
    score,
    get held() {
      return held
    },
    unlock() {
      if (!held) return
      held = false
      draw()
    },
    voice(v) {
      if (v === voice) return
      voice = v
      draw()
    },
    at,
    follow,
    track(origin, staffs, done) {
      const frame = follow(origin, staffs)
      return new Promise((resolve) => {
        const tick = (): void => {
          if (done()) {
            resolve()
            return
          }
          frame()
          window.setTimeout(tick, 1000 / 30)
        }
        tick()
      })
    },
    count(n) {
      qa('li', dots).forEach((d, k) => {
        d.classList.toggle('is-lit', k < n)
      })
    },
  }
}
