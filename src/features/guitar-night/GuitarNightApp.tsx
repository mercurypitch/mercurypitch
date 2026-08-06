// Guitar Night presents the inert Velvet Rehearsal entry before any audio or input lifetime begins.
// ============================================================
/*
THESIS: The player enters a private rehearsal room, not a configuration dashboard.
OWN-WORLD: Velvet curtains, walnut, warm ivory, amber lamps, and quiet teal room status.
STORY: Choose a first win, bring one song, or step directly into the current Guitar workspace.
FIRST VIEWPORT: One calm amp-faceplate entry surface leaves the approved room and instruments visible.
FORM: A grounded rehearsal-room welcome with three deliberately unequal paths and no synthetic activity.
*/

import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js'
import { AUDIO_UPLOAD_ACCEPT, formatFileSize, } from '@/lib/audio-upload-contract'
import type { GuitarFirstWinExerciseStepV1 } from './first-win-config'
import { resolveGuitarFirstWinConfig } from './first-win-config'
import styles from './GuitarNightApp.module.css'
import { readGuitarNightSession } from './session-link'
import type { GuitarNightSongPort } from './song-port'
import type { GuitarNightSelectionState } from './useGuitarNightSongController'
import { loadDefaultGuitarNightSongPort, useGuitarNightSongController, } from './useGuitarNightSongController'

type EntryView = 'choices' | 'first-win' | 'song'
type GuitarNightAppProps = {
  firstWinConfig?: unknown
  loadSongPort?: () => Promise<GuitarNightSongPort>
}

const TAB_STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']

function formatPreparedDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
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

function stepFretsForString(
  step: GuitarFirstWinExerciseStepV1,
  stringIndex: number,
): number[] {
  return stringIndex === step.stringIndex ? step.frets : []
}

