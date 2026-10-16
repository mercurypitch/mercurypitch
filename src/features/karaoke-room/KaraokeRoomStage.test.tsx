// ============================================================
// The Karaoke room: arrival, the run, park and resume (plan S8 §2, §4.2)
// ============================================================
//
// The room hosts the stem mixer's zen stage; the mixer is stood in for here
// by a component that records what the room gave it and hands back controls
// the test can move, because what is under test is the ROOM's wiring: which
// song it cues and when, what it tells the shell, and what it keeps when it
// is taken off the screen and put back.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { Accessor, Setter } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftNotice } from '@/components/key-shift/KeyShiftControl'
import type { GuideLevel, StemMixerHosting, } from '@/components/stem-mixer-hosting'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import type { LyricGlance } from '@/lib/lyric-glance'
import type { NativeDeviceApi, NativeMediaAction, } from '@/stores/native-shell-store'
import { holdRoomArrival, nativeRunControls, registerNativeDevice, registerShellApi, resetRoomArrivalHolds, roomInPictureInPicture, } from '@/stores/native-shell-store'

interface FakeMixer {
  sessionId: string
  title: string
  stems: { vocal?: string; instrumental?: string }
  autoPlay: boolean | undefined
  initialSeekSec: number | undefined
  hosted: StemMixerHosting
  alive: boolean
  setPlaying: Setter<boolean>
  /** The system taking the sound: the real mixer pauses and says so. */
  setInterrupted: Setter<boolean>
  setLoading: Setter<boolean>
  setElapsed: Setter<number>
  /** The clock the lyrics follow: what has reached the speakers. */
  setAudibleElapsed: Setter<number>
  /** The position jumping as a seek or a tapped line moves it. */
  jump: (seconds: number) => void
  /** The song's clock starting while it plays: its resume behind the app. */
  clockStart: () => void
  setSpeed: Setter<number>
  setDuration: Setter<number>
  setLoadError: Setter<string>
  /** The singer moving the sing pill. */
  setGuideLevel: Setter<GuideLevel>
  setHasNotes: Setter<boolean>
  setMusicLevel: Setter<number>
  /** The line being sung and the next, as the stage has them. */
  setLyricGlance: Setter<LyricGlance>
  /** The singer turning the microphone on or off on the stage. */
  setMicOn: Setter<boolean>
  resetMusicLevel: Mock
  /** The room putting the guide back. */
  setGuide: Mock
  play: Mock
  pause: Mock
  /** The clock about to stop: a playing song pauses with its fade. */
  prepareToSuspend: Mock
  seek: Mock
  /** Where the song is by the audio clock: the elapsed time, here. */
  positionNow: Mock
  releaseMic: Mock
  resumeMic: Mock
  /** The singer's key, as the mixer hands it to the room. */
  keyShift: Accessor<number>
  setKeyShift: Mock
  findMyKey: Mock
  /** The room's options holding Find my key's notices (true) or not. */
  holdKeyNotices: Mock
  setKeyNotice: Setter<KeyShiftNotice | null>
}

const mixers = vi.hoisted(() => ({ list: [] as FakeMixer[] }))

vi.mock('@/components/StemMixer', async () => {
  const { createSignal, onCleanup, onMount, untrack } = await import('solid-js')
  return {
    StemMixer: (props: {
      sessionId: string
      songTitle: string
      stems: { vocal?: string; instrumental?: string }
      autoPlay?: boolean
      initialSeekSec?: number
      hosted: StemMixerHosting
    }) => {
      const [playing, setPlaying] = createSignal(false)
      const [interrupted, setInterrupted] = createSignal(false)
      const [loading, setLoading] = createSignal(true)
      const [loadError, setLoadError] = createSignal('')
      const [elapsed, setElapsed] = createSignal(0)
      const [audibleElapsed, setAudibleElapsed] = createSignal(0)
      const [jumps, setJumps] = createSignal(0)
      const [clockStarts, setClockStarts] = createSignal(0)
      const [speed, setSpeed] = createSignal(1)
      const [duration, setDuration] = createSignal(246)
      // As the real mixer moves both clocks and then says it jumped.
      const jump = (seconds: number): void => {
        setElapsed(seconds)
        setAudibleElapsed(seconds)
        setJumps((count) => count + 1)
      }
      // As the real mixer counts its clock starting while the song plays.
      const clockStart = (): void => {
        setClockStarts((count) => count + 1)
      }
      const [hasNotes, setHasNotes] = createSignal(true)
      const [musicLevel, setMusicLevel] = createSignal(0.7)
      const [lyricGlance, setLyricGlance] = createSignal<LyricGlance>({
        current: null,
        next: null,
        words: [],
        sungUpTo: -1,
        sweep: 0,
      })
      const [micOn, setMicOn] = createSignal(false)
      const [keyShift, setKeyShiftValue] = createSignal(0)
      const [keyNotice, setKeyNotice] = createSignal<KeyShiftNotice | null>(
        null,
      )
      const [guide, setGuideLevel] = createSignal<GuideLevel>({
        volume: 0.8,
        muted: false,
      })
      // What the room mounted this mixer with: read once, as the real one
      // reads them, which is the thing the tests look at. The rule cannot
      // see that `untrack` here is solid's, taken from a dynamic import.
      // eslint-disable-next-line solid/reactivity
      const given = untrack(() => ({
        sessionId: props.sessionId,
        title: props.songTitle,
        stems: props.stems,
        autoPlay: props.autoPlay,
        initialSeekSec: props.initialSeekSec,
        hosted: props.hosted,
      }))
      const mixer: FakeMixer = {
        ...given,
        alive: true,
        setPlaying,
        setInterrupted,
        setLoading,
        setElapsed,
        setAudibleElapsed,
        jump,
        clockStart,
        setSpeed,
        setDuration,
        setLoadError,
        setGuideLevel,
        setHasNotes,
        setMusicLevel,
        setLyricGlance,
        setMicOn,
        resetMusicLevel: vi.fn(() => setMusicLevel(0.7)),
        setGuide: vi.fn((level: GuideLevel) => setGuideLevel(level)),
        play: vi.fn(() => setPlaying(true)),
        pause: vi.fn(() => setPlaying(false)),
        prepareToSuspend: vi.fn(() => {
          if (!playing()) return 0
          setPlaying(false)
          return 80
        }),
        seek: vi.fn((seconds: number) => jump(seconds)),
        positionNow: vi.fn(() => elapsed()),
        releaseMic: vi.fn(() => setMicOn(false)),
        resumeMic: vi.fn(() => setMicOn(true)),
        keyShift,
        setKeyShift: vi.fn((value: number) => setKeyShiftValue(value)),
        findMyKey: vi.fn(),
        holdKeyNotices: vi.fn(),
        setKeyNotice,
      }
      mixers.list.push(mixer)
      onMount(() => {
        given.hosted.attach({
          playing,
          interrupted,
          loading,
          loadError,
          elapsed,
          positionNow: mixer.positionNow,
          audibleElapsed,
          jumps,
          clockStarts,
          speed,
          duration,
          hasNotes,
          musicLevel,
          play: mixer.play,
          pause: mixer.pause,
          prepareToSuspend: mixer.prepareToSuspend,
          seek: mixer.seek,
          resetMusicLevel: mixer.resetMusicLevel,
          releaseMic: mixer.releaseMic,
          micOn,
          resumeMic: mixer.resumeMic,
          guide,
          setGuide: mixer.setGuide,
          lyricGlance,
          lyricWindowScript: (title: string) => ({
            title,
            duration: duration(),
            segments: [],
          }),
          key: {
            value: keyShift,
            heard: keyShift,
            onChange: mixer.setKeyShift,
            keyLabel: () => 'A major',
            suggestion: () => null,
            onFindKey: mixer.findMyKey,
            disabledReason: () => undefined,
            notice: keyNotice,
            holdNotices: mixer.holdKeyNotices,
          },
        })
      })
      onCleanup(() => {
        mixer.alive = false
      })
      return <div data-testid="fake-mixer" data-session={props.sessionId} />
    },
  }
})

