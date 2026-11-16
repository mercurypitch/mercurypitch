// Studio MIDI window tests — a MIDI clip's window may run past its audio to its sequence's end, never past it and never past five minutes, and its fades with it; an audio clip and a loop take's passes stay inside their audio; a split, a move, a fade and a duplicate of a MIDI clip past its audio are kept; and a trim of its end past its sequence grows the sequence, a shared one copied first, in one undo step, while a shorter trim leaves it as it was.
import { describe, expect, it } from 'vitest'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { STUDIO_MIDI_WINDOW_LIMIT, STUDIO_MIDI_WINDOW_MOST_FRAMES, studioSequenceCovers, } from './midi-window'
import { studioMidiFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioClip, StudioProject } from './types'
import { validateStudioProject } from './validation'

/**
 * studioMidiFixture's song with its sequence four seconds long, at 120 bpm
 * 7680 ticks, twice its two seconds of audio, and its MIDI clip changed by
 * `change`: by default its window runs from half a second in to the
 * sequence's end, two seconds past its audio.
 */
function pastItsAudio(change: Partial<StudioClip> = {}, lengthTicks = 7680) {
  const fixture = studioMidiFixture()
  const sequence = { ...fixture.sequence, lengthTicks }
  const clip: StudioClip = {
    ...fixture.clip,
    sourceOutFrame: 192_000,
    ...change,
  }
  const project: StudioProject = {
    ...fixture.project,
    clips: fixture.project.clips.map((each) =>
      each.id === clip.id ? clip : each,
    ),
    sequences: [sequence],
  }
  return { project, assets: fixture.assets, clip, sequence }
}

const apply = (
  song: ReturnType<typeof pastItsAudio>,
  command: StudioCommand,
): StudioProject =>
  applyStudioCommand(song.project, command, {
    assets: song.assets,
    now: TEST_NOW,
  })

const clipById = (project: StudioProject, id: string): StudioClip =>
  project.clips.find((clip) => clip.id === id)!

describe('a MIDI clip past its audio', () => {
  it('runs to its sequence’s end, two seconds past its audio', () => {
    // Arrange
    const song = pastItsAudio()

    // Act
    const read = validateStudioProject(song.project, song.assets)

    // Assert
    expect(clipById(read, song.clip.id).sourceOutFrame).toBe(192_000)
  })

  it('is refused a frame past its sequence’s end', () => {
    // Arrange
    const song = pastItsAudio({ sourceOutFrame: 192_001 })

    // Act, Assert
    expect(() => validateStudioProject(song.project, song.assets)).toThrow(
      /clip-midi.sourceOutFrame: Window runs past its sequence/,
    )
  })

  it('runs five minutes into its sequence at the most, however long the sequence', () => {
    // Arrange: a sequence of 5 min 12.5 s, 600,000 ticks at 120 bpm.
    const most = pastItsAudio(
      { sourceOutFrame: STUDIO_MIDI_WINDOW_MOST_FRAMES },
      600_000,
    )
    const over = pastItsAudio(
      { sourceOutFrame: STUDIO_MIDI_WINDOW_MOST_FRAMES + 1 },
      600_000,
    )

    // Act, Assert
    expect(() => validateStudioProject(most.project, most.assets)).not.toThrow()
    expect(() => validateStudioProject(over.project, over.assets)).toThrow(
      STUDIO_MIDI_WINDOW_LIMIT,
    )
  })

  it('fades past its audio, but not past its sequence’s end', () => {
    // Arrange
    const inside = pastItsAudio({
      fades: {
        curve: 'linear-amplitude',
        out: { fromSourceFrame: 150_000, toSourceFrame: 192_000 },
      },
    })
    const beyond = pastItsAudio({
      fades: {
        curve: 'linear-amplitude',
        out: { fromSourceFrame: 150_000, toSourceFrame: 200_000 },
      },
    })

    // Act, Assert
    expect(() =>
      validateStudioProject(inside.project, inside.assets),
    ).not.toThrow()
    expect(() => validateStudioProject(beyond.project, beyond.assets)).toThrow(
      /clip-midi.fades: Fade runs past its sequence/,
    )
  })

  it('leaves an audio clip inside its audio, and a MIDI loop take’s passes', () => {
    // Arrange
    const song = pastItsAudio()
    const audio = clipById(song.project, 'clip-1')
    const longAudio = {
      ...song.project,
      clips: song.project.clips.map((each) =>
        each.id === audio.id ? { ...audio, sourceOutFrame: 1001 } : each,
      ),
    }
    const looped = pastItsAudio({
      sourceInFrame: 64_000,
      sourceOutFrame: 128_000,
      passes: { firstFrame: 0, frames: 64_000, count: 2 },
    })

    // Act, Assert: the audio is 1000 frames long, and the passes need 128,000.
    expect(() => validateStudioProject(longAudio, song.assets)).toThrow(
      /clip-1: Source bounds exceed owned audio/,
    )
    expect(() => validateStudioProject(looped.project, looped.assets)).toThrow(
      /clip-midi.passes: Passes exceed owned audio/,
    )
  })

  it('says a source frame lies inside a sequence up to the tick it ends on', () => {
    // Arrange: 25 frames a tick at 120 bpm.
    const sequence = { tempoBpm: 120, lengthTicks: 7680 }

    // Act, Assert
    expect(studioSequenceCovers(sequence, 192_000)).toBe(true)
    expect(studioSequenceCovers(sequence, 192_001)).toBe(false)
  })
})

