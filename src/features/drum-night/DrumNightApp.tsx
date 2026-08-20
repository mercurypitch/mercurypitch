// ============================================================
// Drum Night — silent-first Pocket Console percussion room
// ============================================================
//
// This standalone surface owns one transport, audio graph and input clock.
// First paint remains visual-only: Web Audio, sample requests and WebMIDI are
// crossed synchronously only by an explicit Play, strike or Connect action.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { AudioWave, ChevronDown, Drum, Loop, MercuryPlanet, Metronome, MidiDin, Minus, MusicLibrary, MusicNote, Pause, Play, Plus, SlidersHorizontal, Square, WaveformBars, X, } from '@/components/icons'
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

type StageView = 'pocket' | 'score' | 'kit'
type Workspace = 'groove' | 'kit' | 'mix' | 'room' | 'learn' | 'songs' | 'coach'
type PadId = EssentialDrumPadId

interface DrumNightAppProps {
  readonly createAudioSession?: () => DrumNightAudioSession
  readonly createPlayer?: (options: DrumKitPlayerOptions) => DrumKitPlayer
  readonly runtimeOptions?: Omit<DrumNightRuntimeOptions, 'player'>
}

const STAGE_VIEWS: readonly StageView[] = ['pocket', 'score', 'kit']
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
  readonly transport: () => DrumTransportState
}

