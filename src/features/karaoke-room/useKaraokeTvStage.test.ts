// ============================================================
// The room's stage on a connected TV: what the room sends, and when
// ============================================================
//
// The hook stands alone here, with a mixer whose clock, length and lane are
// signals, a microphone published as the mixer publishes it, and a device
// whose TV is told by the test when it shows the stage and records what it
// is sent. The rules: the song (or idle) goes each time the TV starts
// showing the stage and each time the song changes while it does, with the
// notes the phone's lane draws, as they change; frames go twenty a second,
// only while it shows the stage, and a frame whose clock reading is not a
// number still reaches the stage; the score is worked out every half
// second, not every frame; and a phone without a TV stage sends nothing.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls, LaneNote, } from '@/components/stem-mixer-hosting'
import type { FeedReading } from '@/lib/tv-stage/feed'
import type { TvStageFrame, TvStageMessage, TvStageSong, } from '@/lib/tv-stage/protocol'
import { readTvStageMessage } from '@/lib/tv-stage/protocol'
import { publishLiveMic } from '@/stores/live-mic-store'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { setTvStageOffsetMs } from '@/stores/tv-stage-store'
import { TV_STAGE_FRAME_MS, TV_STAGE_SCORE_EVERY, useKaraokeTvStage, } from './useKaraokeTvStage'

/** A note as the phone's lane draws it: seconds, under the editor's names. */
const LANE: readonly LaneNote[] = [{ startBeat: 1, endBeat: 2, midi: 64 }]

const TITLE = 'Goodbye to Spring'

/** An iPhone whose connected TV the test shows and hides. */
function fakeDevice() {
  let tell: ((showing: boolean) => void) | null = null
  const sent: TvStageMessage[] = []
  const stop = vi.fn()
  const device = {
    tvStage: {
      watch: (handler: (showing: boolean) => void) => {
        tell = handler
        return stop
      },
      send: (message: TvStageMessage) => {
        sent.push(message)
      },
    },
  }
  return {
    device: device as unknown as NativeDeviceApi,
    sent,
    stop,
    shows: (showing: boolean) => {
      tell?.(showing)
    },
  }
}

/** A mixer with a song in: what the hook reads of it, and nothing else. */
function fakeMixer() {
  const [elapsed, setElapsed] = createSignal(12)
  const [duration, setDuration] = createSignal(180)
  const [lane, setLane] = createSignal<readonly LaneNote[]>(LANE)
  const controls = {
    audibleElapsed: elapsed,
    duration,
    playing: () => true,
    speed: () => 1,
    laneNotes: lane,
    lyricWindowScript: (title: string) => ({
      title,
      duration: duration(),
      segments: [{ at: 0, current: [], next: 'First line', words: [] }],
    }),
  }
  return {
    controls: controls as unknown as HostedMixerControls,
    setElapsed,
    setDuration,
    setLane,
  }
}

/** A microphone published as a mixer publishes it. */
function fakeMic() {
  const readings: FeedReading[] = []
  const score = vi.fn(() => ({ totalNotes: 10, accuracyPct: 81, grade: 'B' }))
  const unpublish = publishLiveMic({
    readings: () => readings,
    readingLagSec: () => 0.1,
    score,
  })
  return { readings, score, unpublish }
}

let dispose: (() => void) | null = null
let mic: ReturnType<typeof fakeMic> | null = null

function mount(
  device: NativeDeviceApi | null,
  mixer: HostedMixerControls | null,
  title: string | null = TITLE,
) {
  createRoot((done) => {
    dispose = done
    useKaraokeTvStage({ device, mixer: () => mixer, title: () => title })
  })
}

const frames = (sent: readonly TvStageMessage[]): TvStageFrame[] =>
  sent.filter((message): message is TvStageFrame => message.kind === 'frame')
const songs = (sent: readonly TvStageMessage[]): TvStageSong[] =>
  sent.filter((message): message is TvStageSong => message.kind === 'song')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_790_000_000_000)
  setTvStageOffsetMs(0)
  mic = fakeMic()
})

afterEach(() => {
  dispose?.()
  dispose = null
  mic?.unpublish()
  mic = null
  vi.useRealTimers()
  setTvStageOffsetMs(0)
})

