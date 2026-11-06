// ============================================================
// Rhythm bar tests — a play as heard, on a fake beat clock
// ============================================================
//
// The kit's rhythm toy (Lesson 17 WEB-SPEC, Toys 1): a view drawn with its
// pads' buttons named by their beats; a play's clock bars, a part's bars of
// four, Play both's second's pause and the readings that fall on a play's
// end; each symbol written as it is heard, its note lit, the 4/4 with the
// first note, each cell read as it ends and never before; what each hit
// books, a knock per beat, beat 1's higher, and one voice for a tied pair
// held for its length less the gap; a part written in place of the one
// before; the counts lit in turn, or faint; the page's one owner stopping
// it; a pad's press, and the arrow keys; the line said once a play is
// heard to its end, never when it is stopped; and the bar seen on the
// pitch line or with its counts, or redrawn at a new tempo, keeping what
// was heard, its readings gone until each note ends again.
//
// Past 4/4 (Lesson 19 WEB-SPEC, Toys 1 and 2): 6/8 and 3/4 cut into bars of
// three quarters, the click on the metre's beats and a count-in in them;
// six pads lit eighth by eighth, the arcs as each group starts, kept after
// the play and cleared by the next; drums struck in place of notes through
// the page's own; a cue booked its seconds ahead of the sounds it picks,
// the first before the part's first beat; the time signature from the
// start where the scene asks; and a part with a view of its own lighting
// its first pad on its first beat.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as BeatClockModule from './beat-clock'
import type { Spot } from './beat-clock'
import type { DrumHit } from './drum-hits'
import type { Bar, Metre, NoteValue, Written } from './rhythm-model'
import { SIX_EIGHT, THREE_FOUR } from './rhythm-model'
import type * as SoundAheadModule from './sound-ahead'
import type * as WoodblockModule from './woodblock'

interface FakeRun {
  o: {
    bar: (
      i: number,
    ) => { beats: number; hits: { beat: number; data: unknown }[] } | null
    bpm: () => number
    audible: boolean
    lead?: number
    early?: number
    book?: (data: unknown, when: number, bus: unknown) => void
    onHit?: (data: unknown, spot: Spot) => void
    onBeat?: (spot: Spot) => void
    onFrame?: (spot: Spot) => void
  }
  stopped: boolean
  end: (heard: boolean) => void
}
const runs: FakeRun[] = []

vi.mock('./beat-clock', async (actual) => {
  const real = await actual<typeof BeatClockModule>()
  return {
    ...real,
    BeatClock: {
      start(o: FakeRun['o']) {
        let end: (heard: boolean) => void = () => undefined
        const done = new Promise<boolean>((r) => (end = r))
        const run: FakeRun = { o, stopped: false, end }
        runs.push(run)
        return {
          done,
          get running() {
            return !run.stopped
          },
          stop() {
            run.stopped = true
            end(false)
          },
          pageTimeOfBeat: () => 0,
        }
      },
    },
  }
})

const notes: { freq: number; dur: number; kind?: string }[] = []
const knocks: { high: boolean }[] = []
vi.mock('./sound-ahead', async (actual) => {
  const real = await actual<typeof SoundAheadModule>()
  return {
    ...real,
    bookNote: (freq: number, o: { dur: number; kind?: string }) => {
      notes.push({ freq, dur: o.dur, kind: o.kind })
      return null
    },
  }
})
vi.mock('./woodblock', async (actual) => {
  const real = await actual<typeof WoodblockModule>()
  return {
    ...real,
    bookWood: (_bus: unknown, _when: number, high: boolean) => {
      knocks.push({ high })
    },
  }
})

const { mountRhythmBar, planPlay } = await import('./rhythm-bar')
const { createSoundOwner } = await import('./now-playing')

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })
const times = (n: number, w: Written): Written[] =>
  Array.from({ length: n }, () => w)

