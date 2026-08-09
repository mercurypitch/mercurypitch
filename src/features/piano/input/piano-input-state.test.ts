// ============================================================
// Piano input state tests — polyphony and pedal lifetimes
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PianoInputEvent, PianoInputSource } from './piano-input-state'
import { createPianoInputState } from './piano-input-state'

const keyboard: PianoInputSource = {
  kind: 'midi',
  id: 'keyboard-a',
  name: 'Stage Keyboard',
}
const secondKeyboard: PianoInputSource = {
  kind: 'midi',
  id: 'keyboard-b',
}
const touchSurface: PianoInputSource = {
  kind: 'touch',
  id: 'main-keys',
}

function noteOn(
  source: PianoInputSource,
  midi: number,
  timestampMs: number,
  keyId?: string,
): PianoInputEvent {
  return {
    type: 'note-on',
    source,
    channel: 0,
    midi,
    velocity: 0.75,
    timestampMs,
    ...(keyId === undefined ? {} : { keyId }),
  }
}

function noteOff(
  source: PianoInputSource,
  midi: number,
  timestampMs: number,
  keyId?: string,
): PianoInputEvent {
  return {
    type: 'note-off',
    source,
    channel: 0,
    midi,
    velocity: 0.25,
    timestampMs,
    ...(keyId === undefined ? {} : { keyId }),
  }
}

function pedal(
  pedalKind: 'sustain' | 'sostenuto' | 'soft',
  value: number,
  timestampMs: number,
): PianoInputEvent {
  return {
    type: 'pedal',
    source: keyboard,
    channel: 0,
    pedal: pedalKind,
    value,
    timestampMs,
  }
}

