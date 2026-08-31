// DrumPlayAlongSongsPanel presents authored scores and prepared backing as honest, independent play-along sources.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, createUniqueId, For, Match, Show, Switch } from 'solid-js'
import { AlertTriangle, Cloud, Drum, FileText, Loader2, MusicLibrary, X, } from '@/components/icons'
import { isGuitarProSongFile, isMidiSongFile, SONG_REFERENCE_FILE_ACCEPT, } from '@/features/play-along/song-import'
import type { PlayAlongBackingSource, PlayAlongSongSummary, } from '@/features/play-along/song-port'
import { playAlongEncodedBudgetCopy } from '@/features/play-along/song-port'
import { UnifiedSongFileDrop } from '@/features/play-along/UnifiedSongFileDrop'
import type { PlayAlongBandPreparationState } from '@/features/play-along/useBandPreparationController'
import type { PlayAlongLibraryState, PlayAlongSelectionState, } from '@/features/play-along/useSongController'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import styles from './DrumPlayAlongSongsPanel.module.css'

const FILE_DROP_COPY = {
  chooseFile: 'Choose MIDI or Guitar Pro',
  dropAlternative: '',
  formats: 'MIDI · GP · GP3 · GP4 · GP5 · GPX',
  activeDrop: 'Drop one authored arrangement',
  oneFile: 'One file at a time',
  opening: (fileName: string) => `Reading ${fileName}…`,
}

const FILE_DROP_CLASSES = {
  root: styles.fileDrop,
  status: styles.fileStatus,
  prompt: styles.filePrompt,
  choose: styles.fileChoose,
  dropAlternative: styles.dropAlternative,
  formats: styles.fileFormats,
  overlay: styles.dropOverlay,
  input: styles.fileInput,
}

type PreparingState = Extract<
  PlayAlongBandPreparationState,
  { kind: 'preparing' }
>
type UnavailableSelection = Extract<
  PlayAlongSelectionState<'drums', PlayAlongBackingSource<'drums'>>,
  { kind: 'unavailable' }
>

export interface DrumPlayAlongSongsPanelProps {
  libraryState: PlayAlongLibraryState
  selectionState: PlayAlongSelectionState<
    'drums',
    PlayAlongBackingSource<'drums'>
  >
  songs: readonly PlayAlongSongSummary[]
  preparationState: PlayAlongBandPreparationState

  /** Host-owned detail for the active MIDI or Guitar Pro arrangement. */
  localArrangement?: JSX.Element
  /** Host-owned controls that belong beside the selected saved backing. */
  selectedSessionAccessory?: JSX.Element

  openingFileName?: string | null
  fileMessage?: string | null
  fileBusy?: boolean
  fileDisabled?: boolean
  onChooseFile?: () => void
  onPickerUnavailable?: () => void
  onFile: (file: File) => void
  onFilesRejected: (files: readonly File[]) => void

  onSelectSession: (sessionId: string) => void
  onClearSession: () => void
  onRetryLibrary: () => void
  onRetrySession?: (sessionId: string) => void

  onSeparateDrums: (sessionId: string) => void
  onCancelSeparation: () => void
  onRetrySeparation: (sessionId: string) => void
  onDismissSeparation: () => void
  onResolveBlocker?: (blocker: CloudSplitBlocker) => void
}

function formatPreparedDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function unavailableSelectionCopy(state: UnavailableSelection): string {
  if (state.reason === 'not-found') {
    return 'That prepared song is no longer in this device library.'
  }
  if (state.reason === 'not-completed') {
    return 'That Karaoke session has not finished preparing yet.'
  }
  if (state.reason === 'missing-local-audio') {
    return 'The session exists, but its audio is not stored on this device.'
  }
  if (state.reason === 'encoded-budget') {
    return playAlongEncodedBudgetCopy(state.requiredBytes, state.budgetBytes)
  }
  return 'The prepared-song library could not be opened.'
}