describe('the TV stage', () => {
  it('sends nothing while the TV shows something else', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)

    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 5)

    expect(tv.sent).toEqual([])
  })

  it('sends the song with the lane’s notes as the TV starts showing the stage, then frames twenty a second', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)

    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 4)

    expect(songs(tv.sent)).toHaveLength(1)
    expect(songs(tv.sent)[0]).toMatchObject({
      title: 'Goodbye to Spring',
      duration: 180,
      notes: [{ t0: 1, t1: 2, midi: 64 }],
    })
    expect(frames(tv.sent)).toHaveLength(5)
    expect(frames(tv.sent)[0]).toMatchObject({
      at: 1_790_000_000_000,
      position: 12,
      playing: true,
      rate: 1,
    })
  })

  it('sends the song again with the notes the lane draws each time they change on the phone', async () => {
    const tv = fakeDevice()
    const mixer = fakeMixer()
    mount(tv.device, mixer.controls)
    tv.shows(true)
    await vi.advanceTimersByTimeAsync(0)

    // A note edited a step up, and another read from the vocal.
    mixer.setLane([
      { startBeat: 1, endBeat: 2, midi: 66 },
      { startBeat: 3, endBeat: 3.5, midi: 62 },
    ])

    expect(songs(tv.sent).at(-1)?.notes).toEqual([
      { t0: 1, t1: 2, midi: 66 },
      { t0: 3, t1: 3.5, midi: 62 },
    ])
  })

  it('sends the song again when more of it arrives', async () => {
    const tv = fakeDevice()
    const mixer = fakeMixer()
    mount(tv.device, mixer.controls)
    tv.shows(true)
    await vi.advanceTimersByTimeAsync(0)
    const before = songs(tv.sent).length

    mixer.setDuration(181)

    expect(songs(tv.sent)).toHaveLength(before + 1)
    expect(songs(tv.sent).at(-1)).toMatchObject({ duration: 181 })
  })

  it('says idle while the room has no song', async () => {
    const tv = fakeDevice()
    mount(tv.device, null, null)

    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 3)

    expect(tv.sent).toEqual([{ v: 1, kind: 'idle' }])
  })

  it('stops the frames when the TV goes back to the phone', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)
    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS)
    const before = tv.sent.length

    tv.shows(false)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 10)

    expect(tv.sent).toHaveLength(before)
  })

  it('sends each reading once, moved back by the measured round trip', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)
    mic?.readings.push({ time: 11.9, frequency: 440 })
    tv.shows(true)
    mic?.readings.push({ time: 11.95, frequency: 880 })
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 2)

    const singer = frames(tv.sent).flatMap((frame) => frame.singer)
    expect(singer).toEqual([
      [11.8, 69],
      [11.85, 81],
    ])
  })

  it('keeps the stage running on its last clock through a reading of the song that is not a number', async () => {
    const tv = fakeDevice()
    const mixer = fakeMixer()
    mount(tv.device, mixer.controls)
    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS)

    mixer.setElapsed(Number.NaN)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS)

    const [good, bad] = frames(tv.sent).slice(-2)
    expect(readTvStageMessage(JSON.stringify(bad))).toEqual(bad)
    expect(bad).toMatchObject({ at: good.at, position: 12, playing: true })
  })

  it('works the score out every half second, not every frame', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)
    tv.shows(true)

    await vi.advanceTimersByTimeAsync(
      TV_STAGE_FRAME_MS * (TV_STAGE_SCORE_EVERY - 1),
    )

    expect(mic?.score).toHaveBeenCalledTimes(1)
    expect(frames(tv.sent).at(-1)?.score).toEqual({ pct: 81, grade: 'B' })
  })

  it('sends no readings and no score while no microphone is up', async () => {
    mic?.unpublish()
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)

    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS)

    expect(frames(tv.sent).every((frame) => frame.singer.length === 0)).toBe(
      true,
    )
    expect(frames(tv.sent).at(-1)?.score).toBeNull()
  })

  it('moves the picture by the Developer screen’s offset', () => {
    const tv = fakeDevice()
    setTvStageOffsetMs(250)
    mount(tv.device, fakeMixer().controls)

    tv.shows(true)

    expect(frames(tv.sent)[0]?.position).toBe(12.25)
  })

  it('stops hearing the TV when the room goes', () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)

    dispose?.()
    dispose = null

    expect(tv.stop).toHaveBeenCalledTimes(1)
  })

  it('says idle as the room closes while the TV shows the stage, so the song does not run on there', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)
    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 2)
    // The last frame before the room closes says the song is playing.
    expect(frames(tv.sent).at(-1)?.playing).toBe(true)

    dispose?.()
    dispose = null
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 4)

    expect(tv.sent.at(-1)).toEqual({ v: 1, kind: 'idle' })
  })

  it('says idle as the room closes after the TV went back to the phone, so a TV that comes back gets no old song', async () => {
    const tv = fakeDevice()
    mount(tv.device, fakeMixer().controls)
    tv.shows(true)
    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS)
    // Mirroring off, or the TV switched to Lyrics: the app still keeps the
    // song and the last frame for a stage page that loads later.
    tv.shows(false)
    const before = tv.sent.length

    dispose?.()
    dispose = null

    expect(tv.sent.slice(before)).toEqual([{ v: 1, kind: 'idle' }])
  })

  it('keeps sending the clock when the microphone throws, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mic?.unpublish()
    const unpublish = publishLiveMic({
      readings: () => {
        throw new Error('no readings')
      },
      readingLagSec: () => 0.1,
      score: () => {
        throw new Error('no score')
      },
    })
    try {
      const tv = fakeDevice()
      mount(tv.device, fakeMixer().controls)

      tv.shows(true)
      await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 3)

      expect(frames(tv.sent)).toHaveLength(4)
      expect(frames(tv.sent).at(-1)).toMatchObject({
        position: 12,
        playing: true,
        singer: [],
      })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('[tv stage]')
    } finally {
      unpublish()
      warn.mockRestore()
    }
  })

  it('does nothing on a phone with no TV stage', async () => {
    mount({} as NativeDeviceApi, fakeMixer().controls)

    await vi.advanceTimersByTimeAsync(TV_STAGE_FRAME_MS * 5)

    expect(mic?.score).not.toHaveBeenCalled()
  })
})
