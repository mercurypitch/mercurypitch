// Studio graph tests for a MIDI clip past its audio — Play starts its source for its audio alone, edged to silence where the audio ends, and the export renders the song to the window's end with the same source.
import { describe, expect, it, vi } from 'vitest'
import { toneAudio } from '../audio/audio.fixture'
import { encodeCanonicalPcm, sha256Bytes } from '../audio/canonical-pcm'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioMidiFixture } from '../model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '../model/types'
import { buildStudioGraph } from './graph'
import { renderStudioArrangement } from './offline-render'
import type { PlaybackParam, PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'

/**
 * studioMidiFixture's keys clip alone, with dry lanes: its two seconds of
 * audio played from half a second in, at one second into the song, and
 * its window running two seconds past the audio, to its sequence's end.
 */
function keysPastAudio(asset: StudioAsset): StudioProject {
  const { project, sequence, clip } = studioMidiFixture()
  return {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
    })),
    clips: [{ ...clip, assetId: asset.id, sourceOutFrame: 192_000 }],
    sequences: [{ ...sequence, lengthTicks: 7680 }],
  }
}

const NO_LATENCY = {
  sampleRate: 48000,
  framesByTrack: { 'track-1': 0, 'track-keys': 0 },
}

describe('a MIDI clip past its audio, played', () => {
  it('starts its source for its audio alone, edged to silence where the audio ends', () => {
    // Arrange
    const asset = studioMidiFixture().assets[1]
    const plan = compileStudioArrangement(keysPastAudio(asset), [asset], {
      latencies: NO_LATENCY,
    })
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const buffer = ctx.createBuffer(1, 96_000, 48000) as unknown as AudioBuffer

    // Act
    const graph = buildStudioGraph(
      ctx.asContext,
      plan,
      new Map([[asset.id, buffer]]),
      0.5,
    )
    graph.scheduleUntil(10)

    // Assert: one second into the song, from half a second into the audio, for its last 1.5 s.
    const sources = ctx.ofType<PlaybackSource>('source')
    expect(sources.map((source) => source.starts)).toEqual([[[1.5, 0.5, 1.5]]])
    const gain = sources[0].connections[0].node as unknown as {
      gain: PlaybackParam
    }
    const last = gain.gain.curves.at(-1)!
    expect(last.time + last.duration).toBeCloseTo(3, 9)
    expect(last.values.at(-1)).toBe(0)
    graph.dispose()
  })

  it('is exported to the window’s end, the same source playing its audio alone', async () => {
    // Arrange: a real canonical copy of two seconds of tone for the take.
    const fixture = studioMidiFixture()
    const blob = await encodeCanonicalPcm(toneAudio(96_000))
    const asset: StudioAsset = {
      ...fixture.assets[1],
      canonicalPcmByteLength: blob.size,
      canonicalPcmSha256: await sha256Bytes(await blob.arrayBuffer()),
    }
    const song = keysPastAudio(asset)
    const plan = compileStudioArrangement(song, [asset])
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    let frames = 0
    Object.assign(ctx, {
      startRendering: vi.fn(() =>
        Promise.resolve(
          ctx.createBuffer(2, frames, 48000) as unknown as AudioBuffer,
        ),
      ),
    })

    // Act
    const render = await renderStudioArrangement(
      song,
      [asset],
      () => Promise.resolve(blob),
      {
        createContext: (options) => {
          frames = options.length
          return ctx as unknown as OfflineAudioContext
        },
        measureLatencies: async () => [0],
      },
    )

    // Assert: the song runs to 4.5 s, silent past 3 s, where the audio ends.
    expect(plan.endFrame).toBe(216_000)
    expect(render.buffer.length).toBe(plan.endFrame + plan.tailFrames)
    const [source] = ctx.ofType<PlaybackSource>('source')
    expect(source.starts[0].slice(1)).toEqual([0.5, 1.5])
    render.release()
  })
})