function separationMessage(state: PreparingState): string {
  const progress = Math.round(state.progress ?? 0)
  if (state.phase === 'opening') return 'Checking saved band parts…'
  if (state.phase === 'uploading') {
    return `Sending the instrumental · ${progress}%`
  }
  if (state.phase === 'processing') {
    return `Separating drums from the band · ${progress}%`
  }
  if (state.phase === 'saving') {
    const detail = state.detail?.trim()
    return detail !== undefined && detail !== ''
      ? detail
      : `Saving separated parts · ${progress}%`
  }
  return 'Reopening the full mix…'
}

function isSupportedScoreFile(file: File): boolean {
  return isMidiSongFile(file.name) || isGuitarProSongFile(file.name)
}

function hasSourceDrumStem(source: PlayAlongBackingSource<'drums'>): boolean {
  return source.stemKinds.some((kind) => kind === 'drums')
}

function startsWithSourceDrums(
  source: PlayAlongBackingSource<'drums'>,
): boolean {
  if (source.plannedMix.kind !== 'parts') return false
  return source.plannedMix.audible.some((kind) => kind === 'drums')
}

export function DrumPlayAlongSongsPanel(props: DrumPlayAlongSongsPanelProps) {
  const headingId = createUniqueId()
  const libraryHeadingId = createUniqueId()
  const selectionHeadingId = createUniqueId()

  const selectedSessionId = createMemo(() => {
    const state = props.selectionState
    if (state.kind === 'loading' || state.kind === 'unavailable') {
      return state.sessionId
    }
    return state.kind === 'ready' ? state.lease.sessionId : null
  })
  const selectedLease = createMemo(() => {
    const state = props.selectionState
    return state.kind === 'ready' ? state.lease : null
  })
  const loadingSelection = createMemo(() => {
    const state = props.selectionState
    return state.kind === 'loading' ? state : null
  })
  const unavailableSelection = createMemo(() => {
    const state = props.selectionState
    return state.kind === 'unavailable' ? state : null
  })
  const preparing = createMemo(() => {
    const state = props.preparationState
    return state.kind === 'preparing' ? state : null
  })
  const sessionChoiceDisabled = createMemo(
    () =>
      props.libraryState !== 'ready' ||
      loadingSelection() !== null ||
      preparing() !== null,
  )

  const submitFile = (file: File): void => {
    if (!isSupportedScoreFile(file)) {
      props.onFilesRejected([file])
      return
    }
    props.onFile(file)
  }

  return (
    <section class={styles.panel} aria-labelledby={headingId}>
      <header class={styles.intro}>
        <p class={styles.eyebrow}>PLAY-ALONG SOURCES</p>
        <h2 id={headingId}>Bring the band. Keep the drums yours.</h2>
        <p class={styles.introCopy}>
          Open MIDI or Guitar Pro for an authored drum score, or choose a
          prepared Karaoke session for audio. Nothing starts until you press
          Play.
        </p>
      </header>

      <div class={styles.sourceDeck}>
        <UnifiedSongFileDrop
          accept={SONG_REFERENCE_FILE_ACCEPT}
          copy={FILE_DROP_COPY}
          classes={FILE_DROP_CLASSES}
          testId="drum-play-along-file-drop"
          disabled={props.fileDisabled}
          busy={props.fileBusy}
          openingFileName={props.openingFileName}
          message={props.fileMessage}
          onChoose={props.onChooseFile}
          onPickerUnavailable={props.onPickerUnavailable}
          onFile={submitFile}
          onRejected={props.onFilesRejected}
        >
          <div class={styles.channelHeader}>
            <span class={styles.channelIcon} aria-hidden="true">
              <FileText size={20} />
            </span>
            <span>
              <small>AUTHORED SCORE</small>
              <strong>MIDI or Guitar Pro</strong>
            </span>
            <i>Score</i>
          </div>
          <p class={styles.channelCopy}>
            Load every track, follow the drum part, and keep the rest available
            as backing.
          </p>
          <Show when={props.localArrangement}>
            <div class={styles.localArrangement}>{props.localArrangement}</div>
          </Show>
        </UnifiedSongFileDrop>

        <section
          class={styles.libraryChannel}
          aria-labelledby={libraryHeadingId}
          aria-busy={props.libraryState === 'loading' ? true : undefined}
        >
          <header class={styles.channelHeader}>
            <span class={styles.channelIcon} aria-hidden="true">
              <MusicLibrary size={20} />
            </span>
            <span>
              <small>PREPARED BACKING</small>
              <strong id={libraryHeadingId}>Karaoke sessions</strong>
            </span>
            <i>Audio</i>
          </header>
          <p class={styles.channelCopy}>
            Completed sessions on this device, ready to mix without uploading
            the original again.
          </p>

          <Switch>
            <Match when={props.libraryState === 'idle'}>
              <div class={styles.libraryState}>
                <Cloud size={22} />
                <span>
                  <strong>Saved songs stay asleep until needed</strong>
                  <small>Load the local catalog when you are ready.</small>
                </span>
                <button type="button" onClick={() => props.onRetryLibrary()}>
                  Load saved songs
                </button>
              </div>
            </Match>
            <Match when={props.libraryState === 'loading'}>
              <div class={styles.libraryState} role="status" aria-live="polite">
                <span class={styles.spinner} aria-hidden="true">
                  <Loader2 />
                </span>
                <span>
                  <strong>Opening your prepared songs</strong>
                  <small>Reading completed sessions on this device…</small>
                </span>
              </div>
            </Match>
            <Match when={props.libraryState === 'error'}>
              <div class={styles.libraryState} role="alert">
                <AlertTriangle />
                <span>
                  <strong>Saved songs could not be opened</strong>
                  <small>Your current score and mix have not changed.</small>
                </span>
                <button type="button" onClick={() => props.onRetryLibrary()}>
                  Try again
                </button>
              </div>
            </Match>
            <Match
              when={props.libraryState === 'ready' && props.songs.length === 0}
            >
              <div class={styles.libraryState}>
                <MusicLibrary size={22} />
                <span>
                  <strong>No prepared backing yet</strong>
                  <small>
                    Separate a song in Karaoke, then return here to play along.
                  </small>
                </span>
              </div>
            </Match>
            <Match
              when={props.libraryState === 'ready' && props.songs.length > 0}
            >
              <ul class={styles.songList} aria-label="Prepared Karaoke songs">
                <For each={props.songs}>
                  {(song) => {
                    const active = () => selectedSessionId() === song.sessionId
                    return (
                      <li>
                        <button
                          type="button"
                          classList={{ [styles.songActive]: active() }}
                          aria-current={active() ? 'true' : undefined}
                          disabled={sessionChoiceDisabled()}
                          onClick={() => props.onSelectSession(song.sessionId)}
                        >
                          <span>
                            <strong>{song.title}</strong>
                            <small>
                              {song.subtitle ??
                                formatPreparedDate(song.createdAt)}
                            </small>
                          </span>
                          <i>{active() ? 'Selected' : 'Load backing'}</i>
                        </button>
                      </li>
                    )
                  }}
                </For>
              </ul>
            </Match>
          </Switch>
        </section>
      </div>

      <section class={styles.routingStrip} aria-labelledby={selectionHeadingId}>
        <div class={styles.routeLabel}>
          <span aria-hidden="true">
            <Drum />
          </span>
          <span>
            <small>BACKING ROUTE</small>
            <strong id={selectionHeadingId}>Drums + band</strong>
          </span>
        </div>

        <div class={styles.routeTruth}>
          <Switch>
            <Match when={props.selectionState.kind === 'idle'}>
              <div class={styles.routeEmpty}>
                <strong>No backing selected</strong>
                <span>
                  Choose a completed Karaoke session above. Your live kit stays
                  independent.
                </span>
              </div>
            </Match>
            <Match when={loadingSelection()}>
              {(state) => (
                <div
                  class={styles.routeLoading}
                  role="status"
                  aria-live="polite"
                >
                  <span class={styles.spinner} aria-hidden="true">
                    <Loader2 />
                  </span>
                  <span>
                    <strong>Opening local stems</strong>
                    <small>{state().sessionId}</small>
                  </span>
                  <button type="button" onClick={props.onClearSession}>
                    Cancel
                  </button>
                </div>
              )}
            </Match>
            <Match when={unavailableSelection()}>
              {(state) => (
                <div class={styles.routeProblem} role="alert">
                  <AlertTriangle />
                  <span>
                    <strong>Backing is unavailable</strong>
                    <small>{unavailableSelectionCopy(state())}</small>
                  </span>
                  <div class={styles.inlineActions}>
                    <Show when={props.onRetrySession}>
                      <button
                        type="button"
                        onClick={() =>
                          props.onRetrySession?.(state().sessionId)
                        }
                      >
                        Try again
                      </button>
                    </Show>
                    <button type="button" onClick={props.onClearSession}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </Match>
            <Match when={selectedLease()}>
              {(lease) => (
                <div class={styles.readyRoute}>
                  <div class={styles.readyHeading}>
                    <span>
                      <small>{lease().title}</small>
                      <Switch>
                        <Match
                          when={
                            lease().plannedMix.kind === 'mixed-instrumental'
                          }
                        >
                          <strong>Backing with drums inside</strong>
                        </Match>
                        <Match
                          when={
                            lease().plannedMix.kind === 'parts' &&
                            hasSourceDrumStem(lease()) &&
                            startsWithSourceDrums(lease())
                          }
                        >
                          <strong>Full mix ready</strong>
                        </Match>
                        <Match
                          when={
                            lease().plannedMix.kind === 'parts' &&
                            hasSourceDrumStem(lease())
                          }
                        >
                          <strong>Separated drums ready</strong>
                        </Match>
                        <Match when={lease().plannedMix.kind === 'parts'}>
                          <strong>Drum-free backing ready</strong>
                        </Match>
                      </Switch>
                    </span>
                    <button
                      type="button"
                      class={styles.clearButton}
                      onClick={props.onClearSession}
                      aria-label={`Clear ${lease().title} backing`}
                    >
                      <X />
                      <span>Clear</span>
                    </button>
                  </div>

                  <Switch>
                    <Match
                      when={lease().plannedMix.kind === 'mixed-instrumental'}
                    >
                      <div class={styles.mixTruth}>
                        <span class={styles.mixChip}>Backing on</span>
                        <span class={styles.mixChipMuted}>Drums included</span>
                        <p>
                          The source drums are still inside this two-stem mix,
                          so they cannot be controlled separately yet.
                        </p>
                      </div>
                      <Show
                        when={
                          lease().source !== 'demo' &&
                          props.preparationState.kind !== 'preparing'
                        }
                      >
                        <div class={styles.separateOffer}>
                          <span>
                            <strong>
                              Create separate Drums and Backing controls
                            </strong>
                            <small>
                              We check account and credits before a cloud job
                              starts.
                            </small>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              props.onSeparateDrums(lease().sessionId)
                            }
                          >
                            Separate drums
                          </button>
                        </div>
                      </Show>
                      <Show when={lease().source === 'demo'}>
                        <p class={styles.demoNote}>
                          This demo keeps drums inside its prepared backing.
                        </p>
                      </Show>
                    </Match>
                    <Match
                      when={
                        lease().plannedMix.kind === 'parts' &&
                        hasSourceDrumStem(lease()) &&
                        startsWithSourceDrums(lease())
                      }
                    >
                      <div class={styles.mixTruth}>
                        <span class={styles.mixChip}>Source drums on</span>
                        <span class={styles.mixChip}>Backing on</span>
                        <p>
                          The full saved mix starts together. Your live kit is a
                          separate input, ready for the mixer when you press
                          Play.
                        </p>
                      </div>
                    </Match>
                    <Match
                      when={
                        lease().plannedMix.kind === 'parts' &&
                        hasSourceDrumStem(lease())
                      }
                    >
                      <div class={styles.mixTruth}>
                        <span class={styles.mixChipMuted}>
                          Source drums off
                        </span>
                        <span class={styles.mixChip}>Backing on</span>
                        <p>
                          The isolated drum stem is ready but starts muted. Your
                          live kit remains independent.
                        </p>
                      </div>
                    </Match>
                    <Match when={lease().plannedMix.kind === 'parts'}>
                      <div class={styles.mixTruth}>
                        <span class={styles.mixChip}>Backing on</span>
                        <span class={styles.mixChipMuted}>No source drums</span>
                        <p>
                          The saved parts contain no drum stem. Play your live
                          kit against the drum-free band.
                        </p>
                      </div>
                    </Match>
                  </Switch>

                  <Show when={props.selectedSessionAccessory}>
                    <div class={styles.sessionAccessory}>
                      {props.selectedSessionAccessory}
                    </div>
                  </Show>
                </div>
              )}
            </Match>
          </Switch>
        </div>

        <Switch>
          <Match when={preparing()}>
            {(state) => (
              <div class={styles.preparation} role="status" aria-live="polite">
                <span class={styles.spinner} aria-hidden="true">
                  <Loader2 />
                </span>
                <span>
                  <strong>{separationMessage(state())}</strong>
                  <small>
                    Keep this room open. Your current backing stays intact.
                  </small>
                </span>
                <Show
                  when={state().progress !== null}
                  fallback={
                    <progress
                      class={styles.progress}
                      max="100"
                      aria-label="Separating drums"
                    />
                  }
                >
                  <progress
                    class={styles.progress}
                    max="100"
                    value={state().progress ?? 0}
                    aria-label="Separating drums"
                  />
                </Show>
                <button type="button" onClick={props.onCancelSeparation}>
                  Cancel
                </button>
              </div>
            )}
          </Match>
          <Match when={props.preparationState.kind === 'blocked'}>
            <div class={styles.preparationBlocked} role="status">
              <AlertTriangle />
              <span>
                <strong>Separation needs one more thing</strong>
                <small>
                  {props.preparationState.kind === 'blocked'
                    ? props.preparationState.blocker.message
                    : ''}
                </small>
                <em>No job started and no credits were used.</em>
              </span>
              <div class={styles.inlineActions}>
                <Show
                  when={
                    props.preparationState.kind === 'blocked' &&
                    props.preparationState.blocker.cta !== null &&
                    props.onResolveBlocker !== undefined
                  }
                >
                  <button
                    type="button"
                    class={styles.primaryAction}
                    onClick={() => {
                      const state = props.preparationState
                      if (state.kind === 'blocked') {
                        props.onResolveBlocker?.(state.blocker)
                      }
                    }}
                  >
                    {props.preparationState.kind === 'blocked'
                      ? props.preparationState.blocker.cta?.label
                      : ''}
                  </button>
                </Show>
                <button
                  type="button"
                  onClick={() => props.onDismissSeparation()}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </Match>
          <Match when={props.preparationState.kind === 'error'}>
            <div class={styles.preparationError} role="alert">
              <AlertTriangle />
              <span>
                <strong>Drum separation did not finish</strong>
                <small>
                  {props.preparationState.kind === 'error'
                    ? props.preparationState.message
                    : ''}
                </small>
                <em>Your original two-stem mix is still ready.</em>
              </span>
              <div class={styles.inlineActions}>
                <button
                  type="button"
                  class={styles.primaryAction}
                  onClick={() => {
                    const state = props.preparationState
                    if (state.kind === 'error') {
                      props.onRetrySeparation(state.sessionId)
                    }
                  }}
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => props.onDismissSeparation()}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </Match>
        </Switch>
      </section>
    </section>
  )
}
