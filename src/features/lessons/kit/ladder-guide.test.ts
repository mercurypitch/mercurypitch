// ============================================================
// Ladder guide tests — Merc's ladder, the guide's sweep and the faster pass
// ============================================================
//
// On a chart that records what is drawn on it (each phrase played, its
// notes lit, ended or cancelled) and the kit's run recorder, Merc's figure
// recorded too: Play Merc's ladder lights each note as he sings it and ends
// its drawing as it runs out, or cancels it when stopped, Merc resting
// either way; with a sweep slot the guide follows after the take's gap,
// silent, a drawing of its own begun as Merc's ends; the faster pass sounds
// the count-in on do after Merc and the guide after the count-in. A play
// stopped part way cancels only the drawing showing.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { FasterPlan, GuideChart, PlayVoice } from './ladder-guide'
import { endOf, fasterPass, mercLadder, SWEEP_GAP_SEC, sweepNotes, } from './ladder-guide'
import type { PhraseDrawing } from './ladder-take'
import type * as MercDuoModule from './merc-duo'
import { COUNT_IN, COUNT_IN_SEC } from './move-do'
import type * as RunModule from './run'
import type { RunNote } from './run'
import { resetRuns, runs } from './run-recorder.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
const sang: [string, number, boolean][] = []
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuoModule>()),
  mercSing: (which: string, midi: number, on: boolean) => {
    sang.push([which, midi, on])
  },
}))

/** A chart on do `doMidi` that logs each phrase played (`play 0: 3`), each note lit (`0 note 1`), and its end or cancel. */
function recordingChart(doMidi = 50): {
  chart: GuideChart
  log: string[]
} {
  const log: string[] = []
  let plays = 0
  return {
    log,
    chart: {
      doMidi,
      play(phrase): PhraseDrawing {
        const id = plays++
        log.push(`play ${id}: ${phrase.notes.length}`)
        return {
          note: (i) => log.push(`${id} note ${i}`),
          end: () => log.push(`${id} end`),
          cancel: () => log.push(`${id} cancel`),
        }
      },
    },
  }
}

/** Three notes up from `doMidi`, a note every `every` s. */
const three = (doMidi: number, every: number): RunNote[] =>
  [0, 2, 4].map((d, i) => ({ t: i * every, midi: doMidi + d, dur: every }))

const NOTES = three(50, 0.75)
const BLUE: PlayVoice = { which: 'blue', audible: true }

beforeEach(() => {
  resetRuns()
  sang.length = 0
})

describe("Play Merc's ladder", () => {
  it('lights each note as Merc sings it, his figure singing along, and ends its drawing as it runs out', async () => {
    const { chart, log } = recordingChart()
    const play = mercLadder(chart, NOTES, BLUE, null)
    expect(runs).toHaveLength(1)
    expect(runs[0].notes).toEqual(NOTES)
    expect(runs[0].o.audible).toBe(true)
    runs[0].note(0)
    runs[0].note(1)
    expect(log).toEqual(['play 0: 3', '0 note 0', '0 note 1'])
    expect(sang).toEqual([
      ['blue', 50, true],
      ['blue', 52, true],
    ])
    runs[0].note(2)
    runs[0].end(true)
    await expect(play.done).resolves.toBe(true)
    expect(log.at(-1)).toBe('0 end')
    expect(sang.at(-1)).toEqual(['blue', 54, false])
  })

  it('stopped part way, cancels its drawing once and Merc rests', async () => {
    const { chart, log } = recordingChart()
    const play = mercLadder(chart, NOTES, BLUE, null)
    runs[0].note(0)
    play.stop()
    expect(runs[0].stopped).toBe(true)
    expect(sang.at(-1)).toEqual(['blue', 50, false])
    await expect(play.done).resolves.toBe(false)
    expect(log).toEqual(['play 0: 3', '0 note 0', '0 cancel'])
  })

  it('with the sound off, sings in silence and still draws', () => {
    const { chart, log } = recordingChart()
    mercLadder(chart, NOTES, { which: 'orange', audible: false }, null)
    runs[0].note(0)
    expect(runs[0].o.audible).toBe(false)
    expect(log).toEqual(['play 0: 3', '0 note 0'])
    expect(sang).toEqual([['orange', 50, true]])
  })
})

