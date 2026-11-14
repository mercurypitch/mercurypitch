// ============================================================
// Lesson 28's steps' toy — the song on two staffs, a state for each step
// ============================================================
//
// One toy in two places, the steps' stage and free play (WEB-SPEC, Toys 2
// and 3): the kit's score (kit/score.ts) drawing each step's state from
// score-plays.ts, and its plays, each one run of the parts' notes
// (kit/run.ts) with the score's clock lighting the notes under the cursor,
// the page's one sound (`NowPlaying`) owning the two together. Step 1's
// tags and numerals show as their phrase's last bar sounds, and stay; Step
// 2's three ways each draw from bar 7 and end on their tag; Step 3's form
// strip outlines the block sounding and fades its letter in, the staffs
// showing that section, the bridge written as it plays; Step 4's staffs
// each play their part alone at a tap. "See it on the pitch line" draws the
// parts as bands, and back. Free play adds a state switch, one button a
// step, and every state's plays.
//
// Until the cold open's choice (`unlock`) the figure draws the hero's ten
// empty bars and every control waits, disabled, under the lock line, since
// every state shows the answer (FACTS 46); the steps' text's plays wait
// with it (steps.ts).

import { q, qa } from '@/features/lessons/kit/dom'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playNotes } from '@/features/lessons/kit/run'
import type { Score } from '@/features/lessons/kit/score'
import { mountScore } from '@/features/lessons/kit/score'
import type { ScoreScene } from '@/features/lessons/kit/score-layout'
import { Sound } from '@/features/lessons/kit/sound'
import { showParts } from '@/features/lessons/kit/step-parts'
import { addLockedStrip } from './locked-strip'
import type { Leg, ScorePlan, ScorePlayId, StepState, Way } from './score-plays'
import { BANDS_SAID, blockSaid, blockScene, LOCKED_SAID, PHRASES, planOf, STATE_SAID, stepFourScene, stepOneScene, WAYS, waySaid, wayScene, } from './score-plays'
import { BEAT_SEC } from './song'

export interface ScoreToy {
  readonly score: Score
  /** The step whose state it draws once the cold open's choice has come. */
  readonly state: StepState
  /** Still waiting for the cold open's choice. */
  readonly held: boolean
  /** Opens a step's state: stops what plays, the staffs back to the step's own. */
  setState(n: StepState): void
  /** The cold open's choice: each state draws, and the controls open. */
  unlock(): void
  /** Plays `id` in its state; true when heard to its end. */
  play(id: ScorePlayId): Promise<boolean>
  stop(): void
}

export interface ScoreToyOptions {
  readonly state: StepState
  /** The hero's song strip, drawn in the figure until the choice. */
  readonly strip: Element | null
  readonly light?: PlayLight
}

const isWay = (id: ScorePlayId): id is Way =>
  id === 'perfect' || id === 'interrupted' || id === 'plagal'

