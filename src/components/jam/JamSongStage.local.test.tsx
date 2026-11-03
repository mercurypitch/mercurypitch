// ============================================================
// JamSongStage — the backing track is kept off AirPlay from the start
// ============================================================
//
// The stage's one <audio> plays into the room's graph once its context
// runs, and natively until then. An element AirPlay takes as remote
// playback plays on the TV and leaves the graph silent, so it is marked
// local in the markup, before anything can play it; the transport's own
// keepMediaLocal at the first play came too late for a page that offered
// it to a TV first (review, 2 Nov 2026).

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamKeyShiftDeps } from '@/lib/jam/jam-key-shift'
import type { JamSong } from '@/lib/jam/jam-song'

// The engine needs AudioWorklet; the markup does not.
vi.mock('@/lib/jam/jam-key-shift', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createJamKeyShift: (_deps: JamKeyShiftDeps) => ({
    backingOutput: (ctx: AudioContext) => ctx.destination,
    guideOutput: (ctx: AudioContext) => ctx.destination,
    apply: () => undefined,
    latencySec: () => 0,
    shiftSemitones: () => 0,
    available: () => true,
    dispose: () => undefined,
  }),
}))

// A stage asks for the audio engine on mount and waits for it; none is
// needed to read its markup.
vi.mock('@/stores/app-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  initAudioEngine: () => new Promise(() => undefined),
}))

import { setJamSong } from '@/stores/jam-store'
import { JamSongStage } from './JamSongStage'

const SONG: JamSong = {
  id: 'session:first',
  title: 'Tester - Ghosts',
  stems: { instrumental: 'blob:instrumental' },
  lines: [],
  notes: [],
  durationSec: 180,
  origin: 'local',
}

beforeEach(() => {
  // jsdom has no media pipeline; the stage pauses its element on the way out.
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  )
})

afterEach(() => {
  cleanup()
  setJamSong(null)
  vi.restoreAllMocks()
})

describe('the jam stage’s backing track', () => {
  it('is marked off AirPlay in its markup, before anything plays it', () => {
    setJamSong(SONG)

    const { container } = render(() => <JamSongStage />)

    const backing = container.querySelector('audio')
    expect(backing).not.toBeNull()
    expect(backing?.hasAttribute('disableremoteplayback')).toBe(true)
    expect(backing?.getAttribute('x-webkit-airplay')).toBe('deny')
  })
})
