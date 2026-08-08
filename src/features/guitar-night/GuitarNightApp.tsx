// Guitar Night presents the inert Velvet Rehearsal entry before any audio or input lifetime begins.
// ============================================================
/*
THESIS: The player enters a private rehearsal room, not a configuration dashboard.
OWN-WORLD: Velvet curtains, walnut, warm ivory, amber lamps, and quiet teal room status.
STORY: Choose a first win, bring one song, or step directly into the current Guitar workspace.
FIRST VIEWPORT: One calm amp-faceplate entry surface leaves the approved room and instruments visible.
FORM: A grounded rehearsal-room welcome with three deliberately unequal paths and no synthetic activity.
*/

import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import type { GuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { createGuitarBackingTransport } from '@/features/guitar/backing/guitar-backing-transport'
import { useGuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { beatToSeconds } from '@/features/guitar/runtime/guitar-performance-contract'
import { AUDIO_UPLOAD_ACCEPT } from '@/lib/audio-upload-contract'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'
import { resolveGuitarFirstWinConfig } from './first-win-config'
import styles from './GuitarNightApp.module.css'
import { guitarNightBackingSession, GuitarNightRoom } from './GuitarNightRoom'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightPreparationPort } from './preparation-port'
import type { GuitarNightReferencePort } from './reference-port'
import { REFERENCE_FILE_ACCEPT } from './reference-port'
import { readGuitarNightSession } from './session-link'
import type { GuitarNightSongPort } from './song-port'
import { useGuitarFirstWinController } from './useGuitarFirstWinController'
import { guitarNightBandPreparationMessage, loadDefaultGuitarNightBandPreparationPort, useGuitarNightBandPreparationController, } from './useGuitarNightBandPreparationController'
import { guitarNightPreparationMessage, loadDefaultGuitarNightPreparationPort, useGuitarNightPreparationController, } from './useGuitarNightPreparationController'
import type { GuitarNightReferenceState } from './useGuitarNightReferenceController'
import { loadDefaultGuitarNightReferencePort, useGuitarNightReferenceController, } from './useGuitarNightReferenceController'
import type { GuitarNightSelectionState } from './useGuitarNightSongController'
import { loadDefaultGuitarNightSongPort, useGuitarNightSongController, } from './useGuitarNightSongController'

type EntryView = 'choices' | 'first-win' | 'song' | 'room'
type GuitarNightAppProps = {
  firstWinConfig?: unknown
  loadReferencePort?: () => Promise<GuitarNightReferencePort>
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
  const initialSessionId = readGuitarNightSession()
  const [view, setView] = createSignal<EntryView>(
    initialSessionId === null ? 'choices' : 'song',
  )
  const [visitedRoomSessionId, setVisitedRoomSessionId] = createSignal<
    string | null
  >(null)
  let detailHeading: HTMLHeadingElement | undefined
  let songInput: HTMLInputElement | undefined
  let referenceInput: HTMLInputElement | undefined

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
  })
  const attachedReference = referenceController.reference
  const unavailableReference = createMemo(() => {
    const current = referenceController.state()
    return current.kind === 'unavailable' ? current : null
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
    if (view() === 'song' || view() === 'room') {
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

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
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
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
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
      classList={{ [styles.appRoom]: view() === 'room' }}
      data-testid="guitar-night-shell"
    >
      <a class={styles.skipLink} href="#guitar-night-main">
        Skip to Guitar Night
      </a>

      <div
        class={styles.backdrop}
        data-testid="guitar-night-backdrop"
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
        <span class={styles.roomName}>Velvet Rehearsal</span>
      </div>

      <main
        class={styles.main}
        classList={{ [styles.mainRoom]: view() === 'room' }}
        id="guitar-night-main"
      >
        <div
          class={styles.entryPanel}
          classList={{
            [styles.entryPanelRoom]: view() === 'room',
            [styles.entryPanelLesson]: view() === 'first-win',
          }}
        >
          <Show when={view() !== 'room'}>
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
                        <Show when={attached().liftedOctaves === true}>
                          <small>
                            Raised into guitar range to fit the six-string
                            stage.
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
                          Enter room
                        </button>
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
                reference={attachedReference}
                onSongs={returnToSongs}
                onSeparateGuitar={prepareGuitarFreeBand}
              />
            </Match>
          </Switch>
        </div>
      </main>

      <Show when={view() !== 'room'}>
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
