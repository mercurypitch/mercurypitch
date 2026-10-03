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
//
//   BEHIND ANOTHER APP (owner, 2 Oct). With "Keep playing in the background"
//   on, the default, a song the singer leaves the app on keeps playing: the
//   microphone goes, as it does for a park, but not the song. The system is
//   told what is playing (on Android that is also what keeps the app from
//   being frozen), and its media buttons reach the run's own play, pause
//   and stop. With it off, a song the app is sent away from pauses.
//
//   COMING BACK (owner, 2 Oct). A microphone the singer had on when they
//   left comes back on when they do, for a run still going. Never behind
//   another app, and never in the small window: nobody sings at the room
//   from there.
//
//   IN A SMALL WINDOW (Android). With "Show lyrics in a small window" on,
//   the default, a singer who leaves the app while a song plays keeps the
//   room in a picture-in-picture window, over whatever app they went to:
//   the line being sung, the next, the title, and nothing of the room's or
//   the shell's chrome (KaraokeLyricsWindow.tsx). The microphone goes as
//   the window opens, as it does when the app is left. The song plays on in
//   there whatever "Keep playing in the background" says, because the page
//   is still on the screen; the system is told what plays, so the window
//   has Android's play and pause. Coming back to the app restores the room
//   as it was (useKaraokePictureInPicture.ts). iOS has no such window for
//   anything but video, and nothing here changes it.
//
//   SONGS OF YOUR OWN (Stage 2, KARAOKE_IMPORT). The song line counts the
//   songs on their way ("Separating 2") and opens the library, where they
//   are; a song sung loses its New mark; and the options say how many songs
//   are left, a tap from Settings, Karaoke.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { GuideLevel, HostedMixerControls, StemMixerHosting, } from '@/components/stem-mixer-hosting'
import { StemMixer } from '@/components/StemMixer'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import { whenBundledExamplesSeeded } from '@/features/karaoke-night/seed-examples'
import { roomName } from '@/features/rooms/room-names'
import { MUSIC_LEVEL } from '@/features/stem-mixer/master-headroom'
import { cycleLyricsSize } from '@/features/stem-mixer/zen-navigation'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { NO_LYRIC_GLANCE } from '@/lib/lyric-glance'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import type { NativeMediaAction, NativeNowPlaying, PinnedRoomToggle, } from '@/stores/native-shell-store'
import { nativeDeviceApi, nativeShellApi, registerRunControls, roomArrivalHeld, } from '@/stores/native-shell-store'
import { importsInFlight, markKaraokeSongPlayed } from './karaoke-import-queue'
import styles from './karaoke-room.module.css'
import type { RoomSong, RoomStems } from './karaoke-room-library'
import { hydrateSong, roomLibrary } from './karaoke-room-library'
import type { ParkedSong } from './karaoke-room-store'
import { KARAOKE_LYRICS_SIZE_LABELS, karaokeBackgroundPlay, karaokeLyricsSize, karaokeNoteGlyphs, karaokePinned, karaokePlayNext, karaokeSongRequest, karaokeStagedSong, lastSungSong, parkKaraokeSong, rememberSungSong, setKaraokeLyricsSize, setKaraokeNoteGlyphs, setKaraokePlayNext, setKaraokeStagedSong, takeKaraokeSongRequest, takeParkedKaraokeSong, } from './karaoke-room-store'
import { karaokeSongs, songsOptionRow } from './karaoke-songs'
import { KaraokeLibrarySheet } from './KaraokeLibrarySheet'
import { KaraokeLyricsWindow } from './KaraokeLyricsWindow'
import { KaraokeRoomOptions } from './KaraokeRoomOptions'
import { KaraokeRoomPicker } from './KaraokeRoomPicker'
import { useKaraokePictureInPicture } from './useKaraokePictureInPicture'

/** The owner name the room holds the shared AudioContext under. */
export const KARAOKE_AUDIO_OWNER = 'karaoke-room'

/** How long after the singer is back the microphone they had on returns. */
export const MIC_RESTORE_DELAY_MS = 500

/** What the system's media player shows for a song with no artist. */
export const UNKNOWN_ARTIST = 'Unknown artist'

/** One song put on the stage. A new cue is a new mixer. */
interface Cue {
  readonly key: number
  readonly song: RoomSong
  readonly stems: RoomStems
  readonly autoPlay: boolean
  readonly seekSec: number | undefined
  /** The guide vocal to put back once the mixer is up, or null. */
  readonly guide: GuideLevel | null
  /** The song the room opened with; see `KaraokeStageHosting.arriving`. */
  readonly arriving: boolean
}

interface CueOptions {
  readonly autoPlay: boolean
  readonly seekSec?: number
  readonly guide?: GuideLevel | null
  readonly arriving?: boolean
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