export function mountScoreToy(root: HTMLElement, o: ScoreToyOptions): ScoreToy {
  const light = o.light ?? playLights()
  const figure = q<HTMLElement>('[data-score]', root)
  const saidLine = q('[data-score-said]', root)
  const playBtns = qa<HTMLButtonElement>('[data-toy-play]', root)
  const blockBtns = qa<HTMLButtonElement>('[data-form-block]', root)
  const stateBtns = qa<HTMLButtonElement>('button[data-state]', root)
  const bandsBtn = root.querySelector<HTMLButtonElement>('[data-pitch-line]')
  const lockLine = root.querySelector<HTMLElement>('[data-lock-line]')

  let n: StepState = o.state
  let held = true
  let run: Run | null = null
  let token = 0
  // what has been heard, which the staffs keep: Step 1's phrases, Step 2's ways, Step 3's blocks
  const phrases = new Set<number>()
  const ways = new Set<Way>()
  const blocks = new Set<number>()
  let way: Way = 'perfect'
  let block = 1

  const score = mountScore(figure, {
    onStaff: (k) => {
      if (held || n !== 4) return
      void play(k === 0 ? 'tavi' : 'merc')
    },
  })

  // the hero's ten empty bars while the figure waits
  addLockedStrip(figure, o.strip)

  /** Step 1's marks heard so far. */
  const phraseMarks = () => {
    const heard = PHRASES.filter((_p, i) => phrases.has(i))
    return {
      tags: heard.flatMap((p) => p.tags),
      numerals: heard.flatMap((p) => p.numerals),
    }
  }

  function sceneNow(): ScoreScene {
    if (n === 2) return wayScene(way, ways.has(way))
    if (n === 3) return blockScene(block)
    if (n === 4) return stepFourScene()
    return stepOneScene(phraseMarks())
  }

  function words(): string {
    if (held) return LOCKED_SAID
    if (score.view === 'bands') return BANDS_SAID
    if (n === 2 && ways.has(way)) return waySaid(way)
    if (n === 3) return blockSaid(block)
    return STATE_SAID[n]
  }

  /** Draws the state as it stands, its words on the figure, and in the live line when `speak`. */
  function draw(speak: boolean, written = Number.POSITIVE_INFINITY): void {
    figure.classList.toggle('is-locked', held)
    // the state drawn, apart from free play's switch, whose buttons carry data-state
    figure.dataset.toyState = String(n)
    if (!held) score.show(sceneNow(), written)
    const said = words()
    figure.setAttribute('aria-label', said)
    if (speak) saidLine.textContent = said
  }

  function syncControls(): void {
    for (const b of [...playBtns, ...blockBtns]) b.disabled = held
    for (const b of stateBtns) {
      b.disabled = held
      b.setAttribute('aria-pressed', String(Number(b.dataset.state) === n))
    }
    if (bandsBtn !== null) {
      bandsBtn.disabled = held
      bandsBtn.setAttribute('aria-pressed', String(score.view === 'bands'))
    }
    for (const b of blockBtns) {
      const k = Number(b.dataset.formBlock)
      b.classList.toggle('is-heard', blocks.has(k))
      b.classList.toggle('is-shown', !held && n === 3 && k === block)
    }
    if (lockLine !== null) lockLine.hidden = !held
  }

  // ------------------------------------------------------------ the plays

  function halt(): void {
    token += 1
    run?.stop()
    run = null
    for (const b of blockBtns) b.classList.remove('is-playing')
    NowPlaying.release(halt)
  }

  /** The staffs drawn again mid-play, a tag added: the cursor and the lights back where the play stands. */
  function drawAt(beat: number): void {
    draw(false)
    score.at(Motion.paused ? Math.floor(beat) : beat)
  }

  /** What a play's beat shows: a phrase's or a way's tag as its last bar starts. */
  function onBeat(id: ScorePlayId, leg: Leg, beat: number): void {
    if (id === 'phrase1' || id === 'phrase2') {
      PHRASES.forEach((p, i) => {
        const at = p.last * 4
        if (phrases.has(i) || at < leg.from || beat < at) return
        phrases.add(i)
        drawAt(beat)
        saidLine.textContent = `${p.tags.map((t) => t.text).join('. ')}.`
      })
    } else if (isWay(id) && !ways.has(id)) {
      if (beat < 4 * (WAYS[id].tags[0]?.bar ?? 0)) return
      ways.add(id)
      drawAt(beat)
      saidLine.textContent = waySaid(id)
    }
  }

  /** A leg's scene and the form strip's block, as it starts. */
  function startLeg(id: ScorePlayId, leg: Leg): void {
    if (isWay(id)) way = id
    if (leg.block !== undefined) {
      block = leg.block
      blocks.add(leg.block)
      for (const b of blockBtns)
        b.classList.toggle(
          'is-playing',
          Number(b.dataset.formBlock) === leg.block,
        )
    }
    syncControls()
    draw(false, leg.write ? leg.from : Number.POSITIVE_INFINITY)
  }

  /** The legs in turn on the score's clock, silent: the notes' run is the sound. */
  function legsRun(id: ScorePlayId, plan: ScorePlan, mine: number): Run {
    let current: Run | null = null
    let stopped = false
    const done = (async (): Promise<boolean> => {
      for (const leg of plan.legs) {
        if (stopped || mine !== token) return false
        startLeg(id, leg)
        current = score.play({
          seconds: leg.beats * BEAT_SEC,
          beatSec: BEAT_SEC,
          from: leg.from,
          staffs: plan.staffs,
          write: leg.write,
          onBeat: (b) => {
            if (mine === token) onBeat(id, leg, b)
          },
        })
        if (!(await current.done)) return false
      }
      return true
    })()
    return {
      done,
      stop: () => {
        stopped = true
        current?.stop()
      },
    }
  }

  async function play(id: ScorePlayId): Promise<boolean> {
    if (held) return false
    halt()
    const plan = planOf(id)
    if (plan.state !== n) setState(plan.state)
    NowPlaying.claim(halt)
    const mine = token
    const sound = playNotes(plan.notes, { audible: Sound.canPlay() })
    const r = allOf([sound, legsRun(id, plan, mine)])
    run = r
    const heard = await r.done
    if (mine !== token) return false
    run = null
    for (const b of blockBtns) b.classList.remove('is-playing')
    NowPlaying.release(halt)
    // a bridge written as it played stays written
    draw(false)
    return heard
  }

  // ------------------------------------------------------------ the controls

  for (const b of playBtns) {
    const id = b.dataset.toyPlay as ScorePlayId
    b.addEventListener('click', () => {
      light(b, play(id))
    })
  }

  for (const b of blockBtns) {
    const k = Number(b.dataset.formBlock)
    b.addEventListener('click', () => {
      light(b, play(`block${k}` as ScorePlayId))
    })
  }

  for (const b of stateBtns)
    b.addEventListener('click', () => {
      const next = Number(b.dataset.state) as StepState
      if (held || next === n) return
      setState(next)
      saidLine.textContent = words()
    })

  bandsBtn?.addEventListener('click', () => {
    if (held) return
    halt()
    score.setView(score.view === 'bands' ? 'staffs' : 'bands')
    syncControls()
    draw(true)
  })

  function setState(next: StepState): void {
    halt()
    n = next
    // the pitch line is Steps 1 and 4's: another step opens on its staffs
    if ((n === 2 || n === 3) && score.view === 'bands') score.setView('staffs')
    showParts(root, n)
    // after the parts, which show the lock line on every step
    syncControls()
    draw(false)
  }

  showParts(root, n)
  syncControls()
  draw(false)

  return {
    score,
    get state() {
      return n
    },
    get held() {
      return held
    },
    setState,
    unlock() {
      if (!held) return
      held = false
      syncControls()
      draw(false)
    },
    play,
    stop: halt,
  }
}