const seeding = vi.hoisted(() => ({ done: Promise.resolve() }))

/** Stage 2 (a dev-target build), switched per test. */
const build = vi.hoisted(() => ({ importing: false }))
vi.mock('@/lib/native-build', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    get KARAOKE_IMPORT() {
      return build.importing
    },
  }
})

const imports = vi.hoisted(() => ({ inFlight: 0, played: [] as string[] }))
vi.mock('./karaoke-import-queue', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  importsInFlight: () => imports.inFlight,
  markKaraokeSongPlayed: (id: string) => imports.played.push(id),
}))
vi.mock('./KaraokeImport', () => ({
  KaraokeImport: () => <div data-testid="karaoke-import" />,
}))

vi.mock('@/features/karaoke-night/seed-examples', () => ({
  whenBundledExamplesSeeded: async () => seeding.done,
}))

const library = vi.hoisted(() => ({
  rows: [] as Array<{
    sessionId: string
    title: string
    artist: string | null
    durationSec: number | null
    credit: string | null
    kind: 'example' | 'yours'
    stems: { vocal: string; instrumental: string }
  }>,
}))

vi.mock('./karaoke-room-library', () => ({
  roomLibrary: () => library.rows,
  hydrateSong: async (row: { stems: unknown }) => Promise.resolve(row.stems),
}))

vi.mock('@/features/backgrounds/PremiumBackgroundPicker', () => ({
  PremiumBackgroundPicker: () => <div data-testid="fake-background-picker" />,
}))

vi.mock('@/lib/backgrounds/background-surface', () => ({
  useBackgroundSurfaceController: () => ({
    resolvedStyle: () => ({ '--mp-stage-image': 'url("/room.webp")' }),
  }),
}))

import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { KARAOKE_LAST_SONG_KEY, KARAOKE_PINNED_KEY, karaokeLyricsSize, karaokeNoteGlyphs, karaokePlayNext, karaokeSongRequest, karaokeStagedSong, requestKaraokeSong, resetKaraokeRoomForTests, setKaraokeBackgroundPlay, setKaraokePictureInPicture, setKaraokePlayNext, } from './karaoke-room-store'
import { resetKaraokeSongsForTests } from './karaoke-songs'
import { KaraokeRoomStage, MIC_RESTORE_DELAY_MS, UNKNOWN_ARTIST, } from './KaraokeRoomStage'

const example = (slug: string, title: string, dir: string) => ({
  sessionId:
    slug === 'karaoke-night'
      ? 'karaoke-night-demo'
      : `karaoke-night-demo:${slug}`,
  title,
  artist: 'Josh Woodward',
  durationSec: 246,
  credit: 'Josh Woodward · CC BY 4.0',
  kind: 'example' as const,
  stems: {
    vocal: `/karaoke/examples/${dir}/vocal.m4a`,
    instrumental: `/karaoke/examples/${dir}/instrumental.m4a`,
  },
})

const GOODBYE = example(
  'karaoke-night',
  'Goodbye to Spring',
  'goodbye-to-spring',
)
const JOSEPHINE = example(
  'josephine',
  "I'll Be Right Behind You, Josephine",
  'josephine',
)
const DARK = example(
  'nothing-in-the-dark',
  'Nothing in the Dark',
  'nothing-in-the-dark',
)

interface FakeDevice extends NativeDeviceApi {
  /** False as on Android; a test of iOS's microphone sets it. */
  micStopsOtherApps: boolean
  acquireAudio: Mock
  keepAwake: Mock
  holdAudioInBackground: Mock
  nowPlaying: Mock
  onMediaAction: Mock
  pictureInPictureAutoEnter: Mock
  onPictureInPicture: Mock
  /** Null as on Android; a test of iOS's window sets one. */
  pictureInPictureLyrics: Mock | null
  lease: {
    ensure: Mock
    unlock: Mock
    release: Mock
  }
  /** Background holds taken and not let go yet. */
  holds: () => number
  /** A press on the system's media controls. */
  press: (action: NativeMediaAction) => void
  /** Media-button handlers still subscribed. */
  mediaListeners: () => number
  /** Android opening the small window (true) or closing it (false). */
  windowed: (inWindow: boolean) => void
}

function fakeDevice(): FakeDevice {
  const lease = {
    ensure: vi.fn(() => null),
    unlock: vi.fn(async () => Promise.resolve(true)),
    release: vi.fn(),
  }
  let holds = 0
  const handlers = new Set<(action: NativeMediaAction) => void>()
  const windowHandlers = new Set<(inWindow: boolean) => void>()
  return {
    micStopsOtherApps: false,
    acquireAudio: vi.fn(() => lease),
    keepAwake: vi.fn(),
    holdAudioInBackground: vi.fn(() => {
      holds += 1
      let released = false
      return () => {
        if (released) return
        released = true
        holds -= 1
      }
    }),
    nowPlaying: vi.fn(),
    onMediaAction: vi.fn((handler: (action: NativeMediaAction) => void) => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    }),
    pictureInPictureAutoEnter: vi.fn(),
    onPictureInPicture: vi.fn((handler: (inWindow: boolean) => void) => {
      windowHandlers.add(handler)
      return () => {
        windowHandlers.delete(handler)
      }
    }),
    pictureInPictureLyrics: null,
    lease,
    holds: () => holds,
    press: (action) => {
      for (const handler of [...handlers]) handler(action)
    },
    mediaListeners: () => handlers.size,
    windowed: (inWindow) => {
      for (const handler of [...windowHandlers]) handler(inWindow)
    },
  }
}

/** A glance as the mixer hands it over, the first `sungUpTo + 1` words lit. */
function glance(
  current: string | null,
  next: string | null,
  sungUpTo?: number,
  sweep = 0,
): LyricGlance {
  const words = current === null ? [] : current.split(' ')
  return { current, next, words, sungUpTo: sungUpTo ?? words.length - 1, sweep }
}