/** A view of one row of `bars` on the one line. */
const viewOf = (
  bars: readonly Bar[],
  pads: 'choose' | 'press' | null = 'choose',
  counts = false,
) => ({
  scene: { staff: 'line' as const, rows: [{ bars, bpm: 60 }], counts },
  label: 'One bar',
  pads,
})

function mount(
  onPad?: (beat: number) => void,
  onFrame?: (beats: number | null) => void,
  drum?: (hit: DrumHit) => void,
) {
  document.body.innerHTML =
    '<div class="rb-toy"><div class="viz wide rb" data-rb role="group"><p class="sr" aria-live="polite" data-rb-said></p></div><div class="rb-pads" data-rb-pads></div></div>'
  const figure = document.querySelector<HTMLElement>('[data-rb]')
  const pads = document.querySelector<HTMLElement>('[data-rb-pads]')
  const said = document.querySelector<HTMLElement>('[data-rb-said]')
  if (figure === null || pads === null || said === null)
    throw new Error('no toy')
  const owner = createSoundOwner()
  const bar = mountRhythmBar({
    figure,
    pads,
    said,
    freq: () => 220,
    voice: () => 'merc',
    owner,
    onPad,
    onFrame,
    drum,
  })
  return { bar, figure, pads, said, owner }
}

const cursors = new WeakMap<FakeRun, { i: number; b: number; beats: number }>()

/**
 * Drives the last run on from where it was, as the clock would: beat by
 * beat it books each hit and shows it as heard, for `count` beats (to the
 * end by default).
 */
function drive(count = Infinity): void {
  const run = runs[runs.length - 1]
  const at = cursors.get(run) ?? { i: 0, b: 0, beats: 0 }
  for (let n = 0; n < count; ) {
    const bar = run.o.bar(at.i)
    if (bar === null) break
    if (at.b >= bar.beats) {
      at.i += 1
      at.b = 0
      continue
    }
    run.o.bpm()
    run.o.onBeat?.({ bar: at.i, beat: at.b, beats: at.beats })
    const b = at.b
    const due = bar.hits.filter((h) =>
      b === 0 ? h.beat < 1 : Math.floor(h.beat) === b,
    )
    for (const h of due) {
      run.o.book?.(h.data, 0, {})
      run.o.onHit?.(h.data, {
        bar: at.i,
        beat: b,
        beats: at.beats + h.beat - b,
      })
    }
    at.b += 1
    at.beats += 1
    n += 1
  }
  cursors.set(run, at)
}

const finish = async (heard = true): Promise<void> => {
  runs[runs.length - 1].end(heard)
  await Promise.resolve()
  await Promise.resolve()
}

const shown = (el: Element): string[] =>
  Array.from(
    el.querySelectorAll('.rb-sym:not(.is-hidden)'),
    (g) => g.getAttribute('data-i') ?? '',
  )
const readings = (el: Element): string[] =>
  Array.from(
    el.querySelectorAll('.rb-read:not(.is-hidden)'),
    (t) => t.textContent ?? '',
  )

beforeEach(() => {
  runs.length = 0
  notes.length = 0
  knocks.length = 0
})

