// Studio note roll keys tests — a press on the roll's keys' column sounds the key under it through the lane's sound and lights it, the roll naming the lit key; a mouse held down and slid up the column plays each key it reaches; a press on the grid or the ruler sounds no key; and the browser's menu never opens over the keys.
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { NoteKeyAudition } from './note-roll-keys'
import { NOTE_KEY_VELOCITY } from './note-roll-keys'
import { StudioNoteRoll } from './StudioNoteRoll'

// jsdom has no PointerEvent; without one the events lose button and clientX.
if (typeof window.PointerEvent === 'undefined')
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  } as unknown as typeof PointerEvent

beforeEach(() => {
  // jsdom draws nothing, lays nothing out and captures no pointer.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 900, 420),
  )
  const captured = new Set<number>()
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The fixture's keys clip in a roll 900 by 420, its keys sounding through a faked audition. */
async function renderRoll() {
  const fixture = studioMidiFixture()
  const played: number[] = []
  const audition: NoteKeyAudition = {
    prime: vi.fn(),
    play: vi.fn((pitch: number) => {
      played.push(pitch)
      return Promise.resolve(true)
    }),
    stop: vi.fn(),
  }
  render(() => (
    <StudioNoteRoll
      clip={fixture.clip}
      sequence={fixture.sequence}
      songTempoBpm={120}
      sound="piano"
      touch={false}
      compact={false}
      color="teal"
      transport={{
        playing: () => false,
        playheadFrame: () => 0,
        frameNow: () => 0,
      }}
      audition={audition}
    />
  ))
  const roll = await waitFor(() => {
    const found = document.querySelector('[data-studio-note-roll]')
    expect(found).toHaveAttribute('data-studio-note-roll')
    return found!
  })
  const [, , minMidi, maxMidi] = roll
    .getAttribute('data-studio-note-roll')!
    .split(':')
    .map(Number)
  // The grid under a ruler 26 px tall, 318 px down to the velocity lane.
  const rowHeight = 318 / (maxMidi - minMidi + 1)
  return {
    roll,
    canvas: roll.querySelector('canvas[role="img"]')!,
    audition,
    played,
    /** The middle of `pitch`'s row on the page. */
    y: (pitch: number) => 26 + (maxMidi + 1 - pitch - 0.5) * rowHeight,
  }
}

const at = (clientX: number, clientY: number) => ({
  pointerId: 1,
  pointerType: 'mouse',
  button: 0,
  clientX,
  clientY,
})

describe('the keys’ column', () => {
  it('sounds the key a press lands on at 100 of 127, priming the clock, and the roll names it lit', async () => {
    // Arrange
    const { roll, canvas, audition, y } = await renderRoll()

    // Act: middle C's key, 36 px into the 72 px column.
    fireEvent.pointerDown(canvas, at(36, y(60)))
    fireEvent.pointerUp(canvas, at(36, y(60)))

    // Assert
    expect(audition.prime).toHaveBeenCalledOnce()
    expect(audition.play).toHaveBeenCalledExactlyOnceWith(60, NOTE_KEY_VELOCITY)
    await waitFor(() =>
      expect(roll).toHaveAttribute('data-studio-note-key-lit', '60'),
    )
  })

  it('plays each key a mouse held down reaches up the column', async () => {
    const { canvas, played, y } = await renderRoll()

    fireEvent.pointerDown(canvas, at(36, y(60)))
    fireEvent.pointerMove(canvas, at(36, y(61)))
    fireEvent.pointerMove(canvas, at(36, y(62)))
    fireEvent.pointerUp(canvas, at(36, y(62)))

    expect(played).toEqual([60, 61, 62])
  })

  it('sounds no key for a press on the grid or the ruler', async () => {
    const { canvas, audition, y } = await renderRoll()

    fireEvent.pointerDown(canvas, at(300, y(60)))
    fireEvent.pointerUp(canvas, at(300, y(60)))
    fireEvent.pointerDown(canvas, at(300, 12))
    fireEvent.pointerUp(canvas, at(300, 12))

    expect(audition.play).not.toHaveBeenCalled()
  })

  it('keeps the browser’s menu off itself', async () => {
    const { canvas, y } = await renderRoll()

    expect(fireEvent.contextMenu(canvas, { clientX: 36, clientY: y(60) })).toBe(
      false,
    )
  })
})
