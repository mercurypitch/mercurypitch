import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoRollEditor } from '../lib/piano-roll'

describe('PianoRollEditor', () => {
  let container: HTMLElement
  let editor: PianoRollEditor

  beforeEach(() => {
    // Mock canvas context for jsdom
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      setTransform: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      roundRect: vi.fn(),
      rect: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    container = document.createElement('div')
    document.body.appendChild(container)
    editor = new PianoRollEditor({
      container,
      scale: [],
      bpm: 120,
      totalBeats: 16,
    })
  })

  it('initializes correctly', () => {
    expect(editor).toBeDefined()
    expect(editor.getMelody()).toEqual([])
  })

  it('sets and gets melody correctly', () => {
    const melody = [
      {
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C' as const, octave: 4 },
        startBeat: 0,
        duration: 1,
      },
    ]
    editor.setMelody(melody)
    expect(editor.getMelody()).toHaveLength(1)
    expect(editor.getMelody()[0].note?.midi).toBe(60)
  })

  it('shifts octave and transposes notes', () => {
    const melody = [
      {
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C' as const, octave: 4 },
        startBeat: 0,
        duration: 1,
      },
    ]
    editor.setMelody(melody)

    // Simulate octave up click
    const upBtn = container.querySelector(
      '#roll-octave-up',
    ) as HTMLButtonElement
    upBtn.click()

    const newMelody = editor.getMelody()
    expect(newMelody[0].note?.midi).toBe(72) // 60 + 12

    const octaveSpan = container.querySelector(
      '#roll-octave-value',
    ) as HTMLSpanElement
    expect(octaveSpan.textContent).toBe('5') // Assuming default is 4
  })

  it('changes duration on duration button click', () => {
    // 1/8 note is 0.5
    const durBtn = container.querySelector(
      'button[data-dur="0.5"]',
    ) as HTMLButtonElement
    durBtn.click()

    expect(durBtn.classList.contains('active')).toBe(true)
  })

  it('changes number of octaves displayed', () => {
    // initial should be 2
    const octavesSpan = container.querySelector(
      '#roll-octaves-value',
    ) as HTMLSpanElement
    expect(octavesSpan.textContent).toBe('2')

    const plusBtn = container.querySelector(
      '#roll-octaves-plus',
    ) as HTMLButtonElement
    plusBtn.click()

    expect(octavesSpan.textContent).toBe('3')

    const minusBtn = container.querySelector(
      '#roll-octaves-minus',
    ) as HTMLButtonElement
    minusBtn.click()
    expect(octavesSpan.textContent).toBe('2')
    minusBtn.click()
    expect(octavesSpan.textContent).toBe('1')
  })

  it('handles undo and redo correctly', () => {
    const melody = [
      {
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C' as const, octave: 4 },
        startBeat: 0,
        duration: 1,
      },
    ]
    editor.setMelody(melody)

    expect(editor.canUndo()).toBe(false)
    expect(editor.canRedo()).toBe(false)

    // Simulate octave up click
    const upBtn = container.querySelector(
      '#roll-octave-up',
    ) as HTMLButtonElement
    upBtn.click()

    expect(editor.canUndo()).toBe(true)
    expect(editor.canRedo()).toBe(false)
    expect(editor.getMelody()[0].note?.midi).toBe(72)

    // Undo
    editor.undo()
    expect(editor.canUndo()).toBe(false)
    expect(editor.canRedo()).toBe(true)
    expect(editor.getMelody()[0].note?.midi).toBe(60)

    // Redo
    editor.redo()
    expect(editor.canUndo()).toBe(true)
    expect(editor.canRedo()).toBe(false)
    expect(editor.getMelody()[0].note?.midi).toBe(72)
  })

  describe('Note ID uniqueness', () => {
    it('setMelody regenerates IDs so external collisions cannot leak in', () => {
      // Simulate a MIDI import that always produces IDs starting from 1.
      // The editor must regenerate IDs so they never collide with existing
      // notes or across successive imports.
      editor.setMelody([
        {
          id: 1,
          note: { midi: 60, freq: 261.63, name: 'C' as const, octave: 4 },
          startBeat: 0,
          duration: 1,
        },
        {
          id: 1, // duplicate ID from a buggy source — must not matter
          note: { midi: 62, freq: 293.66, name: 'D' as const, octave: 4 },
          startBeat: 1,
          duration: 1,
        },
      ])

      const ids = editor.getMelody().map((n) => n.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
      // IDs should be regenerated starting from the editor's counter,
      // not from the incoming values.
      expect(ids[0]).not.toBe(ids[1])
    })

    it('successive setMelody calls never produce overlapping IDs', () => {
      // First melody
      editor.setMelody([
        {
          id: 99,
          note: { midi: 60, freq: 261.63, name: 'C' as const, octave: 4 },
          startBeat: 0,
          duration: 1,
        },
      ])
      const firstIds = editor.getMelody().map((n) => n.id)

      // Second melody (simulating loading a different song)
      editor.setMelody([
        {
          id: 99,
          note: { midi: 64, freq: 329.63, name: 'E' as const, octave: 4 },
          startBeat: 0,
          duration: 1,
        },
      ])
      const secondIds = editor.getMelody().map((n) => n.id)

      // No overlap between first and second melody IDs
      const allIds = new Set([...firstIds, ...secondIds])
      expect(allIds.size).toBe(firstIds.length + secondIds.length)
    })

    it('getMelody returns all unique IDs after setMelody', () => {
      editor.setMelody([
        {
          id: 5,
          note: { midi: 60, freq: 261.63, name: 'C' as const, octave: 4 },
          startBeat: 0,
          duration: 1,
        },
        {
          id: 10,
          note: { midi: 62, freq: 293.66, name: 'D' as const, octave: 4 },
          startBeat: 1,
          duration: 1,
        },
        {
          id: 7,
          note: { midi: 64, freq: 329.63, name: 'E' as const, octave: 4 },
          startBeat: 2,
          duration: 1,
        },
      ])

      const melody = editor.getMelody()
      const ids = melody.map((n) => n.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })
})
