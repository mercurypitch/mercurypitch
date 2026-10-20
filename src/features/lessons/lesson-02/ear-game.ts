// ============================================================
// Lesson 2 ear game — Semitone or tone?, ten rounds in step 4's text
// ============================================================
//
// A card under step 4's Notice, not on the stage (DECISIONS 82). Each round
// plays one step inside A3 to A4 at the film's pace for a pair (0.55 s, then
// 0.75 s), and asks: a semitone or a tone? The feedback says what the step
// was, in the keys' names and the sound's, never a word about the listener;
// a miss plays the step again, slower; two misses in a row bring the
// playbook's line once a game (rules 15 and 21). After ten rounds, the
// count, "7 of 10", and nothing else: no rating, no streak. Up and down
// mixes in falling steps, as Leap does (FACTS 32). Keys 1 and 2 answer while
// the card has focus, and Space plays the step again (a focused button keeps
// Space for itself, as the app's Ear Lab does). The answers use
// aria-disabled, never disabled, so the button a keyboard user just pressed
// keeps its focus.

import { mulberry32, q, qa } from '@/features/lessons/kit/dom'
import { Names } from '@/features/lessons/kit/names'
import { Sound } from '@/features/lessons/kit/sound'
import type { Answer, GameScore, Step } from './ear-game-rounds'
import { answerOf, NEW_GAME, nextStep, ROUNDS, scoreAnswer, stepWords, TRICKY, } from './ear-game-rounds'
import type { NoteEvent } from './examples'
import { pair, playNotes, slower } from './examples'

/** The first game's seed; each new game takes the next, so a visit's games differ and a test can replay one. */
const SEED = 20261019

/** How much slower a missed step plays again. */
const SLOWER = 1.6

/** What the last answer was, for the feedback line (it follows the names toggle). */
interface Said {
  readonly step: Step
  readonly correct: boolean
  readonly tricky: boolean
  readonly last: boolean
}

export function mountEarGame(root: HTMLElement): void {
  const roundEl = q('[data-eg-round]', root)
  const playBtn = q<HTMLButtonElement>('[data-eg-play]', root)
  const playLabel = q('span', playBtn)
  const upDown = q<HTMLButtonElement>('[data-eg-updown]', root)
  const answers = qa<HTMLButtonElement>('[data-eg-answer]', root)
  const feedback = q('[data-eg-feedback]', root)

  let game = 0
  let random = mulberry32(SEED)
  let score: GameScore = NEW_GAME
  let step: Step | null = null
  let answered = true
  let sounding = false
  let upAndDown = false
  let said: Said | null = null

  const eventsOf = (s: Step): NoteEvent[] => pair(s.from, s.to)

  function setAnswerable(on: boolean): void {
    for (const b of answers) b.setAttribute('aria-disabled', String(!on))
  }

  function clearMarks(): void {
    for (const b of answers) b.classList.remove('right', 'picked')
  }

  function render(): void {
    if (said === null) {
      feedback.innerHTML = ''
      return
    }
    const words = `${stepWords(said.step, Names.mode)}.`
    const lead = said.correct ? 'Yes.' : 'Here it is again, slower.'
    const lines = [`${lead} ${words}`]
    if (said.tricky) lines.push(TRICKY)
    if (said.last) lines.push(`<b>${score.heard} of ${ROUNDS}</b>`)
    feedback.innerHTML = lines.join('<br />')
  }

  async function sound(events: readonly NoteEvent[]): Promise<void> {
    sounding = true
    playBtn.classList.add('is-on')
    await playNotes(events, Sound.canPlay())
    playBtn.classList.remove('is-on')
    sounding = false
  }

  function newGame(): void {
    game += 1
    random = mulberry32(SEED + game)
    score = NEW_GAME
  }

  /** Plays the step again while it waits for an answer; otherwise the next round's. */
  function play(): void {
    if (sounding) return
    if (!answered && step !== null) {
      void sound(eventsOf(step))
      return
    }
    if (score.round >= ROUNDS) newGame()
    step = nextStep(random, upAndDown)
    score = { ...score, round: score.round + 1 }
    answered = false
    said = null
    render()
    clearMarks()
    roundEl.textContent = `Round ${score.round} of ${ROUNDS}`
    playLabel.textContent = 'Play it again'
    setAnswerable(true)
    void sound(eventsOf(step))
  }

  function answer(a: Answer): void {
    if (answered || step === null) return
    answered = true
    setAnswerable(false)
    const right = answerOf(step)
    const correct = a === right
    const next = scoreAnswer(score, correct)
    score = next.score
    const last = score.round >= ROUNDS
    said = { step, correct, tricky: next.tricky, last }
    for (const b of answers) {
      b.classList.toggle('right', b.dataset.egAnswer === right)
      b.classList.toggle('picked', b.dataset.egAnswer === a)
    }
    render()
    if (last) roundEl.textContent = `${score.heard} of ${ROUNDS}`
    playLabel.textContent = last ? 'Play ten more' : 'Next round'
    // a miss plays the step again, slowly, once the answer has been said
    const missed = step
    if (!correct)
      window.setTimeout(() => void sound(slower(eventsOf(missed), SLOWER)), 700)
  }

  playBtn.addEventListener('click', play)
  for (const b of answers)
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      answer(b.dataset.egAnswer === 'tone' ? 'tone' : 'semitone')
    })

  upDown.addEventListener('click', () => {
    upAndDown = !upAndDown
    upDown.setAttribute('aria-pressed', String(upAndDown))
  })

  root.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === '1' || e.key === '2') {
      e.preventDefault()
      answer(e.key === '1' ? 'semitone' : 'tone')
    } else if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault()
      play()
    }
  })

  Names.subscribe(render)
}
