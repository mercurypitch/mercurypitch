// ============================================================
// First note's Web Audio player: a round from its place to its place, on
// the room's clock
// ============================================================
//
// The player is the real one, and so is Karaoke's streaming voice it plays
// each stem with (web-audio-song-player.fixture.ts): only the clock, the
// stems' files and their decoder are doubles, and the clock moves only when
// a test moves it. What this holds the player to is what the room reads off
// it, as off the element player (song-player.test.ts): a sound that plays
// from its `from`, fades out to end at its `to`, settles `done` true there
// and false short of it, and says where the band is, read here off the
// context's clock. And never more than a few seconds of a stem decoded:
// two whole stems were what iOS killed Karaoke for.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STREAMED_LOOKAHEAD_WINDOWS, STREAMED_WINDOW_SECONDS, } from '@/features/stem-mixer/stem-memory'
import { createStreamingStemVoice } from '@/features/stem-mixer/streaming-stem-voice'
import { ENVELOPE_DEFAULTS } from '@/lib/preview-player'
import { BAND_RELEASE_SECONDS, LINE_RELEASE_SECONDS, RELEASE_SLACK_MS, STOP_RELEASE_SECONDS, } from './first-note-rules'
import type { FirstNoteEntry } from './first-note-songs'
import type { SongSound } from './song-player'
import { createWebAudioSongPlayer, START_LEAD_SECONDS, } from './web-audio-song-player'
import type { FakeGain, ParamOp } from './web-audio-song-player.fixture'
import { BAND_LEVEL, FakeClock, fakeSong, fakeStreams, stubFrames, VOICE_LEVEL, } from './web-audio-song-player.fixture'

/** An entry: the band from 10 s, the singer in at 18, the line to 23. */
const ENTRY: FirstNoteEntry = {
  from: 10,
  at: 18,
  until: 23,
  midi: 60,
  beats: [],
}
const ATTACK_SECONDS = ENVELOPE_DEFAULTS.attackMs / 1000

let clock: FakeClock

const round6 = (seconds: number): number => Math.round(seconds * 1e6) / 1e6

/** What a gain was told, its times to the microsecond. */
function opsOf(gain: FakeGain): ParamOp[] {
  return gain.gain.ops.map((op) => ({ ...op, at: round6(op.at) }))
}

/** The fades a gain was told to close on. */
function closings(gain: FakeGain): ParamOp[] {
  return opsOf(gain)
    .filter((op) => op.op === 'target')
    .map((op) => ({ ...op, tau: round6(op.tau ?? 0) }))
}

/** The house attack (preview-player.ts openEnvelope) from `at` on the clock. */
function opening(at: number): ParamOp[] {
  return [
    { op: 'cancel', at: round6(at) },
    { op: 'set', value: 0.0001, at: round6(at) },
    { op: 'exp', value: 1, at: round6(at + ATTACK_SECONDS) },
  ]
}

/** The house release from `at` over `seconds`. */
function closing(at: number, seconds: number): ParamOp[] {
  return [{ op: 'target', value: 0, at: round6(at), tau: round6(seconds / 5) }]
}

/** Whether `sound` has settled, and how. */
function watched(sound: SongSound): () => boolean | null {
  let settled: boolean | null = null
  void sound.done.then((played) => {
    settled = played
  })
  return () => settled
}

/** The stems open and the voices schedule what they may. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(1)
}

/** The clock at `seconds`, and a frame drawn. */
async function clockAt(seconds: number): Promise<void> {
  clock.currentTime = seconds
  await vi.advanceTimersByTimeAsync(16)
}

/** A player on the clock, for `files`' songs. */
function playerFor(...files: ReturnType<typeof fakeSong>[]) {
  const streams = fakeStreams(files, createStreamingStemVoice)
  return { player: createWebAudioSongPlayer(streams)(clock.context), streams }
}

