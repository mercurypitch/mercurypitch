// ============================================================
// Drum Night — silent-first Pocket Console percussion room
// ============================================================
//
// This standalone surface owns one transport, audio graph and input clock.
// First paint remains visual-only: Web Audio, sample requests and WebMIDI are
// crossed synchronously only by an explicit Play, strike or Connect action.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { AudioWave, ChevronDown, Drum, FileUpload, Loop, MercuryPlanet, Metronome, MidiDin, Minus, MusicLibrary, MusicNote, Pause, Play, Plus, SlidersHorizontal, Square, WaveformBars, X, } from '@/components/icons'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { barIndexAtBeat } from '@/lib/midi-bars'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { createPersistedSignal } from '@/lib/storage'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { DrumKitId, DrumKitPlayer, DrumKitPlayerOptions, DrumKitPlayerSnapshot, } from './audio'
import { createDrumKitPlayer, DRUM_KIT_CATALOG, DRUM_KIT_IDS, drumKitManifest, } from './audio'
import type { DrumNightAudioSession } from './drum-night-audio-session'
import { createDrumNightAudioSession } from './drum-night-audio-session'
import styles from './DrumNightApp.module.css'
import type { DrumNightRuntimeOptions, DrumTransportState, EssentialDrumPadId, } from './runtime'
import { ESSENTIAL_DRUM_PADS, useDrumNightRuntime } from './runtime'
import type { DrumCapturedHit, DrumRecoveryLoop, DrumScoreIndex, DrumSeatLiveHit, DrumSessionDocument, DrumSessionImportController, DrumSessionImportState, } from './session'
import { createDrumScoreIndex, createDrumSessionImportController, createDrumSessionScheduler, DrummerSeatView, DrumScoreSheet, DrumSessionCoach, drumSessionStateCopy, readyDrumSessionDocument, } from './session'

type StageView = 'pocket' | 'seat' | 'score'
type Workspace = 'groove' | 'kit' | 'mix' | 'room' | 'learn' | 'songs' | 'coach'
type PadId = EssentialDrumPadId

interface DrumNightAppProps {
  readonly createAudioSession?: () => DrumNightAudioSession
  readonly createPlayer?: (options: DrumKitPlayerOptions) => DrumKitPlayer
  readonly createScoreIndex?: (document: DrumSessionDocument) => DrumScoreIndex
  readonly createSessionController?: () => DrumSessionImportController
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
  songs: 'Bring a drum part',
  coach: 'Recover the backbeat',
}

const RING_EVENTS = [
  ['eventHat', 'translate(155 322) rotate(-58)', '-0.1s', 6, 26],
  ['eventHat', 'translate(208 232) rotate(-38)', '-0.4s', 6, 20],
  ['eventSnare', 'translate(309 171) rotate(-19)', '-0.8s', 10, 34],
  ['eventHat', 'translate(406 132) rotate(-9)', '-1.2s', 6, 20],
  ['eventKick', 'translate(500 118)', '-1.6s', 10, 44],
  ['eventHat', 'translate(592 132) rotate(9)', '-2s', 6, 20],
  ['eventTom', 'translate(688 169) rotate(18)', '-2.4s', 10, 34],
  ['eventHat', 'translate(778 224) rotate(36)', '-2.8s', 6, 20],
  ['eventRide', 'translate(840 314) rotate(58)', '-3.2s', 8, 28],
  ['eventCrash', 'translate(866 398) rotate(72)', '-3.6s', 10, 40],
  ['eventHat', 'translate(258 377) rotate(-58)', '-0.5s', 6, 20],
  ['eventSnare', 'translate(371 321) rotate(-25)', '-1.3s', 10, 34],
  ['eventKick', 'translate(500 302)', '-2.1s', 10, 44],
  ['eventHat', 'translate(626 325) rotate(25)', '-2.9s', 6, 20],
  ['eventSnare', 'translate(742 377) rotate(58)', '-3.7s', 10, 34],
] as const

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

function transportIsRunning(state: DrumTransportState): boolean {
  return state.phase === 'count-in' || state.phase === 'playing'
}

