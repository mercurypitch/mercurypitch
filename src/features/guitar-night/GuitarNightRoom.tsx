// Guitar Night Room turns a prepared backing into a deliberate, silent-until-play stage.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ChevronLeft, Crosshair, MusicNote, Pause, Play, Settings, SkipBack, SlidersHorizontal, Volume2, } from '@/components/icons'
import { LoopRangeRail } from '@/components/shared/LoopRangeRail'
import type { GuitarBackingSession, GuitarBackingTransportStatus, } from '@/features/guitar/backing/guitar-backing-transport'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { clampRate, MAX_RATE, MIN_RATE, } from '@/features/guitar-practice/practice-rate'
import { registerMusicPlayingSource, registerVoiceCommands, } from '@/features/voice-control/voice-command-registry'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import { MIN_LOOP_LENGTH } from '@/lib/guitar/loop-span'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { createGuitarNightPerformanceAdapter } from './createGuitarNightPerformanceAdapter'
import { createGuitarNightVoiceCommands } from './guitar-night-voice-commands'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightInputNotice } from './GuitarNightInputNotice'
import type { GuitarNightDoctorView } from './GuitarNightJamDoctor'
import { GuitarNightDoctorCue, GuitarNightJamDoctor, } from './GuitarNightJamDoctor'
import type { GuitarNightListeningSelection } from './GuitarNightListeningCycle'
import { GuitarNightListeningCycle } from './GuitarNightListeningCycle'
import { GuitarNightListeningQuickControls } from './GuitarNightListeningQuickControls'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'
import songStyles from './GuitarNightRoom.module.css'
import { GuitarNightSongMixer } from './GuitarNightSongMixer'
import { GuitarNightSongSession } from './GuitarNightSongSession'
import { GuitarNightStage } from './GuitarNightStage'
import { GuitarNightTunerExperience } from './GuitarNightTunerExperience'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightBackingLease, GuitarNightStemKind } from './song-port'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightAmpSettings } from './useGuitarNightAmpSettings'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import { useGuitarNightSongPlayback } from './useGuitarNightSongPlayback'
import { useGuitarNightTunerController } from './useGuitarNightTunerController'

interface GuitarNightRoomProps {
  backing: GuitarNightBackingLease
  transport: GuitarBackingTransportController
  /** The attached score, when one is verified. Absent keeps the room in free play. */
  reference?: Accessor<GuitarNightReference | null>
  /** The instrument the stage rows describe. Absent means a standard six-string. */
  tuning?: Accessor<InstrumentTuning>
  onInstrument?(instrument: StringedInstrument): void
  onStringCount?(count: number): void
  onTuning?(tuning: InstrumentTuning): void
  /** A room-level sheet parks every side effect while preserving room state. */
  suspended?: Accessor<boolean>
  onSongs(): void
  onSeparateGuitar?(): void
  /**
   * A tab attached in the lobby. It cannot guide THIS room — an authored tab
   * carries its own nominal tempo and nothing has aligned it to the
   * recording — but the room has to say so. Reported as: "in the room itself,
   * it says, attach tab to play along, but I don't have any option to attach
   * it afterwards", by a player who had already attached one.
   */
  authoredReference?: Accessor<GuitarNightReference | null>
  /** Open the tab room, where an authored tab does play. */
  onRehearseTab?(): void
  /** Go back for a tab; the lobby owns the picker and the file drop. */
  onAttachTab?(): void
  /**
   * Hanging a written part on this recording by hand.
   *
   * The room owns the gesture because the room owns the recording's clock: a
   * mark means nothing without a moment to mark. Absent means nobody has
   * claimed a part to place, so the controls are not offered.
   */
  handSync?: Accessor<GuitarNightRoomHandSync | null>
}

/** What the room needs to offer hand placement, and where to send the marks. */
export interface GuitarNightRoomHandSync {
  partName: string
  firstMarkSeconds: number | null
  lastMarkSeconds: number | null
  placed: boolean
  onMark(end: 'first' | 'last', audioSeconds: number): void
  onClear(): void
  onNudge(deltaSeconds: number): void
}

