// Studio graph quality tests — lanes built at the profile the graph is given.
import { describe, expect, it } from 'vitest'
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import { PlaybackContext } from './playback.test-fixtures'

const LIGHT: StudioFxProfile = {
  id: 'light',
  oversample: { saturation: '2x', exciter: 'none', limiter: 'none' },
}

/** One lane with a saturation, built at LIGHT, playing. */
function playingGraph() {
  const fixture = studioFixture()
  const frames = 48000 * 30
  const asset = {
    ...fixture.asset,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: frames * 4 + 32,
    byteLength: frames * 2 + 44,
  }
  const clip = { ...fixture.clip, sourceOutFrame: frames }
  const track = {
    ...fixture.project.tracks[0],
    fx: {
      ...fixture.project.tracks[0].fx,
      baseSpec: {
        version: 1 as const,
        effects: [
          {
            id: 'sat',
            kind: 'saturation' as const,
            enabled: true,
            params: { driveDb: 6, toneHz: 5000, outputDb: 0, mix: 35 },
          },
        ],
      },
    },
  }
  const song = { ...fixture.project, tracks: [track], clips: [clip] }
  const plan = compileStudioArrangement(song, [asset], {
    latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
  })
  const ctx = new PlaybackContext()
  ctx.currentTime = 1
  const buffer = ctx.createBuffer(1, frames, 48000) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    1.5,
    { profile: LIGHT },
  )
  graph.scheduleUntil(3)
  return { ctx, graph }
}

describe('Studio graph playback quality', () => {
  it('builds its lanes at the profile it is given', () => {
    const f = playingGraph()
    expect(f.graph.profile()).toBe(LIGHT)
    f.graph.dispose()
  })
})
