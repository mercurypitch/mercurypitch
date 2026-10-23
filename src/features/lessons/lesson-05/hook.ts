// ============================================================
// Lesson 5 cold open — the hook stage, its two takes and the predict
// ============================================================
//
// Merc and Tavi either side of a band chart with one amber band at A3 and,
// under it, a level strip that grows with loudness (WEB-SPEC, Toys 1). At
// rest the chart holds a still of the hold demo, a violet line settling
// into Merc's band: the lesson's signature. Two takes in the kit's "ooh",
// drawn as violet lines that belong to no Merc (lines.ts, FACTS 72): Play:
// sung easily is live from the start, as sound before the predict; Play:
// pushing harder unlocks once a choice is in. The reveal waits until the
// pushed take has been heard (with sound off the hint says so, as Lesson
// 1's rule has it: the reveal describes what was heard), then the small
// print and the kind line; it never calls a choice wrong. Merc and Tavi both
// listen to the takes. Under reduced motion a take's line lands whole while its
// sound plays.
//
// The sky is the kit's stars, drawn still: on this page only Merc and Tavi's
// idle loops move on their own.

import type { BandChart, CentsTick, LevelPoint, TracePoint, } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { HIT_TOLERANCE_CENTS } from '@/features/lessons/kit/band-words'
import { q } from '@/features/lessons/kit/dom'
import { addDrawer, isSeen, surface } from '@/features/lessons/kit/frame-loop'
import { drawStars, makeStars } from '@/features/lessons/kit/hero-sky'
import { mercListen, mercsReady } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3 } from '@/features/lessons/kit/notes'
import { mountPredict } from '@/features/lessons/kit/predict'
import { playContour } from '@/features/lessons/kit/sound'
import type { Take } from './lines'
import { demoCents, TAKE_SEC, takeCents, takeContour, takeLevel } from './lines'

/** The small chart between Merc and Tavi names only the semitone either side. */
const HOOK_TICKS: readonly CentsTick[] = [
  { c: 100, label: '100: a semitone' },
  { c: 35, label: '' },
  { c: -35, label: '' },
  { c: -100, label: '100', place: 'below' },
]

const SUMMARY: Readonly<Record<Take | 'rest', string>> = {
  rest: "Merc's note A3 as a band; a held note's line settling into it",
  easy: "Merc's note A3 as a band; the easy take settles into it",
  pushed:
    "Merc's note A3 as a band; the pushed take gets louder and climbs above the band",
}

const GUESS: Readonly<Record<string, string>> = {
  steadier: 'You said: settle, steadier than before',
  louder: 'You said: get louder and drift higher',
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

/** The signature at rest: the hold demo's first four seconds, settling into the band. */
function signature(): TracePoint[] {
  const points: TracePoint[] = []
  for (let s = 0; s <= TAKE_SEC + 1e-9; s += 0.02)
    points.push({ t: s, c: demoCents(s) })
  return points
}

/** A take's line and its level up to `u` seconds, a point every 40 ms. */
function takeTo(
  take: Take,
  u: number,
): { line: TracePoint[]; level: LevelPoint[] } {
  const line: TracePoint[] = []
  const level: LevelPoint[] = []
  const end = Math.min(u, TAKE_SEC)
  const add = (s: number): void => {
    line.push({ t: s, c: takeCents(take, s) })
    level.push({ t: s, level: takeLevel(take, s) })
  }
  for (let s = 0; s < end; s += 0.04) add(s)
  add(end)
  return { line, level }
}

function initTakes(
  chart: BandChart,
): (take: Take, audible: boolean) => Promise<void> {
  let playing: { take: Take; t0: number } | null = null

  const scene = (take: Take, u: number): void => {
    const s = chart.scene
    const { line, level } = takeTo(take, u)
    s.line = line
    s.level = level
    const head = line[line.length - 1]
    s.head =
      head === undefined || head.c === null ? null : { t: head.t, c: head.c }
    s.playhead = u < TAKE_SEC ? u : null
    s.lit =
      Math.abs(takeCents(take, Math.min(u, TAKE_SEC))) <= HIT_TOLERANCE_CENTS
  }

  addDrawer({
    active: () => playing !== null && isSeen(chart.canvas),
    draw(now) {
      if (playing === null) return
      const u = reducedMotion() ? TAKE_SEC : (now - playing.t0) / 1000
      scene(playing.take, u)
    },
  })

  return async (take, audible) => {
    chart.clear()
    chart.describe(SUMMARY[take])
    playing = { take, t0: performance.now() }
    // the takes belong to no Merc: both of them listen
    mercListen('blue', true)
    mercListen('orange', true)
    await playContour(takeContour(take, A3), { kind: 'merc', audible })
    mercListen('blue', false)
    mercListen('orange', false)
    scene(take, TAKE_SEC)
    playing = null
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
    strip: true,
  })
  chart.scene.line = signature()
  chart.describe(SUMMARY.rest)
  const play = initTakes(chart)
  mountPredict(q('#predict'), {
    play: (what, audible) =>
      play(what === 'pushed' ? 'pushed' : 'easy', audible),
    plays: [
      q<HTMLButtonElement>('#playEasy'),
      q<HTMLButtonElement>('#playPushed'),
    ],
    revealOn: ['pushed'],
    hints: {
      chosen:
        "Locked in. Now press Play: pushing harder. It's the same note, with a harder and harder push of air.",
      silent:
        'Sound is off, so nothing played. Turn sound on to hear it, then press Play: pushing harder.',
      next: 'Now press Play: pushing harder.',
      again: 'Play them again, one after the other.',
    },
    guess: (choice) => GUESS[choice] ?? 'You said',
  })
}
