// ============================================================
// The Karaoke room (native): the zen player as a room of its own
// ============================================================
//
// Plan S8 §2 and §4. The native Karaoke tab is this room, not the web's
// studio: a picture, the room header the shell draws, and the stem mixer's
// zen stage hosted inside the room's box. The mixer plays; the room decides
// which song, when, and what the shell is told.
//
//   ARRIVAL (D1 A). Nothing goes on the stage until the door has handed the
//   screen over (`roomArrivalHeld`) and the bundled examples are seeded, so a
//   first launch with no network still finds its songs. Then one song is
//   cued, paused at the top: the last one sung, or Goodbye to Spring on a
//   first visit. Nothing plays by itself on arrival.
//
//   THE RUN (D2 A). A song that has started is a run, as a Sing take is: the
//   shell steps the rail aside and brings it back when the song is over. The
//   zen bar IS the transport, so the room registers `ownsTransport` and the
//   shell draws none of its own. Between two songs that follow each other
//   the run is paused, not over.
//
//   PARK AND RESUME. Leaving the tab mid-run parks the song: paused, the
//   microphone let go, the place and the guide vocal kept at module scope
//   (`karaoke-room-store.ts`). The room unmounts; coming back cues the same
//   song at the same place, still a paused run from its first frame, so the
//   rail does not flash back while the song loads again.
//
//   THE DEVICE. The mixer plays on the app's one AudioContext, lent through
//   the bridge (REQ-NRM-033), and the screen stays awake while a song plays.

import type { Component } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { StemMixer } from '@/components/StemMixer'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import { whenBundledExamplesSeeded } from '@/features/karaoke-night/seed-examples'
import { roomName } from '@/features/rooms/room-names'
import type { GuideLevel, HostedMixerControls, StemMixerHosting, } from '@/features/stem-mixer/hosted-mixer'
import { MUSIC_LEVEL } from '@/features/stem-mixer/master-headroom'
import { cycleLyricsSize } from '@/features/stem-mixer/zen-navigation'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import type { PinnedRoomToggle } from '@/stores/native-shell-store'
import { nativeDeviceApi, nativeShellApi, registerRunControls, roomArrivalHeld, } from '@/stores/native-shell-store'
import styles from './karaoke-room.module.css'
import type { RoomSong, RoomStems } from './karaoke-room-library'
import { hydrateSong, roomLibrary } from './karaoke-room-library'
import type { ParkedSong } from './karaoke-room-store'
import { KARAOKE_LYRICS_SIZE_LABELS, karaokeLyricsSize, karaokeNoteGlyphs, karaokePinned, karaokePlayNext, karaokeStagedSong, lastSungSong, parkKaraokeSong, rememberSungSong, setKaraokeLyricsSize, setKaraokeNoteGlyphs, setKaraokePlayNext, setKaraokeStagedSong, takeParkedKaraokeSong, } from './karaoke-room-store'
import { KaraokeLibrarySheet } from './KaraokeLibrarySheet'
import { KaraokeRoomOptions } from './KaraokeRoomOptions'

/** The owner name the room holds the shared AudioContext under. */
export const KARAOKE_AUDIO_OWNER = 'karaoke-room'

/** One song put on the stage. A new cue is a new mixer. */
interface Cue {
  readonly key: number
  readonly song: RoomSong
  readonly stems: RoomStems
  readonly autoPlay: boolean
  readonly seekSec: number | undefined
  /** The guide vocal to put back once the mixer is up, or null. */
  readonly guide: GuideLevel | null
}

interface CueOptions {
  readonly autoPlay: boolean
  readonly seekSec?: number
  readonly guide?: GuideLevel | null
}

/**
 * The song an arrival cues: a parked song first, then the one on the stage
 * when the room was last here, then the last one sung, then Goodbye to
 * Spring, then whatever the library has first.
 */
export function arrivalSong(
  rows: readonly RoomSong[],
  parked: ParkedSong | null,
  staged: string | null,
  lastSung: string | null,
): RoomSong | null {
  const find = (id: string | null | undefined): RoomSong | undefined =>
    id === null || id === undefined
      ? undefined
      : rows.find((row) => row.sessionId === id)
  return (
    find(parked?.sessionId) ??
    find(staged) ??
    find(lastSung) ??
    find(DEMO_SESSION_ID) ??
    rows.at(0) ??
    null
  )
}