/** The OS taking the app away, or bringing it back. */
function sendAppAway(away: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (away ? 'hidden' : 'visible'),
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

let device: FakeDevice
let unregisterDevice: () => void

const current = (): FakeMixer => {
  const alive = mixers.list.filter((mixer) => mixer.alive)
  const mixer = alive.at(-1)
  if (mixer === undefined) throw new Error('no mixer on the stage')
  return mixer
}

async function mountRoom(): Promise<() => void> {
  const { unmount } = render(() => <KaraokeRoomStage />)
  await vi.waitFor(() => {
    expect(mixers.list.some((mixer) => mixer.alive)).toBe(true)
  })
  return unmount
}

/** Let every pending promise and timer of a few frames run. */
const settleFor = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const controls = () => {
  const registered = nativeRunControls()
  if (registered === null) throw new Error('the room registered nothing')
  return registered
}

beforeEach(() => {
  build.importing = false
  imports.inFlight = 0
  imports.played = []
  resetKaraokeSongsForTests()
  mixers.list = []
  library.rows = [GOODBYE, JOSEPHINE, DARK]
  seeding.done = Promise.resolve()
  localStorage.clear()
  resetKaraokeRoomForTests()
  resetRoomArrivalHolds()
  device = fakeDevice()
  unregisterDevice = registerNativeDevice(device)
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(document, 'visibilityState')
  unregisterDevice()
  resetRoomArrivalHolds()
  vi.clearAllMocks()
})

describe('arriving', () => {
  it('cues Goodbye to Spring on a first visit, paused at the top', async () => {
    await mountRoom()

    expect(current().sessionId).toBe(GOODBYE.sessionId)
    expect(current().title).toBe('Goodbye to Spring')
    expect(current().stems).toEqual(GOODBYE.stems)
    expect(current().autoPlay).not.toBe(true)
    expect(current().play).not.toHaveBeenCalled()
    expect(controls().isPlaying()).toBe(false)
    expect(controls().isPaused()).toBe(false)
    // A first visit leaves the guide vocal where the mixer starts it.
    expect(current().setGuide).not.toHaveBeenCalled()
  })

  it('cues the last song sung', async () => {
    localStorage.setItem(KARAOKE_LAST_SONG_KEY, JOSEPHINE.sessionId)
    await mountRoom()

    expect(current().sessionId).toBe(JOSEPHINE.sessionId)
  })

  it('falls back to the first example when the last song is gone', async () => {
    localStorage.setItem(KARAOKE_LAST_SONG_KEY, 'a-song-that-was-removed')
    await mountRoom()

    expect(current().sessionId).toBe(GOODBYE.sessionId)
  })

  it('waits for the door before it puts anything on the stage', async () => {
    const release = holdRoomArrival()
    render(() => <KaraokeRoomStage />)
    // Long enough for the seed and the cue to have run, were it not held.
    await settleFor(30)
    expect(mixers.list).toHaveLength(0)

    release()
    await vi.waitFor(() => {
      expect(mixers.list).toHaveLength(1)
    })
  })

  it('waits for the seed, so a first launch finds its library', async () => {
    let finish: () => void = () => undefined
    seeding.done = new Promise<void>((resolve) => {
      finish = resolve
    })
    library.rows = []
    render(() => <KaraokeRoomStage />)
    await settleFor(30)
    expect(mixers.list).toHaveLength(0)

    library.rows = [GOODBYE, JOSEPHINE, DARK]
    finish()
    await vi.waitFor(() => {
      expect(mixers.list).toHaveLength(1)
    })
    expect(current().sessionId).toBe(GOODBYE.sessionId)
  })

  it('puts the credit on the song line', async () => {
    await mountRoom()

    expect(current().hosted.stage.byline()).toBe('Josh Woodward · CC BY 4.0')
  })
})

describe('what it tells the shell', () => {
  it('registers as the Karaoke tab, with its own transport', async () => {
    await mountRoom()

    expect(controls().tab).toBe(TAB_KARAOKE)
    expect(controls().roomLabel).toBe('Broadway Theater')
    expect(controls().ownsTransport).toBe(true)
    expect(controls().optionsLabel).toBe('Karaoke options')
  })

  it('is a run once the song plays, and paused mid-song is still one', async () => {
    await mountRoom()
    current().setLoading(false)

    current().setPlaying(true)
    expect(controls().isPlaying()).toBe(true)

    controls().pause()
    expect(current().pause).toHaveBeenCalledTimes(1)
    expect(controls().isPlaying()).toBe(false)
    expect(controls().isPaused()).toBe(true)

    controls().resume()
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('remembers the song once it has been sung', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    expect(localStorage.getItem(KARAOKE_LAST_SONG_KEY)).toBe(GOODBYE.sessionId)
  })

  it('stops back to the top, and the run is over', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().setElapsed(40)

    controls().stop()

    expect(current().pause).toHaveBeenCalled()
    expect(current().seek).toHaveBeenLastCalledWith(0)
    expect(controls().isPlaying()).toBe(false)
    expect(controls().isPaused()).toBe(false)
  })
})

describe('parking, and coming back', () => {
  it('pauses, lets the microphone go, and keeps the place', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().setElapsed(31)

    controls().park()

    expect(current().pause).toHaveBeenCalledTimes(1)
    expect(current().releaseMic).toHaveBeenCalledTimes(1)
    expect(controls().isPaused()).toBe(true)
  })

  it('comes back after an unmount on the same song, paused at the same place', async () => {
    const unmount = await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().setElapsed(31)
    controls().park()
    unmount()
    expect(mixers.list.every((mixer) => !mixer.alive)).toBe(true)

    await mountRoom()

    expect(current().sessionId).toBe(GOODBYE.sessionId)
    expect(current().initialSeekSec).toBe(31)
    expect(current().autoPlay).not.toBe(true)
    // Still a paused run from the first frame: the rail must not flash back
    // while the song is loading again.
    expect(controls().isPaused()).toBe(true)
  })

  it('puts the guide vocal back where the singer left it', async () => {
    const unmount = await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().setGuideLevel({ volume: 0.3, muted: true })
    controls().park()
    unmount()

    await mountRoom()

    expect(current().setGuide).toHaveBeenCalledWith({
      volume: 0.3,
      muted: true,
    })
  })

  it('pauses when the app is sent away, with background play off', async () => {
    setKaraokeBackgroundPlay(false)
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    sendAppAway(true)

    expect(current().pause).toHaveBeenCalledTimes(1)
    expect(current().releaseMic).toHaveBeenCalledTimes(1)
  })
})

