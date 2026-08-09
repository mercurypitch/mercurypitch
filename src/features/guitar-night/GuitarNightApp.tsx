// Guitar Night presents the inert Velvet Rehearsal entry before any audio or input lifetime begins.
// ============================================================
/*
THESIS: The player enters a private rehearsal room, not a configuration dashboard.
OWN-WORLD: Velvet curtains, walnut, warm ivory, amber lamps, and quiet teal room status.
STORY: Choose a first win, bring one song, or step directly into the current Guitar workspace.
FIRST VIEWPORT: One calm amp-faceplate entry surface leaves the approved room and instruments visible.
FORM: A grounded rehearsal-room welcome with three deliberately unequal paths and no synthetic activity.
*/

import { createEffect, createMemo, createSignal, For, lazy, Match, onCleanup, onMount, Show, Suspense, Switch, } from 'solid-js'
import type { GuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { createGuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { useGuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { beatToSeconds } from '@/features/guitar/runtime/guitar-performance-contract'
import { AUDIO_UPLOAD_ACCEPT } from '@/lib/audio-upload-contract'
import { createPersistedSignal } from '@/lib/storage'
import { BACKDROP_STORAGE_KEY, DEFAULT_BACKDROP_ID, GUITAR_NIGHT_BACKDROPS, isBackdropId, resolveBackdrop, } from './backdrops'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'
import { resolveGuitarFirstWinConfig } from './first-win-config'
import styles from './GuitarNightApp.module.css'
import { guitarNightBackingSession, GuitarNightRoom } from './GuitarNightRoom'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightPreparationPort } from './preparation-port'
import type { GuitarNightReferencePort, GuitarNightTranscriptionPort, } from './reference-port'
import { measuredReferenceForBacking, REFERENCE_FILE_ACCEPT, } from './reference-port'
import { readGuitarNightSession } from './session-link'
import type { GuitarNightSongPort } from './song-port'
import { useGuitarFirstWinController } from './useGuitarFirstWinController'
import { guitarNightBandPreparationMessage, loadDefaultGuitarNightBandPreparationPort, useGuitarNightBandPreparationController, } from './useGuitarNightBandPreparationController'
import { guitarNightPreparationMessage, loadDefaultGuitarNightPreparationPort, useGuitarNightPreparationController, } from './useGuitarNightPreparationController'
import type { GuitarNightReferenceState } from './useGuitarNightReferenceController'
import { loadDefaultGuitarNightReferencePort, loadDefaultGuitarNightTranscriptionPort, useGuitarNightReferenceController, } from './useGuitarNightReferenceController'
import type { GuitarNightSelectionState } from './useGuitarNightSongController'
import { loadDefaultGuitarNightSongPort, useGuitarNightSongController, } from './useGuitarNightSongController'

/** The auth and billing services stay out of the room's first paint. */
const GuitarNightAccount = lazy(async () => {
  const module = await import('./GuitarNightAccount')
  return { default: module.GuitarNightAccount }
})

/** The tab-only room brings its own audio clock, so it loads on demand. */
const GuitarNightScoreRoom = lazy(async () => {
  const module = await import('./GuitarNightScoreRoom')
  return { default: module.GuitarNightScoreRoom }
})

type EntryView = 'choices' | 'first-win' | 'song' | 'room' | 'score-room'
type GuitarNightAppProps = {
  firstWinConfig?: unknown
  loadReferencePort?: () => Promise<GuitarNightReferencePort>
  loadTranscriptionPort?: () => Promise<GuitarNightTranscriptionPort>
  loadSongPort?: () => Promise<GuitarNightSongPort>
  loadPreparationPort?: () => Promise<GuitarNightPreparationPort>
  loadBandPreparationPort?: () => Promise<GuitarNightBandPreparationPort>
  createBackingTransport?: () => GuitarBackingTransport
}

/** The library opens on the newest few songs; the rest arrive on request. */
const INITIAL_LIBRARY_PAGE = 5
const LIBRARY_PAGE_STEP = 10
/**
 * A first open after a schema change re-indexes every stem this device has
 * saved, which is slow on a large library. Say so rather than letting the
 * room look stuck.
 */
const LIBRARY_SLOW_OPEN_MS = 4000

function formatPreparedDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function unavailableReferenceCopy(
  state: Extract<GuitarNightReferenceState, { kind: 'unavailable' }>,
): string {
  if (state.reason === 'not-found') {
    return 'That tab is not on this device. Open its file again to follow it.'
  }
  if (state.reason === 'no-playable-notes') {
    return 'That file has no playable notes, so the stage stays in free play.'
  }
  return 'Your tab library could not be opened. Try again.'
}

function unavailableSongCopy(
  state: Extract<GuitarNightSelectionState, { kind: 'unavailable' }>,
): string {
  if (state.reason === 'not-found') {
    return 'That prepared song is not available on this device.'
  }
  if (state.reason === 'not-completed') {
    return 'That song has not finished preparing yet.'
  }
  if (state.reason === 'missing-local-audio') {
    return 'The song record is here, but its local audio is missing.'
  }
  return 'Your prepared-song library could not be opened. Try again.'
}

export function GuitarNightApp(props: GuitarNightAppProps) {
  const firstWinConfig = createMemo(() =>
    resolveGuitarFirstWinConfig(props.firstWinConfig),
  )
  const firstWinStep = createMemo(() => firstWinConfig().exerciseSteps[0])
  const firstWinController = useGuitarFirstWinController({
    config: firstWinConfig,
  })
  const firstWinStage: GuitarPerformanceStageSource = {
    title: () => 'Your first low E bar',
    notes: firstWinController.notes,
    timeline: {
      positionSeconds: () =>
        beatToSeconds(
          firstWinController.playheadBeat(),
          firstWinController.tempoBpm(),
        ),
      durationSeconds: () => {
        const finalBeat = firstWinController
          .notes()
          .reduce(
            (latest, note) => Math.max(latest, note.startBeat + note.duration),
            0,
          )
        return beatToSeconds(finalBeat, firstWinController.tempoBpm())
      },
      playheadBeat: firstWinController.playheadBeat,
      tempoBpm: firstWinController.tempoBpm,
    },
  }
  const [backdropId, setBackdropId] = createPersistedSignal<string>(
    BACKDROP_STORAGE_KEY,
    DEFAULT_BACKDROP_ID,
    { validator: isBackdropId },
  )
  const backdrop = createMemo(() => resolveBackdrop(backdropId()))
  const [venueMenuOpen, setVenueMenuOpen] = createSignal(false)
  const initialSessionId = readGuitarNightSession()
  const [view, setView] = createSignal<EntryView>(
    initialSessionId === null ? 'choices' : 'song',
  )
  // Both rooms take the panel full-bleed and hide the entry chrome.
  const isRoomView = createMemo(
    () => view() === 'room' || view() === 'score-room',
  )
  const [visitedRoomSessionId, setVisitedRoomSessionId] = createSignal<
    string | null
  >(null)
  let detailHeading: HTMLHeadingElement | undefined
  let songInput: HTMLInputElement | undefined
  let referenceInput: HTMLInputElement | undefined
  let venueMenuContainer: HTMLDivElement | undefined
  let venueMenuButton: HTMLButtonElement | undefined

  const closeVenueMenuAndRestoreFocus = (): void => {
    setVenueMenuOpen(false)
    queueMicrotask(() => venueMenuButton?.focus())
  }

  const createConfiguredBackingTransport = (): GuitarBackingTransport => {
    const configuredFactory = props.createBackingTransport
    return configuredFactory?.() ?? createGuitarBackingTransport()
  }
  const playbackController = useGuitarBackingTransportController({
    createTransport: createConfiguredBackingTransport,
  })

  const focusDetail = () => {
    queueMicrotask(() => detailHeading?.focus())
  }

  const songController = useGuitarNightSongController({
    loadSongPort: () => {
      const configuredLoader = props.loadSongPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightSongPort()
        : configuredLoader()
    },
    onRouteSession: () => {
      playbackController.configure(null)
      setVisitedRoomSessionId(null)
      setView('song')
      focusDetail()
    },
    onBackingWillRelease: () => {
      playbackController.configure(null)
      setVisitedRoomSessionId(null)
    },
  })
  const referenceController = useGuitarNightReferenceController({
    loadReferencePort: () => {
      const configuredLoader = props.loadReferencePort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightReferencePort()
        : configuredLoader()
    },
    loadTranscriptionPort: () => {
      const configuredLoader = props.loadTranscriptionPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightTranscriptionPort()
        : configuredLoader()
    },
  })
  const attachedReference = referenceController.reference
  const unavailableReference = createMemo(() => {
    const current = referenceController.state()
    return current.kind === 'unavailable' ? current : null
  })
  /**
   * One reference, two rooms — and never both at once. An authored tab carries
   * its own nominal tempo, which nothing has aligned to a recording, so it
   * rehearses on its own clock in the tab room. A measured line was read from
   * this very recording, so it is already on the recording's timeline and is
   * the only reference the play-along room will guide with.
   */
  const authoredReference = createMemo(() => {
    const attached = attachedReference()
    return attached !== null && attached.kind === 'authored' ? attached : null
  })
  const attachedMeasuredReference = createMemo(() => {
    const attached = attachedReference()
    return attached !== null && attached.kind === 'measured' ? attached : null
  })

  const preparationController = useGuitarNightPreparationController({
    loadPreparationPort: () => {
      const configuredLoader = props.loadPreparationPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightPreparationPort()
        : configuredLoader()
    },
    onPrepared: async (sessionId, signal) => {
      const cancelStaging = () => songController.clearSession('replace')
      signal.addEventListener('abort', cancelStaging, { once: true })
      try {
        const refreshed = await songController.refreshLibrary()
        if (signal.aborted) return
        if (!refreshed) {
          throw new Error('Prepared-song library did not refresh')
        }
        await songController.stageSession(sessionId, 'push')
        if (signal.aborted) cancelStaging()
      } finally {
        signal.removeEventListener('abort', cancelStaging)
      }
    },
  })
  const bandPreparationController = useGuitarNightBandPreparationController({
    loadPort: () => {
      const configuredLoader = props.loadBandPreparationPort
      return configuredLoader === undefined
        ? loadDefaultGuitarNightBandPreparationPort()
        : configuredLoader()
    },
    onPrepared: async (sessionId, signal) => {
      const refreshed = await songController.refreshLibrary()
      if (signal.aborted) return
      if (!refreshed) {
        throw new Error(
          'The band parts were saved, but the song library could not reopen them. Open this song again from Prepared songs.',
        )
      }
      setVisitedRoomSessionId(null)
      playbackController.configure(null)
      // The same session id is already staged as the two-stem mix; force
      // past the no-op guard so the upgraded parts actually replace it.
      await songController.stageSession(sessionId, 'replace', { force: true })
    },
  })
  const activeBacking = createMemo(() => {
    const state = songController.selectionState()
    return state.kind === 'ready' ? state.lease : null
  })
  const measuredReference = createMemo(() =>
    measuredReferenceForBacking(
      attachedMeasuredReference(),
      activeBacking()?.sessionId ?? null,
    ),
  )
  const unavailableSelection = createMemo(() => {
    const state = songController.selectionState()
    return state.kind === 'unavailable' ? state : null
  })
  // Only the bass stem is offered: it is effectively monophonic, which is the
  // case pitch detection actually handles. The guitar stem holds however many
  // guitars the mix had and is often chordal, so it is not claimed here.
  const transcribableStem = createMemo(() => {
    const backing = activeBacking()
    if (backing === null) return null
    const bass = backing.stems.find((stem) => stem.kind === 'bass')
    if (bass === undefined) return null
    return {
      sessionId: backing.sessionId,
      kind: bass.kind,
      label: 'Bass',
      url: bass.url,
    }
  })

  const [visibleSongLimit, setVisibleSongLimit] =
    createSignal(INITIAL_LIBRARY_PAGE)
  const songsWithinLimit = (limit: number) => {
    const all = songController.songs()
    if (all.length <= limit) return all
    const head = all.slice(0, limit)
    // The routed song stays reachable even when it sits below the fold —
    // otherwise its Resume affordance hides behind the Show more button.
    const routedSessionId =
      activeBacking()?.sessionId ?? songController.routeSessionId()
    if (
      routedSessionId === null ||
      head.some((song) => song.sessionId === routedSessionId)
    ) {
      return head
    }
    const routed = all.find((song) => song.sessionId === routedSessionId)
    return routed === undefined ? head : [...head, routed]
  }
  const visibleSongs = createMemo(() => songsWithinLimit(visibleSongLimit()))
  const hiddenSongCount = createMemo(() =>
    Math.max(0, songController.songs().length - visibleSongs().length),
  )
  // Count what the next press actually reveals: a pinned routed song is
  // already on screen, so a plain page step would overstate the reveal.
  const nextRevealCount = createMemo(() =>
    Math.max(
      0,
      songsWithinLimit(visibleSongLimit() + LIBRARY_PAGE_STEP).length -
        visibleSongs().length,
    ),
  )

  const [libraryOpenIsSlow, setLibraryOpenIsSlow] = createSignal(false)
  createEffect(() => {
    if (songController.libraryState() !== 'loading') {
      setLibraryOpenIsSlow(false)
      return
    }
    const timer = window.setTimeout(
      () => setLibraryOpenIsSlow(true),
      LIBRARY_SLOW_OPEN_MS,
    )
    onCleanup(() => window.clearTimeout(timer))
  })
  const preparingSong = createMemo(() => {
    const state = preparationController.state()
    return state.kind === 'preparing' ? state : null
  })
  const preparationError = createMemo(() => {
    const state = preparationController.state()
    return state.kind === 'error' ? state : null
  })
  const cancelledPreparation = createMemo(() => {
    const state = preparationController.state()
    return state.kind === 'cancelled' ? state : null
  })
  const bandPreparation = createMemo(() => {
    const state = bandPreparationController.state()
    return state.kind === 'preparing' ? state : null
  })
  const bandPreparationError = createMemo(() => {
    const state = bandPreparationController.state()
    return state.kind === 'error' ? state : null
  })

  const openFirstWin = () => {
    if (!firstWinConfig().enabled) {
      openCurrentGuitar()
      return
    }
    setView('first-win')
    focusDetail()
  }

  const openSongLibrary = () => {
    setView('song')
    songController.initialize()
    referenceController.initialize()
    focusDetail()
  }

  const chooseReferenceFile = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file === undefined) return
    void referenceController.importFile(file)
  }

  const openCurrentGuitar = () => {
    window.location.assign('/#/guitar')
  }

  const enterRoom = () => {
    const backing = activeBacking()
    if (backing === null) return
    if (visitedRoomSessionId() !== backing.sessionId) {
      playbackController.configure(guitarNightBackingSession(backing))
      setVisitedRoomSessionId(backing.sessionId)
    }
    setView('room')
  }

  /**
   * Rehearse the tab alone. The recording is left paused rather than played
   * underneath it: nothing has aligned the two timelines, and a backing
   * running against an unrelated tempo is worse than silence.
   */
  const enterScoreRoom = () => {
    if (authoredReference() === null) return
    playbackController.pause()
    setView('score-room')
  }

  const returnToSongs = () => {
    playbackController.pause()
    setView('song')
    focusDetail()
  }

  const returnToChoices = () => {
    firstWinController.stopGroove()
    preparationController.clear()
    bandPreparationController.clear()
    playbackController.configure(null)
    setVisitedRoomSessionId(null)
    if (view() === 'song' || view() === 'room' || view() === 'score-room') {
      songController.clearSession('push')
    }
    setView('choices')
    queueMicrotask(() =>
      document
        .querySelector<HTMLButtonElement>('[data-entry="start"]')
        ?.focus(),
    )
  }

  const addPreviewHit = (input: 'touch' | 'keyboard' = 'touch') =>
    firstWinController.registerHit(input)

  const previewPassed = () =>
    firstWinController.hits() >= firstWinConfig().passHits
  const previewFinished = () =>
    firstWinController.hits() >= firstWinConfig().freshHitsRequested

  const completionAction = () =>
    firstWinConfig().completionActions.includes('keep-jamming')
      ? 'keep-jamming'
      : firstWinConfig().completionActions.includes('load-song')
        ? 'load-song'
        : 'keep-jamming'

  const handleCompletion = () => {
    firstWinController.stopGroove()
    if (completionAction() === 'load-song') {
      setView('song')
      songController.initialize()
      focusDetail()
      return
    }
    openCurrentGuitar()
  }

  const skipFirstWin = () => {
    firstWinController.skip()
    openCurrentGuitar()
  }

  const handleSongChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file === undefined) return
    bandPreparationController.clear()
    const accepted = preparationController.start(file)
    if (accepted) songController.clearSession('push')
    setView('song')
    focusDetail()
  }

  const stagePreparedSong = (sessionId: string) => {
    if (activeBacking()?.sessionId === sessionId) {
      enterRoom()
      return
    }
    preparationController.clear()
    bandPreparationController.clear()
    setVisitedRoomSessionId(null)
    void songController.stageSession(sessionId, 'push')
  }

  const prepareGuitarFreeBand = () => {
    const backing = activeBacking()
    if (backing === null || backing.defaultMix.kind !== 'mixed-instrumental') {
      return
    }
    playbackController.configure(null)
    setVisitedRoomSessionId(null)
    setView('song')
    focusDetail()
    bandPreparationController.start(backing.sessionId)
  }

  createEffect(() => {
    if (view() !== 'room' || activeBacking() !== null) return
    playbackController.configure(null)
    setView('song')
  })

  // Measured evidence belongs to one exact recording. Once another backing is
  // staged, remove the stale guide rather than showing it as "this stem" or
  // carrying it into the new room.
  createEffect(() => {
    const attached = attachedMeasuredReference()
    const backing = activeBacking()
    if (
      attached === null ||
      backing === null ||
      attached.backingSessionId === backing.sessionId
    ) {
      return
    }
    referenceController.detach()
  })

  // Removing the tab from under the tab room leaves nothing to rehearse.
  createEffect(() => {
    if (view() !== 'score-room' || authoredReference() !== null) return
    setView('song')
  })

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && venueMenuOpen()) {
        closeVenueMenuAndRestoreFocus()
        return
      }
      if (view() !== 'first-win' || event.code !== 'Space' || event.repeat) {
        return
      }
      const target = event.target
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      event.preventDefault()
      addPreviewHit('keyboard')
    }
    const closeVenueMenuOnOutside = (event: PointerEvent): void => {
      const target = event.target
      if (
        !venueMenuOpen() ||
        !(target instanceof Node) ||
        venueMenuContainer?.contains(target) === true
      ) {
        return
      }
      setVenueMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', closeVenueMenuOnOutside)
    onCleanup(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', closeVenueMenuOnOutside)
    })
  })

  const roomStatus = () => {
    const preparation = preparationController.state()
    if (preparation.kind === 'preparing') {
      return {
        title: 'Preparing song',
        detail: guitarNightPreparationMessage(preparation),
      }
    }
    if (preparation.kind === 'error') {
      return {
        title: 'Preparation needs attention',
        detail: 'No playback or listening has started',
      }
    }
    if (preparation.kind === 'cancelled') {
      return {
        title: 'Room ready',
        detail: 'Preparation cancelled; no audio has started',
      }
    }
    const selection = songController.selectionState()
    if (selection.kind === 'ready') {
      return {
        title: 'Room ready',
        detail: 'Song prepared; playback has not started',
      }
    }
    if (selection.kind === 'loading') {
      return {
        title: 'Opening song',
        detail: 'Reading local stems; no audio has started',
      }
    }
    return {
      title: 'Room ready',
      detail: 'No audio or listening has started',
    }
  }

  return (
    <div
      class={styles.app}
      classList={{ [styles.appRoom]: isRoomView() }}
      data-testid="guitar-night-shell"
    >
      <a class={styles.skipLink} href="#guitar-night-main">
        Skip to Guitar Night
      </a>

      <div
        class={styles.backdrop}
        data-testid="guitar-night-backdrop"
        data-backdrop={backdrop().id}
        style={{ '--room-backdrop': `url('${backdrop().url}')` }}
        aria-hidden="true"
      />
      <div class={styles.roomGlow} aria-hidden="true" />

      <div class={styles.topbar}>
        <a class={styles.brand} href="/" aria-label="MercuryPitch home">
          <img src="/favicon.svg" alt="" />
          <span>MercuryPitch</span>
        </a>
        <span class={styles.topbarDivider} aria-hidden="true" />
        <span class={styles.topbarTitle}>Guitar Night</span>
        <span class={styles.roomName}>{backdrop().name}</span>

        <div ref={venueMenuContainer} class={styles.topbarActions}>
          <button
            ref={venueMenuButton}
            type="button"
            class={styles.venueMenuButton}
            aria-expanded={venueMenuOpen()}
            aria-controls="guitar-night-venue-menu"
            onClick={() => setVenueMenuOpen((open) => !open)}
          >
            Room
          </button>
          <div
            id="guitar-night-venue-menu"
            class={styles.venueMenu}
            classList={{ [styles.venueMenuOpen]: venueMenuOpen() }}
          >
            <label class={styles.roomSelect}>
              <span class={styles.visuallyHidden}>Room</span>
              <select
                value={backdrop().id}
                title={backdrop().detail}
                onChange={(event) => {
                  setBackdropId(event.currentTarget.value)
                  closeVenueMenuAndRestoreFocus()
                }}
              >
                <For each={GUITAR_NIGHT_BACKDROPS}>
                  {(room) => (
                    <option value={room.id} title={room.detail}>
                      {room.name}
                    </option>
                  )}
                </For>
              </select>
            </label>
            <a class={styles.studioLink} href="/#/guitar">
              Full studio
            </a>
            <Suspense>
              <GuitarNightAccount />
            </Suspense>
          </div>
        </div>
      </div>

      <main
        class={styles.main}
        classList={{ [styles.mainRoom]: isRoomView() }}
        id="guitar-night-main"
      >
        <div
          class={styles.entryPanel}
          classList={{
            [styles.entryPanelRoom]: isRoomView(),
            [styles.entryPanelLesson]: view() === 'first-win',
          }}
        >
          <Show when={!isRoomView()}>
            <div class={styles.panelEdge} aria-hidden="true" />
          </Show>

          <Switch>
            <Match when={view() === 'choices'}>
              <p class={styles.eyebrow}>The room is quiet</p>
              <h1>Guitar Night</h1>
              <p class={styles.lede}>
                Your room is ready. Begin with one string, bring a song, or step
                straight into the full Guitar workspace.
              </p>

              <div
                class={styles.entryActions}
                data-testid="guitar-night-entry-actions"
              >
                <button
                  class={styles.primaryAction}
                  type="button"
                  aria-label="Start"
                  aria-describedby="guitar-night-start-description"
                  data-entry="start"
                  onClick={openFirstWin}
                >
                  <strong>Start</strong>
                  <span id="guitar-night-start-description">
                    Read your first bar on one open string
                  </span>
                </button>
                <button
                  class={styles.secondaryAction}
                  type="button"
                  aria-label="Load a song"
                  aria-describedby="guitar-night-song-description"
                  onClick={openSongLibrary}
                >
                  <strong>Load a song</strong>
                  <span id="guitar-night-song-description">
                    Open a prepared song or choose local audio
                  </span>
                </button>
                <button
                  class={styles.expertAction}
                  type="button"
                  aria-label="I know my way around"
                  aria-describedby="guitar-night-expert-description"
                  onClick={skipFirstWin}
                >
                  <strong>I know my way around</strong>
                  <span id="guitar-night-expert-description">
                    Open the current Guitar workspace
                  </span>
                </button>
              </div>
            </Match>

            <Match when={view() === 'first-win'}>
              <p class={styles.eyebrow}>First win · one string</p>
              <h1 ref={detailHeading} tabindex="-1">
                Start with one string.
              </h1>
              <p class={styles.detailCopy}>
                Tab has six lines. A number tells you which fret to play. A 0
                means play the string open.
              </p>

              <GuitarNightStage
                source={firstWinStage}
                active={() => view() === 'first-win'}
              />

              <div class={styles.rhythmPreview}>
                <div class={styles.previewMeta}>
                  <span>{firstWinStep().stringLabel} · standard tuning</span>
                  <span>{firstWinController.tempoBpm()} BPM</span>
                </div>
                <div
                  class={styles.beatRow}
                  aria-label={`${firstWinController.hits()} of ${firstWinConfig().freshHitsRequested} notes marked`}
                >
                  <For
                    each={Array.from(
                      { length: firstWinConfig().freshHitsRequested },
                      (_, index) => index,
                    )}
                  >
                    {(index) => (
                      <span
                        classList={{
                          [styles.beatFilled]:
                            index < firstWinController.hits(),
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </For>
                </div>
                <div class={styles.lessonControls}>
                  <button
                    class={styles.grooveAction}
                    type="button"
                    onClick={() =>
                      firstWinController.status() === 'count-in' ||
                      firstWinController.status() === 'playing' ||
                      firstWinController.status() === 'starting'
                        ? firstWinController.stopGroove()
                        : void firstWinController.startGroove()
                    }
                  >
                    {firstWinController.status() === 'count-in' ||
                    firstWinController.status() === 'playing' ||
                    firstWinController.status() === 'starting'
                      ? 'Stop groove'
                      : 'Start count-in'}
                  </button>
                  <button
                    class={styles.tapAction}
                    type="button"
                    aria-label={`Tap each ${firstWinStep().stringLabel} note`}
                    onClick={() => addPreviewHit('touch')}
                    disabled={previewFinished()}
                  >
                    {previewFinished()
                      ? 'First bar complete'
                      : `Play ${firstWinStep().stringLabel} · tap or Space`}
                  </button>
                </div>
                <p
                  class={styles.lessonFeedback}
                  role="status"
                  aria-live="polite"
                >
                  {firstWinController.lastFeedback()}
                </p>
                <Show when={firstWinController.hits() > 0}>
                  <details class={styles.lessonOptions}>
                    <summary>Adjust the intro</summary>
                    <div>
                      <label>
                        <span>Tempo</span>
                        <input
                          type="range"
                          min="40"
                          max="160"
                          step="1"
                          value={firstWinController.tempoBpm()}
                          aria-label="Intro tempo"
                          onInput={(event) =>
                            firstWinController.setTempoBpm(
                              Number(event.currentTarget.value),
                            )
                          }
                        />
                        <strong>{firstWinController.tempoBpm()} BPM</strong>
                      </label>
                      <label>
                        <span>Count-in</span>
                        <select
                          aria-label="Count-in beats"
                          value={firstWinController.countInBeats()}
                          onChange={(event) =>
                            firstWinController.setCountInBeats(
                              Number(event.currentTarget.value),
                            )
                          }
                        >
                          <For each={[0, 2, 4, 8]}>
                            {(beats) => (
                              <option value={beats}>
                                {beats === 0 ? 'Off' : `${beats} beats`}
                              </option>
                            )}
                          </For>
                        </select>
                      </label>
                    </div>
                  </details>
                </Show>
                <Show when={previewPassed()}>
                  <p class={styles.smallWin} role="status">
                    {previewFinished()
                      ? `${firstWinConfig().freshHitsRequested} open notes. You just read your first bar of tab.`
                      : `${firstWinConfig().passHits} notes down. Add the last note or keep going.`}
                  </p>
                </Show>
              </div>

              <div class={styles.detailActions}>
                <button type="button" onClick={returnToChoices}>
                  Back
                </button>
                <Show
                  when={previewPassed()}
                  fallback={
                    <button
                      class={styles.workspaceEscape}
                      type="button"
                      onClick={skipFirstWin}
                    >
                      Open Guitar workspace
                    </button>
                  }
                >
                  <button
                    class={styles.completionAction}
                    type="button"
                    onClick={handleCompletion}
                  >
                    {completionAction() === 'load-song'
                      ? 'Load a song'
                      : 'Keep jamming'}
                  </button>
                </Show>
              </div>
            </Match>

            <Match when={view() === 'song'}>
              <p class={styles.eyebrow}>Songs · this device</p>
              <h1 ref={detailHeading} tabindex="-1">
                Bring a song into the room.
              </h1>
              <p class={styles.detailCopy}>
                Open a song you already prepared here, or choose one audio file
                from this device. Nothing starts playing on its own.
              </p>

              <div
                class={styles.songWell}
                aria-busy={
                  preparingSong() !== null || bandPreparation() !== null
                    ? 'true'
                    : 'false'
                }
              >
                <Switch>
                  <Match when={bandPreparation()}>
                    {(preparation) => (
                      <div class={styles.songState}>
                        <strong>Building the guitar-free band</strong>
                        <span role="status" aria-atomic="true">
                          {guitarNightBandPreparationMessage(preparation())}
                        </span>
                        <Show
                          when={preparation().progress !== null}
                          fallback={
                            <progress
                              class={styles.songProgress}
                              max="100"
                              aria-label="Preparing full-band parts"
                            />
                          }
                        >
                          <progress
                            class={styles.songProgress}
                            max="100"
                            value={preparation().progress ?? 0}
                            aria-label="Preparing full-band parts"
                          />
                        </Show>
                        <small>
                          The current mix stays safe on this device while its
                          drums, bass, and guitar parts are separated.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={bandPreparationError()}>
                    {(error) => (
                      <div class={styles.songState} role="alert">
                        <strong>Couldn’t build the full band</strong>
                        <span>{error().message}</span>
                        <small>
                          Your existing vocals and accompaniment are unchanged.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={preparingSong()}>
                    {(preparation) => (
                      <div class={styles.songState}>
                        <strong title={preparation().file.name}>
                          {preparation().file.name}
                        </strong>
                        <span role="status" aria-atomic="true">
                          {guitarNightPreparationMessage(preparation())}
                        </span>
                        <Show
                          when={preparation().progress !== null}
                          fallback={
                            <progress
                              class={styles.songProgress}
                              max="100"
                              aria-label={`Preparing ${preparation().file.name}`}
                            />
                          }
                        >
                          <progress
                            class={styles.songProgress}
                            max="100"
                            value={preparation().progress ?? 0}
                            aria-label={`Preparing ${preparation().file.name}`}
                          />
                        </Show>
                        <small>
                          {preparation().warning ??
                            'Your audio stays on this device. Nothing will play automatically.'}
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={preparationError()}>
                    {(error) => (
                      <div class={styles.songState} role="alert">
                        <strong>{error().title}</strong>
                        <span title={error().file.name}>
                          {error().file.name}
                        </span>
                        <small>{error().message}</small>
                      </div>
                    )}
                  </Match>
                  <Match when={cancelledPreparation()}>
                    {(cancelled) => (
                      <div class={styles.songState}>
                        <strong>Preparation cancelled</strong>
                        <span title={cancelled().file.name}>
                          {cancelled().file.name}
                        </span>
                        <small>
                          This song was not staged. The file is ready if you
                          want to try again.
                        </small>
                      </div>
                    )}
                  </Match>
                  <Match when={activeBacking()}>
                    {(backing) => (
                      <>
                        <strong>{backing().title}</strong>
                        <span>
                          {backing().stems.length} local{' '}
                          {backing().stems.length === 1 ? 'stem' : 'stems'}{' '}
                          ready
                        </span>
                        <small>
                          {backing().defaultMix.kind === 'parts'
                            ? backing().defaultMix.muted.length > 0
                              ? 'The guitar part is staged separately and defaults muted.'
                              : 'The available band parts are staged without a separate guitar track.'
                            : 'Guitar is still inside this instrumental mix, so no guitar-mute control is shown.'}
                        </small>
                      </>
                    )}
                  </Match>
                  <Match
                    when={songController.selectionState().kind === 'loading'}
                  >
                    <strong>Opening the prepared song</strong>
                    <span>Reading its local stems from this device…</span>
                    <small>No playback or listening has started.</small>
                  </Match>
                  <Match when={unavailableSelection()}>
                    {(selection) => (
                      <>
                        <strong>Song unavailable here</strong>
                        <span>{unavailableSongCopy(selection())}</span>
                        <small>
                          Choose another prepared song or select the audio file
                          again.
                        </small>
                      </>
                    )}
                  </Match>
                  <Match when={true}>
                    <strong>No song selected</strong>
                    <span>MP3, WAV, or FLAC</span>
                    <small>
                      Prepared songs stay on this device and open without an
                      upload.
                    </small>
                  </Match>
                </Switch>
              </div>

              <section
                class={styles.songLibrary}
                aria-labelledby="guitar-night-library-title"
              >
                <div class={styles.songLibraryHeader}>
                  <h2 id="guitar-night-library-title">Prepared songs</h2>
                  <Show when={songController.libraryState() === 'ready'}>
                    <span>
                      {hiddenSongCount() > 0
                        ? `${visibleSongs().length} of ${songController.songs().length} on this device`
                        : `${songController.songs().length} on this device`}
                    </span>
                  </Show>
                </div>

                <Switch>
                  <Match
                    when={
                      songController.libraryState() === 'idle' ||
                      songController.libraryState() === 'loading'
                    }
                  >
                    <p class={styles.songMessage}>
                      Opening your local library…
                      <Show when={libraryOpenIsSlow()}>
                        <small>
                          The first open after an update re-checks the audio
                          already saved on this device. A large library can take
                          a minute, and nothing is lost while it works.
                        </small>
                      </Show>
                    </p>
                  </Match>
                  <Match when={songController.libraryState() === 'error'}>
                    <div class={styles.songMessageRow}>
                      <p>Your local library could not be opened.</p>
                      <button type="button" onClick={songController.retry}>
                        Try again
                      </button>
                    </div>
                  </Match>
                  <Match
                    when={
                      songController.libraryState() === 'ready' &&
                      songController.songs().length === 0
                    }
                  >
                    <p class={styles.songMessage}>
                      No prepared songs on this device yet.
                    </p>
                  </Match>
                  <Match when={songController.songs().length > 0}>
                    <ul class={styles.songList}>
                      <For each={visibleSongs()}>
                        {(song) => (
                          <li>
                            <button
                              type="button"
                              classList={{
                                [styles.songChoiceActive]:
                                  activeBacking()?.sessionId === song.sessionId,
                              }}
                              aria-current={
                                activeBacking()?.sessionId === song.sessionId
                                  ? 'true'
                                  : undefined
                              }
                              disabled={
                                preparationController.isPreparing() ||
                                bandPreparationController.isPreparing() ||
                                songController.selectionState().kind ===
                                  'loading'
                              }
                              onClick={() => stagePreparedSong(song.sessionId)}
                            >
                              <span>
                                <strong>{song.title}</strong>
                                <small>
                                  {formatPreparedDate(song.createdAt)}
                                </small>
                              </span>
                              <i aria-hidden="true">
                                {activeBacking()?.sessionId === song.sessionId
                                  ? visitedRoomSessionId() === song.sessionId
                                    ? 'Resume'
                                    : 'Selected'
                                  : 'Open'}
                              </i>
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                    <Show when={hiddenSongCount() > 0}>
                      <button
                        type="button"
                        class={styles.songListMore}
                        onClick={() =>
                          setVisibleSongLimit(
                            (limit) => limit + LIBRARY_PAGE_STEP,
                          )
                        }
                      >
                        Show {nextRevealCount()} more
                      </button>
                    </Show>
                  </Match>
                </Switch>
              </section>

              <section
                class={styles.songLibrary}
                aria-labelledby="guitar-night-reference-title"
              >
                <div class={styles.songLibraryHeader}>
                  <h2 id="guitar-night-reference-title">Tab to follow</h2>
                  <Show when={attachedReference() !== null}>
                    <button
                      type="button"
                      class={styles.referenceDetach}
                      onClick={() => referenceController.detach()}
                    >
                      Remove
                    </button>
                  </Show>
                </div>

                <Switch>
                  <Match when={attachedReference()}>
                    {(attached) => (
                      <div class={styles.referenceAttached}>
                        <strong>{attached().title}</strong>
                        <small>
                          {attached().kind === 'measured'
                            ? `${attached().notes.length} notes heard across ${Math.round((attached().coverage ?? 0) * 100)}% of this stem`
                            : `${attached().notes.length} authored notes at ${attached().tempoBpm} BPM`}
                        </small>
                        <small>
                          On a {attached().tuning.stringCount}-string{' '}
                          {attached().tuning.instrument} ·{' '}
                          {attached().tuning.labels.join(' ')}
                        </small>
                        <Show when={attached().liftedOctaves === true}>
                          <small>
                            Raised by whole octaves to reach this instrument’s
                            range.
                          </small>
                        </Show>
                        <Show
                          when={
                            attached().kind === 'authored' &&
                            activeBacking() !== null
                          }
                        >
                          <small>
                            This tab keeps its own {attached().tempoBpm} BPM,
                            which nothing has aligned to the recording yet — so
                            it rehearses in the tab room, not over the backing.
                          </small>
                        </Show>
                        <Show when={attached().outOfRangeNotes > 0}>
                          <small>
                            {attached().outOfRangeNotes}{' '}
                            {attached().outOfRangeNotes === 1
                              ? 'note sits'
                              : 'notes sit'}{' '}
                            off this neck, so{' '}
                            {attached().outOfRangeNotes === 1
                              ? 'it is'
                              : 'they are'}{' '}
                            not shown. Another instrument or string count may
                            reach them.
                          </small>
                        </Show>
                        <Show when={attached().tracks.length > 1}>
                          <div
                            class={styles.referenceTracks}
                            role="group"
                            aria-label="Visible part"
                          >
                            <For each={attached().tracks}>
                              {(track) => (
                                <button
                                  type="button"
                                  classList={{
                                    [styles.referenceTrackActive]:
                                      track.id === attached().trackId,
                                  }}
                                  aria-pressed={track.id === attached().trackId}
                                  onClick={() =>
                                    void referenceController.selectTrack(
                                      track.id,
                                    )
                                  }
                                >
                                  {track.name}
                                </button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Match>
                  <Match when={unavailableReference()}>
                    {(unavailable) => (
                      <p class={styles.songMessage}>
                        {unavailableReferenceCopy(unavailable())}
                      </p>
                    )}
                  </Match>
                  <Match
                    when={
                      referenceController.libraryState() === 'idle' ||
                      referenceController.libraryState() === 'loading'
                    }
                  >
                    <p class={styles.songMessage}>Opening your tab library…</p>
                  </Match>
                  <Match when={referenceController.references().length > 0}>
                    <ul class={styles.songList}>
                      <For each={referenceController.references()}>
                        {(summary) => (
                          <li>
                            <button
                              type="button"
                              onClick={() =>
                                void referenceController.attach(summary.songId)
                              }
                            >
                              <span>
                                <strong>{summary.title}</strong>
                                <small>
                                  {summary.trackCount}{' '}
                                  {summary.trackCount === 1 ? 'part' : 'parts'}{' '}
                                  · {formatPreparedDate(summary.importedAt)}
                                </small>
                              </span>
                              <i aria-hidden="true">Attach</i>
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Match>
                  <Match when={true}>
                    <p class={styles.songMessage}>
                      No tabs on this device yet. Open a Guitar Pro or MIDI file
                      to follow real notes — without one the stage stays in
                      honest free play.
                    </p>
                  </Match>
                </Switch>

                <Show when={referenceController.importStatus()}>
                  {(status) => (
                    <p class={styles.referenceError} role="alert">
                      {status()}
                    </p>
                  )}
                </Show>

                <Show
                  when={transcribableStem()}
                  fallback={
                    <button
                      type="button"
                      class={styles.songListMore}
                      onClick={() => referenceInput?.click()}
                    >
                      Open a tab file
                    </button>
                  }
                >
                  {(stem) => (
                    <div class={styles.referenceActions}>
                      <button
                        type="button"
                        class={styles.songListMore}
                        onClick={() => referenceInput?.click()}
                      >
                        Open a tab file
                      </button>
                      <Switch>
                        <Match
                          when={
                            referenceController.transcribeProgress() !== null
                          }
                        >
                          <button
                            type="button"
                            class={styles.songListMore}
                            onClick={referenceController.cancelFollowStem}
                          >
                            Reading the {stem().label.toLowerCase()} notes…{' '}
                            {Math.round(
                              (referenceController.transcribeProgress() ?? 0) *
                                100,
                            )}
                            % · Stop
                          </button>
                        </Match>
                        <Match when={true}>
                          <button
                            type="button"
                            class={styles.songListMore}
                            onClick={() =>
                              void referenceController.followStem({
                                sessionId: stem().sessionId,
                                stemKind: stem().kind,
                                stemLabel: stem().label,
                                stemUrl: stem().url,
                              })
                            }
                          >
                            Transcribe the {stem().label.toLowerCase()} line
                          </button>
                        </Match>
                      </Switch>
                    </div>
                  )}
                </Show>
              </section>

              <div class={styles.detailActions}>
                <button type="button" onClick={returnToChoices}>
                  Back
                </button>
                <Switch>
                  <Match when={bandPreparation() !== null}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={bandPreparationController.cancel}
                    >
                      Keep current mix
                    </button>
                  </Match>
                  <Match when={bandPreparationError()}>
                    {(error) => (
                      <button
                        class={styles.completionAction}
                        type="button"
                        onClick={() =>
                          bandPreparationController.start(error().sessionId)
                        }
                      >
                        Try full band again
                      </button>
                    )}
                  </Match>
                  <Match when={preparingSong() !== null}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={preparationController.cancel}
                    >
                      Cancel preparation
                    </button>
                  </Match>
                  <Match when={preparationError()}>
                    {(error) => (
                      <>
                        <Show when={error().retryable}>
                          <button
                            class={styles.completionAction}
                            type="button"
                            onClick={preparationController.retry}
                          >
                            Try again
                          </button>
                        </Show>
                        <button
                          type="button"
                          onClick={() => songInput?.click()}
                        >
                          Choose another
                        </button>
                      </>
                    )}
                  </Match>
                  <Match when={cancelledPreparation() !== null}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={preparationController.retry}
                    >
                      Try again
                    </button>
                    <button type="button" onClick={() => songInput?.click()}>
                      Choose another
                    </button>
                  </Match>
                  <Match when={activeBacking()}>
                    {(backing) => (
                      <>
                        <button
                          class={styles.completionAction}
                          type="button"
                          onClick={enterRoom}
                        >
                          {authoredReference() === null
                            ? 'Enter room'
                            : 'Play along'}
                        </button>
                        {/* Two rooms, one at a time: the tab has its own
                            tempo and the recording has its own, and nothing
                            aligns them yet. */}
                        <Show when={authoredReference()}>
                          <button
                            class={styles.bandPreparationAction}
                            type="button"
                            onClick={enterScoreRoom}
                          >
                            Rehearse the tab
                          </button>
                        </Show>
                        <Show
                          when={
                            backing().defaultMix.kind === 'mixed-instrumental'
                          }
                        >
                          <button
                            class={styles.bandPreparationAction}
                            type="button"
                            onClick={prepareGuitarFreeBand}
                          >
                            Separate guitar
                          </button>
                        </Show>
                        <button
                          type="button"
                          onClick={() => songInput?.click()}
                        >
                          Choose another
                        </button>
                      </>
                    )}
                  </Match>
                  <Match when={authoredReference() !== null}>
                    {/* A tab alone is a complete rehearsal — no recording
                        needed to enter a room. */}
                    <button
                      class={styles.completionAction}
                      type="button"
                      onClick={enterScoreRoom}
                    >
                      Rehearse the tab
                    </button>
                    <button type="button" onClick={() => songInput?.click()}>
                      Choose audio
                    </button>
                  </Match>
                  <Match when={true}>
                    <button
                      class={styles.completionAction}
                      type="button"
                      disabled={
                        songController.selectionState().kind === 'loading'
                      }
                      onClick={() => songInput?.click()}
                    >
                      {activeBacking() ? 'Choose another' : 'Choose audio'}
                    </button>
                  </Match>
                </Switch>
              </div>
            </Match>

            <Match when={view() === 'room' && activeBacking()}>
              <GuitarNightRoom
                backing={activeBacking()!}
                transport={playbackController}
                reference={measuredReference}
                tuning={referenceController.tuning}
                onInstrument={referenceController.setInstrument}
                onStringCount={referenceController.setStringCount}
                onSongs={returnToSongs}
                onSeparateGuitar={prepareGuitarFreeBand}
              />
            </Match>

            <Match when={view() === 'score-room' && authoredReference()}>
              {(authored) => (
                <Suspense
                  fallback={
                    <p class={styles.songMessage}>Opening the tab room…</p>
                  }
                >
                  <GuitarNightScoreRoom
                    reference={authored}
                    tuning={referenceController.tuning}
                    onInstrument={referenceController.setInstrument}
                    onStringCount={referenceController.setStringCount}
                    onSongs={returnToSongs}
                  />
                </Suspense>
              )}
            </Match>
          </Switch>
        </div>
      </main>

      <Show when={!isRoomView()}>
        <div
          class={styles.roomStatus}
          aria-label={`Room status: ${roomStatus().title}. ${roomStatus().detail}`}
        >
          <span aria-hidden="true" />
          <strong>{roomStatus().title}</strong>
          <small>{roomStatus().detail}</small>
        </div>
      </Show>

      <input
        ref={referenceInput}
        class={styles.fileInput}
        data-testid="guitar-night-reference-input"
        type="file"
        accept={REFERENCE_FILE_ACCEPT}
        onChange={chooseReferenceFile}
        tabindex="-1"
      />

      <input
        ref={songInput}
        class={styles.fileInput}
        data-testid="guitar-night-song-input"
        type="file"
        accept={AUDIO_UPLOAD_ACCEPT}
        disabled={
          preparationController.isPreparing() ||
          bandPreparationController.isPreparing()
        }
        onChange={handleSongChange}
        tabindex="-1"
      />
    </div>
  )
}