describe('planPlay', () => {
  it("cuts a part into bars of four, pauses before Play both's second row, and keeps a short bar for the play's last readings", () => {
    // Arrange
    const sixty = viewOf([
      [note(0.5), note(0.5), note(1), note(0.5), note(0.5), note(1)],
    ])
    const both = {
      ...sixty,
      scene: {
        ...sixty.scene,
        rows: [
          sixty.scene.rows[0],
          {
            bars: [
              [note(1), note(1), note(2)],
              [note(1), note(1), note(2)],
            ],
            bpm: 120,
          },
        ],
      },
    }

    // Act
    const plan = planPlay([
      { view: both, row: 0, bpm: () => 60 },
      { view: both, row: 1, bpm: () => 120, pause: 1 },
    ])

    // Assert: 4 s, a second of silence, 4 s, then the last readings
    expect(plan.map((p) => [p.bar.beats, p.bpm(), p.from])).toEqual([
      [4, 60, 0],
      [1, 60, -1],
      [4, 120, 0],
      [4, 120, 4],
      [1, 600, -1],
    ])
    const clicks = (i: number) =>
      plan[i].bar.hits.filter((h) => (h.data as { k: string }).k === 'click')
    expect(clicks(1)).toHaveLength(0)
    expect(clicks(2).map((h) => (h.data as { high: boolean }).high)).toEqual([
      true,
      false,
      false,
      false,
    ])
    // the first row's last cell ends as the pause begins
    expect(plan[1].bar.hits.map((h) => (h.data as { k: string }).k)).toEqual([
      'end',
    ])
  })

  it("knocks only a bare figure's first beat higher, and books each bar's symbols from its own start", () => {
    // Arrange: the four words' tie, two quarters, a beat's pause, the same two tied
    const v = viewOf([
      [note(1), note(1)],
      [note(1, { tie: true }), note(1)],
    ])
    const view = {
      ...v,
      scene: {
        ...v.scene,
        bare: true,
        rows: [{ ...v.scene.rows[0], starts: [0, 3], beats: 5 }],
      },
    }

    // Act
    const plan = planPlay([{ view, bpm: () => 60 }])
    const at = (k: string) =>
      plan.flatMap((p, i) =>
        p.bar.hits
          .filter((h) => h.data.k === k)
          .map((h) => [i, h.beat, (h.data as { high?: boolean }).high]),
      )

    // Assert
    expect(plan.map((p) => p.bar.beats)).toEqual([4, 1, 1])
    expect(at('click').map((c) => c[2])).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    expect(at('sym').map((s) => [s[0], s[1]])).toEqual([
      [0, 0],
      [0, 1],
      [0, 3],
      [1, 0],
    ])
  })

  it('counts a part in on the click alone, beat 1 higher, lighting no pad', () => {
    // Arrange
    const view = viewOf([times(4, note(1))])

    // Act
    const plan = planPlay([{ view, bpm: () => 60, countIn: 4 }])

    // Assert: the count-in, the bar, and the short bar for its last reading
    expect(plan.map((p) => [p.bar.beats, p.from])).toEqual([
      [4, -1],
      [4, 0],
      [1, -1],
    ])
    expect(
      plan[0].bar.hits.map((h) => [
        h.beat,
        h.data.k,
        (h.data as { high?: boolean }).high,
      ]),
    ).toEqual([
      [0, 'click', true],
      [1, 'click', false],
      [2, 'click', false],
      [3, 'click', false],
    ])
  })

  it('keeps a figure that ends short on its last beat, and reads its last cell after it', () => {
    // Arrange: the half rest's example, ending on the next bar's first note
    const v = viewOf([[note(1), note(1), rest(2)], [note(1)]])
    const view = {
      ...v,
      scene: { ...v.scene, rows: [{ ...v.scene.rows[0], beats: 5 }] },
    }

    // Act
    const plan = planPlay([{ view, bpm: () => 60 }])

    // Assert
    expect(plan.map((p) => p.bar.beats)).toEqual([4, 1, 1])
  })
})