describe('behind another app', () => {
  it('keeps playing when the app is sent away, and lets the microphone go', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    sendAppAway(true)

    expect(current().pause).not.toHaveBeenCalled()
    expect(current().releaseMic).toHaveBeenCalledTimes(1)
    expect(controls().isPlaying()).toBe(true)
    expect(device.holds()).toBe(1)
  })

  it('holds the audio for the run, through the gap before the next song', async () => {
    await mountRoom()
    expect(device.holds()).toBe(0)
    current().setLoading(false)
    current().setPlaying(true)
    expect(device.holds()).toBe(1)
    sendAppAway(true)

    current().setPlaying(false)
    current().hosted.onEnded()
    await vi.waitFor(() => {
      expect(current().sessionId).toBe(JOSEPHINE.sessionId)
    })
    expect(device.holds()).toBe(1)

    controls().stop()
    expect(device.holds()).toBe(0)
  })

  it('lets the audio go for a song paused back there, and takes it again on play', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    sendAppAway(true)

    device.press('pause')
    expect(current().pause).toHaveBeenCalledTimes(1)
    expect(device.holds()).toBe(0)

    device.press('play')
    expect(current().play).toHaveBeenCalledTimes(1)
    expect(device.holds()).toBe(1)
  })

  it('keeps a paused run held while the app is in front', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    controls().pause()

    expect(controls().isPaused()).toBe(true)
    expect(device.holds()).toBe(1)
  })

  it('tells the system what is playing, and that nothing is once the run is over', async () => {
    await mountRoom()
    expect(device.nowPlaying).not.toHaveBeenCalled()
    current().setLoading(false)

    current().setPlaying(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith({
      title: 'Goodbye to Spring',
      artist: 'Josh Woodward · CC BY 4.0',
      playing: true,
      position: 0,
      duration: 246,
      rate: 1,
      interrupted: false,
    })

    controls().pause()
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: false, interrupted: false }),
    )

    controls().stop()
    expect(device.nowPlaying).toHaveBeenLastCalledWith(null)
  })

  it('tells the system a pause was its own when it took the sound', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    // A call or another app: the mixer pauses, then says why.
    current().setPlaying(false)
    current().setInterrupted(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: false, interrupted: true }),
    )

    current().setInterrupted(false)
    current().setPlaying(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, interrupted: false }),
    )
  })

  it('names an unknown artist for a song without one', async () => {
    library.rows = [{ ...GOODBYE, artist: null, credit: null }, JOSEPHINE]
    await mountRoom()
    current().setLoading(false)

    current().setPlaying(true)

    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Goodbye to Spring',
        artist: UNKNOWN_ARTIST,
      }),
    )
  })

  it('tells the system where the song is, on the clock the lyrics follow', async () => {
    await mountRoom()
    current().setLoading(false)
    // The render clock runs ahead of the speakers by the output latency.
    // The lyrics follow the speakers, and so does the bar.
    current().setElapsed(12.75)
    current().setAudibleElapsed(12.5)

    current().setPlaying(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({
        playing: true,
        position: 12.5,
        duration: 246,
        rate: 1,
      }),
    )
    const told = device.nowPlaying.mock.calls.length

    // The clock running on is the system's to draw, not news.
    current().setElapsed(30.25)
    current().setAudibleElapsed(30)
    expect(device.nowPlaying).toHaveBeenCalledTimes(told)

    // A seek, or a line tapped: the bar goes where the song went.
    current().jump(101)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, position: 101 }),
    )

    // A pause holds the bar where the lyrics stopped.
    current().setAudibleElapsed(140.5)
    controls().pause()
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: false, position: 140.5 }),
    )

    // A slower song moves the bar slower.
    controls().resume()
    current().setSpeed(0.75)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, position: 140.5, rate: 0.75 }),
    )
  })

  it("tells the system again when the song's clock starts", async () => {
    // On iOS the clock starting takes the lock screen's bar and skips from
    // the carrier, and a report puts it back (carrier-in-front.ts).
    await mountRoom()
    current().setLoading(false)
    current().setAudibleElapsed(42.5)
    current().setPlaying(true)
    const told = device.nowPlaying.mock.calls.length

    current().clockStart()

    expect(device.nowPlaying).toHaveBeenCalledTimes(told + 1)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, position: 42.5 }),
    )
  })

  it("puts the next song's length on the bar, never the last one's", async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().jump(200)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: 200, duration: 246 }),
    )
    const first = current()

    first.hosted.onNext()
    await vi.waitFor(() => {
      expect(current()).not.toBe(first)
    })
    // Still loading: no length yet, so no bar.
    current().setDuration(0)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: 0, duration: 0 }),
    )

    current().setDuration(181.5)
    current().setLoading(false)
    current().setPlaying(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, position: 0, duration: 181.5 }),
    )
  })

  it('answers the media buttons, and leaves a playing song alone on play', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    device.press('play')
    expect(current().play).not.toHaveBeenCalled()

    device.press('pause')
    expect(controls().isPaused()).toBe(true)

    device.press('play')
    expect(controls().isPlaying()).toBe(true)

    device.press('stop')
    expect(controls().isPlaying()).toBe(false)
    expect(controls().isPaused()).toBe(false)
    expect(current().seek).toHaveBeenLastCalledWith(0)
  })

  it("seeks where the system's progress bar is let go, and tells the bar", async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    device.press({ seekTo: 101.5 })

    expect(current().seek).toHaveBeenLastCalledWith(101.5)
    expect(controls().isPlaying()).toBe(true)
    // The jump is what reports the place again: the bar runs on from it.
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, position: 101.5 }),
    )
  })

  it('keeps a seek inside the song', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    device.press({ seekTo: 300 })
    expect(current().seek).toHaveBeenLastCalledWith(246)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: 246, duration: 246 }),
    )

    device.press({ seekTo: -2 })
    expect(current().seek).toHaveBeenLastCalledWith(0)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: 0 }),
    )
  })

  it('skips from where the song is now, and stays inside it', async () => {
    // iOS's 10 s back and forward, counted from the audio clock.
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().setElapsed(100)

    device.press({ skipBy: 10 })
    expect(current().seek).toHaveBeenLastCalledWith(110)
    expect(controls().isPlaying()).toBe(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true, position: 110 }),
    )

    device.press({ skipBy: -10 })
    expect(current().seek).toHaveBeenLastCalledWith(100)

    current().setElapsed(4)
    device.press({ skipBy: -10 })
    expect(current().seek).toHaveBeenLastCalledWith(0)

    current().setElapsed(240)
    device.press({ skipBy: 10 })
    expect(current().seek).toHaveBeenLastCalledWith(246)
  })

  it('leaves a paused song paused where the bar lands', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    controls().pause()
    current().play.mockClear()

    device.press({ seekTo: 60 })

    expect(current().seek).toHaveBeenLastCalledWith(60)
    expect(current().play).not.toHaveBeenCalled()
    expect(controls().isPaused()).toBe(true)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: false, position: 60 }),
    )
  })

  it('takes no seek while the next song loads, or once the run is over', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    const first = current()

    // Next, mid-run: the run goes on while the next song loads.
    first.hosted.onNext()
    await vi.waitFor(() => {
      expect(current()).not.toBe(first)
    })
    device.press({ seekTo: 30 })
    expect(current().seek).not.toHaveBeenCalled()

    current().setLoading(false)
    current().setPlaying(true)
    controls().stop()
    current().seek.mockClear()

    device.press({ seekTo: 30 })
    expect(current().seek).not.toHaveBeenCalled()
  })

  it('lets everything go when the room does', async () => {
    const unmount = await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    expect(device.mediaListeners()).toBe(1)

    unmount()

    expect(device.holds()).toBe(0)
    expect(device.mediaListeners()).toBe(0)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(null)
  })

  it('does none of it with the setting off', async () => {
    setKaraokeBackgroundPlay(false)
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    expect(device.holds()).toBe(0)
    expect(device.nowPlaying).not.toHaveBeenCalled()
    expect(device.mediaListeners()).toBe(0)
  })

  it('stops holding and announcing when the setting is turned off mid-song', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    expect(device.holds()).toBe(1)

    setKaraokeBackgroundPlay(false)

    expect(device.holds()).toBe(0)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(null)
    expect(device.mediaListeners()).toBe(0)
  })
})