function transportPrimaryCopy(state: DrumTransportState): {
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
      value: `Beat ${Math.floor(state.positionBeats) + 1}`,
      detail: `${state.loopIteration + 1}`,
    }
  }
  if (state.phase === 'paused') {
    return {
      label: 'Paused',
      value: `Beat ${Math.floor(state.positionBeats) + 1}`,
      detail: 'II',
    }
  }
  return { label: 'Ready', value: 'Strike a pad', detail: '1–6' }
}

interface PocketRingProps {
  readonly inactive: boolean
  readonly transport: () => DrumTransportState
}

function PocketRing(props: PocketRingProps): JSX.Element {
  const primaryCopy = createMemo(() => transportPrimaryCopy(props.transport()))
  return (
    <div
      class={styles.pocketView}
      data-testid="drum-night-pocket-view"
      inert={props.inactive}
    >
      <svg
        class={styles.pocketRing}
        viewBox="0 0 1000 620"
        role="img"
        aria-labelledby="drum-pocket-title drum-pocket-description"
      >
        <title id="drum-pocket-title">Pocket Ring visual drum guide</title>
        <desc id="drum-pocket-description">
          An authored one-bar visual guide with kit events approaching a shared
          strike horizon. It is not scheduled as backing audio.
        </desc>
        <defs>
          <linearGradient id="drum-arc-fade" x1="0" x2="1">
            <stop offset="0" stop-color="#aab3b8" stop-opacity="0" />
            <stop offset="0.18" stop-color="#aab3b8" stop-opacity=".48" />
            <stop offset=".82" stop-color="#aab3b8" stop-opacity=".48" />
            <stop offset="1" stop-color="#aab3b8" stop-opacity="0" />
          </linearGradient>
          <filter
            id="drum-event-soft"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g class={styles.ringGeometry} aria-hidden="true">
          <ellipse cx="500" cy="342" rx="416" ry="236" />
          <ellipse cx="500" cy="342" rx="370" ry="205" />
          <ellipse cx="500" cy="342" rx="322" ry="175" />
          <ellipse cx="500" cy="342" rx="274" ry="144" />
          <path class={styles.subdivision} d="M100 342h800" />
          <path class={styles.strikeArc} d="M174 430Q500 578 826 430" />
          <path class={styles.scanArc} d="M94 342A406 226 0 0 1 906 342" />
        </g>

        <g class={styles.kitAnchors} aria-hidden="true">
          <g transform="translate(178 290)">
            <circle r="5" />
            <text y="-16">HI-HAT</text>
          </g>
          <g transform="translate(350 206)">
            <circle r="5" />
            <text y="-16">SNARE</text>
          </g>
          <g transform="translate(500 170)">
            <circle r="5" />
            <text y="-16">KICK</text>
          </g>
          <g transform="translate(638 214)">
            <circle r="5" />
            <text y="-16">TOMS</text>
          </g>
          <g transform="translate(790 294)">
            <circle r="5" />
            <text y="-16">RIDE</text>
          </g>
          <g transform="translate(866 398)">
            <circle r="5" />
            <text x="-18" y="-18">
              CRASH
            </text>
          </g>
        </g>

        <g class={styles.ringEvents} aria-hidden="true">
          <For each={RING_EVENTS}>
            {(event) => (
              <g
                class={cx('event', event[0])}
                style={{ '--event-delay': event[2] } as JSX.CSSProperties}
                transform={event[1]}
              >
                <rect
                  x={-event[3] / 2}
                  y={-event[4] / 2}
                  width={event[3]}
                  height={event[4]}
                  rx={event[3] / 2}
                />
              </g>
            )}
          </For>
        </g>
      </svg>

      <div class={styles.nowCapsule} aria-hidden="true">
        <span class={styles.nowPulse} aria-hidden="true" />
        <span>
          <small>{primaryCopy().label}</small>
          <strong>{primaryCopy().value}</strong>
        </span>
        <b>{primaryCopy().detail}</b>
      </div>
      <div class={styles.syntheticLabel}>
        Visual groove guide · no backing track or click
      </div>
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
  const [variation, setVariation] = createSignal('Source')
  const [kitVolume, setKitVolume] = createSignal(INITIAL_KIT_VOLUME)
  const [calibrationRunning, setCalibrationRunning] = createSignal(false)
  const [calibrationCue, setCalibrationCue] = createSignal(0)
  const [calibrationAwaiting, setCalibrationAwaiting] = createSignal(false)
  const [draggingSessionFile, setDraggingSessionFile] = createSignal(false)
  const [recoveryLoopActive, setRecoveryLoopActive] = createSignal(false)
  // Keep the premium metadata boundary behind the first explicit Room action.
  // Public selections still resolve synchronously through the shared
  // controller, so a restored free room does not cost a first-paint request.
  const [backgroundCatalogEnabled, setBackgroundCatalogEnabled] =
    createSignal(false)
  const [compactScore, setCompactScore] = createSignal(
    typeof window !== 'undefined' && window.innerWidth <= 720,
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
  player.setVolume(INITIAL_KIT_VOLUME / 100)
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
  const sessionController = (
    props.createSessionController ?? createDrumSessionImportController
  )()
  const [sessionState, setSessionState] = createSignal<DrumSessionImportState>(
    sessionController.state(),
  )
  const unsubscribeSession = sessionController.subscribe(() =>
    setSessionState(sessionController.state()),
  )
  const [schedulerSnapshot, setSchedulerSnapshot] = createSignal(
    sessionScheduler.snapshot(),
  )
  const unsubscribeScheduler = sessionScheduler.subscribe(() =>
    setSchedulerSnapshot(sessionScheduler.snapshot()),
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
  let inputRef: HTMLDivElement | undefined
  let inputButtonRef: HTMLButtonElement | undefined
  let sessionFileInputRef: HTMLInputElement | undefined
  let toastTimer: number | undefined
  let hitTimer: number | undefined
  let seatHitSequence = 0
  let calibrationTimer: number | undefined
  let calibrationInputId: string | null = null
  let calibrationLastSampleCount = 0
  let scheduledDocument: DrumSessionDocument | null = null

  const transport = runtime.transportState
  const isPlaying = createMemo(() => transportIsRunning(transport()))
  const loopStatusCopy = createMemo(() => {
    const state = transport()
    if (state.loop === null) return 'Off'
    const beatCount =
      Math.round((state.loop.endBeat - state.loop.startBeat) * 100) / 100
    return state.speedScale === 0.7
      ? `${beatCount}-beat recovery · 70%`
      : `${beatCount}-beat loop`
  })
  const selectedKit = createMemo(() =>
    drumKitManifest(kitSnapshot().selectedKitId),
  )
  const readySession = createMemo(() =>
    readyDrumSessionDocument(sessionState()),
  )
  const sessionScoreIndex = createMemo(() => {
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
  const sessionTitle = createMemo(() => readySession()?.title ?? 'Live drums')
  const roomLabel = createMemo(
    () =>
      getBackgroundDefinition(background.resolved().id)?.label ??
      'Pocket Console',
  )
  const sessionIdentityDetail = createMemo(() => {
    const document = readySession()
    if (document === null) {
      return `Touch · keys · optional MIDI · ${transport().tempoBpm} BPM`
    }
    const source = document.sourceFormat === 'midi' ? 'MIDI' : 'Guitar Pro'
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
      return state.hasReceivedHit ? 'receiving strikes' : 'ready for a strike'
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

  const syncStateFromUrl = (): void => {
    const params = new URLSearchParams(window.location.search)
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
    if (inputOpen()) setInputOpen(false)
  }

  const openWorkspace = (nextWorkspace: Workspace): void => {
    closeInput()
    setWorkspace(nextWorkspace)
    setDrawerOpen(true)
    updateUrl(view(), nextWorkspace)
  }

  const closeWorkspace = (): void => {
    setDrawerOpen(false)
    updateUrl(view(), null)
  }

  const importSessionFile = (file: File | undefined): void => {
    setDraggingSessionFile(false)
    if (file === undefined) return
    void sessionController
      .importFile(file)
      .then((attempt) => {
        if (attempt.status === 'stale') return
        if (attempt.state.status === 'ready') {
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
        showToast('The drum part could not be opened. Choose the file again.')
      })
  }

  const clearImportedSession = (): void => {
    sessionController.cancel()
    if (recoveryLoopActive()) {
      runtime.setLoop(null)
      runtime.setSpeedScale(1)
      setRecoveryLoopActive(false)
    }
    showToast('Imported drum part cleared. The live kit remains playable.')
  }

  const cancelSessionImport = (): void => {
    if (sessionState().status !== 'loading') return
    sessionController.cancel()
    showToast('Drum part import cancelled. Nothing was partially loaded.')
  }

  const applyRecoveryLoop = (loop: DrumRecoveryLoop): void => {
    const authoredEndBeat = readySession()?.durationBeats
    const endBeat =
      authoredEndBeat === undefined
        ? loop.endBeat
        : Math.min(loop.endBeat, authoredEndBeat)
    const applied = runtime.setLoop({ startBeat: loop.startBeat, endBeat })
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
      showToast('Take clock paused. Live voices released.')
      return
    }
    announceOnly(
      readySession() === null
        ? 'Starting the live take clock. No backing track or click is scheduled.'
        : 'Starting authored percussion on the shared take clock. No metronome click is scheduled.',
    )
    void runtime.play()
  }

  const changeTempo = (delta: number): void => {
    const nextTempo = Math.max(40, Math.min(280, transport().tempoBpm + delta))
    runtime.setTempoBpm(nextTempo)
    setRecoveryLoopActive(false)
    showToast(`Tempo set to ${nextTempo} BPM.`)
  }

  const triggerPad = (padId: PadId, velocity = 100): void => {
    runtime.strikePad(padId, velocity)
  }

  const startFirstPocket = (): void => {
    runtime.setTempoBpm(82)
    runtime.setSpeedScale(1)
    setRecoveryLoopActive(false)
    runtime.setCountInBeats(4)
    runtime.setLoop({ startBeat: 0, endBeat: 8 })
    runtime.setRecording(true)
    setDrawerOpen(false)
    updateUrl(view(), null)
    showToast(
      'Two-bar take armed at 82 BPM. The count-in is visual; no click is scheduled.',
    )
    void runtime.play()
  }

  const stopTake = (): void => {
    runtime.stop()
    showToast(
      'Take clock returned to beat one. Captured hits stay in this take.',
    )
  }

  const toggleLoop = (): void => {
    if (transport().loop !== null) {
      const clearedRecovery = recoveryLoopActive()
      runtime.setLoop(null)
      if (clearedRecovery) runtime.setSpeedScale(1)
      setRecoveryLoopActive(false)
      showToast(
        clearedRecovery
          ? 'Recovery loop cleared. Authored tempo returned to 100%.'
          : 'Practice loop cleared.',
      )
      return
    }
    const authoredEndBeat = readySession()?.durationBeats
    const endBeat = Math.min(8, authoredEndBeat ?? 8)
    if (!runtime.setLoop({ startBeat: 0, endBeat })) {
      showToast('This take is too short for a practice loop.')
      return
    }
    setRecoveryLoopActive(false)
    showToast(`${endBeat}-beat transport loop enabled.`)
  }

  const toggleRecording = (): void => {
    const recording = !transport().recording
    runtime.setRecording(recording)
    showToast(recording ? 'Take recording armed.' : 'Take recording disarmed.')
  }

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
      activation = Promise.resolve(player.activate())
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

  const cancelCalibration = (): void => {
    if (calibrationTimer !== undefined) {
      window.clearTimeout(calibrationTimer)
      calibrationTimer = undefined
    }
    setCalibrationRunning(false)
    setCalibrationAwaiting(false)
    setCalibrationCue(0)
    calibrationInputId = null
  }

  const scheduleCalibrationCue = (delayMs: number): void => {
    if (calibrationTimer !== undefined) window.clearTimeout(calibrationTimer)
    setCalibrationAwaiting(false)
    calibrationTimer = window.setTimeout(() => {
      calibrationTimer = undefined
      if (calibrationInputId === null) return
      const nextCue = calibrationLastSampleCount + 1
      if (!runtime.expectCalibrationHit(calibrationNowMs())) {
        cancelCalibration()
        showToast('Connect one MIDI input before calibrating.')
        return
      }
      setCalibrationCue(nextCue)
      setCalibrationAwaiting(true)
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
    isOpen: drawerOpen,
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
    const document = readySession()
    if (document !== scheduledDocument) {
      scheduledDocument = document
      // An imported document owns its own take evidence and practice range.
      // Crossing that boundary must never coach or loop against the previous
      // document, even when the old loop happens to fit the new duration.
      runtime.stop()
      runtime.setLoop(null)
      runtime.setSpeedScale(1)
      runtime.clearRecording()
      setRecoveryLoopActive(false)
      sessionScheduler.setSession(document)
    }
    props.onReadySessionChange?.(document)
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

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('popstate', syncStateFromUrl)
    window.addEventListener('resize', syncCompactScore)
    onCleanup(() => {
      uninstallSpace()
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('popstate', syncStateFromUrl)
      window.removeEventListener('resize', syncCompactScore)
    })
  })

  onCleanup(() => {
    unsubscribeKit()
    unsubscribeSession()
    unsubscribeScheduler()
    sessionScheduler.dispose()
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
      data-drawer-open={drawerOpen() ? 'true' : 'false'}
      data-input-open={inputOpen() ? 'true' : 'false'}
      data-view={view()}
      data-background-treatment={background.resolved().treatment}
      data-session-status={sessionState().status}
    >
      <a
        class={styles.skipLink}
        href="#drum-night-stage"
        inert={inputOpen() || drawerOpen()}
        aria-hidden={inputOpen() || drawerOpen()}
      >
        Skip to the drum stage
      </a>

      <aside
        class={styles.roomRail}
        aria-label="Drum Night sections"
        inert={inputOpen() || drawerOpen()}
      >
        <a class={styles.brandMark} href="/" aria-label="MercuryPitch home">
          <MercuryPlanet />
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
            class={styles.railAction}
            type="button"
            onClick={() => openWorkspace('learn')}
          >
            <MusicLibrary />
            <span>Learn</span>
          </button>
          <button
            class={styles.railAction}
            type="button"
            onClick={() => openWorkspace('songs')}
          >
            <MusicNote />
            <span>Songs</span>
          </button>
          <button
            class={styles.railAction}
            type="button"
            onClick={() => openWorkspace('groove')}
          >
            <SlidersHorizontal />
            <span>Groove</span>
          </button>
        </nav>
        <button
          class={cx('railAction', 'railKit')}
          type="button"
          onClick={() => openWorkspace('kit')}
        >
          <Drum />
          <span>Kit</span>
        </button>
      </aside>

      <main class={styles.roomShell}>
        <header class={styles.sessionBar} inert={inputOpen() || drawerOpen()}>
          <div class={styles.mobileBrand} aria-label="MercuryPitch Drum Night">
            <MercuryPlanet />
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
          <div
            class={styles.barMap}
            aria-label={
              authoredBarCount() === null
                ? `Current bar ${currentBar()}, unbounded take`
                : `Current bar ${currentBar()}, ${authoredBarCountCopy()}`
            }
          >
            <span class={styles.barLabel}>Bar {currentBar()}</span>
            <span class={styles.barExtent} aria-hidden="true">
              <i />
              {authoredBarCountCopy()}
            </span>
          </div>
          <div class={styles.sessionActions}>
            <span class={styles.conceptBadge}>Playable room · pilot</span>
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

          <div class={styles.stageHeading} inert={drawerOpen()}>
            <div class={styles.stageCopy}>
              <span class={styles.stageKicker}>
                <i aria-hidden="true" /> {stageCopy().kicker}
              </span>
              <h1>{stageCopy().title}</h1>
            </div>
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

          <Show when={view() === 'pocket'}>
            <PocketRing transport={transport} inactive={drawerOpen()} />
          </Show>
          <Show when={view() !== 'pocket'}>
            <div
              class={styles.sessionStageView}
              data-session-view={view()}
              inert={drawerOpen()}
            >
              <Show when={view() === 'seat'}>
                <DrummerSeatView
                  session={sessionState}
                  playheadBeat={() => transport().positionBeats}
                  scoreIndex={sessionScoreIndex}
                  liveHits={seatLiveHits}
                />
              </Show>
              <Show when={view() === 'score'}>
                <DrumScoreSheet
                  session={sessionState}
                  playheadBeat={() => transport().positionBeats}
                  scoreIndex={sessionScoreIndex}
                  visibleBarCount={() => (compactScore() ? 2 : 4)}
                />
              </Show>
              <Show when={readySession() === null}>
                <button
                  class={styles.sessionStageImport}
                  type="button"
                  onClick={() => openWorkspace('songs')}
                >
                  Open a drum part
                </button>
              </Show>
              <Show when={readySession() !== null}>
                <p
                  class={styles.authoredPlaybackNotice}
                  data-status={schedulerSnapshot().status}
                  role="note"
                >
                  {authoredPlaybackCopy()}
                </p>
              </Show>
            </div>
          </Show>

          <aside
            class={styles.phraseCoach}
            aria-label="Session phrase coach"
            inert={drawerOpen()}
          >
            <DrumSessionCoach
              session={sessionState}
              playheadBeat={() => transport().positionBeats}
              capturedHits={capturedSessionHits}
              scoreIndex={sessionScoreIndex}
              onRequestRecoveryLoop={applyRecoveryLoop}
            />
          </aside>

          <button
            class={styles.coachCue}
            type="button"
            inert={drawerOpen()}
            onClick={() => openWorkspace('coach')}
            aria-label="Open live take monitor"
          >
            <span class={styles.coachOrb}>
              <AudioWave />
            </span>
            <span>
              <strong>
                {readySession() === null
                  ? 'Load a part to coach a take.'
                  : retainedTakeHitCount() === 0
                    ? 'Play the imported phrase once.'
                    : omittedTakeHitCount() === 0
                      ? `${retainedTakeHitCount()} strikes ready to compare.`
                      : `${retainedTakeHitCount()} strikes ready · ${omittedTakeHitCount()} older not retained.`}
              </strong>
              <small>
                {readySession() === null
                  ? 'MIDI and Guitar Pro percussion are supported.'
                  : 'Uses authored attacks and captured event timing.'}
              </small>
            </span>
            <ChevronDown />
          </button>

          <Show when={transport().loop !== null}>
            <button
              class={styles.activeLoopControl}
              type="button"
              inert={drawerOpen()}
              onClick={toggleLoop}
              aria-label={`Clear active ${loopStatusCopy()}`}
            >
              <Loop />
              <span>
                <strong>{loopStatusCopy()}</strong>
                <small>Clear loop</small>
              </span>
              <X />
            </button>
          </Show>

          <button
            class={styles.sheetScrim}
            type="button"
            aria-label="Close rack drawer"
            onClick={closeWorkspace}
            tabindex={drawerOpen() ? 0 : -1}
            aria-hidden={!drawerOpen()}
            inert={!drawerOpen()}
          />
          <section
            ref={drawerRef}
            class={styles.workbench}
            role="dialog"
            aria-modal="true"
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
                  class={styles.workspaceView}
                  id="drum-workbench-panel-groove"
                  role="tabpanel"
                  aria-labelledby="drum-workbench-tab-groove"
                >
                  <div class={styles.workspaceCopy}>
                    <span>Groove mirror</span>
                    <h3>Neo-soul pocket</h3>
                    <p>
                      One authored visual bar. Variations preserve its preview
                      hits; they do not alter imported-session playback.
                    </p>
                  </div>
                  <div
                    class={styles.grooveLanes}
                    aria-label="Illustrative groove lanes"
                  >
                    <For
                      each={
                        [
                          ['Hat', [1, 0, 1, 0, 1, 0, 1, 0]],
                          ['Snare', [0, 1, 0, 0, 0, 1, 0, 0]],
                          ['Kick', [1, 0, 0, 1, 0, 0, 1, 0]],
                        ] as const
                      }
                    >
                      {(lane) => (
                        <div>
                          <b>{lane[0]}</b>
                          <span>
                            <For each={lane[1]}>
                              {(on) => (
                                <i class={on === 1 ? styles.on : undefined} />
                              )}
                            </For>
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                  <div
                    class={styles.variationSwitch}
                    role="group"
                    aria-label="Groove variation"
                  >
                    <For each={['Source', 'Tight', 'Loose', 'Half-time']}>
                      {(item) => (
                        <button
                          class={
                            variation() === item ? styles.isSelected : undefined
                          }
                          type="button"
                          aria-label={item}
                          aria-pressed={variation() === item}
                          onClick={() => {
                            setVariation(item)
                            showToast(
                              `${item} visual guide selected. It does not change playback yet.`,
                            )
                          }}
                        >
                          <span>{item}</span>
                          <Show when={variation() === item}>
                            <em class={styles.selectionMark} aria-hidden="true">
                              Selected
                            </em>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
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
                  class={styles.workspaceView}
                  id="drum-workbench-panel-mix"
                  role="tabpanel"
                  aria-labelledby="drum-workbench-tab-mix"
                >
                  <div class={styles.workspaceCopy}>
                    <span>Session mix</span>
                    <h3>Keep the kit in front.</h3>
                    <p>
                      Kit level is live. Click, backing and guide controls stay
                      unavailable until those sources exist.
                    </p>
                  </div>
                  <div class={styles.mixerStrips}>
                    <label>
                      <span>Kit · {kitVolume()}%</span>
                      <input
                        aria-label="Kit level"
                        type="range"
                        min="0"
                        max="100"
                        value={kitVolume()}
                        onInput={(event) => {
                          const value = Number(event.currentTarget.value)
                          setKitVolume(value)
                          player.setVolume(value / 100)
                        }}
                      />
                    </label>
                    <For each={['Click', 'Backing', 'Guide']}>
                      {(strip) => (
                        <label class={styles.unavailableStrip}>
                          <span>{strip} · not loaded</span>
                          <input
                            aria-label={`${strip} level unavailable`}
                            type="range"
                            min="0"
                            max="100"
                            value="0"
                            disabled
                          />
                        </label>
                      )}
                    </For>
                  </div>
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
                      Room art is visual only. It never changes the kit, mix, or
                      ambience. Your choice stays on this device and supporter
                      access is checked from the server.
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
                      Play a two-bar backbeat with touch or computer keys now.
                      Connect an e-kit from Input when you want velocity and
                      channel-preserving MIDI strikes.
                    </p>
                  </div>
                  <button
                    class={styles.largeRecovery}
                    type="button"
                    onClick={startFirstPocket}
                  >
                    Start silent take clock at 82 BPM
                  </button>
                </div>
              </Match>
              <Match when={workspace() === 'songs'}>
                <div class={cx('workspaceView', 'sessionImportWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>Bring a drum part</span>
                    <h3>Open MIDI or Guitar Pro.</h3>
                    <p>
                      Percussion tracks keep their articulation, tempo, meter,
                      and velocity. Pitched tracks remain in the source without
                      becoming drum sounds.
                    </p>
                  </div>
                  <div
                    class={cx(
                      'sessionDropZone',
                      draggingSessionFile() && 'isDragging',
                    )}
                    role="group"
                    aria-label="Drop a drum session file"
                    aria-busy={sessionState().status === 'loading'}
                    onDragEnter={(event) => {
                      event.preventDefault()
                      setDraggingSessionFile(true)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      if (event.dataTransfer !== null) {
                        event.dataTransfer.dropEffect = 'copy'
                      }
                      setDraggingSessionFile(true)
                    }}
                    onDragLeave={(event) => {
                      if (
                        event.currentTarget.contains(
                          event.relatedTarget as Node,
                        )
                      )
                        return
                      setDraggingSessionFile(false)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      importSessionFile(
                        event.dataTransfer?.files.item(0) ?? undefined,
                      )
                    }}
                  >
                    <FileUpload />
                    <span>
                      <strong>
                        {sessionState().status === 'loading'
                          ? 'Reading the newest selection'
                          : 'Drop the drum part here'}
                      </strong>
                      <small>
                        .mid, .midi, .gp, .gp3, .gp4, .gp5, or .gpx · 20 MB
                        maximum
                      </small>
                    </span>
                    <input
                      ref={sessionFileInputRef}
                      class={styles.visuallyHiddenInput}
                      type="file"
                      tabindex="-1"
                      accept=".mid,.midi,.gp,.gp3,.gp4,.gp5,.gpx,audio/midi,audio/x-midi"
                      aria-label="Choose a drum session file"
                      onChange={(event) => {
                        importSessionFile(
                          event.currentTarget.files?.item(0) ?? undefined,
                        )
                        event.currentTarget.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => sessionFileInputRef?.click()}
                    >
                      {sessionState().status === 'loading'
                        ? 'Choose a different part'
                        : 'Choose drum part'}
                    </button>
                  </div>
                  <div
                    class={styles.sessionImportStatus}
                    data-tone={sessionImportCopy()?.tone ?? 'neutral'}
                    role={
                      sessionImportCopy()?.tone === 'error' ? 'alert' : 'status'
                    }
                    aria-live="polite"
                  >
                    <span aria-hidden="true" />
                    <div>
                      <strong>{sessionImportCopy()?.title}</strong>
                      <p>{sessionImportCopy()?.detail}</p>
                      <Show when={sessionState().status === 'ready'}>
                        <button type="button" onClick={clearImportedSession}>
                          Clear imported part
                        </button>
                      </Show>
                      <Show when={sessionState().status === 'loading'}>
                        <button type="button" onClick={cancelSessionImport}>
                          Cancel import
                        </button>
                      </Show>
                    </div>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'coach'}>
                <div class={cx('workspaceView', 'sessionCoachWorkspace')}>
                  <DrumSessionCoach
                    session={sessionState}
                    playheadBeat={() => transport().positionBeats}
                    capturedHits={capturedSessionHits}
                    scoreIndex={sessionScoreIndex}
                    onRequestRecoveryLoop={applyRecoveryLoop}
                  />
                </div>
              </Match>
            </Switch>
            <div
              class={styles.drawerTouchKit}
              role="group"
              aria-label="Rack drawer drum pads"
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
          </section>
        </section>

        <div
          class={styles.touchKit}
          role="group"
          aria-label="Touch drum pads"
          inert={inputOpen() || drawerOpen()}
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

        <div class={styles.consoleBridge} inert={inputOpen() || drawerOpen()}>
          <button
            class={styles.consoleModule}
            type="button"
            aria-pressed={transport().countInBeats > 0}
            onClick={() => {
              const enabled = transport().countInBeats === 0
              runtime.setCountInBeats(enabled ? 4 : 0)
              showToast(
                enabled
                  ? 'Four-beat visual count-in enabled. No click is scheduled.'
                  : 'Visual count-in disabled.',
              )
            }}
          >
            <Metronome />
            <span>
              <small>Count-in</small>
              <strong>
                {transport().countInBeats > 0
                  ? `${transport().countInBeats} beats · visual`
                  : 'Off'}
              </strong>
            </span>
          </button>
          <div class={styles.tempoModule} aria-label="Tempo">
            <button
              type="button"
              onClick={() => changeTempo(-2)}
              aria-label="Decrease tempo"
            >
              <Minus />
            </button>
            <span>
              <strong>{transport().tempoBpm}</strong>
              <small>BPM</small>
            </span>
            <button
              type="button"
              onClick={() => changeTempo(2)}
              aria-label="Increase tempo"
            >
              <Plus />
            </button>
          </div>
          <div class={styles.playCradle}>
            <button
              class={styles.playButton}
              type="button"
              onClick={togglePlaying}
              aria-label={`${isPlaying() ? 'Pause' : 'Play'} ${sessionTitle()} take clock`}
            >
              {isPlaying() ? <Pause /> : <Play />}
              <span>{isPlaying() ? 'Pause' : 'Play'}</span>
            </button>
            <button
              class={styles.stopButton}
              type="button"
              disabled={transport().phase === 'stopped'}
              onClick={stopTake}
              aria-label="Stop and return the take clock to beat one"
            >
              <Square />
            </button>
          </div>
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
          <button
            class={cx('consoleModule', 'compactModule')}
            type="button"
            aria-pressed={transport().loop !== null}
            onClick={toggleLoop}
          >
            <Loop />
            <span>
              <small>Practice loop</small>
              <strong>{loopStatusCopy()}</strong>
            </span>
          </button>
        </div>

        <nav
          class={styles.mobileNav}
          aria-label="Drum Night navigation"
          inert={inputOpen() || drawerOpen()}
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
            aria-label={`${isPlaying() ? 'Pause' : 'Play'} ${sessionTitle()} take clock`}
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
              inert={inputOpen() || drawerOpen()}
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
