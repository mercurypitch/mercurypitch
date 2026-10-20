// ============================================================
// Ear game — rounds of two notes, one answer each, and the count at the end
// ============================================================
//
// Lesson 2's Semitone or tone?, generalised to any number of answers and
// any rule for the rounds (Lesson 6 WEB-SPEC, Toys 4): a card in a step's
// text column with a Play button, the answers side by side and a polite
// live line for the feedback. Each run, Play again included, takes a fresh
// seed from Math.random(), kept in memory only, and the page deals the
// game's rounds from the kit's mulberry32; a test deals from a fixed seed.
//
// A round takes one answer. A miss marks the right answer, says the round's
// feedback line and plays the pair again, slower; the round is not asked
// again, and Next moves on. Two misses in a row bring the playbook's line
// once a game (rule 15). The feedback names the interval and the sound,
// never the listener (rule 21). At the end, the count of rounds answered
// right ("7 of 10"), and nothing else: no rating, no streak, nothing stored.
//
// Keys 1 to N answer while the card has focus. Space plays the round again
// while the focus is anywhere in the card but on a button (the card takes
// tabindex="-1", so a tap on its text focuses it); a focused button
// keeps Space and Enter for itself, so a key meant to replay never answers
// by accident. The answers use aria-disabled, never disabled, so the button
// a keyboard user just pressed keeps its focus. Lesson 2's own game (its
// ear-game.ts) predates this one and keeps its fixed seeds.

import { mulberry32, q, qa } from './dom'