describe('in the small window (Android)', () => {
  const playSong = async (): Promise<() => void> => {
    const unmount = await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    return unmount
  }

  it('lets the app go into the window only while a song plays', async () => {
    await mountRoom()
    current().setLoading(false)
    expect(device.pictureInPictureAutoEnter).not.toHaveBeenCalled()

    current().setPlaying(true)
    controls().pause()
    controls().resume()

    expect(device.pictureInPictureAutoEnter.mock.calls).toEqual([
      [true],
      [false],
      [true],
    ])
  })

  it('shows the line being sung, the next and the title, and nothing else', async () => {
    await playSong()
    current().setLyricGlance(
      glance('The harbour lights are low', 'And the tide is coming in'),
    )

    device.windowed(true)

    const lyricsWindow = screen.getByTestId('karaoke-lyrics-window')
    expect(lyricsWindow.textContent).toBe(
      'Goodbye to SpringThe harbour lights are lowAnd the tide is coming in',
    )
    expect(within(lyricsWindow).queryAllByRole('button')).toHaveLength(0)
    expect(roomInPictureInPicture()).toBe(true)

    current().setLyricGlance(glance(null, 'Hold the rope'))
    expect(screen.getByTestId('karaoke-lyrics-window-line').textContent).toBe(
      'Hold the rope',
    )
    expect(screen.queryByTestId('karaoke-lyrics-window-next')).toBeNull()
  })

  it('lets the microphone go and closes what was open, the song still playing', async () => {
    await playSong()
    controls().openOptions?.()
    await screen.findByTestId('karaoke-options')

    device.windowed(true)

    expect(current().releaseMic).toHaveBeenCalledTimes(1)
    expect(current().pause).not.toHaveBeenCalled()
    expect(controls().isPlaying()).toBe(true)
    await vi.waitFor(() => {
      expect(screen.queryByTestId('karaoke-options')).toBeNull()
    })
  })

  it('gives the room back as it was on the way out of the window', async () => {
    await playSong()
    device.windowed(true)

    device.windowed(false)

    expect(screen.queryByTestId('karaoke-lyrics-window')).toBeNull()
    expect(roomInPictureInPicture()).toBe(false)
    expect(screen.getByTestId('fake-mixer')).toBeTruthy()
  })

  it('keeps the stage running but out of reach under the window', async () => {
    await playSong()
    const stage = screen.getByTestId('karaoke-stage')
    expect(stage.inert).toBe(false)

    device.windowed(true)
    expect(stage.inert).toBe(true)
    expect(within(stage).getByTestId('fake-mixer')).toBeTruthy()

    device.windowed(false)
    expect(stage.inert).toBe(false)
  })

  it('lights the words sung so far, and the one being sung part way', async () => {
    await playSong()
    device.windowed(true)

    current().setLyricGlance(
      glance('The harbour lights are low', 'And the tide is coming in', 1, 0.5),
    )

    const line = screen.getByTestId('karaoke-lyrics-window-line')
    expect(line.textContent).toBe('The harbour lights are low')
    const words = [...line.querySelectorAll('span')]
    expect(words.map((word) => word.hasAttribute('data-sung'))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
    expect(words[2].style.getPropertyValue('--sweep')).toBe('50%')
    expect(words[3].style.getPropertyValue('--sweep')).toBe('')
  })

  it("gives the window Android's play and pause with background play off", async () => {
    setKaraokeBackgroundPlay(false)
    await playSong()
    expect(device.mediaListeners()).toBe(0)

    device.windowed(true)
    expect(device.mediaListeners()).toBe(1)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Goodbye to Spring', playing: true }),
    )
    device.press('pause')
    expect(controls().isPaused()).toBe(true)

    device.windowed(false)
    expect(device.mediaListeners()).toBe(0)
    expect(device.nowPlaying).toHaveBeenLastCalledWith(null)
  })

  it('keeps the media buttons it had when the window opens over background play', async () => {
    await playSong()
    expect(device.onMediaAction).toHaveBeenCalledTimes(1)

    device.windowed(true)
    device.windowed(false)

    expect(device.onMediaAction).toHaveBeenCalledTimes(1)
    expect(device.mediaListeners()).toBe(1)
  })

  it('stays out of the window with the setting off', async () => {
    setKaraokePictureInPicture(false)
    await playSong()

    expect(device.pictureInPictureAutoEnter).not.toHaveBeenCalled()
  })

  it('turns the window off and lets go of it when the room does', async () => {
    const unmount = await playSong()
    device.windowed(true)

    unmount()

    expect(device.pictureInPictureAutoEnter).toHaveBeenLastCalledWith(false)
    expect(roomInPictureInPicture()).toBe(false)
  })
})

describe('in the small window (iOS)', () => {
  // iOS draws the window itself, from the lyrics worked out ahead.
  beforeEach(() => {
    device.pictureInPictureLyrics = vi.fn()
  })
  const lyricsSent = (): unknown[] =>
    device.pictureInPictureLyrics?.mock.calls.map(([script]) => script) ?? []

  it("hands the window the song's lyrics, and takes them away with the room", async () => {
    const unmount = await mountRoom()
    current().setLoading(false)

    expect(lyricsSent().at(-1)).toEqual({
      title: 'Goodbye to Spring',
      duration: 246,
      segments: [],
    })

    current().setDuration(250)
    expect(lyricsSent().at(-1)).toMatchObject({ duration: 250 })

    unmount()
    expect(lyricsSent().at(-1)).toBeNull()
  })

  it('keeps the room on the page while the window is open', async () => {
    // iOS's window draws the lyrics itself: the page is not in it, and the
    // shell keeps its chrome.
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    device.windowed(true)

    expect(screen.queryByTestId('karaoke-lyrics-window')).toBeNull()
    expect(screen.getByTestId('karaoke-stage').hasAttribute('inert')).toBe(
      false,
    )
    expect(roomInPictureInPicture()).toBe(false)
    // The window is still open as far as the room's sound goes.
    expect(current().hosted.keepsPlayingHidden?.()).toBe(true)
  })

  it('opens only while the song keeps playing behind other apps', async () => {
    setKaraokeBackgroundPlay(false)
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    expect(device.pictureInPictureAutoEnter).not.toHaveBeenCalled()
    expect(lyricsSent().at(-1) ?? null).toBeNull()

    setKaraokeBackgroundPlay(true)

    expect(device.pictureInPictureAutoEnter.mock.calls).toEqual([[true]])
    expect(lyricsSent().at(-1)).toMatchObject({ title: 'Goodbye to Spring' })
  })
})

