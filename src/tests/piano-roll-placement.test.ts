import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoRollEditor, snapPlacementBeat } from '../lib/piano-roll'
import { buildMultiOctaveScale } from '../lib/scale-data'

// PIANO_ROLL_CONFIG geometry the grid maps clicks with.
const BEAT_WIDTH = 48
const ROW_HEIGHT = 22

// These end-to-end tests dispatch real mouse events, which make the editor
// render to its canvas. Rather than enumerate every 2D-context method the draw
// path touches, back the context with a Proxy so any method is a safe no-op —
// otherwise a missing method (e.g. strokeRect) throws asynchronously during
// draw() and pollutes the run with unhandled errors.
function mockCanvasContext(): void {
  const makeCtx = (): CanvasRenderingContext2D => {
    const store: Record<string | symbol, unknown> = {}
    return new Proxy(store, {
      get(target, prop) {
        if (prop === 'then') return undefined // never look thenable
        if (prop in target) return target[prop]
        if (prop === 'measureText') return () => ({ width: 10 })
        if (prop === 'createLinearGradient')
          return () => ({ addColorStop: () => {} })
        if (typeof prop === 'symbol') return undefined
        return () => {} // every other context method is a no-op
      },
      set(target, prop, value) {
        target[prop] = value
        return true
      },
    }) as unknown as CanvasRenderingContext2D
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(() =>
    makeCtx(),
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

// EARS: docs/specs/compose-note-placement.ears.md
describe('snapPlacementBeat — placement quantization (PLACE-*)', () => {
  it('PLACE-1/PLACE-3: a 1-beat note placed at f=0.1/0.5/0.9 of a slot lands in that slot', () => {
    const slot = 2
    for (const f of [0.1, 0.5, 0.9]) {
      expect(snapPlacementBeat(slot + f, 1)).toBe(slot)
    }
  })

  it('PLACE-3: a click at or past the half mark does not advance to the next slot', () => {
    // Round-to-nearest used to push these up to beat 3 — the reported bug.
    expect(snapPlacementBeat(2.5, 1)).toBe(2)
    expect(snapPlacementBeat(2.99, 1)).toBe(2)
  })

  it('PLACE-4: a click exactly on a slot boundary places at that boundary', () => {
    expect(snapPlacementBeat(2.0, 1)).toBe(2)
    expect(snapPlacementBeat(3.0, 1)).toBe(3)
    expect(snapPlacementBeat(0, 1)).toBe(0)
  })

  it('PLACE-2: snap unit is a half-beat for short notes and a whole beat otherwise', () => {
    // Short note -> 0.5 grid: every fraction of the [2.5, 3.0) slot floors to 2.5.
    for (const f of [0.1, 0.5, 0.9]) {
      expect(snapPlacementBeat(2.5 + f * 0.5, 0.5)).toBe(2.5)
    }
    // A note >= 1 beat snaps to the whole-beat grid regardless of its length.
    expect(snapPlacementBeat(2.5, 1)).toBe(2)
    expect(snapPlacementBeat(2.5, 2)).toBe(2)
  })
})

describe('PianoRollEditor — click placement end-to-end (PLACE-*)', () => {
  let container: HTMLElement
  let editor: PianoRollEditor
  let grid: HTMLCanvasElement

  beforeEach(() => {
    mockCanvasContext()
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = new PianoRollEditor({
      container,
      scale: buildMultiOctaveScale('C', 4, 2, 'major'),
      bpm: 120,
      totalBeats: 16,
    })
    grid = container.querySelector('.roll-grid') as HTMLCanvasElement
    // jsdom returns a zeroed rect; pin it so clientX/clientY map to grid x/y 1:1.
    grid.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as HTMLCanvasElement['getBoundingClientRect']
  })

  function mouse(type: string, clientX: number, clientY: number): void {
    grid.dispatchEvent(
      new MouseEvent(type, { clientX, clientY, bubbles: true }),
    )
  }

  // A click = mousedown + mouseup at the same spot (no drag between them).
  function clickAtBeat(beat: number, clientY: number): void {
    const clientX = beat * BEAT_WIDTH
    mouse('mousedown', clientX, clientY)
    mouse('mouseup', clientX, clientY)
  }

  it('PLACE-1/PLACE-3: clicking at f=0.1/0.5/0.9 of an empty quarter slot places the note in THAT slot', () => {
    // Default selectedDuration is 1 beat -> whole-beat slots (a 1/4-bar slot).
    for (const f of [0.1, 0.5, 0.9]) {
      editor.setMelody([])
      clickAtBeat(2 + f, ROW_HEIGHT / 2)
      const melody = editor.getMelody()
      expect(melody).toHaveLength(1)
      // Every fraction lands in slot 2 — never the next slot (3).
      expect(melody[0].startBeat).toBe(2)
    }
  })

  it('PLACE-4: a boundary click lands on the boundary slot, not the previous one', () => {
    editor.setMelody([])
    clickAtBeat(2.0, ROW_HEIGHT / 2)
    expect(editor.getMelody()[0].startBeat).toBe(2)

    editor.setMelody([])
    clickAtBeat(3.0, ROW_HEIGHT / 2)
    expect(editor.getMelody()[0].startBeat).toBe(3)
  })

  it('PLACE-5: drag-move still rounds to the nearest slot (placement floor did not leak into drag)', () => {
    const rowY = ROW_HEIGHT / 2
    editor.setMelody([])
    clickAtBeat(2.5, rowY) // places a 1-beat note at slot 2
    expect(editor.getMelody()[0].startBeat).toBe(2)

    // Grab the note body and drag it right by ~0.6 beats. Round-to-nearest
    // advances it a full beat (to 3); a floor would have left it at 2.
    const noteBodyX = 2 * BEAT_WIDTH + 20 // beat ~2.42, clear of both edges
    mouse('mousedown', noteBodyX, rowY)
    mouse('mousemove', noteBodyX + 0.6 * BEAT_WIDTH, rowY)
    mouse('mouseup', noteBodyX + 0.6 * BEAT_WIDTH, rowY)

    expect(editor.getMelody()[0].startBeat).toBe(3)
  })
})
