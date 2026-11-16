// Studio new MIDI clip tests — the builder adds each clip with its sequence, on a lane of the song or a new one below the others, as one undo step over a quarter second of silence; a clip made empty is keyed as that silence so nothing renders, and one made with notes is stale; the notes take ids in order and only their fields away from defaults; only a piano, keys, drums or bass lane, or one holding a MIDI clip, makes one where it is pressed; and a clip made in a lane starts at the bar under the press, runs four bars, ends sooner at the lane's next clip, starts after a clip running into its bar, and is refused with no room for a bar.
import { describe, expect, it } from 'vitest'
import { studioMidiKeys } from '../midi/clip-keys'
import { studioMidiRenderKey } from '../midi/render-key'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioMidiFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioNewMidiClip } from './new-midi-clips'
import { STUDIO_NEW_CLIP_NO_ROOM, STUDIO_NEW_CLIP_SILENCE_FRAMES, studioLaneMakesMidiClips, studioNewClipPlace, studioNewMidiClips, } from './new-midi-clips'
import type { StudioAsset, StudioProject, StudioTrack } from './types'

const fixture = studioMidiFixture()

/** The quarter second of silence the new clips play, kept as a recording. */
const SILENCE: StudioAsset = {
  ...fixture.assets[1],
  id: 'asset-silence',
  normalizedFrameCount: STUDIO_NEW_CLIP_SILENCE_FRAMES,
  canonicalPcmId: 'pcm-silence',
  canonicalPcmByteLength: 32 + STUDIO_NEW_CLIP_SILENCE_FRAMES * 4,
  preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 0 },
}
const OPTIONS = { assets: [...fixture.assets, SILENCE], now: TEST_NOW }

/** Ids as the Studio hands them out, numbered in the order asked for. */
function ids() {
  let serial = 0
  return () => `new-${++serial}`
}

/** Four bars at 120 bpm: eight seconds. */
const FOUR_BARS = 384_000

const build = (clips: readonly StudioNewMidiClip[]) =>
  studioNewMidiClips(fixture.project, clips, SILENCE.id, ids())

const apply = (command: StudioCommand, project = fixture.project) =>
  applyStudioCommand(project, command, OPTIONS)

describe('the new MIDI clip builder', () => {
  it('adds an empty clip and its sequence on a lane of the song, its window running four bars past its quarter second of silence, keyed as that silence so nothing renders', () => {
    // Arrange
    const made = build([
      {
        lane: { trackId: 'track-keys' },
        startFrame: 192_000,
        frames: FOUR_BARS,
      },
    ])

    // Act
    const song = apply(made.command)

    // Assert
    const clip = song.clips.find((each) => each.id === made.clipIds[0])!
    const sequence = song.sequences!.find(
      (each) => each.id === clip.midi?.sequenceId,
    )!
    expect(clip).toEqual({
      id: 'new-2',
      trackId: 'track-keys',
      assetId: SILENCE.id,
      startFrame: 192_000,
      sourceInFrame: 0,
      sourceOutFrame: FOUR_BARS,
      gainDb: 0,
      fades: { curve: 'linear-amplitude' },
      midi: {
        sequenceId: 'new-1',
        renderKey: studioMidiRenderKey(sequence, 'piano'),
      },
    })
    expect(sequence).toEqual({
      id: 'new-1',
      ppq: 960,
      tempoBpm: 120,
      lengthTicks: 15_360,
      nextNoteId: 1,
      notes: [],
    })
    expect(studioMidiKeys.staleClips(song)).toEqual([])
  })

  it('makes a new lane with the name and role asked, below the others, and one undo takes the lane, its clip and its sequence away', () => {
    // Arrange
    const made = build([
      {
        lane: { name: 'Drums', role: 'drums' },
        startFrame: 0,
        frames: FOUR_BARS,
      },
    ])
    const history = createStudioHistory(fixture.project)

    // Act
    const added = executeStudioCommand(history, made.command, OPTIONS)
    const undone = undoStudioCommand(added, OPTIONS)

    // Assert
    const lane = added.present.tracks.at(-1)!
    const clip = added.present.clips.at(-1)!
    expect(lane).toMatchObject({ name: 'Drums', role: 'drums', order: 2 })
    expect(clip.trackId).toBe(lane.id)
    expect(clip.midi?.renderKey).toBe(
      studioMidiRenderKey(added.present.sequences!.at(-1)!, 'drums'),
    )
    expect(added.past).toHaveLength(1)
    expect(undone.present.tracks).toEqual(history.present.tracks)
    expect(undone.present.clips).toEqual(history.present.clips)
    expect(undone.present.sequences).toEqual(history.present.sequences)
  })

  it('gives notes ids in order and only their fields away from defaults, lays them at the tempo asked, and makes the clip stale so it renders', () => {
    // Arrange
    const made = build([
      {
        lane: { name: 'Piano', role: 'piano' },
        startFrame: 0,
        frames: 96_000,
        tempoBpm: 90,
        notes: [
          {
            pitch: 60,
            startTick: 0,
            lengthTicks: 480,
            velocity: 0.5,
            releaseVelocity: 0.5,
            channel: 0,
          },
          {
            pitch: 64,
            startTick: 480,
            lengthTicks: 480,
            velocity: 0.75,
            releaseVelocity: 0.25,
            channel: 2,
          },
        ],
      },
    ])

    // Act
    const song = apply(made.command)

    // Assert
    const sequence = song.sequences!.at(-1)!
    // Two seconds at 90 bpm: 2880 ticks.
    expect(sequence).toMatchObject({
      tempoBpm: 90,
      lengthTicks: 2880,
      nextNoteId: 3,
    })
    expect(sequence.notes).toEqual([
      { id: 1, pitch: 60, startTick: 0, lengthTicks: 480, velocity: 0.5 },
      {
        id: 2,
        pitch: 64,
        startTick: 480,
        lengthTicks: 480,
        velocity: 0.75,
        releaseVelocity: 0.25,
        channel: 2,
      },
    ])
    expect(
      studioMidiKeys.staleClips(song).map((stale) => stale.clip.id),
    ).toEqual([made.clipIds[0]])
  })

  it('puts each new lane below the last, and refuses a lane the song does not have', () => {
    // Arrange
    const two = build([
      {
        lane: { name: 'Piano', role: 'piano' },
        startFrame: 0,
        frames: FOUR_BARS,
      },
      {
        lane: { name: 'Drums', role: 'drums' },
        startFrame: 0,
        frames: FOUR_BARS,
      },
    ])

    // Act
    const song = apply(two.command)

    // Assert
    expect(song.tracks.map((track) => [track.name, track.order])).toEqual([
      ['Guitar', 0],
      ['Keys', 1],
      ['Piano', 2],
      ['Drums', 3],
    ])
    expect(() =>
      build([{ lane: { trackId: 'gone' }, startFrame: 0, frames: FOUR_BARS }]),
    ).toThrow(/track.gone: Lane does not exist/)
  })
})