describe('coming back to the room', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** A song playing, the microphone on or off; timers faked from here. */
  const singing = async (micOn = true): Promise<void> => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    current().setMicOn(micOn)
    vi.useFakeTimers()
  }

  it('turns the microphone back on a moment after the singer returns', async () => {
    await singing()
    sendAppAway(true)
    expect(current().releaseMic).toHaveBeenCalledTimes(1)

    sendAppAway(false)
    expect(current().resumeMic).not.toHaveBeenCalled()
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

    expect(current().resumeMic).toHaveBeenCalledTimes(1)
  })

  it('leaves a microphone that was off, off', async () => {
    await singing(false)
    sendAppAway(true)
    sendAppAway(false)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

    expect(current().resumeMic).not.toHaveBeenCalled()
  })

  it('waits for a return that lasts', async () => {
    await singing()
    sendAppAway(true)
    sendAppAway(false)
    sendAppAway(true)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
    expect(current().resumeMic).not.toHaveBeenCalled()

    sendAppAway(false)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
    expect(current().resumeMic).toHaveBeenCalledTimes(1)
  })

  it('brings it back to a song that paused when the app was left', async () => {
    setKaraokeBackgroundPlay(false)
    await singing()
    sendAppAway(true)
    expect(current().pause).toHaveBeenCalledTimes(1)

    sendAppAway(false)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

    expect(current().resumeMic).toHaveBeenCalledTimes(1)
  })

  it('brings it back as the small window opens out into the room', async () => {
    await singing()
    device.windowed(true)
    expect(current().releaseMic).toHaveBeenCalledTimes(1)

    device.windowed(false)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

    expect(current().resumeMic).toHaveBeenCalledTimes(1)
  })

  it('keeps it off when the window is swiped away, until the app is back', async () => {
    await singing()
    device.windowed(true)

    device.windowed(false)
    sendAppAway(true)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
    expect(current().resumeMic).not.toHaveBeenCalled()

    sendAppAway(false)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
    expect(current().resumeMic).toHaveBeenCalledTimes(1)
  })

  it('leaves it off once the run is over', async () => {
    await singing()
    sendAppAway(true)
    controls().stop()

    sendAppAway(false)
    vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

    expect(current().resumeMic).not.toHaveBeenCalled()
  })

  describe('on iOS, where the microphone stops other apps', () => {
    // It would stop whatever the singer put on meanwhile (owner, 4 Oct).
    beforeEach(() => {
      device.micStopsOtherApps = true
    })

    it('keeps it for the next press of play on a paused song', async () => {
      setKaraokeBackgroundPlay(false)
      await singing()
      sendAppAway(true)
      sendAppAway(false)
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
      expect(current().resumeMic).not.toHaveBeenCalled()

      controls().resume()
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

      expect(current().resumeMic).toHaveBeenCalledTimes(1)
    })

    it('brings it back at once to a song still playing', async () => {
      await singing()
      sendAppAway(true)
      sendAppAway(false)
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

      expect(current().resumeMic).toHaveBeenCalledTimes(1)
    })

    it('waits for the app when play comes from the lock screen', async () => {
      await singing()
      sendAppAway(true)
      device.press('pause')
      device.press('play')
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
      expect(current().resumeMic).not.toHaveBeenCalled()

      sendAppAway(false)
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)
      expect(current().resumeMic).toHaveBeenCalledTimes(1)
    })

    it('leaves off a microphone the singer turned on and off again meanwhile', async () => {
      setKaraokeBackgroundPlay(false)
      await singing()
      sendAppAway(true)
      sendAppAway(false)
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

      current().setMicOn(true)
      current().setMicOn(false)
      controls().resume()
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

      expect(current().resumeMic).not.toHaveBeenCalled()
    })

    it('leaves a microphone that was off, off, whatever plays', async () => {
      setKaraokeBackgroundPlay(false)
      await singing(false)
      sendAppAway(true)
      sendAppAway(false)
      controls().resume()
      vi.advanceTimersByTime(MIC_RESTORE_DELAY_MS)

      expect(current().resumeMic).not.toHaveBeenCalled()
    })
  })
})

describe('the next song', () => {
  it('plays by itself when the setting is on, and the run carries across', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    const first = current()

    first.setPlaying(false)
    first.hosted.onEnded()
    await vi.waitFor(() => {
      expect(current().sessionId).toBe(JOSEPHINE.sessionId)
    })

    expect(current().autoPlay).toBe(true)
    // Between the two songs the run is paused, not over.
    expect(controls().isPaused()).toBe(true)
    current().setLoading(false)
    current().setPlaying(true)
    expect(controls().isPlaying()).toBe(true)
  })

  it('stays at the end when the setting is off, and the run is over', async () => {
    setKaraokePlayNext(false)
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    current().setPlaying(false)
    current().hosted.onEnded()
    await Promise.resolve()

    expect(current().sessionId).toBe(GOODBYE.sessionId)
    expect(controls().isPlaying()).toBe(false)
    expect(controls().isPaused()).toBe(false)
  })

  it("steps through the room's library from the bar", async () => {
    await mountRoom()
    expect(current().hosted.hasPrev()).toBe(false)
    expect(current().hosted.hasNext()).toBe(true)

    current().hosted.onNext()
    await vi.waitFor(() => {
      expect(current().sessionId).toBe(JOSEPHINE.sessionId)
    })
    // Nothing was playing, so nothing starts.
    expect(current().autoPlay).not.toBe(true)
    expect(current().hosted.hasPrev()).toBe(true)
  })

  // The song the room opens with keeps its stage out of sight until it is
  // ready; a song changed in the room replaces a stage in use, so it shows at
  // once rather than blanking the room under the singer's thumb.
  it('holds back only the stage of the song it arrived with', async () => {
    await mountRoom()
    expect(current().hosted.stage.arriving).toBe(true)

    current().hosted.onNext()
    await vi.waitFor(() => {
      expect(current().sessionId).toBe(JOSEPHINE.sessionId)
    })
    expect(current().hosted.stage.arriving).not.toBe(true)
  })
})