describe('editing a MIDI clip past its audio', () => {
  it('splits it past its audio, the right half wholly past it', () => {
    // Arrange: the audio ends at song frame 120,000 (48,000 + 96,000 - 24,000).
    const song = pastItsAudio()

    // Act
    const split = apply(song, {
      type: 'split-clip',
      clipId: song.clip.id,
      atFrame: 168_000,
      newClipId: 'right',
    })

    // Assert
    expect(clipById(split, song.clip.id)).toMatchObject({
      sourceInFrame: 24_000,
      sourceOutFrame: 144_000,
    })
    expect(clipById(split, 'right')).toMatchObject({
      startFrame: 168_000,
      sourceInFrame: 144_000,
      sourceOutFrame: 192_000,
      midi: song.clip.midi,
    })
  })

  it('moves it, fades it past its audio and duplicates it, its window kept', () => {
    // Arrange
    const song = pastItsAudio()
    const fades: StudioClip['fades'] = {
      curve: 'linear-amplitude',
      out: { fromSourceFrame: 150_000, toSourceFrame: 192_000 },
    }

    // Act
    const moved = apply(song, {
      type: 'move-clip',
      clipId: song.clip.id,
      trackId: song.clip.trackId,
      startFrame: 300_000,
    })
    const faded = apply(song, {
      type: 'set-fades',
      clipId: song.clip.id,
      fades,
    })
    const doubled = apply(song, {
      type: 'duplicate-clip',
      clipId: song.clip.id,
      newClipId: 'copy',
      newTrackId: 'unused',
    })

    // Assert
    expect(clipById(moved, song.clip.id)).toMatchObject({
      startFrame: 300_000,
      sourceOutFrame: 192_000,
    })
    expect(clipById(faded, song.clip.id).fades).toEqual(fades)
    expect(clipById(doubled, 'copy')).toMatchObject({
      startFrame: 216_000,
      sourceInFrame: 24_000,
      sourceOutFrame: 192_000,
      midi: song.clip.midi,
    })
  })
})

describe('lengthening a MIDI clip', () => {
  /** The fixture's song, its keys clip on a two-second sequence of 3840 ticks. */
  const recorded = () => pastItsAudio({ sourceOutFrame: 96_000 }, 3840)

  it('grows its sequence to the fewest ticks that cover its new end, one undo step', () => {
    // Arrange: 150,010 frames is 6000.4 ticks at 120 bpm.
    const song = recorded()
    const options = { assets: song.assets, now: TEST_NOW }
    const history = createStudioHistory(song.project)

    // Act
    const longer = executeStudioCommand(
      history,
      { type: 'trim-tail', clipId: song.clip.id, sourceOutFrame: 150_010 },
      options,
    )
    const undone = undoStudioCommand(longer, options)

    // Assert
    expect(longer.past).toHaveLength(1)
    expect(clipById(longer.present, song.clip.id).sourceOutFrame).toBe(150_010)
    expect(longer.present.sequences).toEqual([
      { ...song.sequence, lengthTicks: 6001 },
    ])
    expect(undone.present.sequences).toEqual([song.sequence])
    expect(clipById(undone.present, song.clip.id).sourceOutFrame).toBe(96_000)
  })

  it('leaves its sequence as long as it was when trimmed shorter, its notes past the window kept', () => {
    // Arrange
    const song = pastItsAudio()

    // Act
    const shorter = apply(song, {
      type: 'trim-tail',
      clipId: song.clip.id,
      sourceOutFrame: 60_000,
    })

    // Assert
    expect(clipById(shorter, song.clip.id).sourceOutFrame).toBe(60_000)
    expect(shorter.sequences).toEqual([song.sequence])
  })

  it('lengthens a copy of its own when another clip shares its sequence, the other clip as it was', () => {
    // Arrange: a duplicate shares the clip's sequence.
    const song = recorded()
    const shared = apply(song, {
      type: 'duplicate-clip',
      clipId: song.clip.id,
      newClipId: 'copy',
      newTrackId: 'unused',
    })

    // Act
    const longer = applyStudioCommand(
      shared,
      {
        type: 'trim-tail',
        clipId: 'copy',
        sourceOutFrame: 192_000,
        forkSequenceId: 'own',
      },
      { assets: song.assets, now: TEST_NOW },
    )

    // Assert
    expect(clipById(longer, 'copy').midi?.sequenceId).toBe('own')
    expect(clipById(longer, song.clip.id).midi?.sequenceId).toBe(
      song.sequence.id,
    )
    expect(longer.sequences).toEqual([
      song.sequence,
      { ...song.sequence, id: 'own', lengthTicks: 7680 },
    ])
  })

  it('is refused for a shared sequence with no id for the copy, and past five minutes', () => {
    // Arrange
    const song = recorded()
    const shared = apply(song, {
      type: 'duplicate-clip',
      clipId: song.clip.id,
      newClipId: 'copy',
      newTrackId: 'unused',
    })
    const options = { assets: song.assets, now: TEST_NOW }

    // Act, Assert
    expect(() =>
      applyStudioCommand(
        shared,
        { type: 'trim-tail', clipId: 'copy', sourceOutFrame: 192_000 },
        options,
      ),
    ).toThrow(/needs an id for the clip’s own copy/)
    expect(() =>
      apply(song, {
        type: 'trim-tail',
        clipId: song.clip.id,
        sourceOutFrame: STUDIO_MIDI_WINDOW_MOST_FRAMES + 1,
      }),
    ).toThrow(STUDIO_MIDI_WINDOW_LIMIT)
  })
})