describe('mountRhythmBar', () => {
  it('draws a view, names its group, and lays a named button over each beat', () => {
    // Arrange
    const { bar, figure, pads } = mount()

    // Act
    bar.show(viewOf([[note(1), note(0.5), note(0.5), note(2)]]))

    // Assert
    expect(figure.getAttribute('aria-label')).toBe('One bar')
    expect(figure.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
    const buttons = Array.from(pads.querySelectorAll('button'))
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Beat 1: a quarter note',
      'Beat 2: two eighth notes',
      'Beat 3: a half note',
      'Beat 4: the half note, held',
    ])
    expect(buttons.every((b) => b.type === 'button')).toBe(true)
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ])
  })

  it('lays no buttons for a figure whose beats only light', () => {
    // Arrange
    const { bar, pads } = mount()

    // Act
    bar.show(viewOf([times(4, note(1))], null))

    // Assert
    expect(pads.querySelectorAll('button')).toHaveLength(0)
    expect(pads.hidden).toBe(true)
  })

  it('writes each symbol as it is heard, lights its note, shows the 4/4 with the first, and reads each cell only as it ends', async () => {
    // Arrange
    const { bar, figure } = mount()
    const view = viewOf([[note(1), rest(1), note(2)]])
    bar.show(view)

    // Act: as far as the second beat, then to the end
    void bar.play([{ view, bpm: () => 60 }])
    drive(1)
    const first = {
      shown: shown(figure),
      metre: figure.querySelector('.rb-metre')?.classList.contains('is-hidden'),
      sounding: figure
        .querySelector('.rb-sym.is-sounding')
        ?.getAttribute('data-i'),
      read: readings(figure),
      lit: figure.querySelector('.rb-pad.is-now')?.getAttribute('data-beat'),
    }
    drive()
    await finish()

    // Assert
    expect(first).toEqual({
      shown: ['0'],
      metre: false,
      sounding: '0',
      read: [],
      lit: '0',
    })
    expect(shown(figure)).toEqual(['0', '1', '2'])
    expect(readings(figure)).toEqual(['1 s', '1 s', '2 s'])
    expect(figure.querySelector('.rb-sym.is-sounding')).toBeNull()
    expect(figure.querySelector('.rb-pad.is-now')).toBeNull()
  })

  it('books a knock on every beat, beat 1 higher, and one voice for a tied pair held its length less the gap', () => {
    // Arrange
    const { bar } = mount()
    const view = viewOf([[note(1), note(1, { tie: true }), note(2)]])
    bar.show(view)

    // Act
    void bar.play([{ view, bpm: () => 60 }])
    drive()

    // Assert: a quarter, then a quarter tied to a half, three beats as one (FACTS 28, 62, 63)
    expect(knocks.map((k) => k.high)).toEqual([true, false, false, false])
    expect(notes.map((n) => [n.freq, Number(n.dur.toFixed(2))])).toEqual([
      [220, 0.92],
      [220, 2.92],
    ])
    expect(notes.every((n) => n.kind === 'soft')).toBe(true)
  })

  it("holds each note at its part's tempo as it is booked", () => {
    // Arrange
    const { bar } = mount()
    const view = viewOf([[note(1), note(1), note(2)]])
    let bpm = 120
    bar.show(view)

    // Act
    void bar.play([{ view, bpm: () => bpm }])
    drive(1)
    bpm = 60
    drive()

    // Assert: 0.5 s less the gap at 120, then the slider's 60
    expect(notes.map((n) => Number(n.dur.toFixed(2)))[0]).toBe(0.42)
  })

  it('writes each part of Play the halvings in place of the one before', async () => {
    // Arrange
    const { bar, figure } = mount()
    const whole = viewOf([[note(4)]])
    const halves = viewOf([[note(2), note(2)]])
    bar.show(whole)

    // Act: the first bar whole, then into the second's first beat
    void bar.play([
      { view: whole, bpm: () => 60, fresh: true },
      { view: halves, bpm: () => 60, fresh: true },
    ])
    drive(5)

    // Assert: the second bar's first half note, alone
    expect(bar.view).toBe(halves)
    expect(shown(figure)).toEqual(['0'])
    drive()
    await finish()
    expect(shown(figure)).toEqual(['0', '1'])
  })

  it("keeps a bar's unchanged beats written, and writes the changed one as it sounds", () => {
    // Arrange: beat 2 halved, the rest heard before
    const { bar, figure } = mount()
    const view = viewOf([[note(1), note(0.5), note(0.5), note(1), note(1)]])

    // Act
    bar.show(view, (_row, i) => i !== 1 && i !== 2)
    const before = shown(figure)
    void bar.play([{ view, bpm: () => 60 }])
    drive(2)

    // Assert
    expect(before).toEqual(['0', '3', '4'])
    expect(shown(figure)).toEqual(['0', '1', '2', '3', '4'])
  })

  it('lights the counts in turn, and leaves them unlit when faint', () => {
    // Arrange
    const { bar, figure } = mount()
    const view = viewOf([times(8, note(0.5))], null, true)
    bar.show(view)

    // Act
    void bar.play([{ view, bpm: () => 60 }])
    drive(2)
    const lit = figure.querySelector('.rb-count.is-lit')?.textContent
    void bar.play([{ view, bpm: () => 60 }], { faint: true })
    drive(2)

    // Assert
    expect(lit).toBe('and')
    expect(figure.querySelector('.rb-count.is-lit')).toBeNull()
    expect(
      figure.querySelectorAll('.rb-count.is-faint').length,
    ).toBeGreaterThan(0)
  })

  it("stops when another sound takes the page's one owner, and settles its drawing", async () => {
    // Arrange
    const { bar, figure, owner } = mount()
    const view = viewOf([times(4, note(1))])
    bar.show(view)
    const heard = bar.play([{ view, bpm: () => 60 }])
    drive(2)

    // Act
    owner.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(await heard).toBe(false)
    expect(bar.playing).toBe(false)
    expect(figure.querySelector('.rb-pad.is-now')).toBeNull()
  })

  it('says its line once a play is heard to its end, and not when it is stopped', async () => {
    // Arrange
    const { bar, said } = mount()
    const view = viewOf([times(4, note(1))])
    bar.show(view)

    // Act
    const cut = bar.play([{ view, bpm: () => 60 }], { line: 'Played.' })
    bar.stop()
    await cut
    const afterStop = said.textContent
    const whole = bar.play([{ view, bpm: () => 60 }], { line: 'Played.' })
    drive()
    await finish()
    await whole

    // Assert
    expect(afterStop).toBe('')
    expect(said.textContent).toBe('Played.')
  })

  it('sees the bar on the pitch line or with its counts, keeping what was heard, and names it so', () => {
    // Arrange
    const { bar, figure } = mount()
    const view = {
      ...viewOf([times(4, note(1))]),
      laneLabel: 'One bar, on the pitch line',
    }
    bar.show(view)
    void bar.play([{ view, bpm: () => 60 }])
    drive(2)

    // Act
    bar.see({ lanes: true })
    const lanes = [
      figure.querySelector('svg')?.dataset.staff,
      figure.getAttribute('aria-label'),
      shown(figure),
    ]
    bar.see({ counts: true })
    const counts = figure.querySelectorAll('.rb-count').length
    bar.see({ lanes: false, counts: false })

    // Assert
    expect(lanes).toEqual(['lanes', 'One bar, on the pitch line', ['0', '1']])
    expect(counts).toBe(4)
    expect(bar.seen).toEqual({ lanes: false, counts: false })
    expect(figure.getAttribute('aria-label')).toBe('One bar')
    expect(figure.querySelectorAll('.rb-count')).toHaveLength(0)
    expect(shown(figure)).toEqual(['0', '1'])
  })

  it('lights a count switched on mid-play', () => {
    // Arrange
    const { bar, figure } = mount()
    const view = viewOf([times(4, note(1))])
    bar.show(view)
    void bar.play([{ view, bpm: () => 60 }])
    drive(1)

    // Act
    bar.see({ counts: true })
    drive(1)

    // Assert
    expect(figure.querySelector('.rb-count.is-lit')?.textContent).toBe('2')
  })

  it('redraws at a new tempo keeping what is written; its readings go, and read again at that tempo as each note ends', async () => {
    // Arrange
    const { bar, figure } = mount()
    const view = viewOf([[note(1), note(1), note(2)]])
    bar.show(view)
    const first = bar.play([{ view, bpm: () => 60 }])
    drive()
    await finish()
    await first
    const heard = readings(figure)

    // Act
    bar.retempo(120)
    const after = [shown(figure), readings(figure)]
    const faster = bar.view
    if (faster === null) throw new Error('no view')
    void bar.play([{ view: faster, bpm: () => 120 }])
    drive(2)

    // Assert (WEB-SPEC, Toys 6)
    expect(heard).toEqual(['1 s', '1 s', '2 s'])
    expect(after).toEqual([['0', '1', '2'], []])
    expect(readings(figure)).toEqual(['0.5 s'])
  })

  it('shows a bar as heard with its readings off, as after a tempo change', () => {
    // Arrange
    const { bar, figure } = mount()
    const view = viewOf([times(4, note(1))])

    // Act
    bar.show(view, () => true, { readings: false })
    const quiet = [shown(figure), readings(figure)]
    bar.show(view, () => true)

    // Assert
    expect(quiet).toEqual([['0', '1', '2', '3'], []])
    expect(readings(figure)).toEqual(['1 s', '1 s', '1 s', '1 s'])
  })

  it('hands each frame its beats as heard, and null as a play starts and ends', async () => {
    // Arrange
    const frames: (number | null)[] = []
    const { bar } = mount(undefined, (b) => frames.push(b))
    const view = viewOf([times(4, note(1))])
    bar.show(view)

    // Act
    const heard = bar.play([{ view, bpm: () => 60 }])
    runs[runs.length - 1].o.onFrame?.({ bar: 0, beat: 1, beats: 1.25 })
    drive()
    await finish()
    await heard

    // Assert
    expect(frames).toEqual([null, 1.25, null])
  })

  it('lights a pad and a note outside a play, and keeps its ticks through a redraw until cleared', () => {
    // Arrange
    const { bar } = mount()
    const view = viewOf([times(4, note(1))], null)
    bar.show(view, () => true)
    const pad = (b: number) =>
      document.querySelectorAll('.rb-pad')[b]?.classList.contains('is-now')
    const sounding = () =>
      Array.from(document.querySelectorAll('.rb-sym.is-sounding'), (g) =>
        Number(g.getAttribute('data-i')),
      )

    // Act
    bar.light({ pad: 2, sounding: 1 })
    const lit = [pad(2), pad(1), sounding()]
    bar.ticks([{ beat: 1, met: true }])
    bar.see({ counts: true })
    const kept = document.querySelectorAll('.rb-tick.is-met').length
    bar.ticks(null)

    // Assert
    expect(lit).toEqual([true, false, [1]])
    expect(kept).toBe(1)
    expect(document.querySelectorAll('.rb-tick')).toHaveLength(0)
  })

  it('answers a pad pressed, marks the chosen one, and moves the choice with the arrow keys', () => {
    // Arrange
    const pressed: number[] = []
    const { bar, pads } = mount((b) => pressed.push(b))
    bar.show(viewOf([times(4, note(1))]))
    const buttons = () => Array.from(pads.querySelectorAll('button'))

    // Act
    buttons()[1].click()
    bar.choose(1)
    buttons()[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )

    // Assert
    expect(pressed).toEqual([1, 2])
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
    expect(document.activeElement).toBe(buttons()[2])
  })
})