/** One note of a round: MIDI, onset and length, seconds. */
export interface EarNote {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** A round: what it plays, the answer it wants, and the line that says what it was. */
export interface EarRound<A extends string = string> {
  readonly events: readonly EarNote[]
  readonly answer: A
  /** Plain words, the round's sound: "A leap: 7 semitones up, a perfect fifth." */
  readonly words: string
}

/** A sound in flight. */
export interface EarPlaying {
  readonly done: Promise<void>
  stop(): void
}

/** The playbook's line after two misses in a row (rule 15). */
export const TRICKY = "If that felt tricky, good: that's learning."

/** A game in progress: the rounds played, those answered right, and the misses in a row. */
export interface GameScore {
  readonly round: number
  readonly heard: number
  readonly missesInARow: number
  /** True once the tricky line has been said this game. */
  readonly saidTricky: boolean
}

export const NEW_GAME: GameScore = {
  round: 0,
  heard: 0,
  missesInARow: 0,
  saidTricky: false,
}

/** The score after an answer, and whether this answer earns the tricky line. */
export function scoreAnswer(
  score: GameScore,
  correct: boolean,
): { score: GameScore; tricky: boolean } {
  const misses = correct ? 0 : score.missesInARow + 1
  const tricky = misses >= 2 && !score.saidTricky
  return {
    score: {
      round: score.round,
      heard: score.heard + (correct ? 1 : 0),
      missesInARow: misses,
      saidTricky: score.saidTricky || tricky,
    },
    tricky,
  }
}

/** A fresh seed for a run, from Math.random(): kept in memory, never stored. */
export const freshSeed = (): number => Math.floor(Math.random() * 2 ** 32)

/** The answer a number key gives, or null: "1" is the first of `answers`. */
export function keyAnswer<A extends string>(
  key: string,
  answers: readonly A[],
): A | null {
  const i = Number(key) - 1
  return Number.isInteger(i) && i >= 0 && i < answers.length ? answers[i] : null
}

/** Every note `by` times longer, onsets with them: a missed round heard again, slower. */
export const slowerBy = (events: readonly EarNote[], by: number): EarNote[] =>
  events.map((e) => ({ midi: e.midi, at: e.at * by, dur: e.dur * by }))

export interface EarGameOptions<A extends string> {
  /** The answers in key order: key 1 is the first. */
  readonly answers: readonly A[]
  /** A game's rounds, dealt from a seeded generator. */
  readonly deal: (random: () => number) => readonly EarRound<A>[]
  /** Plays a round's notes; the page decides whether they sound. */
  readonly play: (events: readonly EarNote[]) => EarPlaying
  /** How much slower a missed round plays again. */
  readonly slower: number
  /** The Play button's words in each state. */
  readonly labels: {
    readonly start: string
    readonly again: string
    readonly next: string
    readonly more: string
  }
  /** The seed for each run; Math.random() by default. */
  readonly seed?: () => number
}

/** Mounts a game on its card: `[data-eg-round]`, `[data-eg-play]` (with a span), `[data-eg-answer]` and `[data-eg-feedback]`. */
export function mountEarGame<A extends string>(
  root: HTMLElement,
  o: EarGameOptions<A>,
): void {
  const roundEl = q('[data-eg-round]', root)
  const playBtn = q<HTMLButtonElement>('[data-eg-play]', root)
  const playLabel = q('span', playBtn)
  const answerBtns = qa<HTMLButtonElement>('[data-eg-answer]', root)
  const feedback = q('[data-eg-feedback]', root)

  let rounds: readonly EarRound<A>[] = []
  let score: GameScore = NEW_GAME
  let current: EarRound<A> | null = null
  let answered = true
  let playing: EarPlaying | null = null
  let missTimer = 0

  function setAnswerable(on: boolean): void {
    for (const b of answerBtns) b.setAttribute('aria-disabled', String(!on))
  }

  function sound(events: readonly EarNote[]): void {
    window.clearTimeout(missTimer)
    playing?.stop()
    const run = o.play(events)
    playing = run
    playBtn.classList.add('is-on')
    void run.done.then(() => {
      if (playing !== run) return
      playing = null
      playBtn.classList.remove('is-on')
    })
  }

  function newGame(): void {
    rounds = o.deal(mulberry32((o.seed ?? freshSeed)()))
    score = NEW_GAME
  }

  /** Plays the round again while it waits for an answer; otherwise the next round. */
  function play(): void {
    if (!answered && current !== null) {
      sound(current.events)
      return
    }
    if (score.round >= rounds.length) newGame()
    current = rounds[score.round]
    score = { ...score, round: score.round + 1 }
    answered = false
    feedback.textContent = ''
    for (const b of answerBtns) b.classList.remove('right', 'picked')
    roundEl.textContent = `Round ${score.round} of ${rounds.length}`
    playLabel.textContent = o.labels.again
    setAnswerable(true)
    sound(current.events)
  }

  function answer(a: A): void {
    if (answered || current === null) return
    answered = true
    setAnswerable(false)
    const round = current
    const correct = a === round.answer
    const next = scoreAnswer(score, correct)
    score = next.score
    const last = score.round >= rounds.length
    for (const b of answerBtns) {
      b.classList.toggle('right', b.dataset.egAnswer === round.answer)
      b.classList.toggle('picked', b.dataset.egAnswer === a)
    }
    const lines = [
      `${correct ? 'Yes.' : 'Here it is again, slower.'} ${round.words}`,
    ]
    if (next.tricky) lines.push(TRICKY)
    feedback.replaceChildren()
    lines.forEach((line, i) => {
      if (i > 0) feedback.append(document.createElement('br'))
      feedback.append(line)
    })
    if (last) {
      const count = document.createElement('b')
      count.textContent = `${score.heard} of ${rounds.length}`
      feedback.append(document.createElement('br'), count)
      roundEl.textContent = count.textContent
    }
    playLabel.textContent = last ? o.labels.more : o.labels.next
    // a miss plays the round again, slower, once its line has been said
    if (!correct)
      missTimer = window.setTimeout(
        () => sound(slowerBy(round.events, o.slower)),
        700,
      )
  }

  newGame()
  playLabel.textContent = o.labels.start

  playBtn.addEventListener('click', play)
  for (const b of answerBtns)
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      const a = o.answers.find((x) => x === b.dataset.egAnswer)
      if (a !== undefined) answer(a)
    })

  root.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const a = keyAnswer(e.key, o.answers)
    if (a !== null) {
      e.preventDefault()
      answer(a)
    } else if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault()
      if (current !== null) sound(current.events)
    }
  })
}
