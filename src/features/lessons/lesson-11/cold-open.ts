// ============================================================
// Lesson 11 cold open — two sirens on the compact range chart, and the switch
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the compact range chart, the two sirens under
// it, then the predict (WEB-SPEC, Toys 1 "Compact" and Toys 2). The chart
// has the steps' window, no row names and no controls. Its still, before
// any play, is Tavi's siren drawn whole, thick, then thin above the seam,
// then thick again below it, the seam labelled "Merc's model". Play Tavi's
// siren works from the start, since the sound comes first, and never
// reveals: it clears her line and draws it again as it sounds. Once a
// choice locks, Play Merc's siren draws his siren under hers, with its own
// seam; both lines and both seams then stay. The reveal waits until Merc's
// siren is heard to its end with sound on; a siren cut short, by another
// sound, sound turned off or a hidden page, resolves false and reveals
// nothing. At the reveal each seam's label becomes "the switch", the key
// appears under the stage, and Tavi celebrates once.
//
// Each siren is the page's one sound (kit/now-playing.ts), in Merc's two
// gears (gear-sound.ts), and its singer sings while it sounds. Under reduced
// motion a siren is drawn whole at its press. The drawing is a picture, and
// a polite live region speaks for it.

import { q, qa } from '@/features/lessons/kit/dom'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { RangeChart, RangeLine, RangeSeam, } from '@/features/lessons/kit/range-chart'
import { mountRangeChart, RANGE_COLOR, } from '@/features/lessons/kit/range-chart'
import type { Run } from '@/features/lessons/kit/run'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { playGears } from './gear-sound'
import { drawn, flipFrom, JUMP, lineLength, SIREN_SEC, sirenFloor, sirenLine, spoken, STEPS_WINDOW, } from './lines'
import { CAPTION, SWITCH_LABEL } from './registers-toy'

/** Each play's voice: Tavi's siren is the higher voice's, Merc's the lower's. */
export const SIREN_VOICE: Readonly<Record<string, Voice>> = {
  orange: 'higher',
  blue: 'lower',
}

/** The cold open's words (WEB-SPEC, Toys 1 "Compact" and Toys 2). */
export const COLD = {
  hints: {
    chosen: "Locked in. Now play Merc's siren.",
    silent:
      'Sound is off, so nothing played. Turn sound on to hear the siren, then play it again.',
    again: 'Play either siren again.',
  },
  guess: {
    mistake: 'You said: a mistake',
    every: 'You said: every voice can',
  } as Readonly<Record<string, string>>,
  still: "Merc's model: a siren's line that jumps across a grey seam",
  revealed: 'Each seam is now labelled the switch.',
} as const

/** The live line once a siren has drawn to its end. */
export function sirenSaid(v: Voice): string {
  const lo = sirenFloor(v)
  const seam = `between ${spoken(flipFrom(v))} and ${spoken(flipFrom(v) + JUMP)}`
  return v === 'higher'
    ? `Tavi's siren, from ${spoken(lo)} up to ${spoken(lo + 9)} and back. The line jumps across the seam ${seam} on the way up, and back on the way down.`
    : `Merc's siren, from ${spoken(lo)} up to ${spoken(lo + 9)} and back, jumping across its seam ${seam}.`
}

export interface ColdOpen {
  readonly chart: RangeChart
  readonly predict: Predict
  /** Stops a siren where it stands. */
  stop(): void
}

export function initColdOpen(): ColdOpen {
  const hero = q('#heroRange')
  const chart = mountRangeChart(hero, {
    window: STEPS_WINDOW,
    names: false,
    seconds: SIREN_SEC,
  })
  const said = q('[data-hero-said]', hero)
  const key = q('[data-hero-key]')

  // how far each voice's siren is drawn, seconds; Tavi's whole at first
  const drawnTo: Record<Voice, number> = { higher: SIREN_SEC, lower: 0 }
  let sounding: Voice | null = null
  let run: Run | null = null
  let revealed = false

  function say(text: string): void {
    if (said.textContent !== text) said.textContent = text
  }

  function build(): void {
    const s = chart.scene
    const label = revealed ? SWITCH_LABEL : CAPTION
    s.lines = []
    s.seams = []
    for (const v of ['higher', 'lower'] as const) {
      if (drawnTo[v] <= 0) continue
      // the words sit under the seam at the siren's turn, where its line
      // rides well above it, so they clear the line at any width
      const seam: RangeSeam = {
        lo: flipFrom(v),
        hi: flipFrom(v) + JUMP,
        label,
        labelAt: SIREN_SEC / 2,
        labelBelow: true,
      }
      s.seams.push(seam)
      const points = drawn(sirenLine(v), drawnTo[v])
      const last = points[points.length - 1]
      const line: RangeLine = {
        points,
        color: RANGE_COLOR.target,
        head:
          sounding === v && !reducedMotion() && last?.midi != null
            ? { t: last.t, midi: last.midi, glow: 1 }
            : null,
      }
      s.lines.push(line)
    }
  }

  function draw(): void {
    build()
    chart.changed()
  }

  function finish(): void {
    const v = sounding
    run = null
    sounding = null
    chart.animate(null)
    if (v !== null)
      mercSing(v === 'higher' ? 'orange' : 'blue', sirenFloor(v), false)
    NowPlaying.release(stop)
    draw()
  }

  /** Stops a siren where it stands: its sound, its line, its singer. */
  function stop(): void {
    if (run === null) return
    run.stop()
    finish()
  }

  /** Plays a siren; resolves false if another sound, a stop or a hidden page cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    const v = SIREN_VOICE[what]
    if (v === undefined) return false
    stop()
    NowPlaying.claim(stop)
    const line = sirenLine(v)
    const r = playGears(line, audible)
    run = r
    sounding = v
    mercSing(v === 'higher' ? 'orange' : 'blue', sirenFloor(v), true)
    const end = lineLength(line)
    if (reducedMotion()) {
      drawnTo[v] = end
      draw()
    } else {
      drawnTo[v] = 0
      const t0 = performance.now()
      chart.animate((now) => {
        if (run !== r) return false
        drawnTo[v] = Math.min(end, (now - t0) / 1000)
        build()
        return drawnTo[v] < end
      })
    }
    const heard = await r.done
    // stopped here, or a newer play has taken over
    if (run !== r) return false
    if (heard) {
      drawnTo[v] = end
      say(sirenSaid(v))
    }
    finish()
    return heard
  }

  const predict = mountPredict(q('#predict'), {
    play,
    // the two sirens sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['blue'],
    hints: COLD.hints,
    guess: (choice) => COLD.guess[choice] ?? 'You said',
    onReveal: () => {
      revealed = true
      key.hidden = false
      draw()
      say(COLD.revealed)
      mercCelebrate('orange', 1600)
    },
  })

  draw()
  return { chart, predict, stop }
}
