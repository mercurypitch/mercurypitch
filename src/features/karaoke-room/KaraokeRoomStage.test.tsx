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
import type { Setter } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuideLevel, StemMixerHosting, } from '@/features/stem-mixer/hosted-mixer'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { holdRoomArrival, nativeRunControls, registerNativeDevice, registerShellApi, resetRoomArrivalHolds, } from '@/stores/native-shell-store'

interface FakeMixer {
  sessionId: string
  title: string
  stems: { vocal?: string; instrumental?: string }
  autoPlay: boolean | undefined
  initialSeekSec: number | undefined
  hosted: StemMixerHosting
  alive: boolean
  setPlaying: Setter<boolean>
  setLoading: Setter<boolean>
  setElapsed: Setter<number>
  setLoadError: Setter<string>
  /** The singer moving the sing pill. */
  setGuideLevel: Setter<GuideLevel>
  setHasNotes: Setter<boolean>
  setMusicLevel: Setter<number>
  resetMusicLevel: Mock
  /** The room putting the guide back. */
  setGuide: Mock
  play: Mock
  pause: Mock
  seek: Mock
  releaseMic: Mock
}

const mixers = vi.hoisted(() => ({ list: [] as FakeMixer[] }))

vi.mock('@/components/StemMixer', async () => {
  const { createSignal, onCleanup, onMount } = await import('solid-js')
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
      const [loading, setLoading] = createSignal(true)
      const [loadError, setLoadError] = createSignal('')
      const [elapsed, setElapsed] = createSignal(0)
      const [hasNotes, setHasNotes] = createSignal(true)
      const [musicLevel, setMusicLevel] = createSignal(0.7)
      const [guide, setGuideLevel] = createSignal<GuideLevel>({
        volume: 0.8,
        muted: false,
      })
      const mixer: FakeMixer = {
        sessionId: props.sessionId,
        title: props.songTitle,
        stems: props.stems,
        autoPlay: props.autoPlay,
        initialSeekSec: props.initialSeekSec,
        hosted: props.hosted,
        alive: true,
        setPlaying,
        setLoading,
        setElapsed,
        setLoadError,
        setGuideLevel,
        setHasNotes,
        setMusicLevel,
        resetMusicLevel: vi.fn(() => setMusicLevel(0.7)),
        setGuide: vi.fn((level: GuideLevel) => setGuideLevel(level)),
        play: vi.fn(() => setPlaying(true)),
        pause: vi.fn(() => setPlaying(false)),
        seek: vi.fn((seconds: number) => setElapsed(seconds)),
        releaseMic: vi.fn(),
      }
      mixers.list.push(mixer)
      onMount(() => {
        props.hosted.attach({
          playing,
          loading,
          loadError,
          elapsed,
          duration: () => 246,
          hasNotes,
          musicLevel,
          play: mixer.play,
          pause: mixer.pause,
          seek: mixer.seek,
          resetMusicLevel: mixer.resetMusicLevel,
          releaseMic: mixer.releaseMic,
          guide,
          setGuide: mixer.setGuide,
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

import { KARAOKE_LAST_SONG_KEY, KARAOKE_PINNED_KEY, karaokeLyricsSize, karaokeNoteGlyphs, karaokePlayNext, resetKaraokeRoomForTests, setKaraokePlayNext, } from './karaoke-room-store'
import { KaraokeRoomStage } from './KaraokeRoomStage'

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
  acquireAudio: Mock
  keepAwake: Mock
  lease: {
    ensure: Mock
    unlock: Mock
    release: Mock
  }
}

function fakeDevice(): FakeDevice {
  const lease = {
    ensure: vi.fn(() => null),
    unlock: vi.fn(async () => Promise.resolve(true)),
    release: vi.fn(),
  }
  return {
    acquireAudio: vi.fn(() => lease),
    keepAwake: vi.fn(),
    lease,
  }
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

  it('pauses when the app is sent away', async () => {
    await mountRoom()
    current().setLoading(false)
    current().setPlaying(true)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    Reflect.deleteProperty(document, 'visibilityState')

    expect(current().pause).toHaveBeenCalledTimes(1)
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

      fireEvent.click(within(sheet).getByRole('button', { name: 'Open' }))

      expect(pushSettings).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('karaoke-options')).toBeNull()
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

    expect(device.acquireAudio).toHaveBeenCalledWith('karaoke-room')
    current().hosted.audio?.ensure()
    expect(device.lease.ensure).toHaveBeenCalled()

    unmount()
    expect(device.lease.release).toHaveBeenCalledTimes(1)
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
