// ============================================================
// Tune line tests — its buttons, its start, and a played run's timing
// ============================================================
//
// The drawing itself is canvas work (the doubles take every call); what a
// page relies on is here: a named button over every bead, gap and bracket
// its shape asks for, on that part's target in the layout and numbered
// across the tune; a new start that lands at once under reduced motion
// (the doubles turn it on); and a run that announces each note at its
// onset, settles when the last one ends, and stops when asked, saying
// whether it was played to its end. With sound on (a fake Sound.voice),
// a run's voices stop when it is stopped and when a new run starts. On the
// page's frame loop, turned by hand, an idle line asks for no frames, and a
// run brings them back until its last light has gone. A shape that asks for
// a grid makes its buttons one: a row for each line's beads and its gaps,
// one Tab stop that stays on the button last focused, and arrows, Home and
// End that move the focus as WAI-ARIA's layout grid does.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { startFrameLoop } from './frame-loop'
import type { Voice } from './sound'
import { Sound } from './sound'
import type { TuneLineOptions, TuneNote, TuneShape } from './tune-line'
import { gridMove, mountTuneLine } from './tune-line'

const line = (ats: readonly number[]): TuneNote[] =>
  ats.map((at, i) => ({ at, beats: i === ats.length - 1 ? 2 : 1 }))

/** "Twinkle"'s first two lines, semitones above do: crotchets, and a minim at each line's end. */
const TUNE: readonly TuneNote[][] = [
  line([0, 0, 7, 7, 9, 9, 7]),
  line([5, 5, 4, 4, 2, 2, 0]),
]

/** One line on a fixed window of rows, its names and its gaps' strip, every part a button. */
const ONE: TuneShape = {
  lines: [0],
  window: [60, 80],
  fill: false,
  names: true,
  below: 'gaps',
  beadButtons: true,
  gapButtons: true,
  brackets: [],
  ghost: null,
}

interface Mounted {
  readonly tune: ReturnType<typeof mountTuneLine>
  readonly hits: HTMLElement
  /** What the page heard pressed, in order. */
  readonly pressed: string[]
}

function mount(over: Partial<TuneLineOptions> = {}): Mounted {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, width: 600, height: 276 }) as DOMRect
  const hits = document.createElement('div')
  document.body.append(canvas, hits)
  const pressed: string[] = []
  const tune = mountTuneLine({
    canvas,
    hits,
    tune: TUNE,
    start: 60,
    shape: ONE,
    active: () => false,
    labels: {
      note: (g) => `Note ${g + 1}`,
      gap: (g) => `Gap ${g + 1}`,
      bracket: (g) => `Bracket over gap ${g + 1}`,
    },
    onNote: (g) => pressed.push(`note ${g}`),
    onGap: (g) => pressed.push(`gap ${g}`),
    onBracket: (g) => pressed.push(`bracket ${g}`),
    ...over,
  })
  return { tune, hits, pressed }
}

const names = (hits: HTMLElement, kind: string): string[] =>
  Array.from(
    hits.querySelectorAll(`.tune-hit-${kind}`),
    (b) => b.getAttribute('aria-label') ?? '',
  )