describe('createPianoInputState', () => {
  it('normalizes MIDI and touch voices without collapsing equal pitches', () => {
    const input = createPianoInputState()
    input.apply(noteOn(keyboard, 60, 10))
    input.apply(noteOn(touchSurface, 60, 20, 'pointer:1'))
    input.apply(noteOn(touchSurface, 64, 30, 'pointer:2'))

    const snapshot = input.snapshot()
    expect(snapshot.soundingNotes).toHaveLength(3)
    expect(snapshot.pressedNotes).toHaveLength(3)
    expect(snapshot.soundingNotes.map((note) => note.source.kind)).toEqual([
      'midi',
      'touch',
      'touch',
    ])
    expect(snapshot.soundingNotes.map((note) => note.velocity)).toEqual([
      0.75, 0.75, 0.75,
    ])
    expect(snapshot.primaryNote?.midi).toBe(64)

    const update = input.apply(noteOff(keyboard, 60, 40))
    expect(update.soundingStopped).toHaveLength(1)
    expect(update.soundingStopped[0].source.kind).toBe('midi')
    expect(input.snapshot().soundingNotes.map((note) => note.midi)).toEqual([
      60, 64,
    ])
  })

  it('keeps released notes sounding until sustain rises', () => {
    const input = createPianoInputState()
    input.apply(noteOn(keyboard, 60, 1))
    input.apply(pedal('sustain', 1, 2))
    const release = input.apply(noteOff(keyboard, 60, 3))

    expect(release.soundingStopped).toEqual([])
    expect(release.snapshot.pressedNotes).toEqual([])
    expect(release.snapshot.soundingNotes[0]).toMatchObject({
      midi: 60,
      heldBySustain: true,
    })

    const pedalUp = input.apply(pedal('sustain', 0, 4))
    expect(pedalUp.soundingStopped.map((note) => note.midi)).toEqual([60])
    expect(pedalUp.snapshot.soundingNotes).toEqual([])
  })

  it('captures only notes already held when sostenuto goes down', () => {
    const input = createPianoInputState()
    input.apply(noteOn(keyboard, 60, 1))
    input.apply(pedal('sostenuto', 1, 2))
    input.apply(noteOn(keyboard, 64, 3))

    const capturedRelease = input.apply(noteOff(keyboard, 60, 4))
    const laterRelease = input.apply(noteOff(keyboard, 64, 5))
    expect(capturedRelease.soundingStopped).toEqual([])
    expect(laterRelease.soundingStopped.map((note) => note.midi)).toEqual([64])
    expect(input.snapshot().soundingNotes[0]).toMatchObject({
      midi: 60,
      heldBySostenuto: true,
    })

    input.apply(pedal('sustain', 1, 6))
    const sostenutoUp = input.apply(pedal('sostenuto', 0, 7))
    expect(sostenutoUp.soundingStopped).toEqual([])
    expect(input.snapshot().soundingNotes[0].heldBySustain).toBe(true)

    const sustainUp = input.apply(pedal('sustain', 0, 8))
    expect(sustainUp.soundingStopped.map((note) => note.midi)).toEqual([60])
  })

  it('records soft-pedal state on each new voice without changing note lifetime', () => {
    const input = createPianoInputState()
    input.apply(pedal('soft', 0.8, 1))
    input.apply(noteOn(keyboard, 60, 2))
    input.apply(pedal('soft', 0, 3))
    input.apply(noteOn(keyboard, 64, 4))

    expect(
      input.snapshot().soundingNotes.map((note) => note.softPedalValue),
    ).toEqual([0.8, 0])
  })

  it('distinguishes pedal-aware all-notes-off from immediate panic', () => {
    const input = createPianoInputState()
    input.apply(pedal('sustain', 1, 1))
    input.apply(noteOn(keyboard, 60, 2))
    input.apply(noteOn(keyboard, 64, 3))

    const allNotesOff = input.apply({
      type: 'all-notes-off',
      source: keyboard,
      channel: 0,
      timestampMs: 4,
    })
    expect(allNotesOff.snapshot.pressedNotes).toEqual([])
    expect(allNotesOff.snapshot.soundingNotes).toHaveLength(2)
    expect(allNotesOff.soundingStopped).toEqual([])

    const panic = input.apply({
      type: 'panic',
      source: keyboard,
      channel: 0,
      timestampMs: 5,
    })
    expect(panic.soundingStopped.map((note) => note.midi)).toEqual([60, 64])
    expect(panic.snapshot.soundingNotes).toEqual([])
    expect(panic.snapshot.pedals).toEqual([])
  })

  it('cleans up only the disconnected source and notifies subscribers once', () => {
    const input = createPianoInputState()
    const listener = vi.fn()
    const unsubscribe = input.subscribe(listener)
    input.apply(noteOn(keyboard, 60, 1))
    input.apply(noteOn(secondKeyboard, 64, 2))

    const disconnected = input.apply({
      type: 'source-disconnected',
      source: keyboard,
      timestampMs: 3,
    })
    expect(disconnected.soundingStopped.map((note) => note.midi)).toEqual([60])
    expect(
      disconnected.snapshot.soundingNotes.map((note) => note.midi),
    ).toEqual([64])
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    input.apply(noteOff(secondKeyboard, 64, 4))
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('survives a deterministic dense-chord and pedal soak without stuck voices', () => {
    const input = createPianoInputState()
    let timestampMs = 0

    for (let round = 0; round < 80; round += 1) {
      const pedalKind = round % 2 === 0 ? 'sustain' : 'sostenuto'
      for (let note = 36; note < 84; note += 1) {
        input.apply(noteOn(keyboard, note, timestampMs))
        timestampMs += 1
      }
      expect(input.snapshot().pressedNotes).toHaveLength(48)

      input.apply(pedal(pedalKind, 1, timestampMs))
      timestampMs += 1
      for (let note = 36; note < 84; note += 1) {
        input.apply(noteOff(keyboard, note, timestampMs))
        timestampMs += 1
      }
      expect(input.snapshot().soundingNotes).toHaveLength(48)

      input.apply(pedal(pedalKind, 0, timestampMs))
      timestampMs += 1
      expect(input.snapshot().soundingNotes).toHaveLength(0)
      expect(input.snapshot().pressedNotes).toHaveLength(0)
    }

    expect(input.snapshot()).toMatchObject({
      revision: 7_840,
      primaryNote: null,
    })
  })
})
