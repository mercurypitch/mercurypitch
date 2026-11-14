// Studio note editing keys and commands — each key while the editor has the focus, one commit a press: arrows move by a grid step or a semitone (Shift a bar or an octave, Alt a pixel), Delete and Backspace delete, Ctrl or Cmd with D, A, C, X and V duplicate, select all, copy, cut and paste, Escape undoes, clears and then closes; undo and redo pass on; and the toolbar's quantize, transpose, velocity, snap and tool.
import { describe, expect, it } from 'vitest'
import { NOTE_NO_ROOM_AFTER, NOTE_NO_ROOM_PASTE } from './edit-commands'
import { commitsOf, key, mouse, note, noteHost, noteOf, noticesOf, ONE_NOTE_CLIPBOARD, play, } from './edit-script.fixture'
import type { NoteEditCommand } from './edit-types'
import { noteVelocityValue } from './edit-velocity'

// A middle C an eighth from beat 2, an E4 sixteenth on beat 3 and a G4
// eighth on beat 4, in a clip of two bars.
const NOTES = [
  note(1, 60, 960, 480),
  note(2, 64, 1920, 240),
  note(3, 67, 2880, 480),
]
const WINDOW = { startTick: 0, endTick: 7680 }
const editor = (selection: number[] = [1], extra = {}) =>
  noteHost({ notes: NOTES, window: WINDOW, init: { selection }, ...extra })
const command = (editing: NoteEditCommand) => ({
  type: 'command' as const,
  command: editing,
})

describe('the arrows', () => {
  it.each([
    ['ArrowRight', {}, { startTick: 1200 }],
    ['ArrowLeft', {}, { startTick: 720 }],
    ['ArrowUp', {}, { pitch: 61 }],
    ['ArrowDown', {}, { pitch: 59 }],
    ['ArrowUp', { shift: true }, { pitch: 72 }],
    ['ArrowDown', { shift: true }, { pitch: 48 }],
    ['ArrowRight', { shift: true }, { startTick: 4800 }],
    ['ArrowRight', { alt: true }, { startTick: 964 }],
  ] as const)(
    'move the selection with %s %o, in one commit',
    (name, extra, moved) => {
      // Act
      const host = play(editor(), key(name, extra))

      // Assert
      expect(noteOf(host, 1)).toMatchObject(moved)
      expect(commitsOf(host)).toHaveLength(1)
      expect(host.handled).toEqual([true])
    },
  )

  it('commit once a press, a held arrow once a repeat', () => {
    const host = play(
      editor(),
      key('ArrowRight'),
      key('ArrowRight'),
      key('ArrowRight', { repeat: true }),
    )
    expect(commitsOf(host)).toHaveLength(3)
    expect(noteOf(host, 1)?.startTick).toBe(1680)
  })

  it("pass on with nothing selected, but keep Alt with them, the browser's Back", () => {
    const host = play(
      editor([]),
      key('ArrowRight'),
      key('ArrowLeft', { alt: true }),
    )
    expect(host.handled).toEqual([false, true])
    expect(commitsOf(host)).toEqual([])
  })

  it('wait while a drag is under way', () => {
    const host = play(
      editor(),
      mouse('down', 300, 230),
      mouse('move', 400, 230),
      key('ArrowUp'),
    )
    expect(host.handled.at(-1)).toBe(false)
    expect(commitsOf(host)).toEqual([])
  })
})

describe('Delete and Backspace', () => {
  it.each(['Delete', 'Backspace'])(
    '%s deletes the selection in one commit',
    (name) => {
      const host = play(editor([1, 2]), key(name))
      expect(host.ctx.sequence.notes.map((each) => each.id)).toEqual([3])
      expect(commitsOf(host)).toEqual([
        { notes: [NOTES[2]], nextNoteId: 4, selection: [] },
      ])
    },
  )

  it('acts once while held', () => {
    const host = play(
      editor([1]),
      key('Delete'),
      key('Delete', { repeat: true }),
    )
    expect(commitsOf(host)).toHaveLength(1)
    expect(host.handled).toEqual([true, true])
  })
})

