// Where the canvas draws a pitch, top to bottom.
//
// The Sing room draws its line on this canvas, over a photograph. On a phone
// on its side the canvas is 117 px tall, and the stage's bands (34 px above
// the view for its status chip, 78 under it for its control bar) left five of
// them for the whole range: the line was one flat row (device round 5). The
// room has neither overlay on the canvas, so a short canvas there gives the
// view the height instead. Upright, and on the stage, nothing moves.

import { render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PitchCanvas } from '@/components/PitchCanvas'
import { buildMultiOctaveScale, gridRowsForBounds } from '@/lib/scale-data'
import type { PitchSample } from '@/types'

vi.mock('@/lib/audio-engine', () => ({
  AudioEngine: class {
    init(): Promise<void> {
      return Promise.resolve()
    }
    destroy(): void {}
  },
}))

/** The free run's rows for the default range: C major, C3 up three octaves. */
const SCALE = buildMultiOctaveScale('C', 3, 3, 'major')
const MIDIS = SCALE.map((note) => note.midi)
/** The view the canvas fits to them: two semitones of air at each end. */
const VIEW = { min: Math.min(...MIDIS) - 2, max: Math.max(...MIDIS) + 2 }
const ROWS = gridRowsForBounds(SCALE, VIEW.min, VIEW.max)

/** The stage's mapping, as it always was: 34 px above the view, 78 under. */
const stageY = (midi: number, h: number): number =>
  h - 78 - ((midi - VIEW.min) / (VIEW.max - VIEW.min)) * (h - 34 - 78)

const A3 = 57
const A5 = 81
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)
/** Half a second held on one note: the head of the line sits on it. */
const held = (midi: number): PitchSample[] => [
  { time: 0, freq: hz(midi), cents: 0 },
  { time: 0.5, freq: hz(midi), cents: 0 },
]

/** A 2D context that keeps where the heads and the row labels went. */
function recordingContext() {
  const heads: number[] = []
  const labels: number[] = []
  const known: Record<string | symbol, unknown> = {
    arc: (_x: number, y: number, r: number) => {
      // The head's core: radius 5 (its halo is 12, its pip 2).
      if (r === 5) heads.push(y)
    },
    fillText: (text: string, _x: number, y: number) => {
      if (/^[A-G][#b]?\d$/u.test(text)) labels.push(y)
    },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getLineDash: () => [],
  }
  const ctx = new Proxy(known, {
    get: (target, key) =>
      key in target ? target[key] : key === 'then' ? undefined : () => {},
    set: (target, key, value) => {
      target[key] = value
      return true
    },
  })
  return { ctx, heads, labels }
}

let height = 0
let drawn = recordingContext()

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(750)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => height,
  )
  drawn = recordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    id: string,
  ) =>
    id === '2d'
      ? (drawn.ctx as unknown as CanvasRenderingContext2D)
      : null) as typeof HTMLCanvasElement.prototype.getContext)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The canvas as the Sing room builds it, `h` px tall; `room` off is the stage. */
function mount(h: number, room = true) {
  height = h
  const [history, setHistory] = createSignal<PitchSample[]>(held(A3))
  const view = render(() => (
    <PitchCanvas
      melody={() => []}
      scale={() => SCALE}
      totalBeats={() => 17}
      currentBeat={() => 1}
      pitchHistory={history}
      currentNoteIndex={() => -1}
      isPlaying={() => false}
      isPaused={() => false}
      isScrolling={() => true}
      transparent={() => room}
      traceStyle={() => 'spectrum'}
      targetStyle={() => 'line'}
    />
  ))
  /** Where the head of the line is drawn when the voice holds `midi`. */
  const headY = (midi: number): number => {
    drawn.heads.length = 0
    setHistory(held(midi))
    const y = drawn.heads.at(-1)
    if (y === undefined) throw new Error('no head drawn')
    return y
  }
  /** Where the row labels went on the last frame, top to bottom. */
  const labelYs = (): number[] => {
    drawn.labels.length = 0
    setHistory(held(A5))
    return [...drawn.labels].sort((a, b) => a - b)
  }
  return { headY, labelYs, unmount: view.unmount }
}

describe('a pitch on a short room canvas (a phone on its side)', () => {
  it('moves over most of its height: two octaves take more than 40% of 117 px', () => {
    const canvas = mount(117)
    const travel = canvas.headY(A3) - canvas.headY(A5)
    expect(travel).toBeGreaterThan(0.4 * 117)
    canvas.unmount()
  })

  it('stays inside the canvas at both ends of the view', () => {
    const canvas = mount(117)
    const top = canvas.headY(VIEW.max)
    const bottom = canvas.headY(VIEW.min)
    // Room above for the top row's label, below for the head's core.
    expect(top).toBeGreaterThanOrEqual(12)
    expect(bottom).toBeLessThanOrEqual(117 - 5)
    canvas.unmount()
  })

  it('labels its rows no closer than 12 px, so none sits on another', () => {
    const canvas = mount(117)
    const ys = canvas.labelYs()
    expect(ys.length).toBeGreaterThanOrEqual(3)
    const gaps = ys.slice(1).map((y, i) => y - ys[i])
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(12)
    canvas.unmount()
  })
})

describe('everywhere else, exactly as before', () => {
  it('upright (511 px), a pitch sits where the stage mapping puts it', () => {
    const canvas = mount(511)
    expect(canvas.headY(A3)).toBeCloseTo(stageY(A3, 511), 6)
    expect(canvas.headY(A5)).toBeCloseTo(stageY(A5, 511), 6)
    canvas.unmount()
  })

  it('upright (511 px), every row keeps its label', () => {
    const canvas = mount(511)
    expect(canvas.labelYs()).toHaveLength(ROWS.length)
    canvas.unmount()
  })

  it('the practice stage keeps its bands however short it is', () => {
    const canvas = mount(117, false)
    expect(canvas.headY(A3)).toBeCloseTo(stageY(A3, 117), 6)
    expect(canvas.headY(A5)).toBeCloseTo(stageY(A5, 117), 6)
    canvas.unmount()
  })
})
