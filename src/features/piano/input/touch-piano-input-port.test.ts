// ============================================================
// Touch piano input port tests — multi-pointer note ownership
// ============================================================

import { describe, expect, it } from 'vitest'
import { createPianoInputState } from './piano-input-state'
import { createTouchPianoInputPort } from './touch-piano-input-port'

describe('createTouchPianoInputPort', () => {
  it('keeps equal-pitch pointers independent and exposes the latest voice', () => {
    const input = createPianoInputState()
    const touch = createTouchPianoInputPort({
      input,
      sourceId: 'practice-keys',
    })

    touch.press(1, 60, 0.4, 10)
    touch.press(2, 60, 0.9, 20)

    expect(touch.activePointers()).toEqual([
      { pointerId: 1, midi: 60, velocity: 0.4 },
      { pointerId: 2, midi: 60, velocity: 0.9 },
    ])
    expect(input.snapshot().soundingNotes).toHaveLength(2)
    expect(input.snapshot().primaryNote).toMatchObject({
      midi: 60,
      velocity: 0.9,
      keyId: 'pointer:2',
    })

    touch.release(1, 30)
    expect(input.snapshot().soundingNotes).toHaveLength(1)
    expect(input.snapshot().soundingNotes[0].keyId).toBe('pointer:2')
  })

  it('moves one pointer with an ordered release then press', () => {
    const input = createPianoInputState()
    const touch = createTouchPianoInputPort({
      input,
      sourceId: 'practice-keys',
    })
    touch.press(7, 60, 0.8, 10)

    const updates = touch.move(7, 64, 0.5, 20)
    expect(updates).toHaveLength(2)
    expect(updates[0].event.type).toBe('note-off')
    expect(updates[0].soundingStopped.map((note) => note.midi)).toEqual([60])
    expect(updates[1].event.type).toBe('note-on')
    expect(updates[1].soundingStarted.map((note) => note.midi)).toEqual([64])
    expect(input.snapshot().primaryNote?.midi).toBe(64)
  })

  it('normalizes its own pointer state and ignores duplicate or orphan moves', () => {
    const input = createPianoInputState()
    const touch = createTouchPianoInputPort({
      input,
      sourceId: 'practice-keys',
    })

    expect(touch.move(3, 60)).toEqual([])
    expect(touch.press(3, 200, 2)).toHaveLength(1)
    expect(touch.activePointers()).toEqual([
      { pointerId: 3, midi: 127, velocity: 1 },
    ])
    expect(touch.press(3, 127, 0.2)).toEqual([])
    expect(input.snapshot().soundingNotes).toHaveLength(1)
  })

  it('maps cancel to release and releaseAll to an immediate scoped panic', () => {
    const input = createPianoInputState()
    const touch = createTouchPianoInputPort({
      input,
      sourceId: 'practice-keys',
    })
    touch.press(1, 60)
    touch.press(2, 64)

    const cancelled = touch.cancel(1, 10)
    expect(cancelled[0].soundingStopped.map((note) => note.midi)).toEqual([60])
    const released = touch.releaseAll(20)
    expect(released[0].event.type).toBe('panic')
    expect(released[0].soundingStopped.map((note) => note.midi)).toEqual([64])
    expect(touch.activePointers()).toEqual([])
    expect(input.snapshot().soundingNotes).toEqual([])
  })

  it('uses one injected timestamp and disposes without leaving a voice', () => {
    const input = createPianoInputState()
    let timestampMs = 40
    const touch = createTouchPianoInputPort({
      input,
      sourceId: 'practice-keys',
      now: () => timestampMs,
    })

    const press = touch.press(1, 60)
    expect(press[0].event.timestampMs).toBe(40)
    timestampMs = 80
    touch.dispose()
    expect(input.snapshot().soundingNotes).toEqual([])
    expect(touch.press(2, 64)).toEqual([])
  })
})