describe('the library', () => {
  it('opens from the song line, and the song picked goes on the stage', async () => {
    await mountRoom()

    current().hosted.stage.onOpenLibrary()
    const sheet = await screen.findByTestId('karaoke-library')
    fireEvent.click(
      within(sheet).getByRole('button', { name: /^I'll Be Right Behind You/u }),
    )

    await vi.waitFor(() => {
      expect(current().sessionId).toBe(JOSEPHINE.sessionId)
    })
    expect(screen.queryByTestId('karaoke-library')).toBeNull()
    // Nothing was playing, so nothing starts.
    expect(current().autoPlay).not.toBe(true)
  })

  it('marks the song on the stage', async () => {
    await mountRoom()

    current().hosted.stage.onOpenLibrary()
    const sheet = await screen.findByTestId('karaoke-library')

    expect(
      within(sheet)
        .getByRole('button', { name: /^Goodbye to Spring/u })
        .getAttribute('aria-current'),
    ).toBe('true')
  })

  it('plays the song picked while one is playing', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    current().hosted.stage.onOpenLibrary()
    const sheet = await screen.findByTestId('karaoke-library')
    fireEvent.click(
      within(sheet).getByRole('button', { name: /^Nothing in the Dark/u }),
    )

    await vi.waitFor(() => {
      expect(current().sessionId).toBe(DARK.sessionId)
    })
    expect(current().autoPlay).toBe(true)
  })

  it('is what Back closes first, before the room', async () => {
    await mountRoom()
    expect(controls().closeRoomOverlay?.()).toBe(false)

    current().hosted.stage.onOpenLibrary()
    await screen.findByTestId('karaoke-library')

    expect(controls().closeRoomOverlay?.()).toBe(true)
    expect(screen.queryByTestId('karaoke-library')).toBeNull()
    expect(controls().closeRoomOverlay?.()).toBe(false)
  })
})

describe('the Karaoke options', () => {
  async function openOptions(): Promise<HTMLElement> {
    controls().openOptions?.()
    return screen.findByTestId('karaoke-options')
  }

  const switchNamed = (sheet: HTMLElement, name: string): HTMLElement =>
    within(sheet).getByRole('switch', { name })

  it('open from the gear, over a song that keeps playing', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    const sheet = await openOptions()

    expect(within(sheet).getByText('Karaoke options')).toBeTruthy()
    expect(current().pause).not.toHaveBeenCalled()
  })

  it('set the lyrics size, which the stage reads', async () => {
    await mountRoom()
    const sheet = await openOptions()
    expect(
      within(sheet)
        .getByRole('button', { name: 'Medium' })
        .getAttribute('aria-pressed'),
    ).toBe('true')

    fireEvent.click(within(sheet).getByRole('button', { name: 'Large' }))

    expect(karaokeLyricsSize()).toBe('bigger')
    expect(current().hosted.stage.lyricsSize()).toBe('bigger')
    expect(localStorage.getItem('sm-zen-lyrics-size')).toBe('bigger')
  })

  it('offer the notes only for a song that has them', async () => {
    await mountRoom()
    const sheet = await openOptions()
    const notes = switchNamed(sheet, 'Show notes over the lyrics')
    expect(notes.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(notes)
    expect(karaokeNoteGlyphs()).toBe(true)
    expect(current().hosted.stage.noteGlyphs()).toBe(true)

    current().setHasNotes(false)
    expect(
      within(sheet).queryByRole('switch', {
        name: 'Show notes over the lyrics',
      }),
    ).toBeNull()
  })

  it('turn the next song off and on', async () => {
    await mountRoom()
    const sheet = await openOptions()
    const next = switchNamed(sheet, 'Play the next song automatically')
    expect(next.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(next)

    expect(karaokePlayNext()).toBe(false)
    expect(localStorage.getItem('karaoke-room-play-next')).toBe('false')
  })

  it("move the key a step either way, and back to the song's own key", async () => {
    // The stage's landscape column (236-286 px) has no room for the key, so
    // in the room it is a row here (Phase 3 of the mixer rail plan).
    await mountRoom()
    const sheet = await openOptions()
    const key = within(sheet).getByRole('group', { name: 'Key' })

    fireEvent.click(within(key).getByRole('button', { name: 'Raise the key' }))
    fireEvent.click(within(key).getByRole('button', { name: 'Raise the key' }))
    const raised = [
      current().keyShift(),
      within(key).getByTestId('key-shift-value').textContent,
    ]
    fireEvent.click(
      within(key).getByRole('button', {
        name: 'Key +2, back to the original key',
      }),
    )

    expect([raised, current().keyShift()]).toEqual([[2, '+2'], 0])
  })

  it('find my key from the row, and say its wait in the sheet, not over it', async () => {
    await mountRoom()
    const sheet = await openOptions()
    const holdsOpen = current().holdKeyNotices.mock.calls.map(([held]) => held)

    fireEvent.click(within(sheet).getByRole('button', { name: 'Find my key' }))
    current().setKeyNotice({
      message: 'Finding the melody first. This takes a moment.',
      tone: 'info',
    })
    const said = within(sheet).getByTestId(
      'karaoke-options-key-status',
    ).textContent
    controls().closeRoomOverlay?.()

    expect({
      found: current().findMyKey.mock.calls.length,
      said,
      holds: [
        holdsOpen,
        current().holdKeyNotices.mock.calls.map(([held]) => held),
      ],
    }).toEqual({
      found: 1,
      said: 'Finding the melody first. This takes a moment.',
      holds: [[true], [true, false]],
    })
  })

  it('show the music level, and put it back to 100%', async () => {
    await mountRoom()
    current().setMusicLevel(0.98)
    const sheet = await openOptions()
    expect(within(sheet).getByText('140%')).toBeTruthy()

    fireEvent.click(
      within(sheet).getByRole('button', {
        name: 'Reset the music level to 100%',
      }),
    )

    expect(current().resetMusicLevel).toHaveBeenCalledTimes(1)
    expect(within(sheet).getByText('100%')).toBeTruthy()
  })

  it('push All settings, and close', async () => {
    const pushSettings = vi.fn()
    const unregisterShell = registerShellApi({
      pushSettings,
    } as unknown as Parameters<typeof registerShellApi>[0])
    try {
      await mountRoom()
      const sheet = await openOptions()

      fireEvent.click(
        within(sheet).getByRole('button', { name: 'Open all settings' }),
      )

      expect(pushSettings).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('karaoke-options')).toBeNull()
    } finally {
      unregisterShell()
    }
  })

  it('open the studio from Manage songs, pausing the song first', async () => {
    const openKaraokeStudio = vi.fn()
    const unregisterShell = registerShellApi({
      pushSettings: vi.fn(),
      openKaraokeStudio,
    })
    try {
      await mountRoom()
      current().setLoading(false)
      current().setPlaying(true)
      const sheet = await openOptions()

      fireEvent.click(
        within(sheet).getByRole('button', { name: 'Manage songs' }),
      )

      expect(current().pause).toHaveBeenCalledTimes(1)
      expect(openKaraokeStudio).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('karaoke-options')).toBeNull()
    } finally {
      unregisterShell()
    }
  })

  it('offer no Manage songs where nothing can open the studio', async () => {
    const unregisterShell = registerShellApi({ pushSettings: vi.fn() })
    try {
      await mountRoom()
      const sheet = await openOptions()

      expect(
        within(sheet).queryByRole('button', { name: 'Manage songs' }),
      ).toBeNull()
      expect(within(sheet).queryByText('Manage songs')).toBeNull()
    } finally {
      unregisterShell()
    }
  })

  it('are what Back closes first', async () => {
    await mountRoom()
    await openOptions()

    expect(controls().closeRoomOverlay?.()).toBe(true)
    expect(screen.queryByTestId('karaoke-options')).toBeNull()
  })
})

describe('a song the studio hands back', () => {
  it('goes on the stage, playing', async () => {
    await mountRoom()

    requestKaraokeSong(DARK.sessionId)

    await vi.waitFor(() => {
      expect(current().sessionId).toBe(DARK.sessionId)
    })
    expect(current().autoPlay).toBe(true)
    expect(karaokeSongRequest()).toBeNull()
  })

  it('leaves the stage as it was when the room does not have the song', async () => {
    await mountRoom()

    requestKaraokeSong('a-song-the-room-cannot-play')
    await settleFor(30)

    expect(current().sessionId).toBe(GOODBYE.sessionId)
    expect(karaokeStagedSong()).toBe(GOODBYE.sessionId)
    expect(mixers.list.filter((mixer) => mixer.alive)).toHaveLength(1)
    expect(karaokeSongRequest()).toBeNull()
  })

  it('is what an arrival cues when the room was not on the screen', async () => {
    requestKaraokeSong(JOSEPHINE.sessionId)

    await mountRoom()

    expect(current().sessionId).toBe(JOSEPHINE.sessionId)
    expect(current().autoPlay).not.toBe(true)
    await settleFor(30)
    expect(mixers.list).toHaveLength(1)
    expect(karaokeSongRequest()).toBeNull()
  })
})

