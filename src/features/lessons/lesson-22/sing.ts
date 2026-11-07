// ============================================================
// Lesson 22 Sing it — one note, ten seconds, twice: straight, then floating
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6) is the kit's held-note checkpoint
// (kit/hold-sing.ts), Lesson 5's moved into the kit with options, and this
// is Lesson 22's plan for it: two ten-second holds, Hold 1 straight and
// Hold 2 floating, the second only after an "Easy" or "Workable" first
// hold and a rest the singer ends, "Effortful" picking the rest card; each
// hold read by the centre-line reader (kit/hold-centre.ts
// `readCentredHold`), loaded with the listener after Start, which reads a
// hold on the middle of its line where it finds a vibrato; no live band
// state during a take, since a wave wider than the band would flip it on
// every swing (FACTS 57); and the summary's subject, "the middle of your
// line". Both holds take Lesson 5's model note, Merc's usual "ooh" with its
// small wave, so the plan needs no option for it.
//
// What the page adds through the plan's hooks: with sound off, Start asks
// for nothing and plays nothing, and says why under itself; from Start
// until the take ends every other play on the page is disabled and any
// sound stops, so nothing plays during a take (WEB-SPEC, Audio, rule 4);
// and after a hold in which the reader found a vibrato, the line's middle
// draws itself over the line as a dashed violet line over 0.6 s, at once
// under reduced motion, and the vibrato line joins the reading (FACTS 45,
// 46). A hold with none found draws no dashed line, since its line is its
// own middle, and says nothing of a wave.

import { paintWave } from '@/features/lessons/kit/band-chart-wave'
import type { MiddlePoint } from '@/features/lessons/kit/band-chart-wave-scene'
import { q, qa } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import type * as CentreModule from '@/features/lessons/kit/hold-centre'
import type { CentredReading } from '@/features/lessons/kit/hold-centre'
import type { HoldNo } from '@/features/lessons/kit/hold-flow'
import type { HoldModule, HoldSingPlan } from '@/features/lessons/kit/hold-sing'
import { initHoldSing } from '@/features/lessons/kit/hold-sing'
import type { HoldSingView } from '@/features/lessons/kit/hold-sing-view'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RingStills } from '@/features/lessons/kit/sing'
import { Sound } from '@/features/lessons/kit/sound'
import { animate } from '@/features/lessons/kit/words-strip'
import { MIDDLE_SEC } from './vib-picture'

/** Each hold's name, as its head and its status lines say it (LESSON.md). */
export const HOLD_HEAD: Readonly<Record<HoldNo, string>> = {
  1: 'Hold 1, straight',
  2: 'Hold 2, floating',
}

/** What Start says under itself with sound off, asking for nothing (WEB-SPEC, Toys 6). */
export const START_SOUND_OFF =
  "Sound is off, so nothing played. Turn sound on to hear Merc's note, then press Start."

/** Every play on the page outside Sing it: the cold open's and Step 3's, the words', the band chart's in the steps and free play, and the quick check's. */
export const PAGE_PLAYS =
  '[data-play], [data-word-play], [data-vib-play], [data-quiz-play]'

const isCentred = (r: HoldReading): r is CentredReading => 'middle' in r

/** The middle's points on the chart's clock, which counts from the hold's first voiced frame, as the line does. */
export function middlePoints(
  middle: readonly CentreModule.MiddlePoint[],
): MiddlePoint[] {
  const onset = middle[0]?.t ?? 0
  return middle.map((p) => ({ t: p.t - onset, c: p.cents }))
}

/** Lesson 22's plan for the kit's checkpoint, and the page's part in it. */
export function singPlan(): HoldSingPlan {
  // the centre-line reader's module, once Start has loaded it
  let centre: typeof CentreModule | null = null
  // the middle line drawing now; a new take or a new reading ends it
  let drawing = 0
  // the plays this take disabled, given back as it ends
  let held: HTMLButtonElement[] = []
  let taking = false
  // a play enabled during a take (the cold open's choice, say) still waits for its end
  document.addEventListener(
    'click',
    (e) => {
      if (
        taking &&
        e.target instanceof Element &&
        e.target.closest(PAGE_PLAYS) !== null
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    },
    true,
  )

  const hint = (): HTMLElement => q('#singCard [data-start-hint]')

  return {
    consumer: 'lesson-22',
    warmupKey: 'fyp-l22-warmup',
    holds: { lengths: [10, 10], restAfterEffort: true },
    heads: HOLD_HEAD,
    nextHold: 'hold2',
    reader: async (): Promise<HoldModule> => {
      const [take, c] = await Promise.all([
        import('@/features/lessons/kit/hold-take'),
        import('@/features/lessons/kit/hold-centre'),
      ])
      centre = c
      return { ...take, readHold: c.readCentredHold }
    },
    liveBand: false,
    subject: 'the middle of your line',
    paintOver: paintWave,
    mayStart: () => {
      // a take cannot run without Merc's note: the toast says this one can't
      // play, not that it will be seen but not heard
      const silent = !Sound.canPlay({ needsSound: true })
      hint().textContent = silent ? START_SOUND_OFF : ''
      return !silent
    },
    onTake: (open) => {
      taking = open
      drawing += 1
      if (open) {
        // nothing else plays during a take: the sound before it stops
        NowPlaying.claim(() => undefined)
        held = qa<HTMLButtonElement>(PAGE_PLAYS).filter((b) => !b.disabled)
        for (const b of held) b.disabled = true
      } else {
        for (const b of held) b.disabled = false
        held = []
      }
    },
    onReading: (reading: HoldReading, view: HoldSingView) => {
      const line = q('[data-vibrato-line]', view.readingEl)
      const vibrato = isCentred(reading) ? reading.vibrato : null
      const middle = isCentred(reading) ? reading.middle : null
      line.hidden = vibrato === null
      line.textContent =
        vibrato === null || centre === null ? '' : centre.vibratoLine(vibrato)
      if (vibrato === null || middle === null) return
      const points = middlePoints(middle)
      drawing += 1
      const mine = drawing
      const draw = (share: number): void => {
        if (drawing !== mine) return
        view.chart.scene.middle = { points, tone: 'singer', share }
        wake()
      }
      if (reducedMotion()) draw(1)
      else void animate(MIDDLE_SEC, (u) => draw(u))
    },
  }
}

export function initSing(stills: RingStills): void {
  initHoldSing(stills, singPlan())
}