export const KaraokeRoomStage: Component = () => {
  const device = untrack(nativeDeviceApi)
  const lease = device?.acquireAudio(KARAOKE_AUDIO_OWNER)
  onCleanup(() => {
    lease?.release()
  })

  // A song the shell parked on the way out: this arrival is its return.
  const parked = takeParkedKaraokeSong()

  const [pickerOpen] = createSignal(false)
  const [libraryOpen, setLibraryOpen] = createSignal(false)
  const [optionsOpen, setOptionsOpen] = createSignal(false)
  const background = useBackgroundSurfaceController('karaoke', pickerOpen)

  // Read fresh, never memoised: the arrival reads it the moment the seed
  // settles, and the list is a handful of rows.
  const library = (): RoomSong[] => roomLibrary()
  const [seeded, setSeeded] = createSignal(false)
  const [cue, setCue] = createSignal<Cue | null>(null)
  const [mixer, setMixer] = createSignal<HostedMixerControls | null>(null)
  // A run: a song has started and has neither been stopped nor run out.
  const [runOn, setRunOn] = createSignal(parked !== null)

  let alive = true
  let cueToken = 0
  onCleanup(() => {
    alive = false
    cueToken += 1
  })

  const settle = (): void => {
    if (alive) setSeeded(true)
  }
  void whenBundledExamplesSeeded().then(settle, settle)

  const isPlaying = (): boolean => mixer()?.playing() === true
  const isPaused = (): boolean => runOn() && !isPlaying()

  const indexOf = (entry: Cue): number =>
    library().findIndex((row) => row.sessionId === entry.song.sessionId)

  async function cueSong(song: RoomSong, options: CueOptions): Promise<void> {
    cueToken += 1
    const token = cueToken
    setKaraokeStagedSong(song.sessionId)
    const stems = await hydrateSong(song).catch(() => song.stems)
    if (token !== cueToken) return
    setMixer(null)
    setCue({
      key: token,
      song,
      stems,
      autoPlay: options.autoPlay,
      seekSec: options.seekSec,
      guide: options.guide ?? null,
    })
  }

  // Arrival: after the door, after the seed, once.
  let arrived = false
  createEffect(() => {
    if (arrived || roomArrivalHeld() || !seeded()) return
    const song = arrivalSong(
      library(),
      parked,
      untrack(karaokeStagedSong),
      lastSungSong(),
    )
    if (song === null) return
    arrived = true
    const resuming = parked !== null && parked.sessionId === song.sessionId
    // A parked song that is no longer in the library cannot come back.
    if (!resuming) setRunOn(false)
    void cueSong(song, {
      autoPlay: false,
      seekSec: resuming && parked.seconds > 0 ? parked.seconds : undefined,
      guide: resuming ? parked.guide : null,
    })
  })

  // A song that starts is a run, and the one the next arrival cues.
  createEffect(
    on(isPlaying, (playing) => {
      if (!playing) return
      setRunOn(true)
      const entry = untrack(cue)
      if (entry !== null) rememberSungSong(entry.song.sessionId)
    }),
  )

  const step = (entry: Cue, direction: 1 | -1): void => {
    const target = library()[indexOf(entry) + direction]
    if (indexOf(entry) < 0 || target === undefined) return
    // Next and back keep the play state: a playing song plays the next one.
    void cueSong(target, { autoPlay: isPlaying() })
  }

  const songEnded = (entry: Cue): void => {
    const index = indexOf(entry)
    const next =
      karaokePlayNext() && index >= 0 ? library()[index + 1] : undefined
    if (next === undefined) {
      setRunOn(false)
      return
    }
    void cueSong(next, { autoPlay: true })
  }

  const hostingFor = (entry: Cue): StemMixerHosting => ({
    audio: lease,
    stage: {
      byline: () => entry.song.credit ?? entry.song.artist,
      onOpenLibrary: () => {
        setLibraryOpen(true)
      },
      lyricsSize: karaokeLyricsSize,
      noteGlyphs: karaokeNoteGlyphs,
    },
    attach: (controls) => {
      if (entry.key !== cueToken) return
      setMixer(controls)
      if (entry.guide !== null) controls.setGuide(entry.guide)
    },
    hasPrev: () => indexOf(entry) > 0,
    hasNext: () => {
      const index = indexOf(entry)
      return index >= 0 && index < library().length - 1
    },
    onPrev: () => {
      step(entry, -1)
    },
    onNext: () => {
      step(entry, 1)
    },
    onEnded: () => {
      songEnded(entry)
    },
  })

  // Where the song is: the mixer's clock once it has loaded, and until then
  // the place the cue asked for, so a quick leave does not lose it.
  const placeOf = (entry: Cue, controls: HostedMixerControls | null): number =>
    controls !== null && !controls.loading()
      ? controls.elapsed()
      : (entry.seekSec ?? 0)

  // A song picked in the library goes on the stage as Next would put it:
  // playing if one was playing. The song already there just closes the list.
  const pick = (song: RoomSong): void => {
    setLibraryOpen(false)
    if (song.sessionId === cue()?.song.sessionId) return
    void cueSong(song, { autoPlay: isPlaying() })
  }

  // Back closes what the room has open over its stage before it leaves.
  const closeRoomOverlay = (): boolean => {
    if (optionsOpen()) {
      setOptionsOpen(false)
      return true
    }
    if (libraryOpen()) {
      setLibraryOpen(false)
      return true
    }
    return false
  }

  const hasNotes = (): boolean => mixer()?.hasNotes() === true

  // As zen's pill reads it: a share of the level the app ships at.
  const musicPercent = (): number | null => {
    const controls = mixer()
    if (controls === null) return null
    return Math.round(
      (controls.musicLevel() / MUSIC_LEVEL.spec.defaultValue) * 100,
    )
  }

  // The one option beside the gear, as it is now. The notes are absent for
  // a song without them, as their row is.
  const pinnedToggle = (): PinnedRoomToggle | null => {
    switch (karaokePinned()) {
      case 'lyrics-size':
        return {
          icon: 'lyrics-size',
          label: `Text size: ${KARAOKE_LYRICS_SIZE_LABELS[karaokeLyricsSize()]}`,
          onToggle: () => {
            setKaraokeLyricsSize(cycleLyricsSize(karaokeLyricsSize()))
          },
        }
      case 'notes':
        return hasNotes()
          ? {
              icon: 'notes',
              label: 'Show notes over the lyrics',
              pressed: karaokeNoteGlyphs(),
              onToggle: () => {
                setKaraokeNoteGlyphs(!karaokeNoteGlyphs())
              },
            }
          : null
      case 'play-next':
        return {
          icon: 'play-next',
          label: 'Play the next song automatically',
          pressed: karaokePlayNext(),
          onToggle: () => {
            setKaraokePlayNext(!karaokePlayNext())
          },
        }
      default:
        return null
    }
  }

  const pause = (): void => {
    mixer()?.pause()
  }
  const resume = (): void => {
    mixer()?.play()
  }
  const stop = (): void => {
    const controls = mixer()
    controls?.pause()
    controls?.seek(0)
    setRunOn(false)
  }
  const park = (): void => {
    const controls = mixer()
    controls?.pause()
    controls?.releaseMic()
    const entry = cue()
    if (entry === null) return
    parkKaraokeSong({
      sessionId: entry.song.sessionId,
      seconds: placeOf(entry, controls),
      guide: controls?.guide() ?? entry.guide,
    })
  }

  onMount(() => {
    onCleanup(
      registerRunControls({
        tab: TAB_KARAOKE,
        roomLabel: roomName('karaoke'),
        ownsTransport: true,
        optionsLabel: 'Karaoke options',
        isPlaying,
        isPaused,
        pause,
        resume,
        stop,
        park,
        openOptions: () => {
          setOptionsOpen(true)
        },
        closeRoomOverlay,
        pinnedToggle,
      }),
    )
  })

  // No background audio in V1: a song the app is sent away from stops, and
  // lets the microphone go. The place stays; play is one tap on the way back.
  const onVisibility = (): void => {
    if (document.visibilityState !== 'hidden') return
    const controls = mixer()
    if (controls === null) return
    if (controls.playing()) controls.pause()
    controls.releaseMic()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onCleanup(() => {
    document.removeEventListener('visibilitychange', onVisibility)
  })

  // The screen stays on while a song plays, and only then.
  let awake = false
  const keepAwake = (on: boolean): void => {
    if (on === awake) return
    awake = on
    device?.keepAwake(on)
  }
  createEffect(() => {
    keepAwake(isPlaying())
  })
  onCleanup(() => {
    keepAwake(false)
  })

  return (
    <div
      class={styles.room}
      data-testid="karaoke-room"
      style={background.resolvedStyle()}
    >
      {/* data-room-background: the picture a door's clone waits on before it
          fades (apps/mercurypitch alley-entry.ts). */}
      <div class={styles.cover} data-room-background />
      <Show when={cue()} keyed>
        {(entry) => (
          <StemMixer
            sessionId={entry.song.sessionId}
            stems={entry.stems}
            songTitle={entry.song.title}
            practiceMode="full"
            requestedStems={{ vocal: true, instrumental: true }}
            preset="performance"
            showStageSettings={false}
            autoPlay={entry.autoPlay}
            initialSeekSec={entry.seekSec}
            hosted={hostingFor(entry)}
          />
        )}
      </Show>
      <KaraokeLibrarySheet
        isOpen={libraryOpen()}
        close={() => setLibraryOpen(false)}
        songs={library}
        currentId={() => cue()?.song.sessionId ?? null}
        onPick={pick}
      />
      <KaraokeRoomOptions
        isOpen={optionsOpen()}
        close={() => setOptionsOpen(false)}
        hasNotes={hasNotes}
        musicPercent={musicPercent}
        onResetMusicLevel={() => mixer()?.resetMusicLevel()}
        onAllSettings={() => nativeShellApi()?.pushSettings()}
      />
    </div>
  )
}
