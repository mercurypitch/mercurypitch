// Compiled-tab tests pin static score identity, authored truth, and temporal windows.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarNoteNotation } from '@/lib/guitar/guitar-notation'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { buildTabScene } from './build-tab-scene'
import { compileTabNotes, matchingTabNoteAtPlayhead, nextTabEvent, visibleTabEvents, visibleTabNotes, } from './compile-tab-notes'

function note(overrides: Partial<GuitarNote> = {}): GuitarNote {
  return {
    id: 'note-1',
    midi: 64,
    noteName: 'E4',
    stringIndex: 0,
    fret: 0,
    startBeat: 0,
    duration: 1,
    targetFreq: 329.63,
    ...overrides,
  }
}

function scene(notes: readonly GuitarNote[], playheadBeat: number) {
  return buildTabScene({
    notes,
    playheadBeat,
    visibleBeatWindow: 4,
    showNoteLabels: true,
    showFretboard: true,
  })
}

describe('compileTabNotes', () => {
  it('reuses one compiled score for the same immutable source identity', () => {
    const source = Object.freeze([note()])
    const first = compileTabNotes(source)
    const second = compileTabNotes(source)
    const equivalentCopy = compileTabNotes([...source])

    expect(second).toBe(first)
    expect(second.notes).toBe(first.notes)
    expect(second.events).toBe(first.events)
    expect(second.noteById).toBe(first.noteById)
    expect(equivalentCopy).not.toBe(first)
  })

  it('groups simultaneous authored notes without inventing chord truth', () => {
    const chordNotation = {
      chordLabel: 'Cmaj7',
      techniques: [{ kind: 'let-ring' as const }],
    } satisfies GuitarNoteNotation
    const source = [
      note({
        id: 'chord-root',
        midi: 48,
        stringIndex: 4,
        fret: 3,
        startBeat: 4,
        duration: 2,
        notation: chordNotation,
      }),
      note({
        id: 'chord-third',
        midi: 52,
        stringIndex: 3,
        fret: 2,
        startBeat: 4.01,
        duration: 1,
      }),
      note({
        id: 'unlabelled-double-stop-a',
        midi: 57,
        stringIndex: 2,
        fret: 2,
        startBeat: 8,
      }),
      note({
        id: 'unlabelled-double-stop-b',
        midi: 61,
        stringIndex: 1,
        fret: 2,
        startBeat: 8,
      }),
      note({
        id: 'backing-chord',
        isBacking: true,
        startBeat: 4,
        notation: { chordLabel: 'Not a target' },
      }),
    ]

    const compiled = compileTabNotes(source)

    expect(compiled.notes).toHaveLength(5)
    expect(compiled.events).toHaveLength(2)
    expect(compiled.events[0]).toMatchObject({
      startBeat: 4,
      endBeat: 6,
      chordLabel: 'Cmaj7',
    })
    expect(compiled.events[0].notes.map((item) => item.id)).toEqual([
      'chord-root',
      'chord-third',
    ])
    expect(compiled.events[1].notes.map((item) => item.id)).toEqual([
      'unlabelled-double-stop-a',
      'unlabelled-double-stop-b',
    ])
    expect(compiled.events[1].chordLabel).toBeUndefined()
    expect(compiled.noteById.get('backing-chord')?.isBacking).toBe(true)
  })

  it('passes authored notation through by identity', () => {
    const notation = {
      chordLabel: 'A7',
      techniques: [
        {
          kind: 'bend' as const,
          bendType: 'bend' as const,
          semitones: 1,
          points: [
            { at: 0, semitones: 0 },
            { at: 1, semitones: 1 },
          ],
        },
        {
          kind: 'slide' as const,
          slideType: 'legato' as const,
          toFret: 7,
          toNoteId: 'target',
        },
      ],
    } satisfies GuitarNoteNotation
    const compiled = compileTabNotes([
      note({ id: 'origin', notation }),
      note({ id: 'target', fret: 7, startBeat: 1 }),
    ])

    expect(compiled.notes[0].notation).toBe(notation)
    expect(compiled.notes[0].notation?.techniques).toBe(notation.techniques)
    expect(compiled.events[0].chordLabel).toBe('A7')
  })

  it('groups close authored attacks even when they cross a clock bucket boundary', () => {
    const compiled = compileTabNotes([
      note({ id: 'before-boundary', startBeat: 4.031 }),
      note({ id: 'after-boundary', startBeat: 4.065, stringIndex: 1 }),
    ])

    expect(compiled.events).toHaveLength(1)
    expect(compiled.events[0].notes.map((item) => item.id)).toEqual([
      'before-boundary',
      'after-boundary',
    ])
  })

  it('binary-searches a sorted temporal slice including crossing sustains', () => {
    const score = [
      ...Array.from({ length: 20 }, (_, index) =>
        note({
          id: `n-${19 - index}`,
          startBeat: 19 - index,
          midi: 64 + ((19 - index) % 5),
        }),
      ),
      note({ id: 'crossing-sustain', startBeat: 5, duration: 5 }),
    ]
    const atTen = scene(score, 10)

    expect(visibleTabNotes(atTen).map((item) => item.id)).toEqual([
      'crossing-sustain',
      'n-9',
      'n-10',
      'n-11',
      'n-12',
      'n-13',
      'n-14',
    ])
    expect(visibleTabEvents(atTen).map((event) => event.notes[0]?.id)).toEqual([
      'n-10',
      'n-11',
      'n-12',
      'n-13',
      'n-14',
    ])
    expect(nextTabEvent(atTen)?.notes[0]?.id).toBe('n-10')
  })

  it('matches detected pitch near a late playhead without rescanning the score', () => {
    const compiled = compileTabNotes(
      Array.from({ length: 10_000 }, (_, index) =>
        note({
          id: `long-${index}`,
          midi: 60 + (index % 12),
          startBeat: index,
          duration: 0.5,
        }),
      ),
    )
    let indexedReads = 0
    const notes = new Proxy(compiled.notes, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          indexedReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })

    const matched = matchingTabNoteAtPlayhead(
      { ...compiled, notes },
      9_995,
      60 + (9_995 % 12),
    )

    expect(matched?.id).toBe('long-9995')
    expect(indexedReads).toBeLessThan(40)
  })

  it('skips expired regions even when an early sustain crosses the whole score', () => {
    const score = [
      note({
        id: 'whole-score-sustain',
        midi: 71,
        startBeat: 0,
        duration: 10_000,
      }),
      ...Array.from({ length: 10_000 }, (_, index) =>
        note({
          id: `short-${index}`,
          midi: 60 + (index % 12),
          startBeat: index,
          duration: 0.25,
        }),
      ),
    ]
    const compiled = compileTabNotes(score)
    let indexedReads = 0
    const notes = new Proxy(compiled.notes, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          indexedReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const lateScene = {
      ...scene(score, 9_500),
      notes,
    }

    expect(visibleTabNotes(lateScene).map((item) => item.id)).toEqual([
      'whole-score-sustain',
      'short-9500',
      'short-9501',
      'short-9502',
      'short-9503',
      'short-9504',
    ])
    expect(indexedReads).toBeLessThan(100)

    indexedReads = 0
    expect(
      matchingTabNoteAtPlayhead(
        { ...compiled, notes },
        9_500,
        60 + (9_500 % 12),
      )?.id,
    ).toBe('short-9500')
    expect(indexedReads).toBeLessThan(100)
  })
})