describe("the guide's sweep after Merc, with no microphone", () => {
  it("follows after the take's gap, a slot a note, silent, a drawing of its own begun as Merc's ends", async () => {
    const { chart, log } = recordingChart()
    const play = mercLadder(chart, NOTES, BLUE, 0.75)
    expect(runs).toHaveLength(2)
    const [merc, guide] = runs
    expect(guide.o.audible).toBe(false)
    expect(guide.notes).toEqual(
      sweepNotes(NOTES, endOf(NOTES) + SWEEP_GAP_SEC, 0.75),
    )
    expect(guide.notes.map((n) => Math.round(n.t * 100) / 100)).toEqual([
      2.65, 3.4, 4.15,
    ])
    expect(guide.notes.map((n) => n.midi)).toEqual([50, 52, 54])
    for (let i = 0; i < 3; i++) merc.note(i)
    merc.end(true)
    // the gap: Merc's last note still showing, nothing ended yet
    expect(log.at(-1)).toBe('0 note 2')
    guide.note(0)
    expect(log.slice(-3)).toEqual(['0 end', 'play 1: 3', '1 note 0'])
    expect(sang.at(-1)).toEqual(['blue', 54, false])
    guide.note(1)
    guide.note(2)
    guide.end(true)
    await expect(play.done).resolves.toBe(true)
    expect(log.slice(-2)).toEqual(['1 note 2', '1 end'])
  })

  it("stopped during the sweep, cancels the guide's drawing, Merc's left ended", async () => {
    const { chart, log } = recordingChart()
    const play = mercLadder(chart, NOTES, BLUE, 0.75)
    const [merc, guide] = runs
    for (let i = 0; i < 3; i++) merc.note(i)
    merc.end(true)
    guide.note(0)
    play.stop()
    expect(guide.stopped).toBe(true)
    await expect(play.done).resolves.toBe(false)
    expect(log.slice(-4)).toEqual([
      '0 end',
      'play 1: 3',
      '1 note 0',
      '1 cancel',
    ])
    expect(log).not.toContain('0 cancel')
  })

  it("stopped in the gap, cancels Merc's drawing and the guide never begins", async () => {
    const { chart, log } = recordingChart()
    const play = mercLadder(chart, NOTES, BLUE, 0.75)
    const [merc, guide] = runs
    for (let i = 0; i < 3; i++) merc.note(i)
    play.stop()
    guide.note(0)
    await expect(play.done).resolves.toBe(false)
    expect(log.slice(-2)).toEqual(['0 note 2', '0 cancel'])
    expect(sang.at(-1)).toEqual(['blue', 54, false])
  })
})

describe('the faster pass', () => {
  const FASTER: FasterPlan = {
    mercNotes: (_id, doMidi) => three(doMidi, 0.45),
    slotSec: 0.45,
  }

  it("plays Merc's ladder at the plan's pace from the chart's do, the count-in on do after him, then the guide after the count-in", async () => {
    const { chart, log } = recordingChart(55)
    const play = fasterPass(chart, FASTER, 'smaller', BLUE)
    const [merc, guide] = runs
    const notes = three(55, 0.45)
    expect(merc.o.audible).toBe(true)
    expect(merc.notes).toEqual([
      ...notes,
      {
        t: endOf(notes),
        midi: 55,
        dur: COUNT_IN.note,
        kind: 'soft',
        gain: COUNT_IN.gain,
      },
    ])
    expect(guide.o.audible).toBe(false)
    expect(guide.notes).toEqual(
      sweepNotes(notes, endOf(notes) + COUNT_IN_SEC, 0.45),
    )
    for (let i = 0; i < 3; i++) merc.note(i)
    // the count-in: Merc has finished, his drawing ends
    merc.note(3)
    expect(log.slice(-2)).toEqual(['0 note 2', '0 end'])
    expect(sang.at(-1)).toEqual(['blue', 59, false])
    merc.end(true)
    guide.note(0)
    expect(log.slice(-2)).toEqual(['play 1: 3', '1 note 0'])
    guide.note(1)
    guide.note(2)
    guide.end(true)
    await expect(play.done).resolves.toBe(true)
    expect(log.at(-1)).toBe('1 end')
    expect(log.filter((l) => l === '0 end')).toHaveLength(1)
  })

  it('stopped during the count-in, cancels nothing Merc ended and the guide never begins', async () => {
    const { chart, log } = recordingChart(55)
    const play = fasterPass(chart, FASTER, 'full', BLUE)
    const [merc, guide] = runs
    for (let i = 0; i < 4; i++) merc.note(i)
    play.stop()
    guide.note(0)
    await expect(play.done).resolves.toBe(false)
    expect(merc.stopped).toBe(true)
    expect(guide.stopped).toBe(true)
    expect(log).toEqual([
      'play 0: 3',
      '0 note 0',
      '0 note 1',
      '0 note 2',
      '0 end',
    ])
  })
})
