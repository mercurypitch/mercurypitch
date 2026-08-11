// Canvas renderer tests keep authored notation legible without restoring costly effects.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarNoteNotation } from '@/lib/guitar/guitar-notation'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { buildTabScene } from '../build-tab-scene'
import { VELVET_DISPLAY } from '../TabRenderer'
import { bendAmountLabel, bendVisualMotion, Canvas2dTabRenderer, linkedTechniqueTargetFret, slideInSourceFret, slideMarkLabel, slideOutTargetFret, } from './Canvas2dTabRenderer'

function note(id: string, overrides: Partial<GuitarNote> = {}): GuitarNote {
  return {
    id,
    midi: 64,
    noteName: 'E4',
    stringIndex: 0,
    fret: 5,
    startBeat: 1,
    duration: 2,
    targetFreq: 329.63,
    ...overrides,
  }
}

function fakeCanvas() {
  const fillText = vi.fn()
  const setLineDash = vi.fn()
  const quadraticCurveTo = vi.fn()
  const compositeWrites: unknown[] = []
  const shadowBlurWrites: unknown[] = []
  const gradient = { addColorStop: vi.fn() }
  const target: Record<PropertyKey, unknown> = {
    arc: vi.fn(),
    arcTo: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText,
    lineTo: vi.fn(),
    measureText: vi.fn((label: string) => ({ width: label.length * 6 })),
    moveTo: vi.fn(),
    quadraticCurveTo,
    restore: vi.fn(),
    save: vi.fn(),
    setLineDash,
    setTransform: vi.fn(),
    stroke: vi.fn(),
    strokeText: vi.fn(),
  }
  const context = new Proxy(target, {
    set(object, property, value) {
      if (property === 'globalCompositeOperation') compositeWrites.push(value)
      if (property === 'shadowBlur') shadowBlurWrites.push(value)
      return Reflect.set(object, property, value)
    },
  }) as unknown as CanvasRenderingContext2D
  const canvas = {
    clientHeight: 600,
    clientWidth: 960,
    getContext: () => context,
    height: 0,
    width: 0,
  } as unknown as HTMLCanvasElement

  return {
    canvas,
    compositeWrites,
    fillText,
    quadraticCurveTo,
    setLineDash,
    shadowBlurWrites,
  }
}

describe('Canvas2dTabRenderer notation', () => {
  it('draws only source-authored chord and technique marks in reduced-effects mode', () => {
    const notation = {
      chordLabel: 'Am',
      techniques: [
        { kind: 'bend', bendType: 'bend', semitones: 2 },
        { kind: 'hammer-on', toFret: 7, toNoteId: 'target' },
        { kind: 'slide', slideType: 'legato', toFret: 7, toNoteId: 'target' },
        { kind: 'vibrato', width: 'slight' },
        { kind: 'palm-mute' },
        { kind: 'let-ring' },
      ],
    } satisfies GuitarNoteNotation
    const scene = buildTabScene({
      notes: [
        note('origin', { notation }),
        note('target', { fret: 7, midi: 66, startBeat: 2 }),
      ],
      playheadBeat: 0,
      visibleBeatWindow: 8,
      showNoteLabels: true,
      showFretboard: true,
      display: {
        ...VELVET_DISPLAY,
        motion: 'reduced',
        effects: 'reduced',
      },
    })
    const fake = fakeCanvas()
    const renderer = new Canvas2dTabRenderer()
    renderer.mount(fake.canvas)
    renderer.resize(960, 600, 3)

    renderer.render(scene)

    const labels = fake.fillText.mock.calls.map((call) => call[0])
    expect(labels).toEqual(
      expect.arrayContaining(['Am', 'full', 'H', 'SL', 'PM', 'LR']),
    )
    expect(fake.quadraticCurveTo).toHaveBeenCalled()
    expect(fake.setLineDash).toHaveBeenCalledWith([4, 4])
    expect(fake.compositeWrites).not.toContain('lighter')
    expect(fake.shadowBlurWrites).toHaveLength(0)
    expect(fake.canvas.width).toBe(1_920)
    expect(fake.canvas.height).toBe(1_200)
  })

  it('uses guitar bend names for semitone-based import values', () => {
    expect(bendAmountLabel(0.5)).toBe('¼')
    expect(bendAmountLabel(1)).toBe('½')
    expect(bendAmountLabel(2)).toBe('full')
    expect(bendAmountLabel(3)).toBe('3.0 st')
  })

  it('keeps authored bend motion instead of drawing every variant upward', () => {
    expect(bendVisualMotion('release')).toBe('down')
    expect(bendVisualMotion('bend-release')).toBe('up-down')
    expect(bendVisualMotion('hold')).toBe('hold')
    expect(bendVisualMotion('prebend-release')).toBe('down')
    expect(bendVisualMotion('prebend')).toBe('up')
  })

  it('follows a linked target after the score is re-placed for another tuning', () => {
    expect(linkedTechniqueTargetFret(7, 5)).toBe(5)
    expect(linkedTechniqueTargetFret(7, undefined)).toBe(7)
  })

  it('draws slide-ins from the authored pitch direction into the note', () => {
    expect(slideInSourceFret('into-from-below', 7, 24)).toBe(5)
    expect(slideInSourceFret('into-from-above', 7, 24)).toBe(9)
    expect(slideInSourceFret('legato', 7, 24)).toBeUndefined()
  })

  it('draws authored slide-outs in their pitch direction', () => {
    expect(slideOutTargetFret('out-up', 7, 24)).toBe(9)
    expect(slideOutTargetFret('out-down', 7, 24)).toBe(5)
    expect(slideOutTargetFret('pick-slide-up', 23, 24)).toBe(24)
    expect(slideOutTargetFret('pick-slide-down', 1, 24)).toBe(0)
    expect(slideOutTargetFret('shift', 7, 24)).toBeUndefined()
  })

  it('labels pick slides distinctly from ordinary slides', () => {
    expect(slideMarkLabel('out-up')).toBe('SL')
    expect(slideMarkLabel('pick-slide-up')).toBe('P.S.')
    expect(slideMarkLabel('pick-slide-down')).toBe('P.S.')
  })
})