/** Six eighths a bar of `metre` at 90 quarter-BPM, six pads to a bar under arcs, Lesson 19's Step 1. */
const sixView = (
  metre: Metre,
  bars = 1,
  more: { metreFirst?: boolean } = {},
) => ({
  scene: {
    staff: 'line' as const,
    rows: [
      {
        bars: Array.from({ length: bars }, () => times(6, note(0.5))),
        bpm: 90,
        metre,
      },
    ],
    padEvery: 0.5,
    arcs: true,
    ...more,
  },
  label: 'Six eighths',
  pads: null,
})

const KICK: DrumHit = { voice: 'kick', level: 1 }
const HAT: DrumHit = { voice: 'hh-closed', level: 0.7 }
const SNARE: DrumHit = { voice: 'snare', level: 0.7 }
const THREES = [KICK, HAT, HAT, SNARE, HAT, HAT]

describe('past 4/4', () => {
  it("cuts 6/8 and 3/4 into bars of three quarters, knocking on the metre's beats, each bar's first higher", () => {
    // Act
    const plan = (metre: Metre) =>
      planPlay([{ view: sixView(metre, 2), bpm: () => 90 }])
    const clicks = (metre: Metre) =>
      plan(metre).map((p) =>
        p.bar.hits
          .filter((h) => h.data.k === 'click')
          .map((h) => [h.beat, (h.data as { high: boolean }).high]),
      )

    // Assert: two bars of 2 s at 90, then the last readings (FACTS 18)
    expect(plan(SIX_EIGHT).map((p) => [p.bar.beats, p.from])).toEqual([
      [3, 0],
      [3, 3],
      [1, -1],
    ])
    expect(clicks(SIX_EIGHT)).toEqual([
      [
        [0, true],
        [1.5, false],
      ],
      [
        [0, true],
        [1.5, false],
      ],
      [],
    ])
    expect(clicks(THREE_FOUR).slice(0, 2)).toEqual([
      [
        [0, true],
        [1, false],
        [2, false],
      ],
      [
        [0, true],
        [1, false],
        [2, false],
      ],
    ])
  })

  it("counts in with the metre's beats, a bar either way: 6/8's two a dotted quarter apart, 3/4's three", () => {
    // Act
    const countIn = (metre: Metre, beats: number) =>
      planPlay([{ view: sixView(metre), bpm: () => 90, countIn: beats }])[0]

    // Assert: 2 s of count-in at 90 either way (FACTS 36)
    const six = countIn(SIX_EIGHT, 2)
    const three = countIn(THREE_FOUR, 3)
    expect([six.bar.beats, six.from, three.bar.beats, three.from]).toEqual([
      3, -1, 3, -1,
    ])
    expect(six.bar.hits.map((h) => h.beat)).toEqual([0, 1.5])
    expect(three.bar.hits.map((h) => h.beat)).toEqual([0, 1, 2])
  })

  it('lights each of six pads as its eighth is heard, and each arc as its group starts, kept after the play and cleared by the next', async () => {
    // Arrange
    const { bar, figure } = mount()
    const view = sixView(SIX_EIGHT)
    bar.show(view)
    const lit = () =>
      figure.querySelector('.rb-pad.is-now')?.getAttribute('data-pad')
    const arcs = () =>
      Array.from(
        figure.querySelectorAll('.rb-arc'),
        (a) => !a.classList.contains('is-hidden'),
      )
    const before = arcs()

    // Act: the first quarter, the second, then to the end, and again
    void bar.play([{ view, bpm: () => 90, click: false }])
    drive(1)
    const first = { lit: lit(), arcs: arcs() }
    drive(1)
    const second = { lit: lit(), arcs: arcs() }
    drive()
    await finish()
    const after = { lit: lit(), arcs: arcs() }
    void bar.play([{ view, bpm: () => 90, click: false }])

    // Assert: eighths 1 and 2, then 3 and 4 and the second group (FACTS 1a)
    expect(before).toEqual([false, false])
    expect(first).toEqual({ lit: '1', arcs: [true, false] })
    expect(second).toEqual({ lit: '3', arcs: [true, true] })
    expect(after).toEqual({ lit: undefined, arcs: [true, true] })
    expect(arcs()).toEqual([false, false])
  })

  it("draws 3/4's three arcs of two, and none for a figure whose pads are its beats", () => {
    // Arrange
    const { bar, figure } = mount()
    const view = sixView(THREE_FOUR)
    bar.show(view)

    // Act
    void bar.play([{ view, bpm: () => 90, click: false }])
    drive()

    // Assert
    const shownArcs = () =>
      figure.querySelectorAll('.rb-arc:not(.is-hidden)').length
    expect(shownArcs()).toBe(3)
    const fours = viewOf([times(4, note(1))], null)
    expect(
      planPlay([
        {
          view: { ...fours, scene: { ...fours.scene, arcs: true } },
          bpm: () => 60,
        },
      ]).flatMap((p) => p.bar.hits.filter((h) => h.data.k === 'arc')),
    ).toEqual([])
  })

  it("strikes a part's drums in place of its notes, one a sound, through the page's own, and plays it without the click", () => {
    // Arrange
    const struck: DrumHit[] = []
    const { bar } = mount(undefined, undefined, (hit) => struck.push(hit))
    const view = sixView(SIX_EIGHT)
    bar.show(view)

    // Act: Subdivide's 6/8, its last eighth striking nothing
    void bar.play([
      {
        view,
        bpm: () => 90,
        click: false,
        drums: [KICK, HAT, HAT, SNARE, HAT, null],
      },
    ])
    drive()

    // Assert (FACTS 18, 63)
    expect(struck).toEqual([KICK, HAT, HAT, SNARE, HAT])
    expect(notes).toEqual([])
    expect(knocks).toEqual([])
  })

  it("books a cue its seconds ahead of each sound it picks, the first before the part's first beat, and runs it as heard", () => {
    // Arrange: Merc's hop on the kick and the snare (FACTS 57)
    const fired: number[] = []
    const cue = {
      early: 0.53,
      on: (d: DrumHit | null) => d === KICK || d === SNARE,
      fire: () => fired.push(fired.length),
    }
    const view = sixView(SIX_EIGHT)
    const part = { view, bpm: () => 90, click: false, drums: THREES }

    // Act
    const plan = planPlay([part, part], cue)
    const { bar } = mount()
    bar.show(view)
    void bar.play([part], { lead: 0.6, cue })
    const run = runs[runs.length - 1]
    drive()

    // Assert: 0.53 s is 0.795 of a beat at 90, so the kick's before its bar
    expect(
      plan.map((p) =>
        p.bar.hits
          .filter((h) => h.data.k === 'cue')
          .map((h) => Number(h.beat.toFixed(3))),
      ),
    ).toEqual([[-0.795, 0.705], [-0.795, 0.705], []])
    expect([run.o.lead, run.o.early]).toEqual([0.6, 0.53])
    expect(fired).toEqual([0, 1])
  })

  it('shows the time signature before anything is heard where the scene asks, and with the first note otherwise', () => {
    // Arrange
    const { bar, figure } = mount()
    const hidden = () =>
      figure.querySelector('.rb-metre')?.classList.contains('is-hidden')

    // Act
    bar.show(sixView(SIX_EIGHT, 1, { metreFirst: true }))
    const first = hidden()
    bar.show(sixView(SIX_EIGHT))

    // Assert (Lesson 19 WEB-SPEC, Toys 5)
    expect(first).toBe(false)
    expect(hidden()).toBe(true)
  })

  it('sounds each note of a row that gives its notes at its own pitch, as a tune on the staff does (FACTS 61)', () => {
    // Arrange: do re mi so on the bass staff, C3 D3 E3 G3
    const { bar } = mount()
    const tune = (['C', 'D', 'E', 'G'] as const).map((letter) => ({
      letter,
      alter: 0,
      octave: 3,
    }))
    const v = viewOf([times(4, note(1))])
    const view = {
      ...v,
      scene: { ...v.scene, rows: [{ ...v.scene.rows[0], notes: tune }] },
    }
    bar.show(view)

    // Act
    void bar.play([{ view, bpm: () => 60, click: false }])
    drive()

    // Assert
    expect(notes.map((n) => Number(n.freq.toFixed(2)))).toEqual([
      130.81, 146.83, 164.81, 196,
    ])
  })

  it("lights the first pad of a part with a view of its own on its first beat, as each of Play the halvings' bars does", () => {
    // Arrange
    const { bar, figure } = mount()
    const whole = viewOf([[note(4)]])
    const halves = viewOf([[note(2), note(2)]])
    bar.show(whole)

    // Act: into the second bar's first beat
    void bar.play([
      { view: whole, bpm: () => 60, fresh: true },
      { view: halves, bpm: () => 60, fresh: true },
    ])
    drive(5)

    // Assert: drawn afresh, and its first beat lit
    expect(bar.view).toBe(halves)
    expect(
      figure.querySelector('.rb-pad.is-now')?.getAttribute('data-beat'),
    ).toBe('0')
  })
})
