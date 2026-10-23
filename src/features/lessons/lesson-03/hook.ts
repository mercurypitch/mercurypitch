// ============================================================
// Lesson 3 cold open — the hook stage, the sound pair and the predict
// ============================================================
//
// Merc and Tavi either side of a band chart with one amber band at A3, and
// the two figures under them (WEB-SPEC, Toys 1). The sound pair is live from
// the start, as sound before the numbers: Merc's A3, then a reply on the
// same A or a semitone under it, drawn as a violet line that belongs to no
// Merc. The predict needs no sound: a choice shows the three cards one
// after another, then the answer, and never marks a choice wrong. Under
// reduced motion the line lands whole and the cards appear together.
//
// The sky is the kit's stars, drawn still: on this page only Merc and Tavi's
// idle loops move on their own.

import type { BandChart, CentsTick } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { q, qa, wait } from '@/features/lessons/kit/dom'
import { addDrawer, isSeen, surface } from '@/features/lessons/kit/frame-loop'
import { drawStars, makeStars } from '@/features/lessons/kit/hero-sky'
import { mercListen, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, hz } from '@/features/lessons/kit/notes'
import { mountPredict } from '@/features/lessons/kit/predict'
import { playTone, Sound } from '@/features/lessons/kit/sound'

/** Seconds of Merc's A3, the gap, and the reply (FACTS 46). */
const MERC_SEC = 1.6
const GAP_SEC = 0.2
const REPLY_SEC = 1.6
const REPLY_AT = MERC_SEC + GAP_SEC
const REPLY_END = REPLY_AT + REPLY_SEC

/** The small chart between Merc and Tavi names only the semitone either side. */
const HOOK_TICKS: readonly CentsTick[] = [
  { c: 100, label: '100: a semitone' },
  { c: 35, label: '' },
  { c: -35, label: '' },
  { c: -100, label: '100', place: 'below' },
]

type Pair = 'on' | 'off'

const PAIR: Readonly<
  Record<Pair, { cents: number; label: string; summary: string }>
> = {
  on: {
    cents: 0,
    label: '0 cents',
    summary: "Merc's A3 as a band; the reply on the same note",
  },
  off: {
    cents: -100,
    label: '100 cents below: a semitone',
    summary: "Merc's A3 as a band; the reply a semitone below it",
  },
}

/** The stars, painted once per size: the sky never twinkles here. */
function stillSky(stage: HTMLElement): void {
  const cv = surface(q<HTMLCanvasElement>('canvas.sky', stage))
  const stars = makeStars()
  const paint = (): void => {
    const { ctx, w, h } = cv.fit()
    drawStars(ctx, w, h, stars, { idleT: 0, twinkle: 0, cam: 1 })
  }
  paint()
  new ResizeObserver(paint).observe(stage)
}

/** The reply's line up to `t` seconds into the pair, as the chart draws it. */
function replyLine(cents: number, t: number): { t: number; c: number }[] {
  const end = Math.min(t, REPLY_END)
  const points: { t: number; c: number }[] = []
  for (let s = REPLY_AT; s <= end; s += 0.05) points.push({ t: s, c: cents })
  if (points.length > 0) points.push({ t: end, c: cents })
  return points
}

function initPair(chart: BandChart): void {
  const buttons = qa<HTMLButtonElement>('#hookPlays [data-pair]')
  const seen = (): boolean => isSeen(chart.canvas)
  let playing: { pair: Pair; t0: number } | null = null

  const scene = (pair: Pair, t: number): void => {
    const { cents, label } = PAIR[pair]
    const s = chart.scene
    const line = replyLine(cents, t)
    s.glow = t < MERC_SEC ? 1 : 0
    s.line = line
    const head = line[line.length - 1]
    s.head = head === undefined ? null : { t: head.t, c: head.c }
    s.playhead = t < REPLY_END ? t : null
    s.label = head === undefined ? null : { t: REPLY_AT, c: cents, text: label }
  }

  addDrawer({
    active: () => playing !== null && seen(),
    draw(now) {
      if (playing === null) return
      const t = reducedMotion() ? REPLY_END : (now - playing.t0) / 1000
      scene(playing.pair, t)
    },
  })

  async function play(pair: Pair): Promise<void> {
    const audible = Sound.canPlay()
    chart.clear()
    chart.describe(PAIR[pair].summary)
    playing = { pair, t0: performance.now() }
    buttons.forEach((b) => {
      b.disabled = true
      b.classList.toggle('is-on', b.dataset.pair === pair)
    })
    mercSing('blue', A3, true)
    mercListen('orange', true)
    await playTone(hz(A3), MERC_SEC, { kind: 'merc', audible })
    mercSing('blue', A3, false)
    mercListen('orange', false)
    await wait(GAP_SEC)
    // the reply belongs to no Merc: the kit's plain tone, a semitone under A3 is G sharp 3
    await playTone(hz(A3) * 2 ** (PAIR[pair].cents / 1200), REPLY_SEC, {
      audible,
    })
    scene(pair, REPLY_END)
    playing = null
    buttons.forEach((b) => {
      b.disabled = false
      b.classList.remove('is-on')
    })
  }

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const pair = b.dataset.pair
      if (playing !== null || (pair !== 'on' && pair !== 'off')) return
      void play(pair)
    })
  }
}

/** The three cards one after another, then the answer; all at once under reduced motion. */
async function revealCards(): Promise<void> {
  const parts = [...qa<HTMLElement>('#revealCards .rcard'), q('#answer')]
  const calm = reducedMotion()
  for (const [i, part] of parts.entries()) {
    if (!calm && i > 0) await wait(0.7)
    part.hidden = false
    if (!calm)
      part.animate(
        [
          { transform: 'translateY(10px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 600, easing: 'cubic-bezier(.16, 1, .3, 1)' },
      )
  }
}

export function initHook(): void {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const chart = mountBandChart(q('#hookChart'), {
    target: A3,
    ticks: HOOK_TICKS,
  })
  initPair(chart)
  const hint = q('#lockHint')
  mountPredict(q('#predict'), {
    // the answer needs no sound: the cards come with the choice
    play: () => Promise.resolve(),
    plays: [],
    reveal: [],
    hints: { chosen: '', silent: '', again: '' },
    onChoice: () => {
      hint.hidden = true
      // the stage's tested figure is the answer: it shows with the cards
      q('[data-hook-tested]').classList.remove('held')
      // the pressed choice is now disabled: keep the keyboard's place on what it revealed
      const cards = q('#revealCards')
      cards.tabIndex = -1
      void revealCards()
      cards.focus({ preventScroll: true })
    },
  })
}