  const [pickerOpen, setPickerOpen] = createSignal(false)
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
      arriving: options.arriving === true,
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
    // A song the studio handed back while the room was away is the staged
    // song, so this arrival is its answer.
    takeKaraokeSongRequest()
    const resuming = parked !== null && parked.sessionId === song.sessionId
    // A parked song that is no longer in the library cannot come back.
    if (!resuming) setRunOn(false)
    void cueSong(song, {
      autoPlay: false,
      seekSec: resuming && parked.seconds > 0 ? parked.seconds : undefined,
      guide: resuming ? parked.guide : null,
      arriving: true,
    })
  })

  // A song the studio handed back (plan S8 §11): on the stage, playing. One
  // that the room cannot play leaves the stage as it was.
  createEffect(() => {
    if (karaokeSongRequest() === null || !arrived) return
    untrack(() => {
      const request = takeKaraokeSongRequest()
      if (request === null) return
      const song = library().find((row) => row.sessionId === request.sessionId)
      if (song === undefined) {
        setKaraokeStagedSong(cue()?.song.sessionId ?? null)
        return
      }
      void cueSong(song, { autoPlay: true })
    })
  })

  // A song that starts is a run, and the one the next arrival cues.
  createEffect(
    on(isPlaying, (playing) => {
      if (!playing) return
      setRunOn(true)
      const entry = untrack(cue)
      if (entry === null) return
      rememberSungSong(entry.song.sessionId)
      if (KARAOKE_IMPORT) markKaraokeSongPlayed(entry.song.sessionId)
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
      // One conditional on the constant, which a store build folds to 0, so
      // the queue is not referenced there at all.
      badge: () => {
        const coming = KARAOKE_IMPORT ? importsInFlight() : 0
        return coming > 0 ? `Separating ${coming}` : null
      },
      arriving: entry.arriving,
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

  // Manage songs (plan S8 §5): the studio, pushed over the room. The song
  // stops first; the studio is a list to work on, not a stage.
  const openStudio = (): void => {
    mixer()?.pause()
    nativeShellApi()?.openKaraokeStudio?.()
  }

  // Back closes what the room has open over its stage before it leaves.
  const closeRoomOverlay = (): boolean => {
    if (pickerOpen()) {
      setPickerOpen(false)
      return true
    }
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
        // The chip in the room header: the room's picture (R5).
        openRoomPicker: () => {
          setPickerOpen(true)
        },
        closeRoomOverlay,
        pinnedToggle,
      }),
    )
  })

  // A song the app is sent away from lets the microphone go either way. It
  // keeps playing when the singer asked for that (see BEHIND ANOTHER APP);
  // otherwise it pauses, and play is one tap on the way back.
  const backgroundPlay = (): boolean =>
    device !== null && karaokeBackgroundPlay()

  // The microphone on the way out and back in (see COMING BACK). Put back
  // a moment after the return rather than on it: swiping Android's window
  // away reports the window closed and the page hidden in either order, and
  // the microphone must not come on for an instant behind the next app.
  let micToRestore = false
  let restoreTimer: ReturnType<typeof setTimeout> | undefined
  const letMicGo = (controls: HostedMixerControls | null): void => {
    if (controls === null) return
    if (controls.micOn()) micToRestore = true
    controls.releaseMic()
  }
  const restoreMicSoon = (): void => {
    clearTimeout(restoreTimer)
    if (!micToRestore) return
    restoreTimer = setTimeout(() => {
      restoreTimer = undefined
      if (document.visibilityState === 'hidden' || inWindow()) return
      micToRestore = false
      const controls = mixer()
      if (controls !== null && runOn()) controls.resumeMic()
    }, MIC_RESTORE_DELAY_MS)
  }
  onCleanup(() => {
    clearTimeout(restoreTimer)
  })

  // The small window (see IN A SMALL WINDOW). What is open over the stage
  // closes as it opens: nobody can tap a sheet in there, and coming back
  // finds the stage.
  const inWindow = useKaraokePictureInPicture({
    device,
    playing: isPlaying,
    onEnter: () => {
      letMicGo(mixer())
      setPickerOpen(false)
      setOptionsOpen(false)
      setLibraryOpen(false)
    },
    onExit: restoreMicSoon,
  })
  // The run is the system's business while the song is behind another app,
  // and while it is in the window: that is where the window's play and
  // pause come from, and the hold keeps the clock running if the app is
  // reported as gone while the window is still up.
  const systemPlayback = (): boolean => backgroundPlay() || inWindow()
  const [pageHidden, setPageHidden] = createSignal(
    document.visibilityState === 'hidden',
  )
  const onVisibility = (): void => {
    const hidden = document.visibilityState === 'hidden'
    setPageHidden(hidden)
    if (!hidden) {
      restoreMicSoon()
      return
    }
    clearTimeout(restoreTimer)
    const controls = mixer()
    if (controls === null) return
    if (!backgroundPlay() && controls.playing()) controls.pause()
    letMicGo(controls)
  }
  document.addEventListener('visibilitychange', onVisibility)
  onCleanup(() => {
    document.removeEventListener('visibilitychange', onVisibility)
  })

  // The clock keeps running behind another app for as long as the run does,
  // through the gap between two songs, where the next one starts by itself.
  // A song paused back there lets it go: a paused run is a loaded song that
  // is not playing, and silence is no reason to keep the app awake.
  const pausedRun = (): boolean => {
    const controls = mixer()
    return controls !== null && !controls.loading() && !controls.playing()
  }
  const holdingAudio = createMemo(
    () => systemPlayback() && runOn() && !(pageHidden() && pausedRun()),
  )
  createEffect(
    on(holdingAudio, (hold) => {
      if (!hold || device === null) return
      onCleanup(device.holdAudioInBackground(KARAOKE_AUDIO_OWNER))
    }),
  )

  // What the system shows as playing: the run's song, playing or paused,
  // and nothing once the run is over. With it goes where the song is, for
  // the notification's progress bar and the lock screen's, read off the
  // clock the lyrics follow so the bar and the words agree. Told again on
  // play, pause, a jump (a seek, a line tapped, a loop going round), a new
  // speed and a song length arriving, and never per frame: the system runs
  // the bar on by itself from the last report.
  let announced = false
  const announce = (song: NativeNowPlaying | null): void => {
    if (song === null && !announced) return
    announced = song !== null
    device?.nowPlaying(song)
  }
  createEffect(() => {
    const entry = cue()
    if (!systemPlayback() || !runOn() || entry === null) {
      announce(null)
      return
    }
    // The system's player always names an artist, as other music players do:
    // a song without one says so rather than leaving the line blank.
    const artist = entry.song.credit ?? entry.song.artist
    // Between two songs there is no mixer yet: no length, so no bar, rather
    // than the last song's.
    const controls = mixer()
    const playing = isPlaying()
    controls?.jumps()
    announce({
      title: entry.song.title,
      artist: artist === null || artist.trim() === '' ? UNKNOWN_ARTIST : artist,
      playing,
      position: controls === null ? 0 : untrack(controls.audibleElapsed),
      duration: controls?.duration() ?? 0,
      rate: controls?.speed() ?? 1,
    })
  })
  onCleanup(() => {
    announce(null)
  })

  // The system's progress bar: the notification's and the shade's, and the
  // lock screen's. Wherever it is let go, the song lands inside itself and
  // keeps playing or stays paused. The mixer moves the lyrics as a tapped
  // line does, and its jump tells the bar where the song went (above).
  const seekFromSystem = (seconds: number): void => {
    const controls = mixer()
    if (controls === null || controls.loading() || !runOn()) return
    const length = controls.duration()
    if (!(length > 0)) return
    controls.seek(Math.min(length, Math.max(0, seconds)))
  }

  // The notification's buttons, the lock screen's and a headset's. Each
  // checks the song first: play on a playing song would start it over from
  // where it was last paused.
  const onMediaButton = (action: NativeMediaAction): void => {
    if (typeof action === 'object') {
      seekFromSystem(action.seekTo)
    } else if (action === 'play') {
      if (!isPlaying()) resume()
    } else if (action === 'pause') {
      if (isPlaying()) pause()
    } else if (runOn()) {
      stop()
    }
  }
  createEffect(
    on(systemPlayback, (on) => {
      if (!on || device === null) return
      onCleanup(device.onMediaAction(onMediaButton))
    }),
  )

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
      classList={{ [styles.inWindow]: inWindow() }}
      data-testid="karaoke-room"
      style={background.resolvedStyle()}
    >
      {/* data-room-background: the picture a door's clone waits on before it
          fades (apps/mercurypitch alley-entry.ts). */}
      <div class={styles.cover} data-room-background />
      <div class={styles.scrim} data-room-scrim />
      {/* Unseen and out of reach under the small window: its pills and bar
          would sit over the lyrics there, and a tap never reaches them. The
          stage stays mounted, because it is the song's clock. */}
      <div class={styles.stage} inert={inWindow()} data-testid="karaoke-stage">
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
      </div>
      <Show when={inWindow() ? cue() : null} keyed>
        {(entry) => (
          <KaraokeLyricsWindow
            title={entry.song.title}
            glance={mixer()?.lyricGlance() ?? NO_LYRIC_GLANCE}
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
        songsRow={() =>
          KARAOKE_IMPORT ? songsOptionRow(karaokeSongs()) : null
        }
        onSongs={() => nativeShellApi()?.pushSettings('karaoke')}
        onManageSongs={
          nativeShellApi()?.openKaraokeStudio === undefined
            ? undefined
            : openStudio
        }
      />
      <KaraokeRoomPicker
        isOpen={pickerOpen()}
        close={() => setPickerOpen(false)}
        background={background}
      />
    </div>
  )
}
