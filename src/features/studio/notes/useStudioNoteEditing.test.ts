// Studio note editing controller tests — a press makes or resumes the sound's clock before anything else; a drag's draft reaches the render service once for each change of its notes, and its end only once the commit is dispatched; a commit is one set-sequence-notes with a fork id of its own; a song that stops being editable lets a gesture under way go, undone, and a lost focus does the same.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioNoteSet } from '@/lib/studio/midi/notes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import { studioSequence } from '@/lib/studio/model/sequences'
import type { NoteEditInput } from './edit-types'
import type { StudioNoteAudition } from './note-audition'
import { useStudioNoteEditing } from './useStudioNoteEditing'

// The fixture's clip plays ticks 960 to 3840: middle C (id 1) from 960 for
// an eighth and E4 (id 2) from 1920 for a beat. Its roll shows them 5 ticks
// a pixel, on rows 20 px tall from A4 (69) down, so E4 spans x 192 to 384
// and y 100 to 120.
const VIEWPORT = {
  start: 960,
  end: 3840,
  minMidi: 55,
  maxMidi: 69,
  width: 576,
  height: 300,
}

let dispose: (() => void) | undefined
afterEach(() => dispose?.())

function controller() {
  const fixture = studioMidiFixture()
  const log: string[] = []
  const commands: StudioCommand[] = []
  const previews: (StudioNoteSet | null)[] = []
  const audition = {
    warm: vi.fn(),
    prime: vi.fn(() => log.push('prime')),
    play: vi.fn(),
    dispose: vi.fn(),
  } as unknown as StudioNoteAudition
  return createRoot((done) => {
    dispose = done
    const [writable, setWritable] = createSignal(true)
    const editor = useStudioNoteEditing({
      clip: () => fixture.clip,
      sequence: () =>
        studioSequence(fixture.project, fixture.clip.midi!.sequenceId),
      songTempoBpm: () => 120,
      writable,
      playheadFrame: () => 0,
      dispatch(command) {
        commands.push(command)
        log.push(command.type)
        return true
      },
      close: vi.fn(),
      clipboard: () => null,
      setClipboard: vi.fn(),
      audition,
      preview(draft) {
        previews.push(draft)
        log.push(draft === null ? 'draft ended' : 'draft')
      },
      announce: vi.fn(),
      createId: () => 'fork-1',
    })
    editor.editing.attach({
      viewport: () => VIEWPORT,
      setViewport: vi.fn(),
      rows: () => ({ kind: 'piano' }),
      velocityHeight: () => 76,
    })
    return { editor, log, commands, previews, setWritable }
  })
}

const mouse = (
  type: 'down' | 'move' | 'up',
  x: number,
  y: number,
  time: number,
): NoteEditInput => ({
  type,
  pointerId: 1,
  pointerType: 'mouse',
  surface: 'roll',
  x,
  y,
  time,
  button: 0,
})

describe('a press', () => {
  it("makes or resumes the sound's clock before anything else", () => {
    const { editor, log } = controller()

    editor.editing.send(mouse('down', 288, 110, 10))

    expect(log[0]).toBe('prime')
  })
})

describe("a drag's draft", () => {
  it('reaches the render service once for each change of its notes, and its end once the commit is dispatched', () => {
    // Arrange
    const { editor, log, commands, previews } = controller()

    // Act: E4 up a row, then a few pixels on within the same row.
    editor.editing.send(mouse('down', 288, 110, 10))
    editor.editing.send(mouse('move', 288, 90, 26))
    editor.editing.send(mouse('move', 290, 88, 42))
    editor.editing.send(mouse('up', 290, 88, 58))

    // Assert
    expect(log).toEqual(['prime', 'draft', 'set-sequence-notes', 'draft ended'])
    expect(previews[0]?.notes.find((note) => note.id === 2)?.pitch).toBe(65)
    expect(commands[0]).toMatchObject({
      type: 'set-sequence-notes',
      clipId: 'clip-midi',
      forkSequenceId: 'fork-1',
    })
  })
})

describe('a gesture under way', () => {
  it('is let go, undone, when the song stops being editable', () => {
    const { editor, log, setWritable } = controller()
    editor.editing.send(mouse('down', 288, 110, 10))
    editor.editing.send(mouse('move', 288, 90, 26))

    setWritable(false)
    const after = editor.editing.send(mouse('up', 288, 90, 42))

    expect(log).toEqual(['prime', 'draft', 'draft ended'])
    expect(after).toBe(false)
  })

  it('is let go, undone, when the page loses the focus', () => {
    const { editor, log } = controller()
    editor.editing.send(mouse('down', 288, 110, 10))
    editor.editing.send(mouse('move', 288, 90, 26))

    globalThis.dispatchEvent(new Event('blur'))

    expect(log).toEqual(['prime', 'draft', 'draft ended'])
    expect(editor.state().gesture).toBeNull()
  })
})
