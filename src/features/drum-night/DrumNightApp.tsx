// ============================================================
// Drum Night — silent-first Pocket Console percussion room
// ============================================================
//
// This standalone surface owns one transport, audio graph and input clock.
// First paint remains visual-only: Web Audio, sample requests and WebMIDI are
// crossed synchronously only by an explicit Play, touch, or keyboard strike.
// MIDI permission remains audio-inert because an incoming MIDI event is not a
// browser activation gesture.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, lazy, Match, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { AudioWave, ChevronDown, Drum, Metronome, MidiDin, Minus, MusicLibrary, MusicNote, Pause, Play, Plus, SlidersHorizontal, Square, WaveformBars, X, } from '@/components/icons'
import type { PlayAlongBandPreparationPort } from '@/features/play-along/band-preparation-port'
import type { PlayAlongBackingSource, PlayAlongSongSourcePort, } from '@/features/play-along/song-port'
import { DRUM_PLAY_ALONG_POLICY } from '@/features/play-along/song-port'
import { loadUvrPlayAlongSongPort } from '@/features/play-along/song-port-loader'
import { loadPlayAlongBandPreparationPort, usePlayAlongBandPreparationController, } from '@/features/play-along/useBandPreparationController'
import { usePlayAlongSongController } from '@/features/play-along/useSongController'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { barIndexAtBeat } from '@/lib/midi-bars'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { createPersistedSignal } from '@/lib/storage'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { DrumKitId, DrumKitPlayer, DrumKitPlayerOptions, DrumKitPlayerSnapshot, } from './audio'
import { createDrumKitPlayer, DRUM_KIT_CATALOG, DRUM_KIT_IDS, drumKitManifest, } from './audio'
import type { DrumNightAudioSession } from './drum-night-audio-session'
import { createDrumNightAudioSession } from './drum-night-audio-session'
import type { DrumNightClickController, DrumNightClickControllerOptions, DrumNightClickSnapshot, } from './drum-night-click'
import { createDrumNightClickController } from './drum-night-click'
import styles from './DrumNightApp.module.css'
import { DrumNightTimeline } from './DrumNightTimeline'
import { createDrumGrooveDraftController } from './groove'
import type { DrumPlayAlongBusId, DrumPlayAlongMixPreset, DrumPlayAlongSnapshot, DrumStemPlayAlongSnapshot, } from './play-along'
import { createDrumArrangementBackingPlayer } from './play-along/drum-arrangement-player'
import { createDrumPlayAlongController } from './play-along/drum-play-along-controller'
import { readDrumPlayAlongSession, withDrumPlayAlongSession, } from './play-along/drum-play-along-link'
import { createDrumStemPlayAlongController } from './play-along/drum-stem-play-along'
import type { DrumKitAuthoredFamily, DrumNightRuntimeOptions, DrumTransportState, EssentialDrumPadId, } from './runtime'
import { DRUM_KIT_AUTHORED_FAMILIES, ESSENTIAL_DRUM_PADS, useDrumNightLoopRange, useDrumNightRuntime, } from './runtime'
import type { DrumCapturedHit, DrumRecoveryLoop, DrumScoreIndex, DrumSeatLiveHit, DrumSessionDocument, DrumSessionImportController, DrumSessionImportState, FirstPocketVariantId, PreparedPocketProjection, } from './session'
import { createDrumScoreIndex, createDrumSessionImportController, createDrumSessionScheduler, createFirstPocketGroove, DrummerSeatView, DrumScoreSheet, DrumSessionCoach, drumSessionStateCopy, FIRST_POCKET_DEFAULT_VARIANT, IDLE_DRUM_SESSION, projectDrumPocket, readyDrumSessionDocument, } from './session'

const PremiumBackgroundPicker = lazy(() =>
  import('@/features/backgrounds/PremiumBackgroundPicker').then((module) => ({
    default: module.PremiumBackgroundPicker,
  })),
)
const DrumPlayAlongMixer = lazy(() =>
  import('./play-along/DrumPlayAlongMixer').then((module) => ({
    default: module.DrumPlayAlongMixer,
  })),
)
const DrumFamilyBalance = lazy(() =>
  import('./play-along/DrumFamilyBalance').then((module) => ({
    default: module.DrumFamilyBalance,
  })),
)
const DrumGrooveEditor = lazy(() =>
  import('./groove/DrumGrooveEditor').then((module) => ({
    default: module.DrumGrooveEditor,
  })),
)
const DrumPlayAlongSongsPanel = lazy(() =>
  import('./play-along/DrumPlayAlongSongsPanel').then((module) => ({
    default: module.DrumPlayAlongSongsPanel,
  })),
)
const DrumPlayAlongStage = lazy(() =>
  import('./play-along/DrumPlayAlongStage').then((module) => ({
    default: module.DrumPlayAlongStage,
  })),
)

type StageView = 'pocket' | 'seat' | 'score'
type Workspace = 'groove' | 'kit' | 'mix' | 'room' | 'learn' | 'songs' | 'coach'
type PadId = EssentialDrumPadId

interface DrumNightAppProps {
  readonly createAudioSession?: () => DrumNightAudioSession
  readonly createClickController?: (
    options: DrumNightClickControllerOptions,
  ) => DrumNightClickController
  readonly createPlayer?: (options: DrumKitPlayerOptions) => DrumKitPlayer
  readonly createScoreIndex?: (document: DrumSessionDocument) => DrumScoreIndex
  readonly createSessionController?: () => DrumSessionImportController
  readonly loadSongPort?: () => Promise<PlayAlongSongSourcePort<'drums'>>
  readonly loadBandPreparationPort?: () => Promise<PlayAlongBandPreparationPort>
  readonly checkBandPreflight?: (
    sessionId: string,
  ) => CloudSplitBlocker | null | Promise<CloudSplitBlocker | null>
  /** Optional observer for the route-owned imported-session lifecycle. */
  readonly onReadySessionChange?: (document: DrumSessionDocument | null) => void
  readonly runtimeOptions?: Omit<DrumNightRuntimeOptions, 'player'>
}

const STAGE_VIEWS: readonly StageView[] = ['pocket', 'seat', 'score']
const STAGE_VIEW_LABELS: Readonly<Record<StageView, string>> = {
  pocket: 'Pocket',
  seat: 'Drummer Seat',
  score: 'Score',
}
const AUTHORED_FAMILY_LABELS: Readonly<Record<DrumKitAuthoredFamily, string>> =
  {
    cymbals: 'Cymbals',
    hats: 'Hats',
    kick: 'Kick',
    snare: 'Snare',
    toms: 'Toms',
  }
const WORKBENCH_TABS: readonly Workspace[] = ['groove', 'kit', 'mix', 'room']
const KIT_STORAGE_KEY = 'mp.drumNight.kit.v1'
const CALIBRATION_STRIKES = 5
const INITIAL_KIT_VOLUME = 82
const WORKSPACE_TITLES: Record<Workspace, string> = {
  groove: 'Shape the groove',
  kit: 'Choose the kit',
  mix: 'Balance the room',
  room: 'Choose the room',
  learn: 'Build the first pocket',
  songs: 'Bring a song',
  coach: 'Recover the backbeat',
}

const cx = (...names: Array<keyof typeof styles | false | undefined>): string =>
  names
    .filter(
      (name): name is keyof typeof styles =>
        name !== false && name !== undefined,
    )
    .map((name) => styles[name])
    .join(' ')

function isDrumKitId(value: unknown): value is DrumKitId {
  return (
    typeof value === 'string' &&
    (DRUM_KIT_IDS as readonly string[]).includes(value)
  )
}

function pointerVelocity(event: PointerEvent): number {
  const pressure = event.pressure > 0 ? event.pressure : 0.72
  return Math.round(48 + Math.min(1, pressure) * 79)
}

function acceptsPadPointer(event: PointerEvent): boolean {
  return event.button === 0 && event.isPrimary !== false
}

function nextRovingIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
): number | null {
  if (key === 'Home') return 0
  if (key === 'End') return itemCount - 1
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % itemCount
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + itemCount) % itemCount
  }
  return null
}

