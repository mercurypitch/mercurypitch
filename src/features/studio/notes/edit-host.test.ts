// Studio note editing host glue tests — a press lands on the grid or the velocity lane and counts from it, a captured pointer counting from it wherever it goes, and the keys and the ruler take none; Ctrl or Cmd are one modifier; a draft is only the notes a gesture changes or adds; the engine's marquee and grips move by the keys' column and the ruler onto the canvas; a commit is one set-sequence-notes with its own fork id; and a touch screen opens the piano with rows of 24 px.
import { describe, expect, it } from 'vitest'
import type { StudioNote } from '@/lib/studio/model/types'
import { NOTE_TOUCH_ROW_HEIGHT, noteCommitCommand, noteEditKeyInput, notePianoOpening, noteRollDrafts, noteRollDrawing, noteRollPointerInput, noteRollSurfaceAt, noteRollWheelInput, } from './edit-host'
import type { NoteEditView } from './edit-view'
import { studioRollRegions } from './note-roll-geometry'

// A canvas 840 by 406: keys 72 wide, a ruler 26 high, a velocity lane 80 high.
const REGIONS = studioRollRegions({
  width: 840,
  height: 406,
  layout: { keysWidth: 72, rulerHeight: 26, velocityHeight: 80 },
})
/** The canvas 100 px in and 50 px down the page. */
const ORIGIN = { left: 100, top: 50 }

const pointer = (clientX: number, clientY: number, extra = {}) => ({
  pointerId: 3,
  pointerType: 'touch',
  clientX,
  clientY,
  timeStamp: 1234,
  button: 0,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...extra,
})

const note = (id: number, startTick: number): StudioNote => ({
  id,
  pitch: 60,
  startTick,
  lengthTicks: 240,
  velocity: 0.5,
})

describe('where a press lands', () => {
  it.each([
    [300, 100, 'roll'],
    [300, 380, 'velocity'],
    [30, 100, null],
    [300, 10, null],
  ] as const)('at canvas %i, %i on %s', (x, y, surface) => {
    expect(noteRollSurfaceAt(REGIONS, x, y)).toBe(surface)
  })
})

describe('noteRollPointerInput', () => {
  it("counts a press on the grid from the grid's corner", () => {
    expect(
      noteRollPointerInput('down', pointer(400, 176), ORIGIN, REGIONS, 'roll'),
    ).toEqual({
      type: 'down',
      pointerId: 3,
      pointerType: 'touch',
      surface: 'roll',
      x: 228,
      y: 100,
      time: 1234,
      button: 0,
      shift: false,
      mod: false,
      alt: false,
    })
  })

  it("counts a press in the velocity lane from the lane's top", () => {
    const input = noteRollPointerInput(
      'down',
      pointer(400, 400),
      ORIGIN,
      REGIONS,
      'velocity',
    )
    expect(input).toMatchObject({ surface: 'velocity', x: 228, y: 24 })
  })

  it('keeps counting a captured pointer from where it went down, past the surface', () => {
    const input = noteRollPointerInput(
      'move',
      pointer(90, 20),
      ORIGIN,
      REGIONS,
      'roll',
    )
    expect(input).toMatchObject({ x: -82, y: -56 })
  })

  it('reads Ctrl or Cmd as one modifier, and an unknown pointer as a mouse', () => {
    const mac = noteRollPointerInput(
      'down',
      pointer(400, 176, { metaKey: true, pointerType: '' }),
      ORIGIN,
      REGIONS,
      'roll',
    )
    expect(mac).toMatchObject({ mod: true, pointerType: 'mouse' })
  })
})

describe('the wheel and the keys', () => {
  it('counts the wheel from the grid, Ctrl or Cmd its zoom', () => {
    const input = noteRollWheelInput(
      {
        clientX: 400,
        clientY: 176,
        deltaX: 0,
        deltaY: 40,
        deltaMode: 0,
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      },
      ORIGIN,
      REGIONS.grid,
    )
    expect(input).toMatchObject({
      type: 'wheel',
      x: 228,
      y: 100,
      deltaY: 40,
      mod: true,
    })
  })

  it('reads a key with Cmd as Ctrl, and its repeat', () => {
    expect(
      noteEditKeyInput({
        key: 'd',
        shiftKey: false,
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        repeat: true,
      }),
    ).toEqual({ key: 'd', shift: false, mod: true, alt: false, repeat: true })
  })
})

describe("the engine's view on the roll", () => {
  const stored = [note(1, 0), note(2, 240), note(3, 480)]
  const view: NoteEditView = {
    notes: [
      note(1, 0),
      { ...note(2, 240), pitch: 62 },
      note(3, 480),
      note(4, 960),
    ],
    drafting: true,
    selection: [2, 4],
    grips: [{ x: 100, y: 40, width: 3, height: 6 }],
    marquee: { x: 10, y: 20, width: 30, height: 40 },
    hover: null,
    readout: null,
    cursor: 'grabbing',
  }

  it('draws as drafts only the notes the gesture changes or adds', () => {
    expect(noteRollDrafts(view, stored).map((each) => each.id)).toEqual([2, 4])
    expect(noteRollDrafts({ ...view, drafting: false }, stored)).toEqual([])
  })

  it('moves the marquee and the grips onto the canvas, past the keys and the ruler', () => {
    const drawing = noteRollDrawing(view, stored, REGIONS.grid)
    expect(drawing.marquee).toEqual({ x: 82, y: 46, width: 30, height: 40 })
    expect(drawing.grips).toEqual([{ x: 172, y: 66, width: 3, height: 6 }])
    expect([...drawing.selected]).toEqual([2, 4])
  })
})

describe('noteCommitCommand', () => {
  it('makes a commit one set-sequence-notes, with an id for the clip’s own copy', () => {
    const command = noteCommitCommand(
      'clip-1',
      { notes: [note(1, 0)], nextNoteId: 5, selection: [1] },
      () => 'sequence-fork',
    )
    expect(command).toEqual({
      type: 'set-sequence-notes',
      clipId: 'clip-1',
      notes: [note(1, 0)],
      nextNoteId: 5,
      forkSequenceId: 'sequence-fork',
    })
  })
})

describe('notePianoOpening', () => {
  // 60 rows of 8 px.
  const crowded = {
    start: 0,
    end: 3840,
    minMidi: 30,
    maxMidi: 89,
    width: 600,
    height: 480,
  }

  it('opens a touch screen on rows of 24 px at the least', () => {
    const opened = notePianoOpening(crowded, true)
    expect(480 / (opened.maxMidi - opened.minMidi + 1)).toBeGreaterThanOrEqual(
      NOTE_TOUCH_ROW_HEIGHT,
    )
  })

  it('leaves the rows fitted to the notes for a mouse', () => {
    expect(notePianoOpening(crowded, false)).toBe(crowded)
  })
})