describe('Ctrl or Cmd', () => {
  it('with D duplicates the selection right after itself, the copies selected', () => {
    const host = play(editor([1]), key('d', { mod: true }))
    expect(noteOf(host, 4)).toMatchObject({
      pitch: 60,
      startTick: 1440,
      lengthTicks: 480,
    })
    expect(host.state.selection).toEqual([4])
  })

  it('with D refuses copies that would start past the clip, and says why', () => {
    // Arrange: G4 ends on the clip's last tick, so its copy would start past it.
    const host = editor([3], { window: { startTick: 0, endTick: 3360 } })

    // Act
    play(host, key('d', { mod: true }))

    // Assert
    expect(commitsOf(host)).toEqual([])
    expect(noticesOf(host)).toEqual([NOTE_NO_ROOM_AFTER])
  })

  it("with D or A keeps the key, the browser's bookmark and select-all, though nothing is selected", () => {
    const host = play(
      noteHost({ notes: [] }),
      key('d', { mod: true }),
      key('a', { mod: true }),
    )
    expect(host.handled).toEqual([true, true])
  })

  it('with A selects every note the clip plays, and none outside it', () => {
    const outside = [...NOTES, note(4, 50, 100, 240)]
    const host = play(
      noteHost({ notes: outside, window: { startTick: 480, endTick: 7680 } }),
      key('a', { mod: true }),
    )
    expect(host.state.selection).toEqual([1, 2, 3])
  })

  it('with C and V pastes at the playhead on the grid when it is over the clip', () => {
    const host = play(
      editor([1], { playheadTick: 2000 }),
      key('c', { mod: true }),
      key('v', { mod: true }),
    )
    expect(noteOf(host, 4)).toMatchObject({ pitch: 60, startTick: 1920 })
    expect(host.state.selection).toEqual([4])
  })

  it('with V pastes right after the selection when the playhead is off the clip', () => {
    const host = play(
      editor([1], { playheadTick: 9000 }),
      key('c', { mod: true }),
      key('v', { mod: true }),
    )
    expect(noteOf(host, 4)?.startTick).toBe(1440)
  })

  it('with V refuses notes that would start past the clip, and says why', () => {
    // Arrange: a clipboard a beat and a sixteenth long, pasted on the clip's last beat.
    const clipboard = {
      notes: [
        ...ONE_NOTE_CLIPBOARD.notes,
        { pitch: 62, startTick: 1200, lengthTicks: 240, velocity: 0.5 },
      ],
    }
    const host = noteHost({
      notes: NOTES,
      window: { startTick: 0, endTick: 3840 },
      playheadTick: 3000,
      init: { clipboard },
    })

    // Act
    play(host, key('v', { mod: true }))

    // Assert
    expect(commitsOf(host)).toEqual([])
    expect(noticesOf(host)).toEqual([NOTE_NO_ROOM_PASTE])
  })

  it('with X cuts the selection, which V brings back at the playhead', () => {
    const host = play(
      editor([2], { playheadTick: 3360 }),
      key('x', { mod: true }),
    )
    const cut = host.ctx.sequence.notes.map((each) => each.id)
    play(host, key('v', { mod: true }))
    expect(cut).toEqual([1, 3])
    expect(noteOf(host, 4)).toMatchObject({ pitch: 64, startTick: 3360 })
  })

  it.each([
    ['z', {}],
    ['z', { shift: true }],
    ['y', {}],
  ])("with %s %o passes on to the Studio's undo and redo", (name, extra) => {
    const host = play(editor([1]), key(name, { mod: true, ...extra }))
    expect(host.handled).toEqual([false])
    expect(host.effects).toEqual([])
  })
})

describe('Escape', () => {
  it('clears the selection first, and only then asks to close', () => {
    // Act
    const host = play(editor([1]), key('Escape'))
    const cleared = host.state.selection
    const first = [...host.effects]
    play(host, key('Escape'))

    // Assert
    expect(cleared).toEqual([])
    expect(first).toEqual([])
    expect(host.effects).toEqual([{ type: 'close' }])
  })

  it('undoes a drag under way before anything else', () => {
    const host = play(
      editor([3]),
      mouse('down', 300, 230),
      mouse('move', 400, 230),
      key('Escape'),
      mouse('up', 400, 230),
    )
    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([3])
  })
})

describe('the toolbar', () => {
  it('quantizes the selection to the grid, and keeps it', () => {
    const late = [note(1, 60, 1000, 480), note(2, 64, 1950, 240)]
    const host = play(
      noteHost({ notes: late, init: { selection: [2] } }),
      command({ type: 'quantize' }),
    )
    expect([noteOf(host, 1)?.startTick, noteOf(host, 2)?.startTick]).toEqual([
      1000, 1920,
    ])
    expect(host.state.selection).toEqual([2])
  })

  it('quantizes every note the clip plays when none is selected', () => {
    const late = [note(1, 60, 1000, 480), note(2, 64, 1950, 240)]
    const host = play(noteHost({ notes: late }), command({ type: 'quantize' }))
    expect([noteOf(host, 1)?.startTick, noteOf(host, 2)?.startTick]).toEqual([
      960, 1920,
    ])
    expect(host.state.selection).toEqual([])
  })

  it('transposes the selection', () => {
    const host = play(
      editor([1, 2]),
      command({ type: 'transpose', semitones: -1 }),
    )
    expect([noteOf(host, 1)?.pitch, noteOf(host, 2)?.pitch]).toEqual([59, 63])
  })

  it('makes the selection louder or softer in steps of 127', () => {
    const host = play(editor([1]), command({ type: 'velocity', steps: -8 }))
    expect(noteVelocityValue(noteOf(host, 1)!.velocity)).toBe(92)
  })

  it('sets the grid the arrows move by', () => {
    const host = play(
      editor([1]),
      command({ type: 'snap', snap: '1/8' }),
      key('ArrowRight'),
    )
    expect(noteOf(host, 1)?.startTick).toBe(1440)
  })

  it('switches the tool, undoing a drag under way', () => {
    const host = play(
      editor([]),
      mouse('down', 300, 230),
      mouse('move', 400, 230),
      command({ type: 'tool', tool: 'draw' }),
      mouse('up', 400, 230),
    )
    expect(host.state.tool).toBe('draw')
    expect(commitsOf(host)).toEqual([])
  })
})