function formatMegabytes(bytes: number): string {
  if (bytes === 0) return 'No download'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB encoded`
}

function formatSessionTime(seconds: number): string {
  const bounded = Math.max(
    0,
    Math.floor(Number.isFinite(seconds) ? seconds : 0),
  )
  const minutes = Math.floor(bounded / 60)
  return `${minutes}:${String(bounded % 60).padStart(2, '0')}`
}

function formatCountedBeat(beat: number): number {
  const bounded = Math.max(0, Number.isFinite(beat) ? beat : 0)
  return Math.round((bounded + 1) * 100) / 100
}

function transportIsRunning(state: DrumTransportState): boolean {
  return state.phase === 'count-in' || state.phase === 'playing'
}

interface PocketMeterReading {
  readonly barNumber: number
  readonly numerator: number
  readonly denominator: number
  readonly pulseIndex: number
}

function transportPrimaryCopy(
  state: DrumTransportState,
  meter: PocketMeterReading,
): {
  readonly label: string
  readonly value: string
  readonly detail: string
} {
  if (state.phase === 'count-in') {
    return {
      label: 'Count in',
      value: `Beat ${state.countInBeat ?? 1}`,
      detail: `${state.countInBeats}`,
    }
  }
  if (state.phase === 'playing') {
    return {
      label: state.recording ? 'Recording take' : 'Take clock',
      value: `Bar ${meter.barNumber} · beat ${meter.pulseIndex + 1}`,
      detail: `${meter.numerator}/${meter.denominator}`,
    }
  }
  if (state.phase === 'paused') {
    return {
      label: 'Paused',
      value: `Bar ${meter.barNumber} · beat ${meter.pulseIndex + 1}`,
      detail: `${meter.numerator}/${meter.denominator}`,
    }
  }
  return { label: 'Ready', value: 'Strike a pad', detail: '1–6' }
}

interface PocketStageProps {
  readonly activePad: () => PadId | null
  readonly imported: boolean
  readonly inactive: boolean
  readonly meter: () => PocketMeterReading
  readonly onStrike: (padId: PadId, velocity: number) => void
  readonly photoKit: boolean
  readonly pocket: () => PreparedPocketProjection
  readonly sessionTitle: () => string
  readonly transport: () => DrumTransportState
}

function PocketStage(props: PocketStageProps): JSX.Element {
  const primaryCopy = createMemo(() =>
    transportPrimaryCopy(props.transport(), props.meter()),
  )
  const activeSteps = createMemo(
    () => new Set(props.pocket().hits.map((hit) => hit.stepIndex)),
  )
  const currentStep = createMemo(() => {
    const pocket = props.pocket()
    if (pocket.stepCount <= 0 || pocket.durationBeats <= 0) return 0
    const position = Math.max(0, props.transport().positionBeats)
    const localBeat =
      (((position - pocket.startBeat) % pocket.durationBeats) +
        pocket.durationBeats) %
      pocket.durationBeats
    return Math.min(
      pocket.stepCount - 1,
      Math.floor((localBeat / pocket.durationBeats) * pocket.stepCount),
    )
  })
  const currentPulse = createMemo(() => {
    const state = props.transport()
    if (state.phase === 'count-in') {
      return Math.max(
        0,
        Math.min(state.countInBeats - 1, (state.countInBeat ?? 1) - 1),
      )
    }
    return props.meter().pulseIndex
  })
  const pulseCount = createMemo(() => {
    const state = props.transport()
    if (state.phase === 'count-in') {
      return Math.max(1, Math.min(16, state.countInBeats))
    }
    return Math.max(1, Math.min(16, props.meter().numerator))
  })
  const guideCopy = createMemo(() => {
    const state = props.transport()
    if (state.phase === 'count-in') {
      return `Audible count-in ${state.countInBeat ?? 1} of ${state.countInBeats}`
    }
    if (state.phase === 'playing') {
      const meter = props.meter()
      return `Bar ${meter.barNumber} · ${meter.numerator}/${meter.denominator} · beat ${meter.pulseIndex + 1}`
    }
    if (state.phase === 'paused') return 'Paused on the shared take clock'
    return props.imported
      ? 'Press Play to follow this two-bar song window'
      : 'Press Play to hear and follow the two-bar phrase'
  })
  return (
    <div
      class={styles.pocketView}
      data-testid="drum-night-pocket-view"
      inert={props.inactive}
    >
      <Show when={props.photoKit}>
        <div class={styles.pocketHitMap} aria-label="Pocket Console drum kit">
          <For each={ESSENTIAL_DRUM_PADS}>
            {(pad) => (
              <button
                class={cx('pocketHit', props.activePad() === pad.id && 'isHit')}
                data-pad={pad.id}
                type="button"
                aria-label={`${pad.label}, key ${pad.keyboardLabel}`}
                aria-keyshortcuts={pad.keyboardLabel}
                onPointerDown={(event) => {
                  if (!acceptsPadPointer(event)) return
                  props.onStrike(pad.id, pointerVelocity(event))
                }}
                onClick={(event) => {
                  if (event.detail === 0) props.onStrike(pad.id, 100)
                }}
              >
                <span>{pad.shortLabel}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <section class={styles.pocketGuide} aria-label="Pocket guide">
        <header>
          <span class={styles.guideSignal} aria-hidden="true" />
          <span>
            <small>Pocket guide</small>
            <strong>{primaryCopy().value}</strong>
          </span>
          <b>{primaryCopy().detail}</b>
        </header>
        <div class={styles.guideBeats} aria-hidden="true">
          <For each={Array.from({ length: pulseCount() })}>
            {(beat) => (
              <i
                classList={{
                  [styles.isCurrent]: currentPulse() === beat,
                  [styles.isDownbeat]: beat === 0,
                }}
              />
            )}
          </For>
        </div>
        <div class={styles.guideSteps} aria-hidden="true">
          <For each={Array.from({ length: props.pocket().stepCount })}>
            {(_, index) => (
              <i
                classList={{
                  [styles.hasHit]: activeSteps().has(index()),
                  [styles.isCurrent]: currentStep() === index(),
                }}
              />
            )}
          </For>
        </div>
        <p>{guideCopy()}</p>
        <small>
          {props.sessionTitle()} · {props.pocket().hitCount} authored attacks
        </small>
      </section>
    </div>
  )
}

export function DrumNightApp(props: DrumNightAppProps = {}): JSX.Element {
  const [view, setView] = createSignal<StageView>('pocket')
  const [workspace, setWorkspace] = createSignal<Workspace>('groove')
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [inputOpen, setInputOpen] = createSignal(false)
  const [activeHit, setActiveHit] = createSignal<PadId | null>(null)
  const [lastHit, setLastHit] = createSignal('No strikes yet')
  const [liveMessage, setLiveMessage] = createSignal(
    'Ready. Audio, samples, and MIDI stay off until your first action.',
  )
  const [toastVisible, setToastVisible] = createSignal(false)
  const grooveDrafts = createDrumGrooveDraftController({
    initialVariantId: FIRST_POCKET_DEFAULT_VARIANT,
  })
  const variation = grooveDrafts.variantId
  const setVariation = grooveDrafts.selectVariant
  const [kitVolume, setKitVolume] = createSignal(INITIAL_KIT_VOLUME)
  const [liveKitMuted, setLiveKitMuted] = createSignal(false)
  const [selectedAuthoredFamily, setSelectedAuthoredFamily] =
    createSignal<DrumKitAuthoredFamily>('kick')
  const [authoredFamilyMix, setAuthoredFamilyMix] = createSignal<
    Record<
      DrumKitAuthoredFamily,
      { readonly level: number; readonly muted: boolean }
    >
  >({
    cymbals: { level: 1, muted: false },
    hats: { level: 1, muted: false },
    kick: { level: 1, muted: false },
    snare: { level: 1, muted: false },
    toms: { level: 1, muted: false },
  })
  const [calibrationRunning, setCalibrationRunning] = createSignal(false)
  const [calibrationCue, setCalibrationCue] = createSignal(0)
  const [calibrationAwaiting, setCalibrationAwaiting] = createSignal(false)
  const [sessionFileMessage, setSessionFileMessage] = createSignal<
    string | null
  >(null)
  const [recoveryLoopActive, setRecoveryLoopActive] = createSignal(false)
  const [recordingChoiceMade, setRecordingChoiceMade] = createSignal(false)
  const [playRequestPending, setPlayRequestPending] = createSignal(false)
  // Keep the premium metadata boundary behind the first explicit Room action.
  // Public selections still resolve synchronously through the shared
  // controller, so a restored free room does not cost a first-paint request.
  const [backgroundCatalogEnabled, setBackgroundCatalogEnabled] =
    createSignal(false)
  const [compactScore, setCompactScore] = createSignal(
    typeof window !== 'undefined' && window.innerWidth <= 720,
  )
  const drawerIsModal = createMemo(() => compactScore())
  const drawerInteractionLocked = createMemo(
    () => drawerOpen() && drawerIsModal(),
  )
  const modalLayerOpen = createMemo(
    () => inputOpen() || drawerInteractionLocked(),
  )
  const [seatLiveHits, setSeatLiveHits] = createSignal<
    readonly DrumSeatLiveHit[]
  >([])
  const [selectedKitId, setSelectedKitId] = createPersistedSignal<DrumKitId>(
    KIT_STORAGE_KEY,
    'mercury-synth',
    {
      validator: isDrumKitId,
    },
  )
  const background = useBackgroundSurfaceController(
    'drum',
    backgroundCatalogEnabled,
  )
  const audioSession = (
    props.createAudioSession ?? createDrumNightAudioSession
  )()
  const player = (props.createPlayer ?? createDrumKitPlayer)({
    getAudioContext: audioSession.contextForGesture,
    getOutput: audioSession.outputForGesture,
    initialKitId: selectedKitId(),
  })
  const applyLiveKitLevel = (level: number): void => {
    if (player.setLaneVolume !== undefined) player.setLaneVolume('live', level)
    else player.setVolume(level)
  }
  applyLiveKitLevel(INITIAL_KIT_VOLUME / 100)
  const runtime = useDrumNightRuntime({
    ...(props.runtimeOptions ?? {}),
    player,
  })
  const sessionScheduler = createDrumSessionScheduler({
    transport: runtime.transportPort,
    player,
    performanceTimestampToContextTime:
      audioSession.performanceTimestampToContextTime,
  })
  const arrangementBackingPlayer = createDrumArrangementBackingPlayer({
    getAudioContext: audioSession.activeContext,
    getOutput: audioSession.activeOutput,
  })
  const authoredPlayAlong = createDrumPlayAlongController({
    transport: runtime.transportPort,
    player: arrangementBackingPlayer,
    performanceTimestampToContextTime:
      audioSession.performanceTimestampToContextTime,
    onDrumsLevelChange: (level) => player.setLaneVolume?.('authored', level),
  })
  const stemPlayAlong = createDrumStemPlayAlongController({
    transport: runtime.transportPort,
    activeContext: audioSession.activeContext,
    activeOutput: audioSession.activeOutput,
    performanceTimestampToContextTime:
      audioSession.performanceTimestampToContextTime,
  })
  const sessionController =
    props.createSessionController?.() ??
    createDrumSessionImportController({}, { allowPitchedOnly: true })
  const initialSessionState = sessionController.state()
  const [sessionState, setSessionState] =
    createSignal<DrumSessionImportState>(initialSessionState)
  const [importedDocument, setImportedDocument] =
    createSignal<DrumSessionDocument | null>(
      readyDrumSessionDocument(initialSessionState),
    )
  const songController = usePlayAlongSongController<
    'drums',
    PlayAlongBackingSource<'drums'>
  >({
    loadSongPort: () =>
      props.loadSongPort?.() ??
      loadUvrPlayAlongSongPort(DRUM_PLAY_ALONG_POLICY),
    initialSessionId: readDrumPlayAlongSession(),
    writeSession: (sessionId, mode) => {
      const nextLocation = withDrumPlayAlongSession(
        window.location.href,
        sessionId,
      )
      if (mode === 'replace') {
        window.history.replaceState({ drumNight: true }, '', nextLocation)
      } else {
        window.history.pushState({ drumNight: true }, '', nextLocation)
      }
    },
    onBackingWillRelease: () => stemPlayAlong.configure(null),
  })
  let sourceIntentGeneration = 0
  let activeBandIntent: {
    readonly generation: number
    readonly sessionId: string
  } | null = null
  const bandPreparation = usePlayAlongBandPreparationController({
    loadPort: () =>
      props.loadBandPreparationPort?.() ??
      loadPlayAlongBandPreparationPort(DRUM_PLAY_ALONG_POLICY),
    checkPreflight: async (sessionId) => {
      if (props.checkBandPreflight !== undefined) {
        return props.checkBandPreflight(sessionId)
      }
      const [account, preflight] = await Promise.all([
        import('@/lib/standalone-account'),
        import('@/lib/uvr-cloud-preflight'),
      ])
      if (!account.accountReady()) await account.refreshAccount()
      const balance = account.credits()
      return preflight.cloudSplitBlocker({
        signedIn: account.signedIn(),
        ...(balance === null ? {} : { balance }),
      })
    },
    onPrepared: async (sessionId, signal) => {
      const intent = activeBandIntent
      if (
        intent === null ||
        intent.sessionId !== sessionId ||
        intent.generation !== sourceIntentGeneration ||
        signal.aborted
      ) {
        return
      }
      const refreshed = await songController.refreshLibrary()
      if (
        signal.aborted ||
        activeBandIntent !== intent ||
        intent.generation !== sourceIntentGeneration
      ) {
        return
      }
      if (!refreshed) {
        throw new Error(
          'The separated parts were saved, but the prepared-song library could not reopen them.',
        )
      }
      await songController.stageSession(sessionId, 'replace', { force: true })
      if (
        !signal.aborted &&
        activeBandIntent === intent &&
        intent.generation === sourceIntentGeneration
      ) {
        activeBandIntent = null
      }
    },
  })
  const selectedBackingSource = createMemo(() => {
    const state = songController.selectionState()
    return state.kind === 'ready' ? state.lease : null
  })
  const usingStemBacking = createMemo(() => selectedBackingSource() !== null)
  const preparedGroove = createMemo(() => createFirstPocketGroove(variation()))
  const activeDocument = createMemo(
    () => importedDocument() ?? grooveDrafts.document(),
  )
  const loopRange = useDrumNightLoopRange({
    durationBeats: () =>
      runtime.transportState().authoredDurationBeats ??
      activeDocument().durationBeats,
    positionBeats: () => runtime.transportState().positionBeats,
    phase: () => runtime.transportState().phase,
    currentLoop: () => runtime.transportState().loop,
    setLoop: runtime.setLoop,
    seekSeconds: runtime.seekSeconds,
    pause: runtime.pause,
    resume: runtime.play,
  })
  const activeSessionState = createMemo<DrumSessionImportState>(() => ({
    status: 'ready',
    document: activeDocument(),
  }))
  const clickController = (
    props.createClickController ?? createDrumNightClickController
  )({
    transport: runtime.transportPort,
    activeContext: audioSession.activeContext,
    activeOutput: audioSession.activeOutput,
    performanceTimestampToContextTime:
      audioSession.performanceTimestampToContextTime,
    timeSignatures: () => activeDocument().canonicalSong.timeSignatures,
  })
  const [clickSnapshot, setClickSnapshot] =
    createSignal<DrumNightClickSnapshot>(clickController.snapshot())
  const unsubscribeClick = clickController.subscribe(() =>
    setClickSnapshot(clickController.snapshot()),
  )
  const usingImportedDocument = createMemo(
    () => importedDocument() !== null && !usingStemBacking(),
  )
  const unsubscribeSession = sessionController.subscribe(() => {
    const nextState = sessionController.state()
    setSessionState(nextState)
    const nextDocument = readyDrumSessionDocument(nextState)
    if (nextDocument !== null) setImportedDocument(nextDocument)
  })
  const [schedulerSnapshot, setSchedulerSnapshot] = createSignal(
    sessionScheduler.snapshot(),
  )
  const unsubscribeScheduler = sessionScheduler.subscribe(() =>
    setSchedulerSnapshot(sessionScheduler.snapshot()),
  )
  const [authoredPlayAlongSnapshot, setAuthoredPlayAlongSnapshot] =
    createSignal<DrumPlayAlongSnapshot>(authoredPlayAlong.snapshot())
  const unsubscribeAuthoredPlayAlong = authoredPlayAlong.subscribe(() =>
    setAuthoredPlayAlongSnapshot(authoredPlayAlong.snapshot()),
  )
  const [stemPlayAlongSnapshot, setStemPlayAlongSnapshot] =
    createSignal<DrumStemPlayAlongSnapshot>(stemPlayAlong.snapshot())
  const unsubscribeStemPlayAlong = stemPlayAlong.subscribe(() =>
    setStemPlayAlongSnapshot(stemPlayAlong.snapshot()),
  )
  const calibrationNowMs =
    props.runtimeOptions?.midiEnvironment?.nowMs ??
    props.runtimeOptions?.clock?.nowMs ??
    (() => performance.now())
  const [kitSnapshot, setKitSnapshot] = createSignal<DrumKitPlayerSnapshot>(
    player.snapshot(),
  )
  const unsubscribeKit = player.subscribe(() =>
    setKitSnapshot(player.snapshot()),
  )
  let drawerRef: HTMLElement | undefined
  let workspaceOpener: HTMLElement | null = null
  let inputRef: HTMLDivElement | undefined
  let inputButtonRef: HTMLButtonElement | undefined
  let toastTimer: number | undefined
  let hitTimer: number | undefined
  let seatHitSequence = 0
  let calibrationTimer: number | undefined
  let calibrationPresentationFrame: number | undefined
  let calibrationInputId: string | null = null
  let calibrationLastSampleCount = 0
  let scheduledDocument: DrumSessionDocument | null = null
  let scheduledPreparedVariation: FirstPocketVariantId | null = null
  let scheduledBackingSource: PlayAlongBackingSource<'drums'> | null = null

  const transport = runtime.transportState
  const isPlaying = createMemo(() => transportIsRunning(transport()))
  const clickStatusCopy = createMemo(() => {
    const snapshot = clickSnapshot()
    if (!snapshot.enabled) return 'Off by default'
    if (snapshot.status === 'waiting-for-audio')
      return 'Press Play to arm audio'
    if (snapshot.status === 'count-in') return 'Sounding the count-in'
    if (snapshot.status === 'playing') return 'Following the take clock'
    if (snapshot.status === 'error') return 'Audio unavailable'
    return 'Ready on the shared clock'
  })
  const selectedKit = createMemo(() =>
    drumKitManifest(kitSnapshot().selectedKitId),
  )
  const readySession = activeDocument
  const sessionScoreIndex = createMemo(() => {
    if (usingStemBacking()) return null
    const document = readySession()
    if (document === null) return null
    return (props.createScoreIndex ?? createDrumScoreIndex)(document)
  })
  const authoredBarCount = createMemo(
    () => sessionScoreIndex()?.score.bars.length ?? null,
  )
  const authoredBarCountCopy = createMemo(() => {
    const count = authoredBarCount()
    if (count === null) return 'Unbounded take'
    return `${count} authored ${count === 1 ? 'bar' : 'bars'}`
  })
  const currentBar = createMemo(() => {
    const index = sessionScoreIndex()
    if (index === null) return Math.floor(transport().positionBeats / 4) + 1
    return barIndexAtBeat(index.score.bars, transport().positionBeats) + 1
  })
  const sessionMapCopy = createMemo(() => {
    if (usingStemBacking()) {
      const position = formatSessionTime(runtime.positionSeconds())
      const duration = stemPlayAlongSnapshot().durationSeconds
      return {
        label: position,
        detail: duration > 0 ? formatSessionTime(duration) : 'Loads on Play',
        aria:
          duration > 0
            ? `Song position ${position} of ${formatSessionTime(duration)}`
            : `Song position ${position}; audio loads on Play`,
      }
    }
    return {
      label: `Bar ${currentBar()}`,
      detail: authoredBarCountCopy(),
      aria:
        authoredBarCount() === null
          ? `Current bar ${currentBar()}, unbounded take`
          : `Current bar ${currentBar()}, ${authoredBarCountCopy()}`,
    }
  })
  const activePocketBarPair = createMemo(() =>
    Math.floor((currentBar() - 1) / 2),
  )
  const activePocket = createMemo(() => {
    const document = activeDocument()
    if (document.sourceFormat === 'prepared') return projectDrumPocket(document)
    const bars = sessionScoreIndex()?.score.bars ?? []
    const firstBarIndex = activePocketBarPair() * 2
    const firstBar = bars[firstBarIndex] ?? bars[0]
    if (firstBar === undefined) return projectDrumPocket(document)
    const followingBar = bars[firstBarIndex + 2]
    const secondBar = bars[firstBarIndex + 1] ?? firstBar
    const endBeat = Math.min(
      document.durationBeats,
      followingBar?.startBeat ?? secondBar.startBeat + secondBar.beats,
    )
    return projectDrumPocket(document, {
      startBeat: firstBar.startBeat,
      durationBeats: Math.max(0.25, endBeat - firstBar.startBeat),
    })
  })
  const activePocketMeter = createMemo<PocketMeterReading>(() => {
    const index = sessionScoreIndex()
    if (index === null || index.score.bars.length === 0) {
      const beat = Math.max(0, transport().positionBeats)
      return {
        barNumber: Math.floor(beat / 4) + 1,
        numerator: 4,
        denominator: 4,
        pulseIndex: Math.floor(beat) % 4,
      }
    }
    const barIndex = Math.max(
      0,
      Math.min(index.score.bars.length - 1, currentBar() - 1),
    )
    const bar = index.score.bars[barIndex]!
    let meter = index.score.timeSignatures[0]!
    for (const candidate of index.score.timeSignatures) {
      if (candidate.beat > bar.startBeat) break
      meter = candidate
    }
    const pulseLength = 4 / meter.denominator
    const pulseIndex = Math.max(
      0,
      Math.min(
        meter.numerator - 1,
        Math.floor(
          Math.max(0, transport().positionBeats - bar.startBeat) / pulseLength,
        ),
      ),
    )
    return {
      barNumber: barIndex + 1,
      numerator: meter.numerator,
      denominator: meter.denominator,
      pulseIndex,
    }
  })
  const capturedSessionHits = createMemo<readonly DrumCapturedHit[]>(() =>
    runtime.recordedHits().map((hit) => ({
      id: `runtime-${hit.id}`,
      source: hit.source,
      gmKey: hit.gmKey,
      velocity: hit.velocity,
      beat: hit.transportBeat,
    })),
  )
  const retainedTakeHitCount = createMemo(() => transport().recordedHitCount)
  const omittedTakeHitCount = createMemo(
    () => transport().recordedHitOmissionCount,
  )
  const takeHitCountCopy = createMemo(() => {
    const retained = retainedTakeHitCount()
    const omitted = omittedTakeHitCount()
    return omitted === 0
      ? `${retained} hits`
      : `${retained} hits · ${omitted} older not retained`
  })
  const sessionTitle = createMemo(
    () => selectedBackingSource()?.title ?? readySession().title,
  )
  const transportClockLabel = createMemo(() =>
    usingStemBacking() ? 'song clock' : 'take clock',
  )
  const roomLabel = createMemo(
    () =>
      getBackgroundDefinition(background.resolved().id)?.label ??
      'Pocket Console',
  )
  const sessionIdentityDetail = createMemo(() => {
    const backing = selectedBackingSource()
    if (backing !== null) {
      const source =
        backing.plannedMix.kind === 'parts'
          ? 'Separated source audio'
          : 'Two-stem source audio'
      const duration = stemPlayAlongSnapshot().durationSeconds
      return `${source} · ${duration > 0 ? formatSessionTime(duration) : 'loads on Play'} · shared song clock`
    }
    const document = readySession()
    const source =
      document.sourceFormat === 'midi'
        ? 'MIDI'
        : document.sourceFormat === 'guitar-pro'
          ? 'Guitar Pro'
          : 'Built-in groove'
    return `${source} · ${document.hitCount} mapped hits · ${transport().tempoBpm} BPM take clock`
  })
  const sessionImportCopy = createMemo(() => {
    const state = sessionState()
    if (state.status !== 'ready') return drumSessionStateCopy(state)
    const document = state.document
    const percussionCount = document.percussionTracks.length
    const pitchedCopy =
      document.pitchedTrackCount === 0
        ? 'Percussion-only session ready.'
        : `${document.pitchedTrackCount} pitched ${document.pitchedTrackCount === 1 ? 'part is' : 'parts are'} retained, but never treated as drums.`
    const droppedCopy =
      document.droppedHitCount === 0
        ? 'No source hits were dropped.'
        : `${document.droppedHitCount} unsupported ${document.droppedHitCount === 1 ? 'source hit was' : 'source hits were'} left unmapped.`
    return {
      title: `${document.title} is ready`,
      detail: `${percussionCount} percussion ${percussionCount === 1 ? 'track' : 'tracks'} · ${document.hitCount} mapped hits. ${pitchedCopy} ${droppedCopy}`,
      tone: 'ready' as const,
    }
  })
  const sessionImportProblem = createMemo(() => {
    const explicit = sessionFileMessage()
    if (explicit !== null) return explicit
    const status = sessionState().status
    if (status === 'idle' || status === 'loading' || status === 'ready') {
      return null
    }
    return sessionImportCopy()?.detail ?? 'The authored file was not applied.'
  })
  const openingSessionFileName = createMemo(() => {
    const state = sessionState()
    return state.status === 'loading' ? state.fileName : null
  })
  const authoredPlaybackCopy = createMemo(() => {
    const snapshot = schedulerSnapshot()
    const sourceUnsupportedCount =
      snapshot.unsupportedGmHitCount + snapshot.sourceDroppedHitCount
    const silentTriggerCount =
      snapshot.triggerCounts.unmapped + snapshot.triggerCounts.dropped
    const fidelity: string[] = []
    if (sourceUnsupportedCount > 0) {
      fidelity.push(
        `${sourceUnsupportedCount} unsupported ${sourceUnsupportedCount === 1 ? 'source hit stays' : 'source hits stay'} silent rather than being guessed`,
      )
    }
    if (snapshot.overloadOmittedOccurrenceCount > 0) {
      fidelity.push(
        `${snapshot.overloadOmittedOccurrenceCount} simultaneous ${snapshot.overloadOmittedOccurrenceCount === 1 ? 'hit is' : 'hits are'} silent beyond the 48-hit audio ceiling`,
      )
    }
    if (snapshot.capacityOmittedOccurrenceCount > 0) {
      fidelity.push(
        `${snapshot.capacityOmittedOccurrenceCount} delayed ${snapshot.capacityOmittedOccurrenceCount === 1 ? 'hit missed' : 'hits missed'} the bounded scheduling window and stayed silent`,
      )
    }
    if (snapshot.deferredOccurrenceCount > 0) {
      fidelity.push(
        `${snapshot.deferredOccurrenceCount} in-range ${snapshot.deferredOccurrenceCount === 1 ? 'hit is' : 'hits are'} waiting for a later bounded scheduling pass`,
      )
    }
    if (snapshot.omittedTempoChangeCount > 0) {
      fidelity.push(
        `${snapshot.omittedTempoChangeCount} source tempo ${snapshot.omittedTempoChangeCount === 1 ? 'change was' : 'changes were'} omitted from the bounded playback map`,
      )
    }
    if (snapshot.adjustedTempoChangeCount > 0) {
      fidelity.push(
        `${snapshot.adjustedTempoChangeCount} source tempo ${snapshot.adjustedTempoChangeCount === 1 ? 'value was' : 'values were'} clamped to the supported 40–280 BPM range`,
      )
    }
    if (silentTriggerCount > 0) {
      fidelity.push(
        `${silentTriggerCount} scheduled ${silentTriggerCount === 1 ? 'attack was' : 'attacks were'} silent because the active kit reported an unmapped or dropped route`,
      )
    }
    if (snapshot.triggerCounts.synthFallback > 0) {
      fidelity.push(
        `${snapshot.triggerCounts.synthFallback} ${snapshot.triggerCounts.synthFallback === 1 ? 'attack is' : 'attacks are'} using synth fallback`,
      )
    }
    if (snapshot.triggerCounts.unreported > 0) {
      fidelity.push(
        `${snapshot.triggerCounts.unreported} scheduled ${snapshot.triggerCounts.unreported === 1 ? 'attack has' : 'attacks have'} no routing report from the player`,
      )
    }
    const fidelityCopy =
      fidelity.length === 0
        ? 'All indexed source hits use supported General MIDI articulations.'
        : `${fidelity.join('. ')}.`
    if (snapshot.status === 'playing') {
      return `Authored percussion is on the shared take clock. ${fidelityCopy}`
    }
    if (snapshot.status === 'waiting-for-audio') {
      return `Authored playback is waiting for active drum audio. Press Play or strike a pad, then continue the take. ${fidelityCopy}`
    }
    return `Authored percussion is ready on the shared take clock. ${fidelityCopy}`
  })
  const stageCopy = createMemo(() => {
    if (usingStemBacking()) {
      if (view() === 'score') {
        return { kicker: 'Prepared audio', title: 'Audio, not notation.' }
      }
      if (view() === 'seat') {
        return { kicker: 'Play-along room', title: 'Take the drummer’s seat.' }
      }
      return { kicker: 'Prepared backing', title: 'Bring the band in.' }
    }
    switch (view()) {
      case 'seat':
        return { kicker: 'Drummer’s perspective', title: 'Read from the seat.' }
      case 'score':
        return { kicker: 'Authored percussion', title: 'Follow every attack.' }
      default:
        return { kicker: 'Live take', title: 'Find the centre.\nLet it move.' }
    }
  })
  const midiHeadline = createMemo(() => {
    const state = runtime.midiState()
    switch (state.status) {
      case 'requesting':
        return 'Connecting MIDI'
      case 'connected':
        return state.selectedInputName ?? 'MIDI input connected'
      case 'no-inputs':
        return 'No MIDI inputs found'
      case 'disconnected':
        return 'MIDI disconnected'
      case 'unsupported':
        return 'MIDI unavailable'
      case 'denied':
        return 'MIDI permission blocked'
      case 'error':
        return 'MIDI connection failed'
      default:
        return 'MIDI not connected'
    }
  })
  const midiDetail = createMemo(() => {
    const state = runtime.midiState()
    if (state.status === 'connected') {
      if (!kitSnapshot().fallbackReady) {
        return state.hasReceivedHit
          ? 'strikes seen · press Play for sound'
          : 'press Play once for sound'
      }
      return state.hasReceivedHit ? 'receiving strikes' : 'sound ready'
    }
    if (state.status === 'requesting') return 'waiting for permission'
    return 'touch and keys available'
  })
  const midiCompactStatus = createMemo(() => {
    switch (runtime.midiState().status) {
      case 'connected':
        return 'On'
      case 'requesting':
        return 'Wait'
      case 'no-inputs':
        return 'None'
      case 'denied':
      case 'error':
        return 'Error'
      case 'unsupported':
        return 'N/A'
      default:
        return 'Off'
    }
  })
  const midiGuidance = createMemo(() => {
    const state = runtime.midiState()
    switch (state.status) {
      case 'requesting':
        return 'Approve the browser request, then strike a pad on your e-kit.'
      case 'connected':
        return 'Velocity, channel, controller changes, and overlapping strikes stay on the shared performance clock.'
      case 'no-inputs':
        return 'Permission was granted, but no MIDI input is visible. Connect or power on the e-kit, then scan again.'
      case 'disconnected':
        return 'The selected input went away. Reconnect the device, then scan again.'
      case 'unsupported':
        return 'This browser does not expose WebMIDI. Touch pads and keys 1–6 remain playable.'
      case 'denied':
        return 'MIDI permission was blocked. Allow MIDI devices in browser site settings, then retry.'
      case 'error':
        return (
          state.errorMessage ??
          'The MIDI request failed. Check the device and retry.'
        )
      default:
        return 'Connecting is explicit. Opening this panel does not ask for permission or start audio.'
    }
  })
  const kitStatusCopy = createMemo(() => {
    const snapshot = kitSnapshot()
    const manifest = selectedKit()
    if (snapshot.status === 'error') {
      if (!snapshot.fallbackReady) {
        return 'Audio start failed · retry from this control'
      }
      const progress =
        snapshot.plannedSamples > 0
          ? `${snapshot.preparedSamples} of ${snapshot.plannedSamples} core samples ready · `
          : ''
      return `${progress}sample warm-up stopped · synth fallback active`
    }
    if (manifest.engine === 'synth') {
      return snapshot.fallbackReady
        ? 'Ready · synthesized locally'
        : 'Selected · activates on your first action'
    }
    if (snapshot.status === 'loading') {
      return `Loading ${snapshot.preparedSamples} of ${snapshot.plannedSamples} core samples · synth fallback active`
    }
    if (snapshot.sampledReady) {
      return `${snapshot.loadedSamples} samples ready · per-hit synth fallback remains available`
    }
    return 'Selected · samples warm after your first audio action'
  })
  const actionableUnmappedNote = createMemo(() => {
    const rawNote = runtime.midiState().lastRawUnmappedNote
    if (rawNote === null || runtime.midiMapping().has(rawNote.rawMidiKey)) {
      return null
    }
    return rawNote
  })
  const audioErrorMessage = createMemo(() => {
    const snapshot = kitSnapshot()
    if (snapshot.fallbackReady) return null
    return snapshot.error ?? runtime.runtimeError()
  })
  const calibrationEvidenceCopy = createMemo(() => {
    const result = runtime.calibrationResult()
    if (calibrationRunning()) {
      return calibrationAwaiting()
        ? `Awaiting strike ${Math.min(CALIBRATION_STRIKES, result.sampleCount + 1)} of ${CALIBRATION_STRIKES}.`
        : `Preparing strike ${Math.min(CALIBRATION_STRIKES, result.sampleCount + 1)} of ${CALIBRATION_STRIKES}.`
    }
    if (result.status === 'ready') {
      const spread = Math.round(result.spreadMs ?? 0)
      return `${result.inlierCount} of ${result.sampleCount} strikes consistent · ${spread} ms spread.`
    }
    return 'No calibration evidence collected yet.'
  })

  const mappedSourcesFor = (gmKey: number): readonly number[] =>
    [...runtime.midiMapping().entries()]
      .filter((entry) => entry[1] === gmKey)
      .map((entry) => entry[0])
      .sort((left, right) => left - right)

  const focusDrawerPrimary = (): void => {
    const target =
      drawerRef?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      drawerRef?.querySelector<HTMLElement>('[data-drawer-primary="true"]') ??
      drawerRef
    target?.focus()
  }

  const updateUrl = (
    nextView: StageView,
    nextDrawer: Workspace | null,
    mode: 'push' | 'replace' = 'push',
  ): void => {
    const url = new URL(window.location.href)
    if (nextView === 'pocket') url.searchParams.delete('view')
    else url.searchParams.set('view', nextView)
    if (nextDrawer === null) url.searchParams.delete('drawer')
    else url.searchParams.set('drawer', nextDrawer)
    const nextLocation = `${url.pathname}${url.search}${url.hash}`
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextLocation === currentLocation) return
    if (mode === 'replace') {
      window.history.replaceState({ drumNight: true }, '', nextLocation)
    } else {
      window.history.pushState({ drumNight: true }, '', nextLocation)
    }
  }

  const invalidateSourceIntent = (): number => {
    sourceIntentGeneration += 1
    activeBandIntent = null
    return sourceIntentGeneration
  }

  const selectPreparedSession = (
    sessionId: string,
    historyMode: 'push' | 'replace' | 'none' = 'push',
    force = false,
  ): void => {
    invalidateSourceIntent()
    bandPreparation.cancel()
    sessionController.cancel()
    setImportedDocument(null)
    setSessionFileMessage(null)
    void songController.stageSession(sessionId, historyMode, { force })
  }

  const clearPreparedSession = (
    historyMode: 'push' | 'replace' | 'none' = 'push',
  ): void => {
    invalidateSourceIntent()
    bandPreparation.cancel()
    songController.clearSession(historyMode)
  }

  const retryPreparedSession = (sessionId: string): void => {
    if (songController.routeSessionId() !== sessionId) return
    selectPreparedSession(sessionId, 'none', true)
  }

  const startBandSeparation = (sessionId: string): void => {
    const selection = songController.selectionState()
    if (
      songController.routeSessionId() !== sessionId ||
      selection.kind !== 'ready' ||
      selection.lease.sessionId !== sessionId
    ) {
      return
    }
    const generation = invalidateSourceIntent()
    activeBandIntent = { generation, sessionId }
    sessionController.cancel()
    setImportedDocument(null)
    bandPreparation.start(sessionId)
  }

  const cancelBandSeparation = (): void => {
    invalidateSourceIntent()
    bandPreparation.cancel()
  }

  const syncStateFromUrl = (): void => {
    const params = new URLSearchParams(window.location.search)
    const nextSongSessionId = readDrumPlayAlongSession()
    const requestedView = params.get('view')
    const legacyKitView = requestedView === 'kit'
    const nextView = legacyKitView
      ? 'seat'
      : STAGE_VIEWS.includes(requestedView as StageView)
        ? (requestedView as StageView)
        : 'pocket'
    const requestedDrawer = params.get('drawer')
    const nextDrawer =
      requestedDrawer !== null && requestedDrawer in WORKSPACE_TITLES
        ? (requestedDrawer as Workspace)
        : null
    const drawerWorkspaceChanged =
      nextDrawer !== null && nextDrawer !== workspace()

    closeInput()
    setView(nextView)
    if (nextDrawer === null) {
      setDrawerOpen(false)
    } else {
      setWorkspace(nextDrawer)
      setDrawerOpen(true)
      queueMicrotask(() => {
        if (
          drawerWorkspaceChanged ||
          (drawerRef !== undefined &&
            !drawerRef.contains(document.activeElement))
        ) {
          focusDrawerPrimary()
        }
      })
    }
    if (legacyKitView) updateUrl(nextView, nextDrawer, 'replace')
    if (nextSongSessionId === null) {
      if (songController.routeSessionId() !== null) {
        clearPreparedSession('none')
      }
    } else if (
      nextSongSessionId !== songController.routeSessionId() ||
      songController.selectionState().kind === 'idle'
    ) {
      selectPreparedSession(nextSongSessionId, 'none')
    }
  }

  const showToast = (message: string): void => {
    if (toastTimer !== undefined) window.clearTimeout(toastTimer)
    setLiveMessage(message)
    setToastVisible(true)
    toastTimer = window.setTimeout(() => setToastVisible(false), 2600)
  }

  const announceOnly = (message: string): void => {
    if (toastTimer !== undefined) {
      window.clearTimeout(toastTimer)
      toastTimer = undefined
    }
    setToastVisible(false)
    setLiveMessage(message)
  }

  const selectView = (nextView: StageView): void => {
    setView(nextView)
    updateUrl(nextView, drawerOpen() ? workspace() : null)
  }

  const closeInput = (): void => {
    if (!inputOpen()) return
    if (calibrationRunning() || calibrationAwaiting()) {
      cancelCalibration()
    } else {
      stopCalibrationPresentation()
    }
    setInputOpen(false)
  }

  const openWorkspace = (nextWorkspace: Workspace): void => {
    closeInput()
    if (drawerOpen() && workspace() === nextWorkspace) {
      closeWorkspace()
      return
    }
    const activeElement = document.activeElement
    if (
      activeElement instanceof HTMLElement &&
      (drawerRef === undefined || !drawerRef.contains(activeElement))
    ) {
      workspaceOpener = activeElement
    }
    setWorkspace(nextWorkspace)
    setDrawerOpen(true)
    if (nextWorkspace === 'songs') songController.initialize()
    updateUrl(view(), nextWorkspace)
  }

  const closeWorkspace = (): void => {
    const restoreFocus = drawerRef?.contains(document.activeElement) ?? false
    const fallbackOpener = document.querySelector<HTMLButtonElement>(
      '[aria-controls="drum-workbench"][aria-expanded="true"]',
    )
    setDrawerOpen(false)
    updateUrl(view(), null)
    if (restoreFocus) {
      queueMicrotask(() => {
        const target =
          workspaceOpener !== null && workspaceOpener.isConnected
            ? workspaceOpener
            : fallbackOpener
        target?.focus()
      })
    }
  }

  const importSessionFile = (file: File | undefined): void => {
    if (file === undefined) return
    const intentGeneration = invalidateSourceIntent()
    bandPreparation.cancel()
    setSessionFileMessage(null)
    void sessionController
      .importFile(file)
      .then((attempt) => {
        if (
          attempt.status === 'stale' ||
          intentGeneration !== sourceIntentGeneration
        ) {
          return
        }
        if (attempt.state.status === 'ready') {
          songController.clearSession('replace')
          setView('score')
          setDrawerOpen(false)
          updateUrl('score', null)
          showToast(
            `${attempt.state.document.title} is ready. The score now follows the shared take clock.`,
          )
          return
        }
        showToast(
          drumSessionStateCopy(attempt.state)?.title ??
            'The selected drum part was not applied.',
        )
      })
      .catch(() => {
        if (intentGeneration !== sourceIntentGeneration) return
        setSessionFileMessage(
          'The authored arrangement could not be opened. Choose the file again.',
        )
        showToast('The drum part could not be opened. Choose the file again.')
      })
  }

  const clearImportedSession = (): void => {
    invalidateSourceIntent()
    bandPreparation.cancel()
    setImportedDocument(null)
    sessionController.cancel()
    loopRange.clear()
    if (recoveryLoopActive()) runtime.setSpeedScale(1)
    setRecoveryLoopActive(false)
    showToast('Imported drum part cleared. First Pocket is active again.')
  }

  const cancelSessionImport = (): void => {
    if (sessionState().status !== 'loading') return
    invalidateSourceIntent()
    sessionController.cancel()
    showToast('Drum part import cancelled. Nothing was partially loaded.')
  }

  const localArrangementAccessory = createMemo<JSX.Element | undefined>(() => {
    const document = importedDocument()
    if (document === null) return undefined
    const backingCount = document.pitchedTrackCount
    return (
      <div>
        <strong>{document.title}</strong>
        <span>
          {document.hitCount} authored drum hits · {backingCount}{' '}
          {backingCount === 1 ? 'backing track' : 'backing tracks'}
        </span>
        <button type="button" onClick={clearImportedSession}>
          Clear authored arrangement
        </button>
      </div>
    )
  })

  const applyRecoveryLoop = (loop: DrumRecoveryLoop): void => {
    const authoredEndBeat = readySession().durationBeats
    const endBeat = Math.min(loop.endBeat, authoredEndBeat)
    const applied = loopRange.setSpan({
      startBeat: loop.startBeat,
      endBeat,
    })
    if (!applied) {
      showToast('That recovery bar is outside the authored take range.')
      return
    }
    runtime.setSpeedScale(0.7)
    setRecoveryLoopActive(true)
    showToast(
      `Recovery loop set to bar ${loop.barNumber} at 70% of the authored tempo.`,
    )
  }

  const togglePlaying = (): void => {
    const phase = transport().phase
    if (phase === 'playing' || phase === 'count-in') {
      runtime.pause()
      showToast(
        `${usingStemBacking() ? 'Song' : 'Take'} clock paused. Live voices released.`,
      )
      return
    }
    if (playRequestPending()) return
    if (!usingStemBacking() && !recordingChoiceMade()) {
      runtime.setRecording(true)
    }
    announceOnly(
      usingStemBacking()
        ? `${sessionTitle()} is preparing on the shared song clock.`
        : `${sessionTitle()} is starting on the shared take clock${recordingChoiceMade() && !transport().recording ? '.' : ' with take events armed.'}`,
    )
    setPlayRequestPending(true)
    const selectedSource = selectedBackingSource()
    let kitActivation: Promise<boolean>
    try {
      // Cross the Web Audio boundary synchronously inside the button gesture.
      kitActivation = runtime.activateAudio()
    } catch {
      kitActivation = Promise.resolve(false)
    }
    void kitActivation
      .then(async (kitReady) => {
        if (!kitReady) return false
        if (selectedSource !== null) {
          const loaded = await stemPlayAlong.load()
          if (!loaded || untrack(selectedBackingSource) !== selectedSource) {
            return false
          }
          const durationSeconds = untrack(
            () => stemPlayAlong.snapshot().durationSeconds,
          )
          if (!(durationSeconds > 0)) return false
          runtime.transportPort.setAuthoredTiming({
            tempoBpm: 60,
            durationBeats: durationSeconds,
          })
          return runtime.play()
        }
        const backingReady = await authoredPlayAlong.activate()
        if (!backingReady || untrack(selectedBackingSource) !== null) {
          return false
        }
        return runtime.play()
      })
      .then((started) => {
        if (started) return
        const error = stemPlayAlong.snapshot().error
        showToast(
          error?.message ??
            'Audio could not start. Your selected source and mix are unchanged.',
        )
      })
      .catch(() => {
        showToast(
          'Audio could not start. Your selected source and mix are unchanged.',
        )
      })
      .finally(() => setPlayRequestPending(false))
  }

  const changeTempo = (delta: number): void => {
    if (usingStemBacking()) {
      showToast('Prepared audio keeps its recorded timing and pitch.')
      return
    }
    const nextTempo = Math.max(40, Math.min(280, transport().tempoBpm + delta))
    runtime.setTempoBpm(nextTempo)
    setRecoveryLoopActive(false)
    showToast(`Tempo set to ${nextTempo} BPM.`)
  }

  const triggerPad = (padId: PadId, velocity = 100): void => {
    runtime.strikePad(padId, velocity)
  }

  const startFirstPocket = (): void => {
    invalidateSourceIntent()
    bandPreparation.cancel()
    songController.clearSession('replace')
    setImportedDocument(null)
    sessionController.cancel()
    setVariation(FIRST_POCKET_DEFAULT_VARIANT)
    runtime.setSpeedScale(1)
    setRecoveryLoopActive(false)
    runtime.setCountInBeats(4)
    loopRange.clear()
    runtime.setRecording(true)
    setRecordingChoiceMade(false)
    setDrawerOpen(false)
    updateUrl(view(), null)
    showToast(
      'First Pocket armed at 84 BPM. Play it, then answer with your own backbeat.',
    )
    void runtime.play()
  }

  const stopTake = (): void => {
    runtime.stop()
    showToast(
      usingStemBacking()
        ? 'Song clock returned to the start. Your mix is unchanged.'
        : 'Take clock returned to beat one. Captured hits stay in this take.',
    )
  }

  const leaveRecoveryTempo = (): void => {
    if (!recoveryLoopActive()) return
    runtime.setSpeedScale(1)
    setRecoveryLoopActive(false)
  }

  const markLoopAtPlayhead = (mark: 'A' | 'B'): void => {
    leaveRecoveryTempo()
    const accepted = mark === 'A' ? loopRange.setStart() : loopRange.setEnd()
    if (!accepted) {
      showToast('This drum part has no playable timeline range.')
      return
    }
    const span = loopRange.span()
    showToast(
      span === null
        ? `Loop ${mark} marked. Set the other end to begin looping.`
        : `A–B loop set from beat ${formatCountedBeat(span.startBeat)} to beat ${formatCountedBeat(span.endBeat)}.`,
    )
  }

  const moveLoopMark = (mark: 'A' | 'B', beat: number): void => {
    leaveRecoveryTempo()
    if (mark === 'A') loopRange.moveMarkA(beat)
    else loopRange.moveMarkB(beat)
  }

  const commitLoopMark = (mark: 'A' | 'B'): void => {
    if (!loopRange.commitMark(mark)) return
    const span = loopRange.span()
    if (span !== null) {
      announceOnly(
        `A–B loop set from beat ${formatCountedBeat(span.startBeat)} to beat ${formatCountedBeat(span.endBeat)}.`,
      )
    }
  }

  const clearPracticeLoop = (): void => {
    const clearedRecovery = recoveryLoopActive()
    loopRange.clear()
    if (clearedRecovery) runtime.setSpeedScale(1)
    setRecoveryLoopActive(false)
    showToast(
      clearedRecovery
        ? 'Recovery loop cleared. Authored tempo returned to 100%.'
        : 'A–B loop cleared. Full-song playback restored.',
    )
  }

  const toggleRecording = (): void => {
    const recording = !transport().recording
    setRecordingChoiceMade(true)
    runtime.setRecording(recording)
    showToast(recording ? 'Take recording armed.' : 'Take recording disarmed.')
  }

  const toggleClick = (): void => {
    if (usingStemBacking()) {
      showToast(
        'Prepared audio has no authored tempo map. Use the song itself as the timing guide.',
      )
      return
    }
    const enabled = !clickSnapshot().enabled
    clickController.enable(enabled)
    showToast(
      enabled
        ? 'Click enabled. It will join the shared clock when audio starts.'
        : 'Click muted. The authored groove and take clock keep running.',
    )
  }

  const mixSourceKind = createMemo<
    'separated-audio' | 'two-stem-audio' | 'authored-arrangement'
  >(() => {
    if (!usingStemBacking()) return 'authored-arrangement'
    return stemPlayAlongSnapshot().hasIndependentDrums
      ? 'separated-audio'
      : 'two-stem-audio'
  })
  const mixPreset = createMemo<DrumPlayAlongMixPreset>(() => {
    if (usingStemBacking()) {
      const snapshot = stemPlayAlongSnapshot()
      if (snapshot.buses.drums.muted && !snapshot.buses.backing.muted) {
        return 'play-along'
      }
      if (!snapshot.buses.drums.muted && snapshot.buses.backing.muted) {
        return 'drum-focus'
      }
      return 'full'
    }
    const snapshot = authoredPlayAlongSnapshot()
    if (snapshot.drums.muted && !snapshot.backing.muted) return 'play-along'
    if (!snapshot.drums.muted && snapshot.backing.muted) return 'drum-focus'
    return 'full'
  })
  const applyMixPreset = (preset: DrumPlayAlongMixPreset): void => {
    if (usingStemBacking()) {
      if (!stemPlayAlong.applyPreset(preset)) {
        showToast('Separate drums before changing the source-drum balance.')
        return
      }
    } else {
      const snapshot = authoredPlayAlong.snapshot()
      authoredPlayAlong.setBusSolo('drums', false)
      authoredPlayAlong.setBusSolo('backing', false)
      for (const track of snapshot.backingTracks) {
        authoredPlayAlong.setTrackSolo(track.id, false)
      }
      authoredPlayAlong.setBusMuted('drums', preset === 'play-along')
      authoredPlayAlong.setBusMuted('backing', preset === 'drum-focus')
    }
    const copy =
      preset === 'play-along'
        ? 'Source drums muted. Backing and your live kit stay available.'
        : preset === 'drum-focus'
          ? 'Backing muted. Source drums and your live kit stay available.'
          : 'Full source mix restored. Your live kit remains independent.'
    showToast(copy)
  }
  const setMixBusLevel = (bus: DrumPlayAlongBusId, level: number): void => {
    if (bus === 'you') {
      const percent = Math.round(level * 100)
      setKitVolume(percent)
      applyLiveKitLevel(liveKitMuted() ? 0 : level)
      return
    }
    if (bus === 'click') {
      clickController.setLevel(level)
      return
    }
    if (usingStemBacking()) stemPlayAlong.setBusLevel(bus, level)
    else authoredPlayAlong.setBusLevel(bus, level)
  }
  const setMixBusMuted = (bus: DrumPlayAlongBusId, muted: boolean): void => {
    if (bus === 'you') {
      setLiveKitMuted(muted)
      applyLiveKitLevel(muted ? 0 : kitVolume() / 100)
      return
    }
    if (bus === 'click') {
      if (usingStemBacking()) return
      clickController.enable(!muted)
      return
    }
    if (usingStemBacking()) stemPlayAlong.setBusMuted(bus, muted)
    else authoredPlayAlong.setBusMuted(bus, muted)
  }
  const setMixTrackLevel = (trackId: string, level: number): void => {
    if (usingStemBacking()) stemPlayAlong.setTrackLevel(trackId, level)
    else authoredPlayAlong.setTrackLevel(trackId, level)
  }
  const setMixTrackMuted = (trackId: string, muted: boolean): void => {
    if (usingStemBacking()) stemPlayAlong.setTrackMuted(trackId, muted)
    else authoredPlayAlong.setTrackMuted(trackId, muted)
  }
  const sourceDrumsMix = createMemo(() => {
    if (usingStemBacking()) {
      const snapshot = stemPlayAlongSnapshot()
      return {
        level: snapshot.buses.drums.level,
        muted: snapshot.buses.drums.muted,
        disabled: !snapshot.hasIndependentDrums,
        detail: snapshot.hasIndependentDrums
          ? 'Separated source audio'
          : 'Inside Backing',
      }
    }
    const drums = authoredPlayAlongSnapshot().drums
    return {
      level: drums.level,
      muted: drums.muted,
      disabled: !drums.available,
      detail: `${drums.eventCount} authored ${drums.eventCount === 1 ? 'hit' : 'hits'}`,
    }
  })
  const backingMix = createMemo(() => {
    if (usingStemBacking()) {
      const backing = stemPlayAlongSnapshot().buses.backing
      return {
        level: backing.level,
        muted: backing.muted,
        detail: 'Prepared source audio',
      }
    }
    const backing = authoredPlayAlongSnapshot().backing
    return {
      level: backing.level,
      muted: backing.muted,
      disabled: !backing.available,
      detail:
        backing.available && backing.trackCount > 0
          ? `${backing.trackCount} timing and pitch ${backing.trackCount === 1 ? 'guide' : 'guides'}`
          : 'No pitched backing tracks',
    }
  })
  const sourceMixTracks = createMemo(() => {
    if (usingStemBacking()) {
      return stemPlayAlongSnapshot().tracks.map((track) => ({
        id: track.id,
        label: track.label,
        bus: track.bus,
        level: track.level,
        muted: track.muted,
        detail: track.available ? 'Prepared stem' : 'Loads on Play',
      }))
    }
    return authoredPlayAlongSnapshot().backingTracks.map((track) => ({
      id: track.id,
      label: track.label,
      bus: 'backing' as const,
      level: track.level,
      muted: track.muted,
      detail: `${track.playbackLabel} · timing and pitch guide`,
    }))
  })
  const authoredFamilyBalanceRows = createMemo(() => {
    const mix = authoredFamilyMix()
    return DRUM_KIT_AUTHORED_FAMILIES.map((family) => ({
      id: family,
      label: AUTHORED_FAMILY_LABELS[family],
      level: mix[family].level,
      muted: mix[family].muted,
    }))
  })
  const setAuthoredFamilyLevel = (
    family: DrumKitAuthoredFamily,
    requestedLevel: number,
  ): void => {
    const level = Number.isFinite(requestedLevel)
      ? Math.min(1, Math.max(0, requestedLevel))
      : 0
    const current = authoredFamilyMix()[family]
    setAuthoredFamilyMix((mix) => ({
      ...mix,
      [family]: { ...mix[family], level },
    }))
    player.setAuthoredFamilyVolume?.(family, current.muted ? 0 : level)
  }
  const setAuthoredFamilyMuted = (
    family: DrumKitAuthoredFamily,
    muted: boolean,
  ): void => {
    const current = authoredFamilyMix()[family]
    setAuthoredFamilyMix((mix) => ({
      ...mix,
      [family]: { ...mix[family], muted },
    }))
    player.setAuthoredFamilyVolume?.(family, muted ? 0 : current.level)
  }

  createEffect(() => {
    const preparedSourceActive =
      importedDocument() === null && !usingStemBacking()
    const mix = untrack(authoredFamilyMix)
    for (const family of DRUM_KIT_AUTHORED_FAMILIES) {
      const familyMix = mix[family]
      player.setAuthoredFamilyVolume?.(
        family,
        preparedSourceActive ? (familyMix.muted ? 0 : familyMix.level) : 1,
      )
    }
  })

  const selectKit = (kitId: DrumKitId): void => {
    const manifest = drumKitManifest(kitId)
    setSelectedKitId(kitId)
    showToast(
      manifest.engine === 'sampled'
        ? `${manifest.name} selected. Samples warm only after audio is active.`
        : 'Mercury Synth selected. No sample download is needed.',
    )
    void player.selectKit(kitId)
  }

  const retryKit = (): void => {
    showToast('Reactivating drum audio before retrying the selected kit.')
    let activation: Promise<boolean>
    try {
      activation = runtime.retryAudio()
    } catch {
      showToast('Drum audio is still unavailable. Check browser audio access.')
      return
    }
    void activation
      .then(async (activated) => {
        if (!activated) {
          showToast(
            'Drum audio is still unavailable. Check browser audio access.',
          )
          return
        }
        await player.retry()
        showToast('Drum audio is active. The selected kit is retrying now.')
      })
      .catch(() => {
        showToast('The selected kit could not be retried yet.')
      })
  }

  const connectMidi = (): void => {
    showToast('Requesting access to connected MIDI inputs.')
    void runtime.connectMidi()
  }

  function stopCalibrationPresentation(): void {
    if (calibrationTimer !== undefined) {
      window.clearTimeout(calibrationTimer)
      calibrationTimer = undefined
    }
    if (calibrationPresentationFrame !== undefined) {
      window.cancelAnimationFrame(calibrationPresentationFrame)
      calibrationPresentationFrame = undefined
    }
    setCalibrationRunning(false)
    setCalibrationAwaiting(false)
    setCalibrationCue(0)
    calibrationInputId = null
  }

  function cancelCalibration(): void {
    stopCalibrationPresentation()
    runtime.resetLatencyCalibration()
  }

  const scheduleCalibrationCue = (delayMs: number): void => {
    if (calibrationTimer !== undefined) window.clearTimeout(calibrationTimer)
    setCalibrationAwaiting(false)
    calibrationTimer = window.setTimeout(() => {
      calibrationTimer = undefined
      if (calibrationInputId === null) return
      const nextCue = calibrationLastSampleCount + 1
      setCalibrationCue(nextCue)
      setCalibrationAwaiting(true)
      calibrationPresentationFrame = window.requestAnimationFrame(() => {
        calibrationPresentationFrame = undefined
        if (calibrationInputId === null || !untrack(inputOpen)) return
        if (!runtime.expectCalibrationHit(calibrationNowMs())) {
          cancelCalibration()
          showToast('Connect one MIDI input before calibrating.')
        }
      })
    }, delayMs)
  }

  const startCalibration = (): void => {
    const inputId = runtime.midiState().selectedInputId
    if (inputId === null) {
      showToast('Connect and select a MIDI input before calibrating.')
      return
    }
    runtime.resetLatencyCalibration()
    calibrationInputId = inputId
    calibrationLastSampleCount = 0
    setCalibrationCue(0)
    setCalibrationRunning(true)
    showToast('Calibration started. Strike on each amber pulse.')
    scheduleCalibrationCue(700)
  }

  const applyCalibration = (): void => {
    const estimate = runtime.calibrationResult().estimateMs
    if (!runtime.applyLatencyCalibration() || estimate === null) {
      showToast('Complete five strikes before applying latency compensation.')
      return
    }
    showToast(`Input compensation set to ${Math.round(estimate)} ms.`)
  }

  useFocusTrap(() => drawerRef, {
    isOpen: () => drawerOpen() && drawerIsModal(),
    onClose: closeWorkspace,
    initialFocus: () => {
      const selected = drawerRef?.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      )
      return (
        selected ??
        drawerRef?.querySelector<HTMLElement>('[data-drawer-primary="true"]') ??
        drawerRef
      )
    },
  })

  useFocusTrap(() => inputRef, {
    isOpen: inputOpen,
    onClose: closeInput,
    initialFocus: () =>
      inputRef?.querySelector<HTMLElement>(
        '[data-input-primary="true"]:not(select)',
      ) ??
      inputRef?.querySelector<HTMLElement>('[data-input-close="true"]') ??
      inputRef,
  })

  createEffect(() => {
    if (drawerOpen() && workspace() === 'room') {
      setBackgroundCatalogEnabled(true)
    }
  })

  createEffect(() => {
    const hit = runtime.recentHit()
    if (hit === null) return
    const pad = ESSENTIAL_DRUM_PADS.find(
      (candidate) => candidate.gmKey === hit.gmKey,
    )
    if (hitTimer !== undefined) window.clearTimeout(hitTimer)
    setActiveHit(pad?.id ?? null)
    setLastHit(
      `${pad?.label ?? `GM ${hit.gmKey}`} · ${hit.velocity} · ${hit.source}`,
    )
    seatHitSequence += 1
    setSeatLiveHits((current) =>
      [
        ...current,
        {
          id: `live-${seatHitSequence}`,
          gmKey: hit.gmKey,
          velocity: hit.velocity,
        },
      ].slice(-6),
    )
    hitTimer = window.setTimeout(() => {
      setActiveHit(null)
      setSeatLiveHits([])
    }, 150)
  })

  createEffect(() => {
    const backingSource = selectedBackingSource()
    const document = backingSource === null ? readySession() : null
    const preparedVariation =
      document?.sourceFormat === 'prepared' ? variation() : null
    const hotPreparedRevision =
      backingSource === null &&
      scheduledBackingSource === null &&
      document !== null &&
      document !== scheduledDocument &&
      document.sourceFormat === 'prepared' &&
      scheduledDocument?.sourceFormat === 'prepared' &&
      preparedVariation === scheduledPreparedVariation

    if (hotPreparedRevision) {
      scheduledDocument = document
      sessionScheduler.updateSession(document)
      authoredPlayAlong.setSession(document)
      return
    }

    if (
      document !== scheduledDocument ||
      backingSource !== scheduledBackingSource
    ) {
      scheduledDocument = document
      scheduledPreparedVariation = preparedVariation
      scheduledBackingSource = backingSource
      // An imported document owns its own take evidence and practice range.
      // Crossing that boundary must never coach or loop against the previous
      // document, even when the old loop happens to fit the new duration.
      runtime.stop()
      loopRange.setSpan(null)
      runtime.setSpeedScale(1)
      runtime.clearRecording()
      setRecordingChoiceMade(false)
      setRecoveryLoopActive(false)
      if (backingSource !== null) {
        sessionScheduler.setSession(null)
        authoredPlayAlong.setSession(null)
        stemPlayAlong.configure(backingSource)
        runtime.transportPort.setAuthoredTiming({
          tempoBpm: 60,
          durationBeats: backingSource.durationSeconds ?? 0,
        })
        runtime.transportPort.seek(0)
        runtime.setCountInBeats(0)
        if (clickSnapshot().enabled) clickController.enable(false)
      } else {
        if (document === null) return
        stemPlayAlong.configure(null)
        sessionScheduler.setSession(document)
        authoredPlayAlong.setSession(document)
        const arrangement = authoredPlayAlong.snapshot().arrangement
        runtime.transportPort.setAuthoredTiming({
          tempoBpm: document.canonicalSong.bpm,
          tempoChanges: document.canonicalSong.tempoChanges,
          durationBeats: arrangement?.durationBeats ?? document.durationBeats,
        })
        runtime.transportPort.seek(0)
      }
    }
  })

  createEffect(() => {
    props.onReadySessionChange?.(importedDocument())
  })

  createEffect(() => {
    const result = runtime.calibrationResult()
    const selectedInputId = runtime.midiState().selectedInputId
    if (!calibrationRunning()) return
    if (selectedInputId !== calibrationInputId) {
      cancelCalibration()
      showToast('Calibration reset because the MIDI input changed.')
      return
    }
    if (result.sampleCount <= calibrationLastSampleCount) return
    calibrationLastSampleCount = result.sampleCount
    setCalibrationAwaiting(false)
    if (result.sampleCount >= CALIBRATION_STRIKES) {
      setCalibrationRunning(false)
      setCalibrationCue(CALIBRATION_STRIKES)
      showToast('Five strikes captured. Review and apply the estimate.')
      return
    }
    scheduleCalibrationCue(650)
  })

  onMount(() => {
    syncStateFromUrl()

    const uninstallSpace = installSpacePlaybackToggle({
      toggle: togglePlaying,
      ownsSpace: () => !drawerOpen() && !inputOpen(),
    })
    const onPointerDown = (event: PointerEvent): void => {
      if (
        !inputOpen() ||
        inputRef === undefined ||
        inputButtonRef === undefined
      )
        return
      const target = event.target
      if (!(target instanceof Node)) return
      if (!inputRef.contains(target) && !inputButtonRef.contains(target)) {
        event.preventDefault()
        closeInput()
      }
    }
    const syncCompactScore = (): void => {
      setCompactScore(window.innerWidth <= 720)
    }
    const closeTetheredWorkbenchOnEscape = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Escape' ||
        inputOpen() ||
        !drawerOpen() ||
        drawerIsModal()
      )
        return
      event.preventDefault()
      closeWorkspace()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', closeTetheredWorkbenchOnEscape)
    window.addEventListener('popstate', syncStateFromUrl)
    window.addEventListener('resize', syncCompactScore)
    onCleanup(() => {
      uninstallSpace()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', closeTetheredWorkbenchOnEscape)
      window.removeEventListener('popstate', syncStateFromUrl)
      window.removeEventListener('resize', syncCompactScore)
    })
  })

  onCleanup(() => {
    unsubscribeClick()
    unsubscribeKit()
    unsubscribeSession()
    unsubscribeScheduler()
    unsubscribeAuthoredPlayAlong()
    unsubscribeStemPlayAlong()
    stemPlayAlong.dispose()
    void authoredPlayAlong.dispose()
    sessionScheduler.dispose()
    clickController.dispose()
    sessionController.dispose()
    cancelCalibration()
    if (toastTimer !== undefined) window.clearTimeout(toastTimer)
    if (hitTimer !== undefined) window.clearTimeout(hitTimer)
    void audioSession.dispose()
  })

  return (
    <div
      class={styles.shell}
      style={background.resolvedStyle()}
      data-testid="drum-night-shell"
      data-playing={isPlaying() ? 'true' : 'false'}
      data-click-enabled={clickSnapshot().enabled ? 'true' : 'false'}
      data-click-status={clickSnapshot().status}
      data-drawer-open={drawerOpen() ? 'true' : 'false'}
      data-input-open={inputOpen() ? 'true' : 'false'}
      data-view={view()}
      data-background-treatment={background.resolved().treatment}
      data-session-status={activeSessionState().status}
      data-import-status={sessionState().status}
    >
      <a
        class={styles.skipLink}
        href="#drum-night-stage"
        inert={modalLayerOpen()}
        aria-hidden={modalLayerOpen()}
      >
        Skip to the drum stage
      </a>

      <aside
        class={styles.roomRail}
        aria-label="Drum Night sections"
        inert={inputOpen()}
      >
        <a class={styles.brandMark} href="/" aria-label="MercuryPitch home">
          <img src="/favicon.svg" alt="" />
        </a>
        <nav class={styles.railNav}>
          <button
            class={cx('railAction', !drawerOpen() && 'isActive')}
            type="button"
            aria-current={!drawerOpen() ? 'page' : undefined}
            onClick={() => {
              closeWorkspace()
              selectView('pocket')
            }}
          >
            <WaveformBars />
            <span>Pocket</span>
          </button>
          <button
            class={cx(
              'railAction',
              drawerOpen() && workspace() === 'learn' && 'isActive',
            )}
            type="button"
            aria-expanded={drawerOpen() && workspace() === 'learn'}
            aria-controls="drum-workbench"
            onClick={() => openWorkspace('learn')}
          >
            <MusicLibrary />
            <span>Learn</span>
          </button>
          <button
            class={cx(
              'railAction',
              drawerOpen() && workspace() === 'songs' && 'isActive',
            )}
            type="button"
            aria-expanded={drawerOpen() && workspace() === 'songs'}
            aria-controls="drum-workbench"
            onClick={() => openWorkspace('songs')}
          >
            <MusicNote />
            <span>Songs</span>
          </button>
          <button
            class={cx(
              'railAction',
              drawerOpen() && workspace() === 'groove' && 'isActive',
            )}
            type="button"
            aria-expanded={drawerOpen() && workspace() === 'groove'}
            aria-controls="drum-workbench"
            onClick={() => openWorkspace('groove')}
          >
            <SlidersHorizontal />
            <span>Groove</span>
          </button>
        </nav>
        <button
          class={cx(
            'railAction',
            'railKit',
            drawerOpen() && workspace() === 'kit' && 'isActive',
          )}
          type="button"
          aria-expanded={drawerOpen() && workspace() === 'kit'}
          aria-controls="drum-workbench"
          onClick={() => openWorkspace('kit')}
        >
          <Drum />
          <span>Kit</span>
        </button>
      </aside>

      <main class={styles.roomShell}>
        <header class={styles.sessionBar} inert={modalLayerOpen()}>
          <div class={styles.mobileBrand} aria-label="MercuryPitch Drum Night">
            <img src="/favicon.svg" alt="" />
            <span>Drums</span>
          </div>
          <button
            class={styles.sessionIdentity}
            type="button"
            onClick={() => openWorkspace('songs')}
          >
            <span class={styles.sessionLight} aria-hidden="true" />
            <span>
              <strong>{sessionTitle()}</strong>
              <small>{sessionIdentityDetail()}</small>
            </span>
            <ChevronDown />
          </button>
          <div class={styles.barMap} aria-label={sessionMapCopy().aria}>
            <span class={styles.barLabel}>{sessionMapCopy().label}</span>
            <span class={styles.barExtent} aria-hidden="true">
              <i />
              {sessionMapCopy().detail}
            </span>
          </div>
          <div class={styles.sessionActions}>
            <button
              ref={inputButtonRef}
              class={styles.inputChip}
              type="button"
              aria-label={`Open drum input setup: ${midiHeadline()}, ${midiDetail()}`}
              aria-expanded={inputOpen()}
              aria-controls="drum-input-popover"
              aria-haspopup="dialog"
              onClick={() => {
                setDrawerOpen(false)
                if (inputOpen()) closeInput()
                else setInputOpen(true)
                updateUrl(view(), null)
              }}
            >
              <span
                class={styles.signalDot}
                data-status={runtime.midiState().status}
                aria-hidden="true"
              />
              <MidiDin />
              <span class={styles.compactInputState} aria-hidden="true">
                {midiCompactStatus()}
              </span>
              <span class={styles.inputCopy}>
                <strong>{midiHeadline()}</strong>
                <small>{midiDetail()}</small>
              </span>
              <ChevronDown />
            </button>
            <button
              class={styles.roomChip}
              type="button"
              aria-label={`Change room, ${roomLabel()} selected`}
              onClick={() => openWorkspace('room')}
            >
              <span class={styles.roomChipArt} aria-hidden="true" />
              <span>
                <strong>{roomLabel()}</strong>
                <small>Visual room</small>
              </span>
              <ChevronDown />
            </button>
          </div>
        </header>

        <section
          class={styles.performanceStage}
          id="drum-night-stage"
          tabindex="-1"
          aria-label="Drum performance stage"
          inert={inputOpen()}
        >
          <div class={styles.stageRoom} aria-hidden="true" />
          <Show when={view() === 'seat'}>
            <picture
              class={styles.seatBackdrop}
              data-testid="drummer-seat-backdrop"
              aria-hidden="true"
            >
              <source
                media="(max-width: 720px)"
                srcset="/drum-night/drummer-seat-portrait.webp"
              />
              <img src="/drum-night/drummer-seat-landscape.webp" alt="" />
            </picture>
          </Show>
          <div class={styles.stageShade} aria-hidden="true" />
          <div class={styles.stageVignette} aria-hidden="true" />

          <div
            class={styles.stageHeading}
            data-copy-hidden={usingStemBacking() && view() !== 'seat'}
            inert={drawerInteractionLocked()}
          >
            <Show when={!usingStemBacking() || view() === 'seat'}>
              <div class={styles.stageCopy}>
                <span class={styles.stageKicker}>
                  <i aria-hidden="true" /> {stageCopy().kicker}
                </span>
                <h1>{stageCopy().title}</h1>
              </div>
            </Show>
            <div
              class={styles.viewSwitcher}
              role="group"
              aria-label="Drum view"
            >
              <For each={STAGE_VIEWS}>
                {(item) => (
                  <button
                    class={view() === item ? styles.isActive : undefined}
                    type="button"
                    aria-pressed={view() === item}
                    aria-label={`${STAGE_VIEW_LABELS[item]} view`}
                    onClick={() => selectView(item)}
                  >
                    {item === 'seat' ? 'Seat' : STAGE_VIEW_LABELS[item]}
                  </button>
                )}
              </For>
            </div>
          </div>

          <Show
            when={usingStemBacking()}
            fallback={
              <>
                <Show when={view() === 'pocket'}>
                  <PocketStage
                    activePad={activeHit}
                    transport={transport}
                    pocket={activePocket}
                    meter={activePocketMeter}
                    imported={usingImportedDocument()}
                    sessionTitle={sessionTitle}
                    inactive={drawerInteractionLocked()}
                    photoKit={
                      background.resolved().id === 'drum-pocket-console'
                    }
                    onStrike={triggerPad}
                  />
                </Show>
                <Show when={view() !== 'pocket'}>
                  <div
                    class={styles.sessionStageView}
                    data-session-view={view()}
                    inert={drawerInteractionLocked()}
                  >
                    <Show when={view() === 'seat'}>
                      <DrummerSeatView
                        session={activeSessionState}
                        playheadBeat={() => transport().positionBeats}
                        scoreIndex={sessionScoreIndex}
                        liveHits={seatLiveHits}
                        onStrike={triggerPad}
                      />
                    </Show>
                    <Show when={view() === 'score'}>
                      <DrumScoreSheet
                        session={activeSessionState}
                        playheadBeat={() => transport().positionBeats}
                        scoreIndex={sessionScoreIndex}
                        visibleBarCount={() => (compactScore() ? 2 : 4)}
                        markA={loopRange.markA}
                        markB={loopRange.markB}
                      />
                    </Show>
                    <p
                      class={styles.authoredPlaybackNotice}
                      data-status={schedulerSnapshot().status}
                      role="note"
                    >
                      {authoredPlaybackCopy()}
                    </p>
                  </div>
                </Show>

                <aside
                  class={styles.phraseCoach}
                  aria-label="Session phrase coach"
                  inert={drawerInteractionLocked()}
                >
                  <DrumSessionCoach
                    session={activeSessionState}
                    playheadBeat={() => transport().positionBeats}
                    capturedHits={capturedSessionHits}
                    scoreIndex={sessionScoreIndex}
                    onRequestRecoveryLoop={applyRecoveryLoop}
                  />
                </aside>

                <button
                  class={styles.coachCue}
                  type="button"
                  inert={drawerInteractionLocked()}
                  onClick={() => openWorkspace('coach')}
                  aria-label="Open live take monitor"
                >
                  <span class={styles.coachOrb}>
                    <AudioWave />
                  </span>
                  <span>
                    <strong>
                      {retainedTakeHitCount() === 0
                        ? recordingChoiceMade() && !transport().recording
                          ? 'Arm Take events, then press Play.'
                          : 'Press Play, then answer the phrase.'
                        : omittedTakeHitCount() === 0
                          ? `${retainedTakeHitCount()} strikes ready to compare.`
                          : `${retainedTakeHitCount()} strikes ready · ${omittedTakeHitCount()} older not retained.`}
                    </strong>
                    <small>
                      {retainedTakeHitCount() === 0
                        ? 'Take events arms automatically on the first Play.'
                        : 'Uses authored attacks and captured event timing.'}
                    </small>
                  </span>
                  <ChevronDown />
                </button>
              </>
            }
          >
            <Show
              when={view() === 'seat'}
              fallback={
                <DrumPlayAlongStage
                  title={sessionTitle()}
                  mixKind={
                    stemPlayAlongSnapshot().hasIndependentDrums
                      ? 'separated'
                      : 'two-stem'
                  }
                  view={view()}
                  positionSeconds={runtime.positionSeconds()}
                  durationSeconds={stemPlayAlongSnapshot().durationSeconds}
                  isPlaying={isPlaying()}
                  isLoading={
                    playRequestPending() ||
                    stemPlayAlongSnapshot().status === 'loading'
                  }
                  recentPadId={activeHit()}
                  strikeDisabled={drawerInteractionLocked()}
                  onStrike={triggerPad}
                  onOpenAuthoredScore={() => openWorkspace('songs')}
                />
              }
            >
              <div
                class={styles.sessionStageView}
                data-session-view="seat"
                inert={drawerInteractionLocked()}
              >
                <DrummerSeatView
                  session={() => IDLE_DRUM_SESSION}
                  playheadBeat={() => transport().positionBeats}
                  scoreIndex={() => null}
                  liveHits={seatLiveHits}
                  onStrike={triggerPad}
                />
              </div>
            </Show>
          </Show>

          <button
            class={styles.sheetScrim}
            type="button"
            aria-label="Close rack drawer"
            onClick={closeWorkspace}
            tabindex={drawerInteractionLocked() ? 0 : -1}
            aria-hidden={!drawerInteractionLocked()}
            inert={!drawerInteractionLocked()}
          />
          <section
            ref={drawerRef}
            id="drum-workbench"
            class={styles.workbench}
            data-workspace={workspace()}
            role={drawerIsModal() ? 'dialog' : 'region'}
            aria-modal={drawerIsModal() ? 'true' : undefined}
            aria-labelledby="drum-workbench-title"
            aria-hidden={!drawerOpen()}
            inert={!drawerOpen()}
            tabindex="-1"
          >
            <div class={styles.workbenchBar}>
              <div>
                <span>Rack drawer</span>
                <strong id="drum-workbench-title">
                  {WORKSPACE_TITLES[workspace()]}
                </strong>
              </div>
              <Show
                when={WORKBENCH_TABS.some((item) => item === workspace())}
                fallback={
                  <button
                    class={styles.contextRackBack}
                    type="button"
                    data-drawer-primary="true"
                    onClick={() => {
                      setWorkspace('groove')
                      updateUrl(view(), 'groove')
                      queueMicrotask(focusDrawerPrimary)
                    }}
                  >
                    <SlidersHorizontal />
                    Rack controls
                  </button>
                }
              >
                <div
                  class={styles.workbenchTabs}
                  role="tablist"
                  aria-label="Drum workbench"
                >
                  <For each={WORKBENCH_TABS}>
                    {(item, index) => (
                      <button
                        class={
                          workspace() === item ? styles.isActive : undefined
                        }
                        type="button"
                        role="tab"
                        id={`drum-workbench-tab-${item}`}
                        aria-controls={`drum-workbench-panel-${item}`}
                        aria-selected={workspace() === item}
                        tabindex={workspace() === item ? 0 : -1}
                        onClick={() => {
                          setWorkspace(item)
                          updateUrl(view(), item)
                        }}
                        onKeyDown={(event) => {
                          const nextIndex = nextRovingIndex(
                            event.key,
                            index(),
                            WORKBENCH_TABS.length,
                          )
                          if (nextIndex === null) return
                          event.preventDefault()
                          const nextWorkspace = WORKBENCH_TABS[nextIndex]
                          setWorkspace(nextWorkspace)
                          updateUrl(view(), nextWorkspace)
                          const tabs =
                            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                              '[role="tab"]',
                            )
                          tabs?.[nextIndex]?.focus()
                        }}
                      >
                        {item[0].toUpperCase() + item.slice(1)}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <button
                class={styles.closeWorkbench}
                type="button"
                onClick={closeWorkspace}
                aria-label="Close rack drawer"
              >
                <X />
              </button>
            </div>

            <Switch>
              <Match when={workspace() === 'groove'}>
                <div
                  class={cx('workspaceView', 'grooveWorkspace')}
                  id="drum-workbench-panel-groove"
                  role="tabpanel"
                  aria-labelledby="drum-workbench-tab-groove"
                >
                  <Show when={drawerOpen()}>
                    <Switch>
                      <Match when={usingStemBacking()}>
                        <section class={styles.grooveReadOnly}>
                          <span>Prepared audio</span>
                          <h3>Keep the source honest.</h3>
                          <p>
                            A saved audio session has no authored drum grid. Mix
                            its separated Drums and Backing in Mix, or choose a
                            prepared groove or MIDI/GP part in Songs.
                          </p>
                          <button
                            type="button"
                            onClick={() => openWorkspace('songs')}
                          >
                            Open Songs
                          </button>
                        </section>
                      </Match>
                      <Match when={usingImportedDocument()}>
                        <section class={styles.grooveReadOnly}>
                          <span>Read-only imported part</span>
                          <h3>{sessionTitle()}</h3>
                          <p>
                            Imported MIDI and Guitar Pro remain the exact Score
                            and playalong authority. Clear the part in Songs to
                            return to the session-local First Pocket editor.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setView('score')
                              closeWorkspace()
                            }}
                          >
                            Open imported score
                          </button>
                        </section>
                      </Match>
                      <Match when={true}>
                        <DrumGrooveEditor
                          controller={grooveDrafts}
                          label={`${preparedGroove().variant.label} groove editor`}
                        />
                      </Match>
                    </Switch>
                  </Show>
                </div>
              </Match>
              <Match when={workspace() === 'kit'}>
                <div
                  class={cx('workspaceView', 'kitWorkspace')}
                  id="drum-workbench-panel-kit"
                  role="tabpanel"
                  aria-labelledby="drum-workbench-tab-kit"
                >
                  <div class={styles.workspaceCopy}>
                    <span>Sound and mapping</span>
                    <h3>{selectedKit().name}</h3>
                    <p>
                      {selectedKit().character}. Each sampled flavor loads only
                      after an audio action and falls back per strike.
                    </p>
                    <div
                      class={styles.kitLoadStatus}
                      data-status={kitSnapshot().status}
                      role="status"
                    >
                      <strong>{kitStatusCopy()}</strong>
                      <small>
                        {formatMegabytes(selectedKit().publishedEncodedBytes)}
                      </small>
                      <Show when={kitSnapshot().error !== null}>
                        <button type="button" onClick={retryKit}>
                          Retry {selectedKit().name}
                        </button>
                      </Show>
                    </div>
                  </div>
                  <div
                    class={styles.kitCatalog}
                    role="radiogroup"
                    aria-label="Drum sound"
                  >
                    <For each={DRUM_KIT_CATALOG}>
                      {(kit, index) => (
                        <button
                          class={
                            kitSnapshot().selectedKitId === kit.id
                              ? styles.isSelected
                              : undefined
                          }
                          type="button"
                          role="radio"
                          aria-checked={kitSnapshot().selectedKitId === kit.id}
                          tabindex={
                            kitSnapshot().selectedKitId === kit.id ? 0 : -1
                          }
                          onClick={() => selectKit(kit.id)}
                          onKeyDown={(event) => {
                            const nextIndex = nextRovingIndex(
                              event.key,
                              index(),
                              DRUM_KIT_CATALOG.length,
                            )
                            if (nextIndex === null) return
                            event.preventDefault()
                            const nextKit = DRUM_KIT_CATALOG[nextIndex]
                            selectKit(nextKit.id)
                            const radios =
                              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                                '[role="radio"]',
                              )
                            radios?.[nextIndex]?.focus()
                          }}
                        >
                          <span>
                            <strong>{kit.name}</strong>
                            <small>{kit.character}</small>
                            <Show when={kitSnapshot().selectedKitId === kit.id}>
                              <em
                                class={styles.selectionMark}
                                aria-hidden="true"
                              >
                                Selected
                              </em>
                            </Show>
                          </span>
                          <b>
                            {kit.engine === 'synth'
                              ? 'Instant'
                              : formatMegabytes(kit.publishedEncodedBytes)}
                          </b>
                        </button>
                      )}
                    </For>
                    <Show when={kitSnapshot().selectedKitId === 'live'}>
                      <p class={styles.kitAttribution}>
                        {selectedKit().license.attribution}{' '}
                        <a
                          href={selectedKit().license.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selectedKit().license.spdx}
                        </a>
                      </p>
                    </Show>
                  </div>
                  <div class={styles.mappingPanel}>
                    <div class={styles.mappingHeading}>
                      <span>
                        <strong>E-kit learn map</strong>
                        <small>
                          {runtime.midiState().status === 'connected'
                            ? runtime.midiState().selectedInputName
                            : 'Connect MIDI to learn by strike'}
                        </small>
                      </span>
                      <button
                        type="button"
                        disabled={runtime.midiMapping().size === 0}
                        onClick={() => runtime.clearMidiMapping()}
                      >
                        Clear learned
                      </button>
                    </div>
                    <div class={styles.mappingList}>
                      <For each={ESSENTIAL_DRUM_PADS}>
                        {(pad) => {
                          const sources = () => mappedSourcesFor(pad.gmKey)
                          const learning = () =>
                            runtime.midiState().learningTargetGmKey ===
                            pad.gmKey
                          return (
                            <div>
                              <span>{pad.gmKey}</span>
                              <strong>{pad.label}</strong>
                              <small>
                                {sources().length === 0
                                  ? 'GM default'
                                  : `Raw ${sources().join(', ')}`}
                              </small>
                              <button
                                type="button"
                                class={
                                  learning() ? styles.isLearning : undefined
                                }
                                disabled={
                                  runtime.midiState().status !== 'connected'
                                }
                                onClick={() => {
                                  if (learning()) runtime.cancelMidiLearn()
                                  else runtime.beginMidiLearnForPad(pad.id)
                                }}
                              >
                                {learning() ? 'Strike now · cancel' : 'Learn'}
                              </button>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                    <Show when={actionableUnmappedNote()}>
                      {(unmapped) => (
                        <p class={styles.rawMidiNotice}>
                          Raw note {unmapped().rawMidiKey} on channel{' '}
                          {unmapped().midiChannel + 1} is not mapped yet. Choose
                          Learn beside its intended drum, then strike it again.
                        </p>
                      )}
                    </Show>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'mix'}>
                <div
                  class={cx('workspaceView', 'mixWorkspace')}
                  id="drum-workbench-panel-mix"
                  role="tabpanel"
                  aria-labelledby="drum-workbench-tab-mix"
                >
                  <DrumPlayAlongMixer
                    sourceKind={mixSourceKind()}
                    activePreset={mixPreset()}
                    drums={sourceDrumsMix()}
                    backing={backingMix()}
                    you={{
                      level: kitVolume() / 100,
                      muted: liveKitMuted(),
                      detail: `${selectedKit().name} · touch, keys, or e-kit`,
                    }}
                    click={{
                      level: clickSnapshot().level,
                      muted: !clickSnapshot().enabled,
                      disabled: usingStemBacking(),
                      detail: usingStemBacking()
                        ? 'Unavailable without authored tempo'
                        : clickStatusCopy(),
                    }}
                    tracks={sourceMixTracks()}
                    drumsAccessory={
                      activeDocument().sourceFormat === 'prepared' &&
                      !usingStemBacking() ? (
                        <DrumFamilyBalance
                          families={authoredFamilyBalanceRows()}
                          selectedFamily={selectedAuthoredFamily()}
                          onFamilySelect={setSelectedAuthoredFamily}
                          onFamilyLevelChange={setAuthoredFamilyLevel}
                          onFamilyMuteChange={setAuthoredFamilyMuted}
                        />
                      ) : undefined
                    }
                    onPresetChange={applyMixPreset}
                    onBusLevelChange={setMixBusLevel}
                    onBusMuteChange={setMixBusMuted}
                    onTrackLevelChange={setMixTrackLevel}
                    onTrackMuteChange={setMixTrackMuted}
                  />
                </div>
              </Match>
              <Match when={workspace() === 'room'}>
                <div
                  class={styles.workspaceView}
                  id="drum-workbench-panel-room"
                  role="tabpanel"
                  aria-labelledby="drum-workbench-tab-room"
                >
                  <div class={styles.workspaceCopy}>
                    <span>Room and ambience</span>
                    <h3>{roomLabel()}</h3>
                    <p>
                      Room art changes the Pocket and Score environment only.
                      The dedicated Drummer Seat viewpoint, kit sound, and mix
                      remain independent. Your choice stays on this device.
                    </p>
                  </div>
                  <PremiumBackgroundPicker
                    controller={background}
                    embedded
                    onSelect={(option) => {
                      const accepted = background.select(option.id)
                      if (accepted) {
                        announceOnly(
                          `${option.label} selected. Drum sound unchanged.`,
                        )
                      }
                      return accepted
                    }}
                  />
                </div>
              </Match>
              <Match when={workspace() === 'learn'}>
                <div class={cx('workspaceView', 'simpleWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>First pocket</span>
                    <h3>Kick. Snare. Space.</h3>
                    <p>
                      Hear a two-bar backbeat, then answer it with touch,
                      computer keys, or a connected e-kit. Your strikes keep
                      their velocity and timing on the same clock.
                    </p>
                  </div>
                  <button
                    class={styles.largeRecovery}
                    type="button"
                    onClick={startFirstPocket}
                  >
                    Play First Pocket at 84 BPM
                  </button>
                </div>
              </Match>
              <Match when={workspace() === 'songs'}>
                <div class={cx('workspaceView', 'sessionImportWorkspace')}>
                  <DrumPlayAlongSongsPanel
                    libraryState={songController.libraryState()}
                    selectionState={songController.selectionState()}
                    songs={songController.songs()}
                    preparationState={bandPreparation.state()}
                    localArrangement={localArrangementAccessory()}
                    selectedSessionAccessory={
                      <button
                        type="button"
                        onClick={() => {
                          setWorkspace('mix')
                          updateUrl(view(), 'mix')
                        }}
                      >
                        Open the play-along mixer
                      </button>
                    }
                    openingFileName={openingSessionFileName()}
                    fileMessage={sessionImportProblem()}
                    fileBusy={sessionState().status === 'loading'}
                    onFile={importSessionFile}
                    onFilesRejected={() => {
                      const message =
                        'Choose one MIDI, GP, GP3, GP4, GP5, or GPX file.'
                      setSessionFileMessage(message)
                      showToast(message)
                    }}
                    onSelectSession={selectPreparedSession}
                    onClearSession={clearPreparedSession}
                    onRetryLibrary={() => {
                      void songController.refreshLibrary()
                    }}
                    onRetrySession={retryPreparedSession}
                    onSeparateDrums={startBandSeparation}
                    onCancelSeparation={cancelBandSeparation}
                    onRetrySeparation={startBandSeparation}
                    onDismissSeparation={cancelBandSeparation}
                    onResolveBlocker={(blocker) => {
                      if (blocker.cta === null) return
                      window.location.assign(
                        `/#/settings/${blocker.cta.section}`,
                      )
                    }}
                  />
                  <Show when={sessionState().status === 'loading'}>
                    <button
                      class={styles.cancelSessionImport}
                      type="button"
                      onClick={cancelSessionImport}
                    >
                      Cancel authored-file import
                    </button>
                  </Show>
                </div>
              </Match>
              <Match when={workspace() === 'coach'}>
                <div class={cx('workspaceView', 'sessionCoachWorkspace')}>
                  <DrumSessionCoach
                    session={activeSessionState}
                    playheadBeat={() => transport().positionBeats}
                    capturedHits={capturedSessionHits}
                    scoreIndex={sessionScoreIndex}
                    onRequestRecoveryLoop={applyRecoveryLoop}
                  />
                </div>
              </Match>
            </Switch>
          </section>
        </section>

        <DrumNightTimeline
          sourceLabel={() =>
            usingImportedDocument() || usingStemBacking()
              ? 'Song timeline'
              : 'Groove timeline'
          }
          positionSeconds={runtime.positionSeconds}
          durationSeconds={runtime.durationSeconds}
          playheadBeat={() => transport().positionBeats}
          durationBeats={() =>
            transport().authoredDurationBeats ?? activeDocument().durationBeats
          }
          markA={loopRange.markA}
          markB={loopRange.markB}
          active={loopRange.isActive}
          disabled={modalLayerOpen}
          secondsForBeat={runtime.secondsForBeat}
          beatForSeconds={runtime.beatForSeconds}
          onSeek={loopRange.seekSeconds}
          onScrubStart={loopRange.beginScrub}
          onScrubEnd={loopRange.endScrub}
          onMoveMark={moveLoopMark}
          onCommitMark={commitLoopMark}
          onMarkAtPlayhead={markLoopAtPlayhead}
          onClear={clearPracticeLoop}
        />

        <Show when={compactScore()}>
          <div
            class={styles.touchKit}
            role="group"
            aria-label="Touch drum pads"
            inert={modalLayerOpen()}
          >
            <For each={ESSENTIAL_DRUM_PADS}>
              {(pad) => (
                <button
                  class={cx(
                    pad.id === 'kick' && 'kickPad',
                    activeHit() === pad.id && 'isHit',
                  )}
                  type="button"
                  onPointerDown={(event) => {
                    if (!acceptsPadPointer(event)) return
                    triggerPad(pad.id, pointerVelocity(event))
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) triggerPad(pad.id, 100)
                  }}
                  aria-label={`${pad.label}, key ${pad.keyboardLabel}`}
                  aria-keyshortcuts={pad.keyboardLabel}
                >
                  <span>{pad.shortLabel}</span>
                  <small>{pad.keyboardLabel}</small>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class={styles.consoleBridge} inert={modalLayerOpen()}>
          <div class={cx('consoleSide', 'consoleLead')}>
            <button
              class={styles.consoleModule}
              type="button"
              disabled={usingStemBacking()}
              aria-pressed={transport().countInBeats > 0}
              aria-label={
                transport().countInBeats > 0
                  ? `Count-in: ${transport().countInBeats} audible beats`
                  : 'Count-in: off'
              }
              onClick={() => {
                const enabled = transport().countInBeats === 0
                runtime.setCountInBeats(enabled ? 4 : 0)
                showToast(
                  enabled
                    ? 'Four-beat audible count-in enabled.'
                    : 'Count-in disabled.',
                )
              }}
            >
              <Metronome />
              <span>
                <small>Count-in</small>
                <strong>
                  {transport().countInBeats > 0
                    ? `${transport().countInBeats} beats`
                    : 'Off'}
                </strong>
              </span>
            </button>
            <button
              class={styles.consoleModule}
              type="button"
              disabled={usingStemBacking()}
              aria-pressed={clickSnapshot().enabled}
              aria-label={`Playback click: ${clickSnapshot().enabled ? 'on' : 'off'}`}
              onClick={toggleClick}
            >
              <AudioWave />
              <span>
                <small>Play click</small>
                <strong>{clickSnapshot().enabled ? 'On' : 'Off'}</strong>
              </span>
            </button>
            <div
              class={styles.tempoModule}
              aria-label={
                usingStemBacking() ? 'Recorded song timing' : 'Authored tempo'
              }
            >
              <button
                type="button"
                disabled={usingStemBacking()}
                onClick={() => changeTempo(-2)}
                aria-label="Decrease tempo"
              >
                <Minus />
              </button>
              <span>
                <strong>
                  {usingStemBacking() ? '1×' : transport().tempoBpm}
                </strong>
                <small>{usingStemBacking() ? 'Song' : 'BPM'}</small>
              </span>
              <button
                type="button"
                disabled={usingStemBacking()}
                onClick={() => changeTempo(2)}
                aria-label="Increase tempo"
              >
                <Plus />
              </button>
            </div>
          </div>
          <div class={styles.playCradle}>
            <button
              class={styles.stopButton}
              type="button"
              disabled={transport().phase === 'stopped'}
              onClick={stopTake}
              aria-label={`Stop and return the ${transportClockLabel()} to ${usingStemBacking() ? 'the start' : 'beat one'}`}
            >
              <Square />
            </button>
            <button
              class={styles.playButton}
              type="button"
              onClick={togglePlaying}
              aria-label={`${isPlaying() ? 'Pause' : 'Play'} ${sessionTitle()} ${transportClockLabel()}`}
            >
              {isPlaying() ? <Pause /> : <Play />}
              <span>{isPlaying() ? 'Pause' : 'Play'}</span>
            </button>
          </div>
          <div class={cx('consoleSide', 'consoleTrail')}>
            <button
              class={cx('consoleModule', 'recordModule')}
              type="button"
              aria-pressed={transport().recording}
              onClick={toggleRecording}
            >
              <i class={styles.recordMark} aria-hidden="true" />
              <span>
                <small>Take events</small>
                <strong>
                  {transport().recording
                    ? `Armed · ${takeHitCountCopy()}`
                    : `${takeHitCountCopy()} · off`}
                </strong>
              </span>
            </button>
            <button
              class={styles.consoleModule}
              type="button"
              onClick={() => openWorkspace('kit')}
            >
              <Drum />
              <span>
                <small>Kit</small>
                <strong>{selectedKit().name}</strong>
              </span>
              <ChevronDown />
            </button>
          </div>
        </div>

        <nav
          class={styles.mobileNav}
          aria-label="Drum Night navigation"
          inert={modalLayerOpen()}
        >
          <button type="button" onClick={() => openWorkspace('songs')}>
            <MusicNote />
            <span>Song</span>
          </button>
          <button type="button" onClick={() => openWorkspace('groove')}>
            <SlidersHorizontal />
            <span>Groove</span>
          </button>
          <button
            class={styles.mobilePlay}
            type="button"
            onClick={togglePlaying}
            aria-label={`${isPlaying() ? 'Pause' : 'Play'} ${sessionTitle()} ${transportClockLabel()}`}
          >
            {isPlaying() ? <Pause /> : <Play />}
            <span>{isPlaying() ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            aria-pressed={transport().recording}
            onClick={toggleRecording}
          >
            <i class={styles.mobileRecordMark} aria-hidden="true" />
            <span>{transport().recording ? 'Armed' : 'Record'}</span>
          </button>
          <button type="button" onClick={() => openWorkspace('kit')}>
            <Drum />
            <span>Kit</span>
          </button>
        </nav>

        <Show when={inputOpen()}>
          <div class={styles.inputScrim} aria-hidden="true" />
          <div
            ref={inputRef}
            class={styles.inputPopover}
            id="drum-input-popover"
            role="dialog"
            aria-label="Drum input"
            aria-modal="true"
            tabindex="-1"
          >
            <div class={styles.popoverHeading}>
              <span>Input and calibration</span>
              <button
                data-input-close="true"
                type="button"
                onClick={closeInput}
                aria-label="Close input details"
              >
                <X />
              </button>
            </div>
            <strong>{midiHeadline()}</strong>
            <p>{midiGuidance()}</p>
            <Show when={runtime.midiState().availableInputs.length > 1}>
              <label class={styles.inputSelect}>
                <span>Active MIDI input</span>
                <select
                  data-input-primary="true"
                  value={runtime.midiState().selectedInputId ?? ''}
                  onChange={(event) => {
                    const inputId = event.currentTarget.value
                    runtime.selectMidiInput(inputId)
                  }}
                >
                  <For each={runtime.midiState().availableInputs}>
                    {(input) => <option value={input.id}>{input.name}</option>}
                  </For>
                </select>
              </label>
            </Show>
            <div class={styles.inputRow}>
              <span>Last strike</span>
              <b>{lastHit()}</b>
            </div>
            <div class={styles.inputRow}>
              <span>Hi-hat controller</span>
              <b>
                {runtime.midiState().lastControllerChange === null
                  ? 'No controller data'
                  : `CC ${runtime.midiState().lastControllerChange?.controller} · ${runtime.midiState().lastControllerChange?.value}`}
              </b>
            </div>
            <Show when={actionableUnmappedNote()}>
              {(unmapped) => (
                <div class={styles.unmappedInput} role="status">
                  Raw note {unmapped().rawMidiKey} on channel{' '}
                  {unmapped().midiChannel + 1} needs a learned mapping.
                </div>
              )}
            </Show>
            <Show when={runtime.midiState().status === 'connected'}>
              <div class={styles.calibrationPanel}>
                <div class={styles.calibrationHeading}>
                  <span>
                    <strong>Five-strike latency check</strong>
                    <small>
                      Strike the e-kit exactly when the amber target pulses.
                    </small>
                  </span>
                  <b>
                    {runtime.calibrationResult().sampleCount}/
                    {CALIBRATION_STRIKES}
                  </b>
                </div>
                <div
                  class={cx(
                    'calibrationTarget',
                    calibrationAwaiting() && 'calibrationTargetLive',
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <span aria-hidden="true" />
                  <strong>
                    {calibrationAwaiting()
                      ? `Strike ${calibrationCue()}`
                      : calibrationRunning()
                        ? 'Get ready'
                        : runtime.calibrationResult().status === 'ready'
                          ? `${Math.round(runtime.calibrationResult().estimateMs ?? 0)} ms estimate`
                          : 'Ready to calibrate'}
                  </strong>
                </div>
                <small class={styles.calibrationEvidence} role="status">
                  {calibrationEvidenceCopy()}
                </small>
                <div class={styles.calibrationActions}>
                  <button type="button" onClick={startCalibration}>
                    {runtime.calibrationResult().sampleCount > 0
                      ? 'Restart five strikes'
                      : 'Start five strikes'}
                  </button>
                  <button
                    type="button"
                    disabled={runtime.calibrationResult().status !== 'ready'}
                    onClick={applyCalibration}
                  >
                    Apply estimate
                  </button>
                </div>
                <Show when={runtime.latencyCompensationSourceId() !== null}>
                  <small class={styles.appliedLatency}>
                    Applied: {Math.round(runtime.latencyCompensationMs())} ms to
                    this input only.
                  </small>
                </Show>
              </div>
            </Show>
            <div class={styles.inputActions}>
              <Show
                when={runtime.midiState().status === 'connected'}
                fallback={
                  <button
                    data-input-primary="true"
                    type="button"
                    disabled={
                      runtime.midiState().status === 'requesting' ||
                      runtime.midiState().status === 'unsupported'
                    }
                    onClick={connectMidi}
                  >
                    {runtime.midiState().status === 'requesting'
                      ? 'Connecting…'
                      : runtime.midiState().status === 'idle'
                        ? 'Connect MIDI input'
                        : 'Scan for MIDI input'}
                  </button>
                }
              >
                <button
                  data-input-primary="true"
                  type="button"
                  onClick={() => {
                    cancelCalibration()
                    runtime.disconnectMidi()
                  }}
                >
                  Disconnect MIDI
                </button>
              </Show>
              <button type="button" onClick={() => openWorkspace('kit')}>
                Review sound and mapping
              </button>
            </div>
          </div>
        </Show>

        <Show when={audioErrorMessage()}>
          {(message) => (
            <div
              class={styles.runtimeAlert}
              role="alert"
              inert={modalLayerOpen()}
            >
              <span>
                <strong>Drum audio is unavailable.</strong>
                <small>{message()}</small>
              </span>
              <button type="button" onClick={retryKit}>
                Try audio again
              </button>
            </div>
          )}
        </Show>

        <div
          class={cx('toast', toastVisible() && 'toastVisible')}
          data-visible={toastVisible() ? 'true' : 'false'}
          role="status"
          aria-live="polite"
        >
          {liveMessage()}
        </div>
      </main>
    </div>
  )
}
