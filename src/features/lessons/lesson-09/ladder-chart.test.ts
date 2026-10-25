// ============================================================
// Lesson 9 ladder chart tests — each state's rungs, its window, its words
// ============================================================
//
// The chart as the page mounts it, on the kit's own band chart, its frames
// run by hand (kit/frame-loop.test-fixtures.ts), read through the scene it
// hands the band chart and the summary on its canvas: each state's rungs,
// window and names (WEB-SPEC, Toys 1); every window holds every note its
// state plays, for both voices and every place Move do takes do (Tests 4's
// last clause); no summary holds a sign; an arc draws as its second note
// starts, and under reduced motion every phrase lands whole at once; and
// with nothing moving the page asks for no frame.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { HandLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { LadderChart, Phrase } from './ladder-chart'
import type { ChartState } from './ladder-data'
import { doOf, liveWindow, RUNG_ORDER, windowOf } from './ladder-data'
import { climbNotes, COPY_TRACE, FIVE_LEAPS, fiveLeapsNotes, freeNotes, hearFirstNotes, landingSound, landingTrace, leapNotes, MERC_LEAP, mercLadderNotes, OVER_LEAPS, PATH_IDS, pathNotes, SLOW, stepNotes, } from './sounds'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const STATES: readonly ChartState[] = [
  'compact',
  'step',
  'hear',
  'ladder',
  'order',
  'landing',
  'free',
]
const VOICES: readonly Voice[] = ['lower', 'higher']
const SHIFTS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]

/** A leap's two notes, its arc drawn as the second starts. */
const leap = (notes: Phrase['notes']): Phrase => ({ notes, leaps: [[0, 1]] })

/** Every phrase a state plays (WEB-SPEC, Toys 1 and 2; FACTS 91 to 95), at speed and slowed. */
function phrasesOf(state: ChartState, d: number): Phrase[] {
  const mercLeap = leap(leapNotes(d, MERC_LEAP))
  switch (state) {
    case 'compact':
      return [
        mercLeap,
        ...PATH_IDS.map((p) => ({
          notes: pathNotes(d, p),
          leaps: [[0, 1] as const, [1, 2] as const],
        })),
      ]
    case 'step':
      return [{ notes: stepNotes(d) }, { notes: stepNotes(d, SLOW) }, mercLeap]
    case 'hear':
      return [{ notes: hearFirstNotes(d) }, mercLeap]
    case 'ladder':
      return [
        { notes: climbNotes(d) },
        ...OVER_LEAPS.map((l) => leap(leapNotes(d, l))),
      ]
    case 'order':
      return [
        {
          notes: fiveLeapsNotes(d),
          leaps: FIVE_LEAPS.map((_, k) => [2 * k, 2 * k + 1] as const),
        },
      ]
    case 'landing':
      return [{ notes: [landingSound(d).first] }]
    case 'free':
      return RUNG_ORDER.flatMap((from) =>
        RUNG_ORDER.map((to) => {
          const notes = freeNotes(d, from, to, { hearFirst: true })
          return notes.length === 3
            ? { notes, leaps: [[1, 2] as const] }
            : { notes }
        }),
      )
  }
}

/** The ladder chart mounted on a canvas of its own, on screen, its frames by hand. */
async function mount(
  state: ChartState,
  o: { reduce?: boolean; voice?: Voice } = {},
): Promise<{
  hand: HandLoop
  ladder: LadderChart
  setVoice: (v: Voice) => void
}> {
  if (o.voice !== undefined)
    localStorage.setItem('fyp-voice', JSON.stringify(o.voice))
  const hand = await handLoop(o.reduce ?? true)
  const { VoiceChoice } = await import('@/features/lessons/kit/voice-choice')
  const { mountLadderChart } = await import('./ladder-chart')
  const root = document.createElement('figure')
  root.innerHTML = '<canvas></canvas>'
  document.body.appendChild(root)
  const canvas = root.querySelector('canvas') as HTMLCanvasElement
  Object.defineProperties(canvas, {
    clientWidth: { value: 300, configurable: true },
    clientHeight: { value: 190, configurable: true },
  })
  const ladder = mountLadderChart(root, { state })
  hand.see(canvas)
  hand.settle()
  return { hand, ladder, setVoice: (v) => VoiceChoice.set(v) }
}

