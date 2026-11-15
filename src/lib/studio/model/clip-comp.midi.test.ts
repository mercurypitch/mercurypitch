// Studio comp tests beside MIDI — a MIDI loop take plays one whole pass and is never comped, and a MIDI render swaps only a stale MIDI clip's audio, never a comped take's.
import { describe, expect, it } from 'vitest'
import { studioMidiKeys } from '../midi/clip-keys'
import { STUDIO_MIDI_COMP_REFUSAL, studioCanComp } from './clip-comp'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { studioMidiFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAsset, StudioClip, StudioProject } from './types'
import { validateStudioProject } from './validation'

/**
 * studioMidiFixture's song with both its clips loop takes: the audio clip
 * on the second of four 250-frame passes, comped, and the MIDI clip on the
 * second of three 32,000-frame passes.
 */
function loopTakes() {
  const { project, assets, sequence } = studioMidiFixture()
  const [audio, keys] = project.clips
  const comped: StudioClip = {
    ...audio,
    sourceInFrame: 250,
    sourceOutFrame: 500,
    fades: { curve: 'linear-amplitude' },
    passes: { firstFrame: 0, frames: 250, count: 4 },
    comp: [
      { fromSourceFrame: 250, toSourceFrame: 300, pass: 0 },
      { fromSourceFrame: 300, toSourceFrame: 500, pass: 1 },
    ],
  }
  const played: StudioClip = {
    ...keys,
    sourceInFrame: 32_000,
    sourceOutFrame: 64_000,
    passes: { firstFrame: 0, frames: 32_000, count: 3 },
  }
  const song: StudioProject = { ...project, clips: [comped, played] }
  return { project: song, assets, sequence, comped, played }
}

const apply = (
  project: StudioProject,
  command: StudioCommand,
  assets: readonly StudioAsset[],
) => applyStudioCommand(project, command, { assets, now: TEST_NOW })

describe('a MIDI loop take', () => {
  it('plays one whole pass: a comp of it is refused, and choosing a pass moves its window', () => {
    // Arrange
    const { project, assets, comped, played } = loopTakes()

    // Act
    const swipe = () =>
      apply(
        project,
        {
          type: 'comp-pass',
          clipId: played.id,
          fromSourceFrame: 40_000,
          toSourceFrame: 50_000,
          pass: 0,
        },
        assets,
      )
    const chosen = apply(
      project,
      { type: 'choose-pass', clipId: played.id, pass: 0 },
      assets,
    ).clips.find((clip) => clip.id === played.id)

    // Assert
    expect(studioCanComp(comped)).toBe(true)
    expect(studioCanComp(played)).toBe(false)
    expect(swipe).toThrow(STUDIO_MIDI_COMP_REFUSAL)
    expect(chosen).toMatchObject({
      sourceInFrame: 0,
      sourceOutFrame: 32_000,
      midi: played.midi,
    })
    expect(chosen?.comp).toBeUndefined()
  })

  it('refuses a song that keeps a comp on a MIDI clip', () => {
    const { project, assets, played } = loopTakes()
    const comped = {
      ...project,
      clips: project.clips.map((clip) =>
        clip.id === played.id
          ? {
              ...clip,
              comp: [
                { fromSourceFrame: 32_000, toSourceFrame: 40_000, pass: 0 },
                { fromSourceFrame: 40_000, toSourceFrame: 64_000, pass: 1 },
              ],
            }
          : clip,
      ),
    }

    expect(() => validateStudioProject(comped, assets)).toThrow(
      `project.clips[1].comp: ${STUDIO_MIDI_COMP_REFUSAL}`,
    )
  })
})

describe('a MIDI render beside a comped audio take', () => {
  it('swaps the stale MIDI clip to its render and leaves the comped take as it was', () => {
    // Arrange: the keys' notes edited, so their audio is due a render.
    const { project, assets, sequence, comped, played } = loopTakes()
    const edited = apply(
      project,
      {
        type: 'set-sequence-notes',
        clipId: played.id,
        notes: sequence.notes.map((note) =>
          note.id === 1 ? { ...note, velocity: 0.6 } : note,
        ),
        nextNoteId: sequence.nextNoteId,
        forkSequenceId: 'sequence-own',
      },
      assets,
    )
    const stale = studioMidiKeys.staleClips(edited)
    const render: StudioAsset = {
      ...assets[1],
      id: 'asset-render',
      normalizedFrameCount: 120_000,
      canonicalPcmId: 'pcm-render',
      canonicalPcmByteLength: 32 + 120_000 * 4,
    }

    // Act
    const rendered = apply(
      edited,
      { type: 'set-midi-render', assetId: render.id, renderKey: stale[0].key },
      [...assets, render],
    )

    // Assert
    expect(stale.map((item) => item.clip.id)).toEqual([played.id])
    expect(studioMidiKeys.clipKey(edited, comped)).toBeNull()
    expect(rendered.clips.find((clip) => clip.id === comped.id)).toEqual(comped)
    expect(rendered.clips.find((clip) => clip.id === played.id)).toMatchObject({
      assetId: render.id,
      midi: { renderKey: stale[0].key },
      passes: played.passes,
    })
    expect(studioMidiKeys.staleClips(rendered)).toEqual([])
  })
})
