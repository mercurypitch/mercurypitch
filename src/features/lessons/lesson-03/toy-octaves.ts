// ============================================================
// Lesson 3 octave toy — Fig. 4, two bands an octave apart
// ============================================================
//
// The band chart on a pitch axis from F3 to C5, a tick per semitone, A3 and
// A4 named (WEB-SPEC, Toys 5): Merc's amber band at A3 and a dashed one an
// octave up at A4, the same note (FACTS 27). The kit's predict opens the
// step: a choice unlocks Play blue's A3, Play orange's A4 and Play both, and
// the reveal comes only once Play both has been heard. Orange's reply then
// stays drawn as a violet line landing in the A4 band, with the series' one
// gold, the bracket "same note, an octave apart". Under reduced motion the
// line lands whole.

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { q, wait } from '@/features/lessons/kit/dom'
import { addDrawer, watch } from '@/features/lessons/kit/frame-loop'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercListen, mercSing, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { mountPredict } from '@/features/lessons/kit/predict'
import { playTone } from '@/features/lessons/kit/sound'

const NOTE_SEC = 1.3
/** Where orange's reply draws across the chart's window, seconds. */
const REPLY_AT = 1.4
const OCTAVE = 1200

/** Orange's reply landing in the A4 band: from 60 cents under, settled in 0.4 s. */
export function replyCents(t: number): number {
  return OCTAVE - 60 * Math.exp(-Math.max(0, t) / 0.12)
}

function replyLine(upTo: number): { t: number; c: number }[] {
  const points: { t: number; c: number }[] = []
  for (let s = 0; s <= upTo; s += 0.04)
    points.push({ t: REPLY_AT + s, c: replyCents(s) })
  return points
}

export interface OctavesOptions {
  readonly active?: () => boolean
}

export function mountOctaves(
  root: HTMLElement,
  opts: OctavesOptions = {},
): void {
  const chart: BandChart = mountBandChart(q('.octave-viz', root), {
    target: A3,
    axis: { notes: [53, 72], named: [A3, A4] },
    echo: OCTAVE,
    active: opts.active,
  })
  const seen = watch(root)
  let drawing: number | null = null

  // the reply draws while orange sings; whole at once under reduced motion
  addDrawer({
    active: () => drawing !== null && seen(),
    draw(now) {
      if (drawing === null) return
      const s = reducedMotion()
        ? NOTE_SEC
        : Math.min(NOTE_SEC, (now - drawing) / 1000)
      const line = replyLine(s)
      chart.scene.line = line
      const head = line[line.length - 1]
      chart.scene.head = head === undefined ? null : { t: head.t, c: head.c }
    },
  })

  async function sing(which: Which, audible: boolean): Promise<void> {
    const midi = which === 'blue' ? A3 : A4
    const other: Which = which === 'blue' ? 'orange' : 'blue'
    mercSing(which, midi, true)
    mercListen(other, true)
    if (which === 'blue') chart.scene.glow = 1
    else chart.scene.echoGlow = 1
    await playTone(hz(midi), NOTE_SEC, { kind: 'merc', audible })
    chart.scene.glow = 0
    chart.scene.echoGlow = 0
    mercSing(which, midi, false)
    mercListen(other, false)
  }

  async function play(what: string, audible: boolean): Promise<void> {
    if (what === 'a3') return sing('blue', audible)
    if (what === 'a4') return sing('orange', audible)
    await sing('blue', audible)
    await wait(0.25)
    drawing = performance.now()
    await sing('orange', audible)
    drawing = null
  }

  mountPredict(q('.step-predict', root), {
    play,
    revealOn: ['both'],
    hints: {
      chosen: "Locked in. Now press Play both: blue's A3, then orange's A4.",
      silent:
        'Sound is off, so nothing played. Turn sound on to hear them, then press Play both.',
      next: "Now press Play both: blue's A3, then orange's A4.",
      again: 'Play them again, one at a time or both.',
    },
    onReveal: () => {
      const line = replyLine(NOTE_SEC)
      chart.scene.line = line
      const head = line[line.length - 1]
      chart.scene.head = head === undefined ? null : { t: head.t, c: head.c }
      chart.scene.bracket = 'same note, an octave apart'
      chart.describe(
        "Merc's band at A3, and the same note an octave up at A4; orange's reply lands in the A4 band: the same note, an octave apart",
      )
      mercCelebrate('orange', 1600)
    },
  })
}