const STEM_LABELS: Record<GuitarNightStemKind, string> = {
  vocal: 'Vocals',
  instrumental: 'Backing',
  drums: 'Drums',
  bass: 'Bass',
  guitar: 'Guitar',
  piano: 'Keys',
  other: 'Other',
}

const EMPTY_STAGE_NOTES: readonly GuitarNote[] = []

export function guitarNightBackingSession(
  backing: GuitarNightBackingLease,
): GuitarBackingSession {
  return {
    sessionId: backing.sessionId,
    title: backing.title,
    tracks: backing.stems.map((stem) => ({
      id: stem.kind,
      label: STEM_LABELS[stem.kind],
      url: stem.url,
      sizeBytes: stem.sizeBytes,
      durationSeconds: stem.durationSeconds,
      muted: backing.defaultMix.muted.some((kind) => kind === stem.kind),
    })),
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

function playLabel(status: GuitarBackingTransportStatus): string {
  if (status === 'playing') return 'Pause backing'
  if (status === 'loading') return 'Cancel backing start'
  if (status === 'paused') return 'Resume backing'
  if (status === 'complete') return 'Play again'
  return 'Play backing'
}

function statusCopy(status: GuitarBackingTransportStatus): string {
  if (status === 'playing') return 'Backing is playing'
  // Not always local: the demo song's stems come off the network, and
  // saying otherwise while eight megabytes arrive is how a slow download
  // came to look like a broken button.
  if (status === 'loading') return 'Getting the song ready'
  if (status === 'paused') return 'Backing paused'
  if (status === 'complete') return 'Song complete'
  if (status === 'error') return 'Playback needs attention'
  return 'Ready when you are'
}

export function GuitarNightRoom(props: GuitarNightRoomProps) {
  let roomHeading!: HTMLHeadingElement
  let doctorTrigger: HTMLButtonElement | undefined
  let tunerTrigger: HTMLButtonElement | undefined
  const [doctorOpen, setDoctorOpen] = createSignal(false)
  const [tunerOpen, setTunerOpen] = createSignal(false)
  const [mixerOpen, setMixerOpen] = createSignal(false)
  const [sessionOpen, setSessionOpen] = createSignal(false)
  const [sessionHandPlacement, setSessionHandPlacement] = createSignal(false)
  const [listeningRoutePending, setListeningRoutePending] = createSignal(false)
  let disposed = false
  onCleanup(() => {
    disposed = true
  })

  function openHandPlacement(): void {
    setSessionHandPlacement(true)
    setSessionOpen(true)
  }

  const amp = useGuitarNightAmpSettings()
  createEffect(() => props.transport.setElectricAmpParameters(amp.parameters()))
  const listening = useGuitarListeningController({
    activateAudio: () => props.transport.activate(),
    getAudioGraph: () => props.transport.getAudioGraph(),
    ampParameters: amp.parameters,
  })
  const roomTuning = createMemo(
    () => props.tuning?.() ?? standardTuning('guitar'),
  )
  const tuner = useGuitarNightTunerController({
    tuning: roomTuning,
    listening,
    activateAudio: () => props.transport.activate(),
    getAudioGraph: () => props.transport.getAudioGraph(),
    pausePlayback: () => props.transport.pause(),
    onTuning: (next) => props.onTuning?.(next),
  })
  const reference = createMemo(() => props.reference?.() ?? null)
  const performance = createGuitarNightPerformanceAdapter(
    () => props.transport,
    () => props.backing.title,
    () => reference()?.notes ?? EMPTY_STAGE_NOTES,
    () => reference()?.tempoBpm ?? null,
  )
  const isPlaying = createMemo(() => props.transport.status() === 'playing')
  const isCalibrating = createMemo(() => listening.status() === 'calibrating')
  const isLoading = createMemo(() => props.transport.status() === 'loading')
  const songPlayback = useGuitarNightSongPlayback({
    transport: () => props.transport,
    listening,
    blocked: () => props.suspended?.() === true || tunerOpen(),
    sourceIdentity: () => props.backing,
  })

  async function selectListeningRoute(
    next: GuitarNightListeningSelection,
  ): Promise<void> {
    if (
      disposed ||
      listeningRoutePending() ||
      props.suspended?.() === true ||
      tunerOpen()
    )
      return
    if (next === null) {
      songPlayback.toggleListening()
      return
    }
    const backing = props.backing
    setListeningRoutePending(true)
    try {
      await songPlayback.selectInputProfile(next)
      if (
        disposed ||
        props.backing !== backing ||
        props.suspended?.() === true ||
        tunerOpen() ||
        listening.inputProfile() !== next
      )
        return
      await songPlayback.startListening()
    } finally {
      if (!disposed) setListeningRoutePending(false)
    }
  }

  /** 0..1 across the whole song, 0 before the first byte lands. */
  const loadFraction = createMemo(() => {
    const progress = props.transport.loadProgress()
    return progress === null ? 0 : Math.min(1, Math.max(0, progress.fraction))
  })

  /**
   * Whole percent, or null when nothing declared a size — a streamed room
   * and a server with no `content-length` both land here, and a number
   * invented for them would be a lie the ring has to keep telling.
   */
  const loadPercent = createMemo(() => {
    const progress = props.transport.loadProgress()
    if (progress === null || progress.totalBytes <= 0) return null
    return Math.round(loadFraction() * 100)
  })

  const loadingDetail = createMemo(() => {
    const progress = props.transport.loadProgress()
    if (progress === null) return 'Opening the audio'
    const megabytes = progress.receivedBytes / 1_048_576
    if (progress.totalBytes > 0) {
      return `${megabytes.toFixed(1)} MB of ${(progress.totalBytes / 1_048_576).toFixed(1)} MB`
    }
    if (progress.totalTracks > 1) {
      const current = Math.min(progress.loadedTracks + 1, progress.totalTracks)
      return `Stem ${current} of ${progress.totalTracks}`
    }
    return megabytes > 0
      ? `${megabytes.toFixed(1)} MB so far`
      : 'Opening the audio'
  })

  // ── Voice commands (room-owned) ────────────────────────────
  // The same transport controller the room's buttons drive; registered for
  // the room's lifetime. Track ids are stem kinds, so the shared stem
  // vocabulary maps straight onto mute/unmute.
  const voiceCommands = createGuitarNightVoiceCommands({
    playing: () => props.transport.status() === 'playing',
    positionSeconds: () => props.transport.positionSeconds(),
    durationSeconds: () => props.transport.durationSeconds(),
    play: () => {
      void songPlayback.play()
    },
    pause: () => props.transport.pause(),
    stop: () => props.transport.stop(),
    seek: (seconds) => props.transport.seek(seconds),
    playbackRate: () => props.transport.playbackRate(),
    setPlaybackRate: (rate) => {
      void props.transport.setPlaybackRate(rate)
    },
    tracks: () =>
      props.transport
        .tracks()
        .map((t) => ({ id: t.id, muted: t.muted, available: t.available })),
    setTrackMuted: (id, muted) => props.transport.setTrackMuted(id, muted),
  })
  // A suspending sheet parks EVERY side effect (its contract, see props) —
  // spoken transport included, or "play" would punch through the sheet.
  // Read lazily per utterance by the registry, deliberately outside any
  // tracked scope — same seam as StemMixer's registration.
  onCleanup(
    // eslint-disable-next-line solid/reactivity
    registerVoiceCommands(() =>
      props.suspended?.() === true ||
      mixerOpen() ||
      sessionOpen() ||
      doctorOpen() ||
      tunerOpen() ||
      isCalibrating()
        ? []
        : voiceCommands,
    ),
  )
  // Wake-word mode must hear this stage's playback as "music rolling".
  onCleanup(
    // eslint-disable-next-line solid/reactivity
    registerMusicPlayingSource(() => props.transport.status() === 'playing'),
  )
  const isListening = createMemo(
    () =>
      listening.status() === 'listening' ||
      listening.status() === 'requesting' ||
      isCalibrating(),
  )
  const duration = createMemo(() =>
    Math.max(0, performance.transport.timeline.durationSeconds()),
  )
  const position = createMemo(() =>
    Math.min(
      duration(),
      Math.max(0, performance.transport.timeline.positionSeconds()),
    ),
  )
  const mixCopy = createMemo(() => {
    if (props.backing.defaultMix.kind === 'mixed-instrumental') {
      return 'Backing ready. Guitar remains inside this mix, so it cannot be muted independently.'
    }
    if (props.backing.defaultMix.muted.length > 0) {
      return 'Independent band parts. Adjust each track without changing the others.'
    }
    return 'Band parts are ready. No separate guitar track was found.'
  })
  const rateLabel = createMemo(
    () => `${performance.transport.playbackRate().toFixed(2)}×`,
  )
  const doctorView = createMemo<GuitarNightDoctorView | null>(() => {
    const take = listening.take()
    if (take?.lifecycle !== 'completed') return null
    const attacks = take.events.filter(
      (event) => event.kind === 'attack',
    ).length
    const observations = listening.observations()
    const hasEvidence = take.events.length > 0
    return {
      anchorLabel: `Free play · ${formatTime((take.durationFrames ?? 0) / take.clock.sampleRate)}`,
      headline: hasEvidence
        ? attacks === 1
          ? 'One fresh note start came through.'
          : `${attacks} fresh note starts came through.`
        : 'No notes heard.',
      detail: hasEvidence
        ? 'This is a signal-only take. Attach an authored tab for beat and note-start comparison.'
        : 'Try a short phrase again. Move closer, use a direct input, or quieten the room if the meter stays low.',
      evidence: observations.map((observation) => ({ ...observation })),
      unavailableReasons: [
        'No authored phrase was attached, so note accuracy and beat timing were not scored.',
        'Sustain and pitch stability need continuous note evidence.',
      ],
      recoveryLabel: 'Listen to another take',
      recoveryDetail:
        listening.inputProfile() === 'interface'
          ? 'Direct input can stay on alongside the song. Monitoring is your choice in Session.'
          : 'The backing pauses while this device listens.',
      privacyCopy:
        'Measured from this take on this device. Audio is not saved.',
    }
  })

  // The loop lives in seconds of the recording, so it survives a speed change:
  // the same bars come round again whatever rate they are played at.
  const loop = useGuitarNightLoopController({
    limit: duration,
  })
  let loopSource = untrack(() => props.backing)
  createEffect(() => {
    const next = props.backing
    if (next === loopSource) return
    loopSource = next
    loop.clear()
  })
  // Only committed marks reach the engine; the range rail owns drag preview.
  // Audio-clock wraps do not wait for a visual frame or call ordinary seek.
  createEffect(() => {
    const start = loop.markA()
    const end = loop.markB()
    // Let the engine validate against decoded duration. A duration update must
    // not turn invalid marks into an explicit Clear and erase its loop error.
    const range = start !== null && end !== null ? { start, end } : null
    const transport = props.transport
    untrack(() => transport.setLoopRange(range))
  })
  const loopPendingReason = createMemo(() => {
    if (props.transport.loopError() !== null) return 'Loop unavailable'
    const start = loop.markA()
    const end = loop.markB()
    if (start === null || end === null || loop.isLooping()) return undefined
    return start >= duration()
      ? 'Move A/B inside the song'
      : `Set A and B at least ${MIN_LOOP_LENGTH} s apart`
  })

  const nudgeRate = (delta: number): void => {
    const next = clampRate(
      Math.round((performance.transport.playbackRate() + delta) * 100) / 100,
    )
    void performance.transport.setPlaybackRate(next)
  }

  const recoverFromDoctor = (): void => {
    setDoctorOpen(false)
    listening.clearTake()
    void songPlayback.startListening()
  }

  const openTuner = (): void => {
    setDoctorOpen(false)
    setMixerOpen(false)
    setSessionOpen(false)
    setTunerOpen(true)
  }

  const closeTuner = (): void => {
    setTunerOpen(false)
    queueMicrotask(() => tunerTrigger?.focus())
  }

  const leaveRoom = (): void => {
    tuner.close()
    songPlayback.stopAll()
    props.onSongs()
  }

  createEffect(() => {
    if (props.suspended?.() !== true) return
    setDoctorOpen(false)
    setTunerOpen(false)
    setMixerOpen(false)
    setSessionOpen(false)
    tuner.close()
    listening.stop()
    props.transport.pause()
  })

  const changeVolume = (event: InputEvent): void => {
    const input = event.currentTarget as HTMLInputElement
    props.transport.setMasterVolume(Number(input.value))
  }

  onMount(() => {
    roomHeading.focus({ preventScroll: true })
    // Space is the transport wherever the room is open — a focused mute chip
    // or slider must not steal it. Typing surfaces keep the key (see helper).
    onCleanup(
      installSpacePlaybackToggle({
        toggle: songPlayback.togglePlayback,
        ownsSpace: () =>
          props.suspended?.() !== true &&
          !doctorOpen() &&
          !tunerOpen() &&
          !mixerOpen() &&
          !sessionOpen(),
        enabled: () =>
          props.transport.status() !== 'loading' && !isCalibrating(),
      }),
    )
  })

  return (
    <section
      class={styles.roomPanel}
      data-testid="guitar-night-room"
      data-stage-scope="true"
      data-room-kind="backing"
      data-playback-mode={props.transport.loadMode() ?? 'unloaded'}
    >
      <div class={styles.panelEdge} aria-hidden="true" />
      <div class={styles.roomHeadingRow}>
        <div class={styles.roomIdentity}>
          <button
            class={styles.roomBack}
            type="button"
            aria-label="Back to Songs"
            onClick={leaveRoom}
          >
            <ChevronLeft />
          </button>
          <div>
            <p class={styles.eyebrow}>
              Play-along ·{' '}
              {props.backing.defaultMix.kind === 'parts'
                ? 'band parts'
                : 'two-stem mix'}
            </p>
            <h1 ref={roomHeading} tabindex="-1" title={props.backing.title}>
              {props.backing.title}
            </h1>
          </div>
        </div>
        <div class={styles.roomHeadingMeta}>
          <span class={styles.trackCount}>
            {props.backing.stems.length}{' '}
            {props.backing.stems.length === 1 ? 'track' : 'tracks'} · on this
            device
          </span>
          <div class={styles.roomTools} aria-label="Room tools">
            <Show when={props.handSync?.()}>
              {(sync) => (
                <button
                  type="button"
                  class={styles.alignTool}
                  aria-haspopup="dialog"
                  aria-label={`Align ${sync().partName} by hand`}
                  onClick={openHandPlacement}
                >
                  <span aria-hidden="true">
                    <Crosshair />
                  </span>
                  <strong>Align</strong>
                </button>
              )}
            </Show>
            <button
              ref={tunerTrigger}
              type="button"
              aria-haspopup="dialog"
              aria-label="Tune guitar"
              disabled={props.transport.status() === 'loading'}
              onClick={openTuner}
            >
              <span aria-hidden="true">
                <MusicNote />
              </span>
              <strong>Tune</strong>
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`Open track mixer for ${props.backing.title}`}
              onClick={() => setMixerOpen(true)}
            >
              <span aria-hidden="true">
                <SlidersHorizontal />
              </span>
              <strong>Mix</strong>
              <small>{props.backing.stems.length}</small>
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label="Session controls"
              onClick={() => {
                setSessionHandPlacement(false)
                setSessionOpen(true)
              }}
            >
              <span aria-hidden="true">
                <Settings />
              </span>
              <strong>Session</strong>
            </button>
          </div>
        </div>
      </div>

      <GuitarNightStage
        source={performance.stage}
        tuning={props.tuning}
        onInstrument={props.onInstrument}
        onStringCount={props.onStringCount}
        guideLabel={() => {
          const attached = reference()
          if (attached === null) return null
          return attached.tracks.length > 1
            ? `${attached.title} · ${attached.trackName}`
            : attached.title
        }}
        invitationNote={() => {
          const authored = props.authoredReference?.() ?? null
          const placing = props.handSync?.() ?? null
          if (placing !== null) {
            return placing.placed
              ? `${placing.partName} is placed on this recording. Use Align to nudge it if it drifts.`
              : `Placing ${placing.partName} on this recording: play, then use Align to mark its first and last note.`
          }
          if (authored === null) {
            return 'Attach a tab or turn on Listening whenever you want a target.'
          }
          if (authored.scoreMode === 'backing-only') {
            return `${authored.title} carries authored drums on their own clock. Open its backing-only room for free play.`
          }
          return `${authored.title} is attached, but it keeps its own tempo — it plays in the tab room, not against this recording.`
        }}
        invitationAction={
          <>
            <Show when={props.handSync?.()}>
              {(sync) => (
                <button
                  class={styles.stageInvitationAction}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={openHandPlacement}
                >
                  {sync().placed
                    ? `Adjust ${sync().partName}`
                    : `Mark ${sync().partName}`}
                </button>
              )}
            </Show>
            <Show when={props.authoredReference?.() ?? null}>
              <Show when={props.onRehearseTab}>
                {(rehearse) => (
                  <button
                    class={styles.stageInvitationAction}
                    type="button"
                    onClick={() => rehearse()()}
                  >
                    {(props.authoredReference?.() ?? null)?.scoreMode ===
                    'backing-only'
                      ? 'Play the drum backing'
                      : 'Practice with tab'}
                  </button>
                )}
              </Show>
            </Show>
            <Show when={(props.authoredReference?.() ?? null) === null}>
              <Show when={props.onAttachTab}>
                {(attach) => (
                  <button
                    class={styles.stageInvitationAction}
                    type="button"
                    onClick={() => attach()()}
                  >
                    Attach a tab
                  </button>
                )}
              </Show>
            </Show>
          </>
        }
        active={() => true}
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
        overlay={
          <>
            <Show when={!doctorOpen() && doctorView()}>
              {(view) => (
                <GuitarNightDoctorCue
                  view={view()}
                  expanded={false}
                  controlsId="guitar-night-doctor"
                  buttonRef={(element) => {
                    doctorTrigger = element
                  }}
                  onOpen={() => setDoctorOpen(true)}
                />
              )}
            </Show>
            <GuitarNightJamDoctor
              id="guitar-night-doctor"
              open={doctorOpen()}
              view={doctorView()}
              recording={listening.take()?.lifecycle === 'recording'}
              liveEventCount={listening.events().length}
              returnFocus={() => doctorTrigger ?? null}
              fallbackFocus={() => roomHeading}
              onClose={() => setDoctorOpen(false)}
              onClear={() => {
                listening.clearTake()
                setDoctorOpen(false)
              }}
              onRecover={recoverFromDoctor}
            />
          </>
        }
      />

      <GuitarNightInputError
        message={listening.error}
        canTakeOver={listening.canTakeOverInput}
        takeoverPending={listening.inputTakeoverPending}
        onTakeOver={() => void songPlayback.useInputHere()}
      />
      <GuitarNightInputNotice message={listening.notice} floating />

      <div
        class={`${styles.transportDeck} ${songStyles.transportWithListening}`}
        data-testid="guitar-night-deck"
      >
        <div
          class={songStyles.listeningDock}
          data-testid="guitar-night-song-listening-dock"
        >
          <GuitarNightListeningCycle
            status={listening.status}
            profile={listening.inputProfile}
            disabled={() =>
              listeningRoutePending() ||
              props.suspended?.() === true ||
              tunerOpen() ||
              listening.inputTakeoverPending()
            }
            onSelect={selectListeningRoute}
            quickControls={() => (
              <Show when={listening.inputProfile() === 'interface'}>
                <GuitarNightListeningQuickControls
                  status={listening.status()}
                  listening={isListening()}
                  disabled={
                    listeningRoutePending() ||
                    props.suspended?.() === true ||
                    tunerOpen() ||
                    listening.inputTakeoverPending()
                  }
                  backingEnabled={!props.transport.backingMuted()}
                  hasBacking={props.transport.tracks().length > 0}
                  canMonitor={listening.canAmpMonitor()}
                  monitoringEnabled={listening.ampMonitoringEnabled()}
                  monitoringActive={listening.ampMonitoringActive()}
                  onListening={() => songPlayback.toggleListening()}
                  onBacking={(enabled) =>
                    props.transport.setBackingMuted(!enabled)
                  }
                  onMonitor={listening.setAmpMonitoringEnabled}
                />
              </Show>
            )}
          />
        </div>
        <div class={`${styles.timeRail} ${songStyles.timeline}`}>
          <span>{formatTime(position())}</span>
          <LoopRangeRail
            axisDomain={() => ({ start: 0, end: duration() })}
            axisValue={position}
            markDomain={() => ({ start: 0, end: duration() })}
            markA={loop.markA}
            markB={loop.markB}
            toAxis={(seconds) => seconds}
            fromAxis={(seconds) => seconds}
            active={() => props.transport.loopRange() !== null}
            disabled={() => duration() <= 0 || isLoading() || isCalibrating()}
            marksDisabled={() =>
              duration() <= 0 || isLoading() || isCalibrating()
            }
            axisStep={() => 0.05}
            markStep={() => 0.05}
            minimumMarkGap={() => MIN_LOOP_LENGTH}
            formatAxisValue={(seconds) =>
              `${formatTime(seconds)} of ${formatTime(duration())}`
            }
            formatMarkValue={(seconds) => `${seconds.toFixed(2)} seconds`}
            seekLabel="Song position"
            onSeek={(seconds) => performance.transport.seekSeconds(seconds)}
            onMoveMarkA={(seconds) => loop.moveMark('A', seconds)}
            onMoveMarkB={(seconds) => loop.moveMark('B', seconds)}
            testIdPrefix="guitar-night-song"
          />
          <span>{formatTime(duration())}</span>
        </div>

        <div class={`${styles.songLoopControls} ${songStyles.loopDock}`}>
          <GuitarNightLoopControls
            span={props.transport.loopRange()}
            pending={
              loop.isPending() ||
              (loop.isLooping() && props.transport.loopRange() === null)
            }
            pendingReason={loopPendingReason()}
            hasStart={loop.markA() !== null}
            hasEnd={loop.markB() !== null}
            disabled={duration() <= 0 || isLoading() || isCalibrating()}
            blockedReason={
              isCalibrating()
                ? 'Finish calibration first'
                : 'Wait for the song to be ready'
            }
            format={formatTime}
            onMarkStart={() => loop.markStart(position())}
            onMarkEnd={() => loop.markEnd(position())}
            onClear={loop.clear}
          />
        </div>

        <div class={`${styles.transportControls} ${songStyles.playbackDock}`}>
          <button
            class={styles.restartControl}
            type="button"
            aria-label="Restart song"
            onClick={() => props.transport.seek(0)}
          >
            <SkipBack />
          </button>
          <button
            class={styles.playControl}
            classList={{ [styles.playControlLoading]: isLoading() }}
            type="button"
            aria-label={playLabel(props.transport.status())}
            title={playLabel(props.transport.status())}
            disabled={isCalibrating()}
            data-loading-percent={loadPercent() ?? ''}
            onClick={songPlayback.togglePlayback}
          >
            <Show
              when={isLoading()}
              fallback={
                <span aria-hidden="true">
                  {isPlaying() ? <Pause /> : <Play />}
                </span>
              }
            >
              {/* The button IS the progress meter while a song arrives:
                  a ring around the rim, and the percentage in the middle
                  once the server has said how much there is. */}
              <span
                aria-hidden="true"
                class={styles.playControlRing}
                classList={{
                  [styles.playControlRingSpinning]: loadPercent() === null,
                }}
                style={{ '--load-fraction': String(loadFraction()) }}
              />
              <span aria-hidden="true" class={styles.playControlPercent}>
                {loadPercent() === null ? '' : `${loadPercent()}%`}
              </span>
            </Show>
          </button>
          <div
            class={styles.playbackSpeed}
            role="group"
            aria-label="Playback speed"
          >
            <button
              type="button"
              aria-label={`Slow down from ${rateLabel()}`}
              disabled={
                props.transport.status() === 'loading' ||
                performance.transport.playbackRate() <= MIN_RATE
              }
              onClick={() => nudgeRate(-0.05)}
            >
              <span aria-hidden="true">−</span>
            </button>
            <output aria-label={`Playback speed ${rateLabel()}`}>
              <strong>{rateLabel()}</strong>
              <small>Speed</small>
            </output>
            <button
              type="button"
              aria-label={`Speed up from ${rateLabel()}`}
              disabled={
                props.transport.status() === 'loading' ||
                performance.transport.playbackRate() >= MAX_RATE
              }
              onClick={() => nudgeRate(0.05)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <label class={styles.masterVolume}>
            <span aria-hidden="true">
              <Volume2 />
            </span>
            <span class={styles.visuallyHidden}>Backing volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={props.transport.masterVolume()}
              aria-label="Backing volume"
              onInput={changeVolume}
            />
          </label>
        </div>
      </div>

      <Show when={props.transport.error()}>
        {(message) => (
          <p class={styles.playbackError} role="alert">
            {message()}
          </p>
        )}
      </Show>
      <Show when={props.transport.loopError()}>
        {(message) => (
          <p class={styles.playbackError} role="alert">
            {message()}
          </p>
        )}
      </Show>

      <div class={styles.roomFooter}>
        <p>
          <span aria-hidden="true" />
          <strong role="status" aria-live="polite" aria-atomic="true">
            {statusCopy(props.transport.status())}
          </strong>
          <small>
            {props.transport.status() === 'armed'
              ? 'Press Play or Space to start audio'
              : isLoading()
                ? loadingDetail()
                : `${formatTime(position())} of ${formatTime(duration())}`}
          </small>
          <Show
            when={
              props.transport.loopMode() === 'streamed' &&
              props.transport.loopRange() !== null
            }
          >
            <small>Streaming loop · a brief pause may occur at A</small>
          </Show>
        </p>
      </div>

      <GuitarNightSongMixer
        title={props.backing.title}
        transport={props.transport}
        isOpen={mixerOpen()}
        onClose={() => setMixerOpen(false)}
        detail={mixCopy()}
        onSeparateGuitar={
          props.backing.defaultMix.kind === 'mixed-instrumental' &&
          props.onSeparateGuitar
            ? () => {
                setMixerOpen(false)
                props.onSeparateGuitar?.()
              }
            : undefined
        }
      />
      <GuitarNightSongSession
        routePending={listeningRoutePending()}
        isOpen={sessionOpen()}
        focusHandPlacement={sessionHandPlacement()}
        onClose={() => setSessionOpen(false)}
        listening={listening}
        playback={songPlayback}
        amp={amp}
        isListening={isListening}
        isCalibrating={isCalibrating}
        position={position}
        formatTime={formatTime}
        handSync={props.handSync}
      />
      <Show when={tunerOpen()}>
        <GuitarNightTunerExperience
          controller={tuner}
          tuning={roomTuning}
          detectedFrequencyHz={listening.detectedFrequency}
          detectedNoteLabel={listening.currentNote}
          surfaceMode="overlay"
          recoveryActionLabel={() =>
            listening.canTakeOverInput() ? 'Use it here' : null
          }
          onRecoveryAction={() => void listening.useInputHere()}
          onBack={closeTuner}
        />
      </Show>
    </section>
  )
}