const rungs = (l: LadderChart) => l.chart.scene.rungs ?? []
const arcs = (l: LadderChart) => l.chart.scene.arcs ?? []
const cents = (l: LadderChart): number[] => rungs(l).map((r) => r.c)
const summary = (l: LadderChart): string | null =>
  l.chart.canvas.getAttribute('aria-label')

describe("Lesson 9's ladder chart, state by state", () => {
  it.each([
    ['compact', [0, 700], false, false, []],
    ['step', [0, 200], false, false, [50, 52, 57]],
    ['hear', [0, 700], false, false, [50, 57]],
    ['ladder', [0, 400, 700, 1200], true, false, [50, 54, 57, 62]],
    ['order', [0, 400, 700, 1200], true, true, [50, 54, 57, 62]],
    ['landing', [0, 700], false, false, [50, 57]],
    ['free', [0, 400, 700, 1200], false, true, [50, 54, 57, 62]],
  ] as const)(
    'shows %s with its rungs, its window and its names',
    async (state, expected, faint, rows, names) => {
      // Arrange
      const { ladder } = await mount('compact')

      // Act
      ladder.show(state)

      // Assert
      const [lo, hi] = windowOf(state, 50)
      expect([ladder.chart.lo, ladder.chart.hi]).toEqual([
        (lo - 50) * 100,
        (hi - 50) * 100,
      ])
      expect(cents(ladder)).toEqual(expected)
      expect(rungs(ladder).every((r) => r.faint === faint)).toBe(true)
      expect(rungs(ladder).every((r) => (r.from === undefined) === rows)).toBe(
        true,
      )
      expect(ladder.view.names).toEqual(names)
    },
  )

  it("draws Merc's leap on the compact chart, from the end of do's slot to the start of so's, and says so", async () => {
    // Arrange, Act
    const { ladder } = await mount('compact')

    // Assert
    const [d, so] = rungs(ladder)
    expect(arcs(ladder)).toEqual([
      { from: { t: d.to, c: 0 }, to: { t: so.from, c: 700 } },
    ])
    expect(summary(ladder)).toBe(
      "Do, D3, and so, A3, with Merc's leap between them",
    )
  })

  it("lays Step 2's illustration over do's slot and so's, landing 75 cents under so, with its words under it", async () => {
    // Arrange, Act
    const { ladder } = await mount('hear')

    // Assert
    const [d, so] = rungs(ladder)
    const { line, label } = ladder.chart.scene
    expect(line).toEqual([
      { t: d.from, c: 0 },
      { t: d.to, c: 0 },
      { t: so.from, c: 625 },
      { t: so.to, c: 625 },
    ])
    expect(label?.text).toBe('an illustration')
    expect(label?.t).toBe(so.from)
    expect(label?.c).toBeLessThan(625)
  })

  it("gives Step 5's so a slot twice as long as do's", async () => {
    // Arrange, Act
    const { ladder } = await mount('landing')

    // Assert
    const [d, so] = rungs(ladder)
    expect(
      ((so.to ?? 0) - (so.from ?? 0)) / ((d.to ?? 0) - (d.from ?? 0)),
    ).toBeCloseTo(2)
  })

  it("lays Sing it's ladder as faint slots on Merc's time, 1.5 s each, its window to the ladder's top, and says where do is", async () => {
    // Arrange
    const { ladder } = await mount('compact')

    // Act
    ladder.showLive('smaller')

    // Assert
    expect(cents(ladder)).toEqual([0, 400, 700, 400, 0])
    expect(rungs(ladder).map((r) => [r.from, r.to])).toEqual([
      [0, 1.5],
      [1.5, 3],
      [3, 4.5],
      [4.5, 6],
      [6, 7.5],
    ])
    expect(rungs(ladder).every((r) => r.faint === true)).toBe(true)
    const [lo, hi] = liveWindow('smaller', 50)
    expect([ladder.chart.lo, ladder.chart.hi]).toEqual([
      (lo - 50) * 100,
      (hi - 50) * 100,
    ])
    expect(summary(ladder)).toBe('Do is D3')
  })

  it('names each rung by its syllable and its spelled note, the sign on the canvas and the word spoken', async () => {
    // Arrange
    const { noteName } = await import('./ladder-chart')

    // Act
    const names = [50, 52, 54, 55, 57, 62].map((m) => noteName(50, m))

    // Assert
    expect(names.map((n) => n.text)).toEqual([
      'do · D3',
      're · E3',
      'mi · F♯3',
      'fa · G3',
      'so · A3',
      'top do · D4',
    ])
    expect(names.map((n) => n.spoken)).toEqual([
      'do, D3',
      're, E3',
      'mi, F sharp 3',
      'fa, G3',
      'so, A3',
      'top do, D4',
    ])
  })
})