describe('the option pinned beside the gear', () => {
  const choose = async (value: string): Promise<void> => {
    controls().openOptions?.()
    const sheet = await screen.findByTestId('karaoke-options')
    fireEvent.change(
      within(sheet).getByRole('combobox', { name: 'Beside the gear' }),
      { target: { value } },
    )
  }

  it('is nothing until the singer pins one', async () => {
    await mountRoom()

    expect(controls().pinnedToggle?.() ?? null).toBeNull()
  })

  it('pins the notes, which switch from the header', async () => {
    await mountRoom()
    await choose('notes')

    const pinned = controls().pinnedToggle?.()
    expect(pinned).toMatchObject({
      icon: 'notes',
      label: 'Show notes over the lyrics',
      pressed: false,
    })
    pinned?.onToggle()
    expect(karaokeNoteGlyphs()).toBe(true)
    expect(controls().pinnedToggle?.()?.pressed).toBe(true)
    expect(localStorage.getItem(KARAOKE_PINNED_KEY)).toBe('notes')
  })

  it('draws no notes button for a song without notes', async () => {
    await mountRoom()
    await choose('notes')

    current().setHasNotes(false)

    expect(controls().pinnedToggle?.() ?? null).toBeNull()
  })

  it('steps the lyrics size from the header, and names the size', async () => {
    await mountRoom()
    await choose('lyrics-size')

    expect(controls().pinnedToggle?.()?.label).toBe('Text size: Medium')
    controls().pinnedToggle?.()?.onToggle()

    expect(karaokeLyricsSize()).toBe('bigger')
    expect(controls().pinnedToggle?.()?.label).toBe('Text size: Large')
    expect(controls().pinnedToggle?.()?.pressed).toBeUndefined()
  })

  it('pins the next song, and a later visit finds it pinned', async () => {
    const unmount = await mountRoom()
    await choose('play-next')
    expect(controls().pinnedToggle?.()?.pressed).toBe(true)
    unmount()

    await mountRoom()

    const pinned = controls().pinnedToggle?.()
    expect(pinned?.icon).toBe('play-next')
    pinned?.onToggle()
    expect(karaokePlayNext()).toBe(false)
  })
})

describe('the room picture', () => {
  it('is drawn behind the stage, from the karaoke surface', async () => {
    await mountRoom()

    const room = screen.getByTestId('karaoke-room')
    expect(room.style.getPropertyValue('--mp-stage-image')).toBe(
      'url("/room.webp")',
    )
    expect(
      room.querySelector('[data-room-background]'),
      'the element the door grows into',
    ).not.toBeNull()
  })

  // The veil used to come with the stage, which mounts only once its song is
  // cued: the door handed over to the bright picture, and the stage dimmed it
  // in one frame on its way in (owner, 3 Oct).
  it('is dimmed by the room itself, before the stage arrives', () => {
    holdRoomArrival()
    render(() => <KaraokeRoomStage />)

    const picture = screen
      .getByTestId('karaoke-room')
      .querySelector('[data-room-background]')
    expect(picture?.nextElementSibling?.hasAttribute('data-room-scrim')).toBe(
      true,
    )
    expect(mixers.list).toHaveLength(0)
  })

  it('is chosen from the chip, and Back closes the chooser first', async () => {
    await mountRoom()

    controls().openRoomPicker?.()
    const picker = await screen.findByTestId('karaoke-room-picker')
    expect(within(picker).getByTestId('fake-background-picker')).toBeTruthy()

    expect(controls().closeRoomOverlay?.()).toBe(true)
    expect(screen.queryByTestId('karaoke-room-picker')).toBeNull()
  })
})

describe('the device', () => {
  it("plays on the app's one AudioContext, and gives it back on the way out", async () => {
    const unmount = await mountRoom()

    expect(device.acquireAudio).toHaveBeenCalledWith('karaoke-room', {
      prepareToSuspend: expect.any(Function),
    })
    current().hosted.audio?.ensure()
    expect(device.lease.ensure).toHaveBeenCalled()

    unmount()
    expect(device.lease.release).toHaveBeenCalledTimes(1)
  })

  it('pauses a playing song with its fade before the clock stops', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)
    const options = device.acquireAudio.mock.calls[0]?.[1] as {
      prepareToSuspend: () => number
    }

    expect(options.prepareToSuspend()).toBe(80)
    expect(current().prepareToSuspend).toHaveBeenCalledTimes(1)
    // Paused already: nothing left to fade.
    expect(options.prepareToSuspend()).toBe(0)
  })

  it('tells the mixer whether the song keeps playing behind other apps', async () => {
    await mountRoom()

    expect(current().hosted.keepsPlayingHidden?.()).toBe(true)
    setKaraokeBackgroundPlay(false)
    expect(current().hosted.keepsPlayingHidden?.()).toBe(false)
  })

  it('keeps the screen awake while a song plays, and only then', async () => {
    const unmount = await mountRoom()
    current().setLoading(false)

    current().setPlaying(true)
    expect(device.keepAwake).toHaveBeenLastCalledWith(true)

    current().setPlaying(false)
    expect(device.keepAwake).toHaveBeenLastCalledWith(false)

    current().setPlaying(true)
    unmount()
    expect(device.keepAwake).toHaveBeenLastCalledWith(false)
  })
})

describe('songs of your own (Stage 2)', () => {
  it('says how many are on their way on the song line, which opens the library', async () => {
    build.importing = true
    imports.inFlight = 2
    await mountRoom()

    expect(current().hosted.stage.badge?.()).toBe('Separating 2')
    imports.inFlight = 0
    expect(current().hosted.stage.badge?.()).toBeNull()
  })

  it('says nothing of them in a build that does not import', async () => {
    imports.inFlight = 2
    await mountRoom()

    expect(current().hosted.stage.badge?.() ?? null).toBeNull()
  })

  it('takes the New mark off a song once it is sung', async () => {
    build.importing = true
    await mountRoom()
    current().setLoading(false)

    current().setPlaying(true)

    expect(imports.played).toEqual(['karaoke-night-demo'])
  })

  it("put the songs left in the options, which push Karaoke's settings", async () => {
    build.importing = true
    resetKaraokeSongsForTests({
      left: 18,
      subscribed: true,
      renewsAt: '2026-10-27T10:00:00.000Z',
      perPeriod: 20,
    })
    const pushSettings = vi.fn()
    const unregisterShell = registerShellApi({ pushSettings })
    try {
      await mountRoom()
      controls().openOptions?.()
      const sheet = await screen.findByTestId('karaoke-options')

      const row = within(sheet).getByRole('button', {
        name: 'Songs this month: 18 of 20 left',
      })
      fireEvent.click(row)

      expect(pushSettings).toHaveBeenCalledWith('karaoke')
      expect(screen.queryByTestId('karaoke-options')).toBeNull()
    } finally {
      unregisterShell()
    }
  })

  it('leave the songs out of the options in a build that does not import', async () => {
    resetKaraokeSongsForTests({
      left: 18,
      subscribed: true,
      renewsAt: null,
      perPeriod: 20,
    })
    await mountRoom()
    controls().openOptions?.()
    const sheet = await screen.findByTestId('karaoke-options')

    expect(within(sheet).queryByText('Songs this month')).toBeNull()
  })
})

describe('the room picture, on an iPad', () => {
  it('says the choice stays on this iPad', async () => {
    const restore = actAsIpad()
    try {
      await mountRoom()

      controls().openRoomPicker?.()
      const picker = await screen.findByTestId('karaoke-room-picker')

      expect(picker.textContent).toContain('Your choice stays on this iPad.')
      expect(picker.textContent).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })
})
