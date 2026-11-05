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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as BeatClockModule from './beat-clock'
import type { Spot } from './beat-clock'
import type { Bar, NoteValue, Written } from './rhythm-model'
import type * as SoundAheadModule from './sound-ahead'
import type * as WoodblockModule from './woodblock'

interface FakeRun {
  o: {
    bar: (
      i: number,
    ) => { beats: number; hits: { beat: number; data: unknown }[] } | null
    bpm: () => number
    audible: boolean
    book?: (data: unknown, when: number, bus: unknown) => void
    onHit?: (data: unknown, spot: Spot) => void
    onBeat?: (spot: Spot) => void
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

function mount(onPad?: (beat: number) => void) {
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