beforeEach(() => {
  vi.useFakeTimers()
  stubFrames()
  clock = new FakeClock()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a lead-in', () => {
  it("plays the band alone, from the entry's place, a moment after its stems open", async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)

    player.leadIn(files.song, ENTRY)
    await settle()

    expect(files.band.asked).toEqual([ENTRY.from])
    expect(files.voice.asked).toEqual([])
    expect(clock.windowsOf(VOICE_LEVEL)).toEqual([])
    expect(clock.windowsOf(BAND_LEVEL)[0].startedAt).toBe(START_LEAD_SECONDS)
    const gains = clock.stemGains()
    expect(gains).toHaveLength(1)
    expect(opsOf(gains[0])).toEqual(opening(START_LEAD_SECONDS))
  })

  it('fades the band out to end where the singer comes in, and settles played once the fade is over', async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)
    const sound = player.leadIn(files.song, ENTRY)
    const settled = watched(sound)
    await settle()
    const [band] = clock.stemGains()
    const fadeFrom =
      START_LEAD_SECONDS + (ENTRY.at - BAND_RELEASE_SECONDS - ENTRY.from)

    await clockAt(fadeFrom - 0.05)
    expect(closings(band)).toEqual([])

    await clockAt(fadeFrom)
    expect(closings(band)).toEqual(closing(fadeFrom, BAND_RELEASE_SECONDS))
    const silentAt = round6(
      fadeFrom + BAND_RELEASE_SECONDS + RELEASE_SLACK_MS / 1000,
    )
    for (const window of clock.windowsOf(BAND_LEVEL)) {
      expect(round6(window.stops[0])).toBe(silentAt)
    }
    expect(settled()).toBeNull()

    await vi.advanceTimersByTimeAsync(
      BAND_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )
    expect(settled()).toBe(true)
  })

  it("reads the band's place off the context's clock, and keeps it once the sound is let go", async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)
    const sound = player.leadIn(files.song, ENTRY)
    expect(sound.position()).toBe(ENTRY.from)
    await settle()

    await clockAt(START_LEAD_SECONDS - 0.1)
    expect(sound.position()).toBe(ENTRY.from)
    await clockAt(START_LEAD_SECONDS + 3.2)
    expect(sound.position()).toBeCloseTo(ENTRY.from + 3.2, 9)

    sound.stop()
    await vi.advanceTimersByTimeAsync(
      STOP_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )
    clock.currentTime = 30
    expect(sound.position()).toBeCloseTo(ENTRY.from + 3.2, 9)
  })

  it('holds a few seconds of the band decoded, never the song', async () => {
    const files = fakeSong('josephine', [ENTRY], 240)
    const { player } = playerFor(files)

    player.leadIn(files.song, ENTRY)
    await settle()
    await clockAt(START_LEAD_SECONDS + 1)

    expect(files.band.pulledSeconds).toBeGreaterThan(0)
    expect(files.band.pulledSeconds).toBeLessThanOrEqual(
      STREAMED_WINDOW_SECONDS * STREAMED_LOOKAHEAD_WINDOWS,
    )
  })
})

describe('a line', () => {
  it('plays the band and the voice together from the entry, opened alike into the room, and fades both out at its end', async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)
    const settled = watched(player.line(files.song, ENTRY))
    await settle()

    expect(files.band.asked).toEqual([ENTRY.at])
    expect(files.voice.asked).toEqual([ENTRY.at])
    expect(clock.windowsOf(BAND_LEVEL)[0].startedAt).toBe(START_LEAD_SECONDS)
    expect(clock.windowsOf(VOICE_LEVEL)[0].startedAt).toBe(START_LEAD_SECONDS)
    const gains = clock.stemGains()
    expect(gains.map(opsOf)).toEqual([
      opening(START_LEAD_SECONDS),
      opening(START_LEAD_SECONDS),
    ])

    const fadeFrom =
      START_LEAD_SECONDS + (ENTRY.until - LINE_RELEASE_SECONDS - ENTRY.at)
    await clockAt(fadeFrom)
    expect(gains.map(closings)).toEqual([
      closing(fadeFrom, LINE_RELEASE_SECONDS),
      closing(fadeFrom, LINE_RELEASE_SECONDS),
    ])
    await vi.advanceTimersByTimeAsync(
      LINE_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )
    expect(settled()).toBe(true)
  })
})