describe("Lesson 9's ladder chart windows and words", () => {
  it('holds every note each state plays, its rungs and its lines, for both voices and every place Move do takes do', () => {
    // Arrange
    const outside: string[] = []
    const check = (
      where: string,
      [lo, hi]: readonly [number, number],
      midis: readonly number[],
    ): void => {
      for (const m of midis)
        if (m < lo || m > hi)
          outside.push(`${where}: ${m} outside ${lo} to ${hi}`)
    }

    // Act
    for (const voice of VOICES)
      for (const shift of SHIFTS) {
        const d = doOf(voice, shift)
        for (const state of STATES) {
          const w = windowOf(state, d)
          const played = phrasesOf(state, d).flatMap((p) =>
            p.notes.map((n) => n.midi),
          )
          check(`${voice} ${shift} ${state}`, w, played)
        }
        // the illustrations' lines, cents from do
        check(
          `${voice} ${shift} hear line`,
          windowOf('hear', d),
          COPY_TRACE.map((p) => d + (p.c ?? 0) / 100),
        )
        check(
          `${voice} ${shift} landing line`,
          windowOf('landing', d),
          landingTrace().map((p) => d + (p.c ?? 0) / 100),
        )
        for (const id of ['full', 'smaller'] as const)
          check(
            `${voice} ${shift} live ${id}`,
            liveWindow(id, d),
            mercLadderNotes(id, d).map((n) => n.midi),
          )
      }

    // Assert
    expect(outside).toEqual([])
  })

  it('reads its window again on every state, voice and do, so each rung stands inside the axis it draws on', async () => {
    // Arrange
    const { ladder, setVoice } = await mount('compact')
    const outside: string[] = []

    // Act
    for (const voice of VOICES) {
      setVoice(voice)
      for (const shift of SHIFTS) {
        ladder.move(shift)
        for (const state of STATES) {
          ladder.show(state)
          const [lo, hi] = windowOf(state, doOf(voice, shift))
          const { chart } = ladder
          if (
            chart.lo !== (lo - chart.target) * 100 ||
            chart.hi !== (hi - chart.target) * 100
          )
            outside.push(
              `${voice} ${shift} ${state}: axis ${chart.lo} to ${chart.hi}`,
            )
          for (const r of rungs(ladder))
            if (r.c < chart.lo || r.c > chart.hi)
              outside.push(`${voice} ${shift} ${state}: rung ${r.c}`)
        }
      }
    }

    // Assert
    expect(outside).toEqual([])
  })

  it('says what it shows in spoken names, never a sign, in every state, voice and place of do', async () => {
    // Arrange
    const { ladder, setVoice } = await mount('compact')
    const said: string[] = []

    // Act
    for (const voice of VOICES) {
      setVoice(voice)
      for (const shift of SHIFTS) {
        ladder.move(shift)
        for (const state of STATES) {
          ladder.show(state)
          said.push(summary(ladder) ?? '')
          for (const p of phrasesOf(state, ladder.doMidi).slice(0, 4)) {
            const drawn = ladder.play(p)
            p.notes.forEach((_, i) => drawn.note(i))
            drawn.end()
            said.push(summary(ladder) ?? '')
          }
        }
        for (const id of ['full', 'smaller'] as const) {
          ladder.showLive(id)
          said.push(summary(ladder) ?? '')
        }
      }
    }

    // Assert
    expect(said.filter((s) => s === '' || /[♯♭#𝄪𝄫]/u.test(s))).toEqual([])
  })

  it('follows a voice chosen anywhere on the page, and Move do within its four semitones', async () => {
    // Arrange
    const { ladder, setVoice } = await mount('ladder')

    // Act
    setVoice('higher')
    const higher = { target: ladder.chart.target, said: summary(ladder) }
    ladder.move(9)

    // Assert
    expect(higher).toEqual({
      target: 62,
      said: 'Do, D4, mi, F sharp 4, so, A4, and top do, D5',
    })
    expect(ladder.doMidi).toBe(66)
    expect(cents(ladder)).toEqual([0, 400, 700, 1200])
  })

  it('opens on the stored voice', async () => {
    // Arrange, Act
    const { ladder } = await mount('compact', { voice: 'higher' })

    // Assert
    expect(ladder.chart.target).toBe(62)
    expect(summary(ladder)).toBe(
      "Do, D4, and so, A4, with Merc's leap between them",
    )
  })
})

describe("Lesson 9's ladder chart, as a phrase plays", () => {
  it.each(STATES)(
    'lights, in %s, the rung at the pitch of every note it plays',
    async (state) => {
      // Arrange
      const { ladder } = await mount(state)
      const unlit: string[] = []

      // Act
      for (const p of phrasesOf(state, 50)) {
        const drawn = ladder.play(p)
        p.notes.forEach((n, i) => {
          drawn.note(i)
          if (
            !rungs(ladder).some(
              (r) => (r.glow ?? 0) > 0 && r.c === (n.midi - 50) * 100,
            )
          )
            unlit.push(`note ${i} of ${p.notes.map((x) => x.midi).join(' ')}`)
        })
        drawn.cancel()
      }

      // Assert
      expect(unlit).toEqual([])
    },
  )

  it("shows a path's middle note only once its path plays, each band faint before its turn", async () => {
    // Arrange
    const { ladder } = await mount('compact')
    const atRest = cents(ladder)

    // Act
    const drawn = ladder.play({
      notes: pathNotes(50, 'mi'),
      leaps: [
        [0, 1],
        [1, 2],
      ],
    })
    const before = rungs(ladder).map((r) => r.faint)
    drawn.note(0)
    const first = rungs(ladder).map((r) => r.faint)

    // Assert
    expect(atRest).toEqual([0, 700])
    expect(cents(ladder)).toEqual([0, 400, 700])
    expect(before).toEqual([true, true, true])
    expect(first).toEqual([false, true, true])
  })

  it('draws an arc from nothing as its second note starts, part way in the next frame, and whole once settled', async () => {
    // Arrange
    const { hand, ladder } = await mount('compact', { reduce: false })
    const drawn = ladder.play(leap(leapNotes(50, MERC_LEAP)))
    drawn.note(0)
    hand.settle()
    const afterFirst = arcs(ladder)[0].drawn

    // Act
    drawn.note(1)
    const atStart = arcs(ladder)[0].drawn
    hand.frame()
    const partWay = arcs(ladder)[0].drawn ?? 0
    hand.settle()

    // Assert
    expect([afterFirst, atStart]).toEqual([0, 0])
    expect(partWay).toBeGreaterThan(0)
    expect(partWay).toBeLessThan(1)
    expect(arcs(ladder)[0].drawn).toBe(1)
    expect(rungs(ladder)[1].glow).toBe(1)
    expect(hand.asked).toHaveLength(0)
  })

  it.each(STATES)(
    'lands, in %s under reduced motion, each arc whole and each rung lit at once, and at rest once heard',
    async (state) => {
      // Arrange
      const { ladder } = await mount(state)
      const p =
        phrasesOf(state, 50).find((x) => (x.leaps ?? []).length > 0) ??
        phrasesOf(state, 50)[0]
      const drawn = ladder.play(p)

      // Act
      p.notes.forEach((_, i) => drawn.note(i))
      const sounding = {
        arcs: arcs(ladder).map((a) => a.drawn),
        lit: rungs(ladder).some((r) => r.glow === 1),
      }
      drawn.end()

      // Assert
      expect(sounding.arcs.every((d) => d === 1)).toBe(true)
      expect(sounding.lit).toBe(true)
      expect(arcs(ladder)).toHaveLength((p.leaps ?? []).length)
      expect(
        arcs(ladder).every((a) => a.drawn === undefined || a.drawn === 1),
      ).toBe(true)
      expect(rungs(ladder).every((r) => (r.glow ?? 0) === 0)).toBe(true)
    },
  )

  it("numbers Step 4's five leaps, each in a column of its own", async () => {
    // Arrange
    const { ladder } = await mount('order')
    const [p] = phrasesOf('order', 50)

    // Act
    const drawn = ladder.play(p)
    drawn.end()

    // Assert
    expect(arcs(ladder).map((a) => [a.from.c, a.to.c, a.digit])).toEqual([
      [400, 700, 1],
      [0, 400, 2],
      [0, 700, 3],
      [700, 1200, 4],
      [0, 1200, 5],
    ])
  })

  it("draws Step 3's leap to the top do from do's slot over the slots it skips", async () => {
    // Arrange
    const { ladder } = await mount('ladder')

    // Act
    ladder.play(leap(leapNotes(50, OVER_LEAPS[1]))).end()

    // Assert
    const [d, , , top] = rungs(ladder)
    expect(arcs(ladder)).toEqual([
      { from: { t: d.to, c: 0 }, to: { t: top.from, c: 1200 } },
    ])
  })

  it("lights Sing it's second mi in its own slot, not the first", async () => {
    // Arrange
    const { ladder } = await mount('compact')
    ladder.showLive('smaller')
    const drawn = ladder.play({ notes: mercLadderNotes('smaller', 50) })

    // Act: each note as it starts, 1.5 s apart
    for (const i of [0, 1, 2, 3]) {
      if (i > 0) vi.advanceTimersByTime(1500)
      drawn.note(i)
    }

    // Assert
    expect(rungs(ladder).map((r) => r.glow)).toEqual([0, 0, 0, 1, 0])
  })

  it('puts a rung out once its note has sounded, and a cut-short phrase back at rest', async () => {
    // Arrange
    const { ladder } = await mount('compact')
    const drawn = ladder.play({
      notes: pathNotes(50, 're'),
      leaps: [
        [0, 1],
        [1, 2],
      ],
    })
    drawn.note(0)

    // Act
    vi.advanceTimersByTime(1000)
    const afterDo = rungs(ladder).map((r) => r.glow)
    drawn.cancel()

    // Assert
    expect(afterDo).toEqual([0, 0, 0])
    expect(cents(ladder)).toEqual([0, 700])
    expect(summary(ladder)).toBe(
      "Do, D3, and so, A3, with Merc's leap between them",
    )
  })

  it('asks for no frame at rest, nor once a phrase has drawn', async () => {
    // Arrange
    const { hand, ladder } = await mount('ladder', { reduce: false })
    const rested = hand.asked.length

    // Act
    const drawn = ladder.play(leap(leapNotes(50, OVER_LEAPS[0])))
    drawn.note(0)
    drawn.note(1)
    const frames = hand.settle()
    vi.advanceTimersByTime(1000)
    hand.settle()

    // Assert
    expect(rested).toBe(0)
    expect(frames).toBeGreaterThan(0)
    expect(frames).toBeLessThan(60)
    expect(hand.asked).toHaveLength(0)
  })
})