describe('which lanes make a clip where they are pressed', () => {
  it('are piano, keys, drums and bass lanes, and any lane holding a MIDI clip', () => {
    // Arrange
    const lane = (role: StudioTrack['role']) => ({ id: 'lane', role })
    const { clips } = fixture.project

    // Act, Assert
    for (const role of ['piano', 'keys', 'drums', 'bass'] as const)
      expect(studioLaneMakesMidiClips(lane(role), [])).toBe(true)
    expect(studioLaneMakesMidiClips(lane('voice'), [])).toBe(false)
    expect(
      studioLaneMakesMidiClips({ id: 'track-keys', role: 'other' }, clips),
    ).toBe(true)
    expect(
      studioLaneMakesMidiClips({ id: 'track-1', role: 'other' }, clips),
    ).toBe(false)
  })
})

describe('where a clip made in a lane goes', () => {
  /** The keys lane holding a clip from 2 s to 4 s, bars of 2 s at 120 bpm. */
  const lane = (): Pick<StudioProject, 'tempoBpm' | 'clips'> => ({
    tempoBpm: 120,
    clips: [
      {
        ...fixture.clip,
        startFrame: 96_000,
        sourceInFrame: 0,
        sourceOutFrame: 96_000,
      },
    ],
  })

  it('starts at the bar under the press and runs four bars', () => {
    // Act: 5.5 s, in bar 3.
    const place = studioNewClipPlace(lane(), 'track-keys', 264_000)

    // Assert
    expect(place).toEqual({ startFrame: 192_000, frames: FOUR_BARS })
  })

  it('ends where the lane’s next clip starts, when that comes first', () => {
    // Act: 0.5 s, in bar 1, the clip at 2 s.
    const place = studioNewClipPlace(lane(), 'track-keys', 24_000)

    // Assert
    expect(place).toEqual({ startFrame: 0, frames: 96_000 })
  })

  it('starts where a clip running into its bar ends, and from the playhead’s bar on a new lane', () => {
    // Arrange: the clip from 2 s to 5 s, into bar 3.
    const song = lane()
    const longer = {
      ...song,
      clips: [{ ...song.clips[0], sourceOutFrame: 144_000 }],
    }

    // Act
    const after = studioNewClipPlace(longer, 'track-keys', 264_000)
    const fresh = studioNewClipPlace(longer, null, 264_000)

    // Assert: after the clip, to bar 7's line at 12 s.
    expect(after).toEqual({ startFrame: 240_000, frames: 336_000 })
    expect(fresh).toEqual({ startFrame: 192_000, frames: FOUR_BARS })
  })

  it('is refused with no room for a bar before the next clip', () => {
    // Arrange: a second clip from 5 s, a second and a half after the first ends.
    const song = lane()
    const crowded = {
      ...song,
      clips: [
        { ...song.clips[0], sourceOutFrame: 144_000 },
        { ...song.clips[0], id: 'next', startFrame: 312_000 },
      ],
    }

    // Act
    const place = studioNewClipPlace(crowded, 'track-keys', 264_000)

    // Assert
    expect(place).toEqual({ refusal: STUDIO_NEW_CLIP_NO_ROOM })
  })
})