const button = (hits: HTMLElement, selector: string): HTMLButtonElement => {
  const found = hits.querySelector<HTMLButtonElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

const box = (el: HTMLElement): number[] =>
  [el.style.left, el.style.top, el.style.width, el.style.height].map((v) =>
    Number.parseFloat(v),
  )

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('mountTuneLine: its buttons', () => {
  it('lays a named button over every bead and every gap the shape asks for', () => {
    // Arrange
    const { hits } = mount()

    // Act
    const beads = names(hits, 'note')
    const gaps = names(hits, 'gap')

    // Assert
    expect(beads).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `Note ${n}`))
    expect(gaps).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Gap ${n}`))
    expect(hits.hidden).toBe(false)
  })

  it("puts each button on its part's target in the layout", () => {
    // Arrange
    const { tune, hits } = mount()

    // Act
    const L = tune.layout

    // Assert
    expect(L).not.toBeNull()
    const bead = L?.lines[0].beads[2]
    const gap = L?.gaps[1].target
    expect(box(button(hits, '[data-note="2"]'))).toEqual([
      bead?.x,
      bead?.y,
      bead?.w,
      bead?.h,
    ])
    expect(box(button(hits, '[data-gap="1"]'))).toEqual([
      gap?.x,
      gap?.y,
      gap?.w,
      gap?.h,
    ])
  })

  it('hides its layer when the shape asks for no buttons', () => {
    // Arrange
    const quiet: TuneShape = {
      ...ONE,
      beadButtons: false,
      gapButtons: false,
    }

    // Act
    const { hits } = mount({ shape: quiet })

    // Assert
    expect(hits.children).toHaveLength(0)
    expect(hits.hidden).toBe(true)
  })

  it("numbers the second line's beads across the tune, so a tap names the note it hit", () => {
    // Arrange
    const { tune, hits, pressed } = mount()
    tune.setShape({ ...ONE, lines: [0, 1], window: null })

    // Act
    button(hits, '[data-note="7"]').click()

    // Assert
    expect(names(hits, 'note')).toHaveLength(14)
    expect(pressed).toEqual(['note 7'])
  })

  it('tells the page which gap was pressed, by its number across the tune', () => {
    // Arrange
    const { hits, pressed } = mount()

    // Act
    button(hits, '[data-gap="3"]').click()

    // Assert
    expect(pressed).toEqual(['gap 3'])
  })

  it('lays a button over each named bracket, and reports it by its gap', () => {
    // Arrange
    const { hits, pressed } = mount({
      shape: {
        ...ONE,
        beadButtons: false,
        gapButtons: false,
        brackets: [{ gap: 1, label: 'P5' }],
      },
    })

    // Act
    button(hits, '[data-bracket="1"]').click()

    // Assert
    expect(names(hits, 'bracket')).toEqual(['Bracket over gap 2'])
    expect(pressed).toEqual(['bracket 1'])
  })

  it('renames every button when asked, once the words have changed', () => {
    // Arrange
    let letter = 'C'
    const { tune, hits } = mount({
      labels: {
        note: (g) => `Note ${g + 1}, from ${letter}`,
        gap: (g) => `Gap ${g + 1}`,
        bracket: (g) => `Bracket ${g + 1}`,
      },
    })
    letter = 'D'

    // Act
    tune.relabel()

    // Assert
    expect(names(hits, 'note')[0]).toBe('Note 1, from D')
  })
})

describe('mountTuneLine: a grid', () => {
  /** Both lines stacked, every bead and gap a button, as one grid (Lesson 6's Step 2). */
  const GRID: TuneShape = { ...ONE, lines: [0, 1], window: null, grid: true }

  const rowNames = (hits: HTMLElement): string[][] =>
    Array.from(hits.querySelectorAll('[role="row"]'), (row) =>
      Array.from(
        row.querySelectorAll('[role="gridcell"] > .tune-hit'),
        (b) => b.getAttribute('aria-label') ?? '',
      ),
    )

  const tabStops = (hits: HTMLElement): string[] =>
    Array.from(
      hits.querySelectorAll('.tune-hit[tabindex="0"]'),
      (b) => b.getAttribute('aria-label') ?? '',
    )

  /** A key pressed on whatever has the focus. */
  const press = (key: string, ctrlKey = false): string => {
    const at = document.activeElement
    at?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        ctrlKey,
        bubbles: true,
        cancelable: true,
      }),
    )
    return document.activeElement?.getAttribute('aria-label') ?? ''
  }

  it("lays a row for each line's beads and one for its gaps, the join in line 1's, every name as before", () => {
    // Arrange
    const { hits } = mount({ shape: GRID })

    // Act
    const rows = rowNames(hits)

    // Assert
    expect(hits.getAttribute('role')).toBe('grid')
    const n = (from: number, to: number, kind: string): string[] =>
      Array.from({ length: to - from + 1 }, (_, i) => `${kind} ${from + i}`)
    expect(rows).toEqual([
      n(1, 7, 'Note'),
      n(1, 7, 'Gap'),
      n(8, 14, 'Note'),
      n(8, 13, 'Gap'),
    ])
  })

  it('is one Tab stop, on the first bead before any focus, then on the button last focused', () => {
    // Arrange
    const { tune, hits } = mount({ shape: GRID })
    const before = tabStops(hits)

    // Act: a gap takes the focus, then the shape is drawn again
    button(hits, '[data-gap="3"]').focus()
    const after = tabStops(hits)
    tune.setShape({ ...GRID })

    // Assert
    expect(before).toEqual(['Note 1'])
    expect(after).toEqual(['Gap 4'])
    expect(tabStops(hits)).toEqual(['Gap 4'])
    expect(hits.querySelectorAll('.tune-hit[tabindex="-1"]')).toHaveLength(26)
  })

  it('moves the focus by the arrows, a row at a time down a column, and by Home and End', () => {
    // Arrange
    const { hits } = mount({ shape: GRID })
    button(hits, '[data-note="0"]').focus()

    // Act
    const met = [
      press('ArrowRight'),
      press('End'),
      press('ArrowRight'),
      press('ArrowDown'),
      press('ArrowDown'),
      press('ArrowDown'),
      press('ArrowDown'),
      press('Home'),
      press('ArrowLeft'),
      press('ArrowUp'),
      press('End', true),
      press('Home', true),
      press('ArrowUp'),
    ]

    // Assert: the shorter last row takes its last cell; the edges hold
    expect(met).toEqual([
      'Note 2',
      'Note 7',
      'Note 7',
      'Gap 7',
      'Note 14',
      'Gap 13',
      'Gap 13',
      'Gap 8',
      'Gap 8',
      'Note 8',
      'Gap 13',
      'Note 1',
      'Note 1',
    ])
    expect(tabStops(hits)).toEqual(['Note 1'])
  })

  it('leaves Enter, Space and every other key to the button, which still presses', () => {
    // Arrange
    const { hits, pressed } = mount({ shape: GRID })
    const gap = button(hits, '[data-gap="1"]')
    gap.focus()
    const key = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })

    // Act
    gap.dispatchEvent(key)
    gap.click()

    // Assert
    expect(key.defaultPrevented).toBe(false)
    expect(pressed).toEqual(['gap 1'])
  })

  it('goes back to a Tab stop each, and the layer to its own role, on a shape with no grid', () => {
    // Arrange
    const { tune, hits } = mount({ shape: GRID })

    // Act
    tune.setShape(ONE)

    // Assert
    expect(hits.getAttribute('role')).toBeNull()
    expect(hits.querySelectorAll('[role="row"]')).toHaveLength(0)
    expect(hits.querySelectorAll('.tune-hit[tabindex]')).toHaveLength(0)
    expect(Array.from(hits.children).every((c) => c.matches('.tune-hit'))).toBe(
      true,
    )
  })
})

describe('gridMove', () => {
  const ROWS = [7, 7, 7, 6]

  it('steps along a row, holding at its ends', () => {
    expect(gridMove(ROWS, { row: 0, col: 3 }, 'ArrowRight')).toEqual({
      row: 0,
      col: 4,
    })
    expect(gridMove(ROWS, { row: 0, col: 6 }, 'ArrowRight')).toEqual({
      row: 0,
      col: 6,
    })
    expect(gridMove(ROWS, { row: 1, col: 0 }, 'ArrowLeft')).toEqual({
      row: 1,
      col: 0,
    })
  })

  it('moves up and down a column, onto the last cell of a shorter row, holding at the top and bottom', () => {
    expect(gridMove(ROWS, { row: 2, col: 6 }, 'ArrowDown')).toEqual({
      row: 3,
      col: 5,
    })
    expect(gridMove(ROWS, { row: 3, col: 5 }, 'ArrowDown')).toEqual({
      row: 3,
      col: 5,
    })
    expect(gridMove(ROWS, { row: 0, col: 2 }, 'ArrowUp')).toEqual({
      row: 0,
      col: 2,
    })
  })

  it("goes to a row's ends by Home and End, and to the grid's with Control", () => {
    expect(gridMove(ROWS, { row: 3, col: 2 }, 'Home')).toEqual({
      row: 3,
      col: 0,
    })
    expect(gridMove(ROWS, { row: 1, col: 2 }, 'End')).toEqual({
      row: 1,
      col: 6,
    })
    expect(gridMove(ROWS, { row: 1, col: 2 }, 'Home', true)).toEqual({
      row: 0,
      col: 0,
    })
    expect(gridMove(ROWS, { row: 1, col: 2 }, 'End', true)).toEqual({
      row: 3,
      col: 5,
    })
  })

  it('leaves every other key alone', () => {
    expect(gridMove(ROWS, { row: 0, col: 0 }, 'Enter')).toBeNull()
    expect(gridMove(ROWS, { row: 0, col: 0 }, ' ')).toBeNull()
    expect(gridMove(ROWS, { row: 0, col: 0 }, 'ArrowDown', true)).toBeNull()
  })
})

describe('mountTuneLine: its start', () => {
  it('lands a new start at once under reduced motion, and says it took no time', () => {
    // Arrange
    const { tune } = mount()

    // Act
    const took = tune.setStart(66)

    // Assert
    expect(took).toBe(0)
    expect(tune.start).toBe(66)
  })

  it('rounds a start to the nearest semitone row', () => {
    // Arrange
    const { tune } = mount()

    // Act
    tune.setStart(61.6)

    // Assert
    expect(tune.start).toBe(62)
  })
})

describe('mountTuneLine: a played run', () => {
  const EVENTS = [
    { midi: 60, at: 0, dur: 0.5 },
    { midi: 60, at: 0.5, dur: 0.5 },
    { midi: 67, at: 1, dur: 1 },
  ]

  it('announces each note at its onset and settles when the last one ends, played to its end', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { tune } = mount()
    const heard: number[] = []
    let settled: boolean | null = null
    const run = tune
      .play(EVENTS, false, { onNote: (e) => heard.push(e.midi) })
      .then((finished) => {
        settled = finished
      })
    vi.advanceTimersByTime(999)
    await Promise.resolve()
    const early = { heard: [...heard], busy: tune.busy, settled }

    // Act
    vi.advanceTimersByTime(1001)
    await run

    // Assert
    expect(early).toEqual({ heard: [60, 60], busy: true, settled: null })
    expect(heard).toEqual([60, 60, 67])
    expect(tune.busy).toBe(false)
    expect(settled).toBe(true)
  })

  it('stops a run in flight: it settles at once, cut short, and announces nothing more', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { tune } = mount()
    const heard: number[] = []
    const run = tune.play(EVENTS, false, {
      onNote: (e) => heard.push(e.midi),
    })
    vi.advanceTimersByTime(600)

    // Act
    tune.stop()
    const finished = await run
    vi.advanceTimersByTime(5000)

    // Assert
    expect(finished).toBe(false)
    expect(heard).toEqual([60, 60])
    expect(tune.busy).toBe(false)
  })

  it('cuts a run short when a new one starts, and plays the new one to its end', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { tune } = mount()
    const first = tune.play(EVENTS, false)
    vi.advanceTimersByTime(600)

    // Act
    const second = tune.play(EVENTS, false)
    vi.advanceTimersByTime(2000)

    // Assert
    expect(await first).toBe(false)
    expect(await second).toBe(true)
  })
})

describe('mountTuneLine: its voices', () => {
  const EVENTS = [
    { midi: 60, at: 0, dur: 0.5 },
    { midi: 60, at: 0.5, dur: 0.5 },
    { midi: 67, at: 1, dur: 1 },
  ]

  /** Sound on: every voice the line starts from now on, its note, and whether it was stopped. */
  function listen(): { midi: number; stopped: boolean }[] {
    const started: { midi: number; stopped: boolean }[] = []
    vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
      const v = {
        midi: Math.round(69 + 12 * Math.log2(freq / 440)),
        stopped: false,
      }
      started.push(v)
      const voice: Voice = {
        alive: true,
        setFreq: () => undefined,
        setGain: () => undefined,
        stop: () => {
          v.stopped = true
        },
      }
      return voice
    })
    return started
  }

  it('stops its voices when the run is stopped, and starts no more', () => {
    // Arrange: a run with sound, its second note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const started = listen()
    const { tune } = mount()
    void tune.play(EVENTS, true)
    vi.advanceTimersByTime(600)

    // Act
    tune.stop()
    vi.advanceTimersByTime(5000)

    // Assert
    expect(started).toEqual([
      { midi: 60, stopped: true },
      { midi: 60, stopped: true },
    ])
  })

  it("stops a run's voices when a new run starts, and leaves the new run's voices whole", () => {
    // Arrange: a run with sound, its second note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const started = listen()
    const { tune } = mount()
    void tune.play(EVENTS, true)
    vi.advanceTimersByTime(600)

    // Act
    void tune.play(EVENTS, true)
    vi.advanceTimersByTime(5000)

    // Assert: the first run's two stopped, then the new run's three, played out
    expect(started.map((v) => v.stopped)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
    expect(started.map((v) => v.midi)).toEqual([60, 60, 60, 60, 67])
  })
})

describe('mountTuneLine: its frames', () => {
  const EVENTS = [
    { midi: 60, at: 0, dur: 0.5 },
    { midi: 60, at: 0.5, dur: 0.5 },
    { midi: 67, at: 1, dur: 1 },
  ]

  it('asks for no frame once it has drawn, and for every frame of a run until its last light has gone', () => {
    // Arrange: the page's frame loop on a clock the test turns, and a line on screen
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'performance'],
    })
    const asked: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) =>
      asked.push(cb),
    )
    const { tune } = mount({ active: () => true })
    startFrameLoop()
    /** Runs the frame asked for, 16 ms on; false when none was asked for. */
    const frame = (): boolean => {
      const next = asked.shift()
      if (next === undefined) return false
      vi.advanceTimersByTime(16)
      next(performance.now())
      return true
    }
    const painted = frame()
    const idle = asked.length

    // Act
    void tune.play(EVENTS, false)
    const onPlay = asked.length
    let moving = 0
    while (moving < 1000 && frame()) moving += 1

    // Assert: the first paint, then none until the run; 2 s of notes and the last light's fade, then none
    expect(painted).toBe(true)
    expect(idle).toBe(0)
    expect(onPlay).toBe(1)
    expect(moving * 16).toBeGreaterThanOrEqual(2000)
    expect(moving).toBeLessThan(1000)
    expect(asked).toHaveLength(0)
  })
})