describe('a sound that stops short', () => {
  it('fades out quickly when stopped, its windows stopped after the fade, every node let go, and settles unplayed', async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)
    const sound = player.leadIn(files.song, ENTRY)
    const settled = watched(sound)
    await settle()
    await clockAt(2)
    const [band] = clock.stemGains()

    sound.stop()

    expect(closings(band)).toEqual(closing(2, STOP_RELEASE_SECONDS))
    const silentAt = round6(2 + STOP_RELEASE_SECONDS + RELEASE_SLACK_MS / 1000)
    for (const window of clock.windowsOf(BAND_LEVEL)) {
      expect(round6(window.stops[0])).toBe(silentAt)
    }
    expect(settled()).toBeNull()
    await vi.advanceTimersByTimeAsync(
      STOP_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )
    expect(settled()).toBe(false)
    const bus = clock.gains.find((gain) =>
      gain.connections.includes(clock.destination),
    )
    expect(
      clock.gains.filter((gain) => gain !== bus && !gain.disconnected),
    ).toEqual([])
    expect(clock.sources.filter((source) => !source.disconnected)).toEqual([])
  })

  it('plays nothing at all when stopped before its stems open', async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)
    const sound = player.leadIn(files.song, ENTRY)
    const settled = watched(sound)

    sound.stop()
    await settle()
    await vi.advanceTimersByTimeAsync(
      STOP_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )

    expect(clock.sources).toEqual([])
    expect(clock.stemGains()).toEqual([])
    expect(settled()).toBe(false)
  })

  it('settles unplayed when the song ends before the singer comes in', async () => {
    const files = fakeSong('josephine', [ENTRY], 12)
    const { player } = playerFor(files)
    const settled = watched(player.leadIn(files.song, ENTRY))
    await settle()
    const windows = clock.windowsOf(BAND_LEVEL)
    expect(windows).toHaveLength(1)

    await clockAt(START_LEAD_SECONDS + 2)
    windows[0].end()
    await vi.advanceTimersByTimeAsync(
      STOP_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )

    expect(settled()).toBe(false)
  })

  it('settles unplayed when iOS stops the clock short of the place', async () => {
    const files = fakeSong('josephine', [ENTRY])
    const { player } = playerFor(files)
    const settled = watched(player.leadIn(files.song, ENTRY))
    await settle()
    await clockAt(START_LEAD_SECONDS + 3)

    clock.interrupt()
    await vi.advanceTimersByTimeAsync(
      STOP_RELEASE_SECONDS * 1000 + RELEASE_SLACK_MS,
    )

    expect(settled()).toBe(false)
  })
})

describe("a song's stems", () => {
  it('are opened once for its rounds, and let go for the next song and at the end of the run', async () => {
    const first = fakeSong('josephine', [ENTRY])
    const second = fakeSong('nothing-in-the-dark', [ENTRY])
    const { player, streams } = playerFor(first, second)
    const urls = (files: ReturnType<typeof fakeSong>): string[] => [
      files.song.stems.instrumental,
      files.song.stems.vocal,
    ]

    player.leadIn(first.song, ENTRY)
    await settle()
    player.line(first.song, ENTRY)
    await settle()
    expect([...streams.opened].sort()).toEqual(urls(first).sort())
    expect([first.band.disposed, first.voice.disposed]).toEqual([false, false])

    player.leadIn(second.song, ENTRY)
    await settle()
    expect([first.band.disposed, first.voice.disposed]).toEqual([true, true])
    expect([...streams.opened].sort()).toEqual(
      [...urls(first), ...urls(second)].sort(),
    )

    player.dispose()
    await settle()
    expect([second.band.disposed, second.voice.disposed]).toEqual([true, true])
  })
})