export function GuitarNightApp(props: GuitarNightAppProps) {
  const firstWinConfig = createMemo(() =>
    resolveGuitarFirstWinConfig(props.firstWinConfig),
  )
  const firstWinStep = createMemo(() => firstWinConfig().exerciseSteps[0])
  const initialSessionId = readGuitarNightSession()
  const [view, setView] = createSignal<EntryView>(
    initialSessionId === null ? 'choices' : 'song',
  )
  const [previewHits, setPreviewHits] = createSignal(0)
  const [selectedSong, setSelectedSong] = createSignal<File | null>(null)
  let detailHeading: HTMLHeadingElement | undefined
  let songInput: HTMLInputElement | undefined

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
      setSelectedSong(null)
      setView('song')
      focusDetail()
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
    focusDetail()
  }

  const openCurrentGuitar = () => {
    window.location.assign('/#/guitar')
  }

  const returnToChoices = () => {
    if (view() === 'song') songController.clearSession('push')
    setView('choices')
    queueMicrotask(() =>
      document
        .querySelector<HTMLButtonElement>('[data-entry="start"]')
        ?.focus(),
    )
  }

  const addPreviewHit = () => {
    setPreviewHits((hits) =>
      Math.min(hits + 1, firstWinConfig().freshHitsRequested),
    )
  }

  const previewPassed = () => previewHits() >= firstWinConfig().passHits
  const previewFinished = () =>
    previewHits() >= firstWinConfig().freshHitsRequested

  const completionAction = () =>
    firstWinConfig().completionActions.includes('keep-jamming')
      ? 'keep-jamming'
      : firstWinConfig().completionActions.includes('load-song')
        ? 'load-song'
        : 'keep-jamming'

  const handleCompletion = () => {
    if (completionAction() === 'load-song') {
      setView('song')
      songController.initialize()
      focusDetail()
      return
    }
    openCurrentGuitar()
  }

  const handleSongChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    songController.clearSession('push')
    setSelectedSong(input.files?.[0] ?? null)
    input.value = ''
    setView('song')
    focusDetail()
  }

  const stagePreparedSong = (sessionId: string) => {
    setSelectedSong(null)
    void songController.stageSession(sessionId, 'push')
  }

  const roomStatusCopy = () => {
    const selection = songController.selectionState()
    if (selection.kind === 'ready') {
      return 'Song prepared; playback has not started'
    }
    if (selection.kind === 'loading') {
      return 'Opening local song; no audio has started'
    }
    if (selectedSong() !== null) {
      return 'Audio chosen; preparation has not started'
    }
    return 'No audio or listening has started'
  }

  return (
    <div class={styles.app} data-testid="guitar-night-shell">
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

      <main class={styles.main} id="guitar-night-main">
        <section class={styles.entryPanel}>
          <div class={styles.panelEdge} aria-hidden="true" />

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
                  onClick={openCurrentGuitar}
                >
                  <strong>I know my way around</strong>
                  <span id="guitar-night-expert-description">
                    Open the current Guitar workspace
                  </span>
                </button>
              </div>
            </Match>

            <Match when={view() === 'first-win'}>
              <p class={styles.eyebrow}>First win · touch preview</p>
              <h1 ref={detailHeading} tabindex="-1">
                Start with one string.
              </h1>
              <p class={styles.detailCopy}>
                Tab has six lines. A number tells you which fret to play. A 0
                means play the string open.
              </p>

              <div
                class={styles.tabPreview}
                role="img"
                aria-label={`Tab showing ${firstWinConfig().freshHitsRequested} open ${firstWinStep().stringLabel} notes`}
              >
                <For each={TAB_STRING_LABELS}>
                  {(label, stringIndex) => (
                    <div
                      class={styles.tabString}
                      classList={{
                        [styles.targetString]:
                          stringIndex() === firstWinStep().stringIndex,
                      }}
                    >
                      <span>{label}</span>
                      <i aria-hidden="true" />
                      <div class={styles.tabNotes} aria-hidden="true">
                        <For
                          each={stepFretsForString(
                            firstWinStep(),
                            stringIndex(),
                          )}
                        >
                          {(fret) => <b>{fret}</b>}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class={styles.rhythmPreview}>
                <div class={styles.previewMeta}>
                  <span>{firstWinStep().stringLabel} · standard tuning</span>
                  <span>{firstWinConfig().freshHitsRequested} notes</span>
                </div>
                <div
                  class={styles.beatRow}
                  aria-label={`${previewHits()} of ${firstWinConfig().freshHitsRequested} preview taps`}
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
                          [styles.beatFilled]: index < previewHits(),
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </For>
                </div>
                <button
                  class={styles.tapAction}
                  type="button"
                  onClick={addPreviewHit}
                  disabled={previewFinished()}
                >
                  {previewFinished()
                    ? 'First bar complete'
                    : `Tap each ${firstWinStep().stringLabel} note`}
                </button>
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
                      onClick={openCurrentGuitar}
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

              <div class={styles.songWell} aria-live="polite">
                <Switch>
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
                  <Match when={selectedSong() !== null}>
                    <strong>{selectedSong()?.name}</strong>
                    <span>
                      {selectedSong()?.type === ''
                        ? 'Audio file'
                        : (selectedSong()?.type ?? 'Audio file')}{' '}
                      · {formatFileSize(selectedSong()?.size ?? 0)}
                    </span>
                    <small>
                      Selected on this device. Song preparation is not connected
                      yet.
                    </small>
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
                    <span>{songController.songs().length} on this device</span>
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
                      <For each={songController.songs()}>
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
                              <i aria-hidden="true">Open</i>
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Match>
                </Switch>
              </section>

              <div class={styles.detailActions}>
                <button type="button" onClick={returnToChoices}>
                  Back
                </button>
                <button
                  class={styles.completionAction}
                  type="button"
                  onClick={() => songInput?.click()}
                >
                  {selectedSong() ? 'Choose another' : 'Choose audio'}
                </button>
              </div>
            </Match>
          </Switch>
        </section>
      </main>

      <div
        class={styles.roomStatus}
        aria-label={`Room status: ${roomStatusCopy()}`}
      >
        <span aria-hidden="true" />
        <strong>Room ready</strong>
        <small>{roomStatusCopy()}</small>
      </div>

      <input
        ref={songInput}
        class={styles.fileInput}
        data-testid="guitar-night-song-input"
        type="file"
        accept={AUDIO_UPLOAD_ACCEPT}
        onChange={handleSongChange}
        tabindex="-1"
      />
    </div>
  )
}