function PocketRing(props: PocketRingProps): JSX.Element {
  const primaryCopy = createMemo(() => transportPrimaryCopy(props.transport()))
  return (
    <div class={styles.pocketView} data-testid="drum-night-pocket-view">
      <svg
        class={styles.pocketRing}
        viewBox="0 0 1000 620"
        role="img"
        aria-labelledby="drum-pocket-title drum-pocket-description"
      >
        <title id="drum-pocket-title">Pocket Ring for bar nine</title>
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

      <div class={styles.nowCapsule} aria-live="polite">
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

function ScoreView(): JSX.Element {
  const noteXs = [92, 156, 270, 334, 448, 512, 626, 690]
  return (
    <div class={styles.scoreView} data-testid="drum-night-score-view">
      <div
        class={styles.scorePanel}
        aria-label="Illustrative percussion score for bars nine through twelve"
      >
        <div class={styles.scoreHeading}>
          <span>Midnight Pocket</span>
          <small>bars 9–12</small>
        </div>
        <svg
          viewBox="0 0 820 330"
          role="img"
          aria-label="Illustrative percussion notation"
        >
          <g class={styles.staffLines}>
            <path d="M54 90h714M54 112h714M54 134h714M54 156h714M54 178h714" />
            <path d="M232 82v104M410 82v104M588 82v104M768 82v104" />
          </g>
          <g class={styles.scoreNotes}>
            <For each={noteXs}>
              {(x, index) => (
                <>
                  <path d={`m${x} 80 10 10m0-10-10 10m5 0v50`} />
                  <ellipse
                    cx={x + 32}
                    cy={index() % 2 === 0 ? 156 : 134}
                    rx="8"
                    ry="6"
                  />
                  <path d={`M${x + 40} ${index() % 2 === 0 ? 154 : 132}v-48`} />
                </>
              )}
            </For>
          </g>
          <g class={styles.scoreAccents}>
            <path d="m178 66 12-7 12 7M356 66l12-7 12 7M534 66l12-7 12 7M712 66l12-7 12 7" />
          </g>
          <path class={styles.scorePlayhead} d="M420 58v148" />
          <text class={styles.scoreCopy} x="74" y="238">
            Kick and snare anchor the pocket. Hi-hat opens on the final eighth.
          </text>
          <text class={styles.scoreMuted} x="74" y="270">
            Authored preview · GM articulations · no sticking inferred
          </text>
        </svg>
      </div>
    </div>
  )
}

interface KitViewProps {
  activeHit: () => PadId | null
  onHit: (pad: PadId, velocity: number) => void
  selectedKitName: () => string
}

function KitView(props: KitViewProps): JSX.Element {
  return (
    <div class={styles.kitView} data-testid="drum-night-kit-view">
      <div class={styles.kitIntro}>
        <span>Playable kit · {props.selectedKitName()}</span>
        <h2>Strike the room.</h2>
        <p>
          Use the pads or keys 1–6. Sampled kits warm after your first action;
          Mercury Synth covers every hit while they load.
        </p>
      </div>
      <div class={styles.kitHotspots} aria-label="Playable drum-kit preview">
        <For each={ESSENTIAL_DRUM_PADS}>
          {(pad) => (
            <button
              class={cx(
                'kitHotspot',
                `hotspot${pad.id === 'hi-hat' ? 'Hat' : pad.id[0].toUpperCase() + pad.id.slice(1)}` as keyof typeof styles,
                props.activeHit() === pad.id && 'isHit',
              )}
              type="button"
              onPointerDown={(event) => {
                if (!acceptsPadPointer(event)) return
                props.onHit(pad.id, pointerVelocity(event))
              }}
              onClick={(event) => {
                if (event.detail === 0) props.onHit(pad.id, 100)
              }}
              aria-label={`${pad.label}, key ${pad.keyboardLabel}`}
              aria-keyshortcuts={pad.keyboardLabel}
            >
              <span>{pad.label}</span>
              <kbd>{pad.keyboardLabel}</kbd>
            </button>
          )}
        </For>
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
  const [selectedKitId, setSelectedKitId] = createPersistedSignal<DrumKitId>(
    KIT_STORAGE_KEY,
    'mercury-synth',
    {
      validator: isDrumKitId,
    },
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
  let toastTimer: number | undefined
  let hitTimer: number | undefined
  let calibrationTimer: number | undefined
  let calibrationInputId: string | null = null
  let calibrationLastSampleCount = 0

  const transport = runtime.transportState
  const isPlaying = createMemo(() => transportIsRunning(transport()))
  const selectedKit = createMemo(() =>
    drumKitManifest(kitSnapshot().selectedKitId),
  )
  const currentBar = createMemo(
    () => Math.floor(transport().positionBeats / 4) + 1,
  )
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

  const updateUrl = (
    nextView: StageView,
    nextDrawer: Workspace | null,
  ): void => {
    const url = new URL(window.location.href)
    if (nextView === 'pocket') url.searchParams.delete('view')
    else url.searchParams.set('view', nextView)
    if (nextDrawer === null) url.searchParams.delete('drawer')
    else url.searchParams.set('drawer', nextDrawer)
    window.history.replaceState({}, '', url)
  }

  const showToast = (message: string): void => {
    if (toastTimer !== undefined) window.clearTimeout(toastTimer)
    setLiveMessage(message)
    setToastVisible(true)
    toastTimer = window.setTimeout(() => setToastVisible(false), 2600)
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

  const togglePlaying = (): void => {
    const phase = transport().phase
    if (phase === 'playing' || phase === 'count-in') {
      runtime.pause()
      showToast('Take clock paused. Live voices released.')
      return
    }
    showToast(
      'Starting the take clock. No backing track or click is scheduled.',
    )
    void runtime.play()
  }

  const changeTempo = (delta: number): void => {
    const nextTempo = Math.max(40, Math.min(280, transport().tempoBpm + delta))
    runtime.setTempoBpm(nextTempo)
    showToast(`Tempo set to ${nextTempo} BPM.`)
  }

  const triggerPad = (padId: PadId, velocity = 100): void => {
    runtime.strikePad(padId, velocity)
  }

  const startFirstPocket = (): void => {
    runtime.setTempoBpm(82)
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
    const nextLoop =
      transport().loop === null ? { startBeat: 0, endBeat: 8 } : null
    runtime.setLoop(nextLoop)
    showToast(
      nextLoop === null
        ? 'Two-bar transport loop cleared.'
        : 'Two-bar transport loop enabled.',
    )
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
    initialFocus: () =>
      drawerRef?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      drawerRef,
  })

  useFocusTrap(() => inputRef, {
    isOpen: inputOpen,
    onClose: closeInput,
    initialFocus: () =>
      inputRef?.querySelector<HTMLElement>('[data-input-primary="true"]') ??
      inputRef,
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
    hitTimer = window.setTimeout(() => setActiveHit(null), 150)
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
    const params = new URLSearchParams(window.location.search)
    const initialView = params.get('view')
    if (STAGE_VIEWS.includes(initialView as StageView))
      setView(initialView as StageView)
    const initialDrawer = params.get('drawer')
    if (initialDrawer !== null && initialDrawer in WORKSPACE_TITLES) {
      setWorkspace(initialDrawer as Workspace)
      setDrawerOpen(true)
    }

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

    document.addEventListener('pointerdown', onPointerDown)
    onCleanup(() => {
      uninstallSpace()
      document.removeEventListener('pointerdown', onPointerDown)
    })
  })

  onCleanup(() => {
    unsubscribeKit()
    cancelCalibration()
    if (toastTimer !== undefined) window.clearTimeout(toastTimer)
    if (hitTimer !== undefined) window.clearTimeout(hitTimer)
    void audioSession.dispose()
  })

  return (
    <div
      class={styles.shell}
      data-testid="drum-night-shell"
      data-playing={isPlaying() ? 'true' : 'false'}
      data-drawer-open={drawerOpen() ? 'true' : 'false'}
      data-view={view()}
    >
      <a class={styles.skipLink} href="#drum-night-stage">
        Skip to the drum stage
      </a>

      <aside
        class={styles.roomRail}
        aria-label="Drum Night sections"
        inert={inputOpen()}
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
        <header class={styles.sessionBar} inert={inputOpen()}>
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
              <strong>Midnight Pocket</strong>
              <small>
                A minor <i /> Neo-soul <i /> {transport().tempoBpm} BPM
              </small>
            </span>
            <ChevronDown />
          </button>
          <div
            class={styles.barMap}
            aria-label={`Current bar ${currentBar()}, unbounded take`}
          >
            <span class={styles.barLabel}>Bar {currentBar()}</span>
            <span class={styles.barExtent} aria-hidden="true">
              <i /> Unbounded take
            </span>
          </div>
          <div class={styles.sessionActions}>
            <span class={styles.conceptBadge}>Live kit foundation</span>
            <button
              ref={inputButtonRef}
              class={styles.inputChip}
              type="button"
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
              <span class={styles.inputCopy}>
                <strong>{midiHeadline()}</strong>
                <small>{midiDetail()}</small>
              </span>
              <ChevronDown />
            </button>
            <button
              class={styles.roomChip}
              type="button"
              onClick={() => openWorkspace('room')}
            >
              <span class={styles.roomChipArt} aria-hidden="true" />
              <span>
                <strong>Pocket Console</strong>
                <small>Tracking room</small>
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
          <div class={styles.stageShade} aria-hidden="true" />
          <div class={styles.stageVignette} aria-hidden="true" />

          <div class={styles.stageHeading}>
            <div class={styles.stageCopy}>
              <span class={styles.stageKicker}>
                <i aria-hidden="true" /> Live take
              </span>
              <h1>
                Find the centre.
                <br />
                Let it move.
              </h1>
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
                    onClick={() => selectView(item)}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                )}
              </For>
            </div>
          </div>

          <Show when={view() === 'pocket'}>
            <PocketRing transport={transport} />
          </Show>
          <Show when={view() === 'score'}>
            <ScoreView />
          </Show>
          <Show when={view() === 'kit'}>
            <KitView
              activeHit={activeHit}
              onHit={triggerPad}
              selectedKitName={() => selectedKit().name}
            />
          </Show>

          <aside class={styles.phraseCoach} aria-label="Live take monitor">
            <div class={styles.coachHeading}>
              <span>
                <i aria-hidden="true" /> Take monitor
              </span>
              <small>
                {transport().recording ? 'Recording armed' : 'Not recording'}
              </small>
            </div>
            <span class={styles.coachWindow}>This take</span>
            <h2>
              {runtime.recordedHits().length === 0
                ? 'Play the phrase once.'
                : `${runtime.recordedHits().length} strikes captured.`}
            </h2>
            <p>
              {runtime.recordedHits().length === 0 ? (
                <>
                  Arm recording, start the take clock, then play with touch,
                  keys, or a connected e-kit.
                </>
              ) : (
                <>
                  Latest event: <b>{lastHit()}</b>. Coaching waits for an
                  authored phrase; this view reports only captured evidence.
                </>
              )}
            </p>
            <div
              class={styles.timingEvidence}
              aria-label="Recorded strike timing around the nearest sixteenth"
            >
              <div class={styles.timingAxis}>
                <span>early</span>
                <i />
                <span>late</span>
              </div>
              <div class={styles.timingMarks} aria-hidden="true">
                <Show
                  when={runtime.recordedHits().length > 0}
                  fallback={
                    <span class={styles.emptyEvidence}>No take data</span>
                  }
                >
                  <For each={runtime.recordedHits().slice(-5)}>
                    {(hit) => (
                      <i
                        class={cx(
                          'mark',
                          hit.timingOffsetMs < -12
                            ? 'teal'
                            : hit.timingOffsetMs > 12
                              ? 'coral'
                              : 'ivory',
                        )}
                        style={{
                          left: `${50 + Math.max(-38, Math.min(38, hit.timingOffsetMs / 3))}%`,
                          height: `${18 + Math.round((hit.velocity / 127) * 24)}px`,
                        }}
                      />
                    )}
                  </For>
                </Show>
              </div>
            </div>
            <button
              class={styles.recoveryAction}
              type="button"
              onClick={startFirstPocket}
            >
              <span class={styles.recoveryIcon}>
                <Loop />
              </span>
              <span>
                <strong>Start a two-bar take at 82 BPM</strong>
                <small>Four-beat visual count-in · no click</small>
              </span>
              <ChevronDown />
            </button>
            <button
              class={styles.quietAction}
              type="button"
              disabled={runtime.recordedHits().length === 0}
              onClick={() => {
                runtime.clearRecording()
                showToast('Captured hit events cleared from this take.')
              }}
            >
              Clear captured hits
            </button>
            <div class={styles.privacyNote}>
              <span class={styles.privacyMark} aria-hidden="true" />
              <span>
                <strong>On-device event timing</strong>
                <small>No microphone or audio recording is used.</small>
              </span>
            </div>
          </aside>

          <button
            class={styles.coachCue}
            type="button"
            onClick={() => openWorkspace('coach')}
            aria-label="Open live take monitor"
          >
            <span class={styles.coachOrb}>
              <AudioWave />
            </span>
            <span>
              <strong>
                {runtime.recordedHits().length === 0
                  ? 'Arm a take.'
                  : `${runtime.recordedHits().length} strikes captured.`}
              </strong>
              <small>Measured coaching starts after an authored phrase.</small>
            </span>
            <ChevronDown />
          </button>

          <button
            class={styles.sheetScrim}
            type="button"
            aria-label="Close rack drawer"
            onClick={closeWorkspace}
            tabindex={drawerOpen() ? 0 : -1}
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
              <div
                class={styles.workbenchTabs}
                role="tablist"
                aria-label="Drum workbench"
              >
                <For each={WORKBENCH_TABS}>
                  {(item, index) => (
                    <button
                      class={workspace() === item ? styles.isActive : undefined}
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
                      One authored bar. Variations preserve the source hits and
                      remain a visual arrangement preview until song scheduling
                      arrives.
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
                          onClick={() => {
                            setVariation(item)
                            showToast(
                              `${item} visual guide selected. It does not change playback yet.`,
                            )
                          }}
                        >
                          {item}
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
                    <h3>Pocket Console</h3>
                    <p>
                      Preview art first. Kit and reverb never change without
                      separate confirmation.
                    </p>
                  </div>
                  <div class={styles.roomOptions}>
                    <div class={styles.isSelected}>
                      <span class={cx('roomThumb', 'pocketThumb')} />
                      <strong>Pocket Console</strong>
                      <small>Current visual</small>
                    </div>
                    <div>
                      <span class={cx('roomThumb', 'tapeThumb')} />
                      <strong>Tape Room</strong>
                      <small>Planned room</small>
                    </div>
                    <div>
                      <span class={cx('roomThumb', 'daylightThumb')} />
                      <strong>Daylight Riser</strong>
                      <small>Planned room</small>
                    </div>
                  </div>
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
                <div class={cx('workspaceView', 'simpleWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>Bring a drum part</span>
                    <h3>Open MIDI or Guitar Pro.</h3>
                    <p>
                      Percussion tracks remain articulations. Unsupported
                      mappings fail visibly and never play as pitches.
                    </p>
                  </div>
                  <div class={styles.songActions}>
                    <button type="button" disabled>
                      Local import planned
                    </button>
                    <button type="button" disabled>
                      Prepared parts planned
                    </button>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'coach'}>
                <div class={cx('workspaceView', 'simpleWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>Take monitor</span>
                    <h3>
                      {runtime.recordedHits().length === 0
                        ? 'Play the phrase once.'
                        : `${runtime.recordedHits().length} strikes are on the clock.`}
                    </h3>
                    <p>
                      Drum Night preserves source, articulation, velocity and
                      timing. It does not claim a coaching result until an
                      authored phrase supplies the target.
                    </p>
                  </div>
                  <button
                    class={styles.largeRecovery}
                    type="button"
                    onClick={startFirstPocket}
                  >
                    Start two-bar take
                  </button>
                </div>
              </Match>
            </Switch>
          </section>
        </section>

        <div
          class={styles.touchKit}
          aria-label="Touch drum pads"
          inert={inputOpen()}
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

        <div class={styles.consoleBridge} inert={inputOpen()}>
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
              aria-label={`${isPlaying() ? 'Pause' : 'Play'} Midnight Pocket take clock`}
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
                  ? `Armed · ${runtime.recordedHits().length} hits`
                  : `${runtime.recordedHits().length} hits · off`}
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
              <strong>{transport().loop === null ? 'Off' : 'Two bars'}</strong>
            </span>
          </button>
        </div>

        <nav
          class={styles.mobileNav}
          aria-label="Drum Night navigation"
          inert={inputOpen()}
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
            aria-label={`${isPlaying() ? 'Pause' : 'Play'} Midnight Pocket take clock`}
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
            <span>Record</span>
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
            <div class={styles.runtimeAlert} role="alert" inert={inputOpen()}>
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
          role="status"
          aria-live="polite"
        >
          {liveMessage()}
        </div>
      </main>
    </div>
  )
}
