// Guitar Night Room turns a prepared backing into a deliberate, silent-until-play stage.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Mic, Pause, Play, SkipBack, Volume2, VolumeX, } from '@/components/icons'
import type { GuitarBackingSession, GuitarBackingTransportStatus, } from '@/features/guitar/backing/guitar-backing-transport'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { clampRate, MAX_RATE, MIN_RATE, } from '@/features/guitar-practice/practice-rate'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { createGuitarNightPerformanceAdapter } from './createGuitarNightPerformanceAdapter'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightDoctorView } from './GuitarNightJamDoctor'
import { GuitarNightDoctorCue, GuitarNightJamDoctor, } from './GuitarNightJamDoctor'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightBackingLease, GuitarNightStemKind } from './song-port'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'

interface GuitarNightRoomProps {
  backing: GuitarNightBackingLease
  transport: GuitarBackingTransportController
  /** The attached score, when one is verified. Absent keeps the room in free play. */
  reference?: Accessor<GuitarNightReference | null>
  /** The instrument the stage rows describe. Absent means a standard six-string. */
  tuning?: Accessor<InstrumentTuning>
  onInstrument?(instrument: StringedInstrument): void
  onStringCount?(count: number): void
  onSongs(): void
  onSeparateGuitar?(): void
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
  if (status === 'loading') return 'Starting backing'
  if (status === 'paused') return 'Resume backing'
  if (status === 'complete') return 'Play again'
  return 'Play backing'
}

function statusCopy(status: GuitarBackingTransportStatus): string {
  if (status === 'playing') return 'Backing is playing'
  if (status === 'loading') return 'Opening the local stems'
  if (status === 'paused') return 'Backing paused'
  if (status === 'complete') return 'Song complete'
  if (status === 'error') return 'Playback needs attention'
  return 'Ready when you are'
}

export function GuitarNightRoom(props: GuitarNightRoomProps) {
  let roomHeading!: HTMLHeadingElement
  let doctorTrigger: HTMLButtonElement | undefined
  const [doctorOpen, setDoctorOpen] = createSignal(false)
  const listening = useGuitarListeningController({
    activateAudio: () => props.transport.activate(),
    getAudioGraph: () => props.transport.getAudioGraph(),
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
      return 'Guitar is muted. The available band parts are ready.'
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
      recoveryDetail: 'The room stays quiet while this device listens.',
      privacyCopy:
        'Measured from this take on this device. Audio is not saved.',
    }
  })

  // The loop lives in seconds of the recording, so it survives a speed change:
  // the same bars come round again whatever rate they are played at.
  const loop = useGuitarNightLoopController({
    limit: duration,
    onWrap: (start) => performance.transport.seekSeconds(start),
  })
  // Position is polled by the transport already; following it here costs one
  // comparison per update and keeps the wrap on the audio clock, not a frame.
  createEffect(() => {
    if (!isPlaying()) return
    loop.follow(position())
  })

  const nudgeRate = (delta: number): void => {
    const next = clampRate(
      Math.round((performance.transport.playbackRate() + delta) * 100) / 100,
    )
    void performance.transport.setPlaybackRate(next)
  }

  const togglePlayback = (): void => {
    if (isPlaying()) {
      props.transport.pause()
      return
    }
    if (isCalibrating()) return
    if (isListening()) listening.stop()
    void performance.transport.play()
  }

  const toggleListening = (): void => {
    if (isListening()) {
      listening.stop()
      return
    }
    if (isPlaying()) props.transport.pause()
    void listening.start()
  }

  const recoverFromDoctor = (): void => {
    setDoctorOpen(false)
    listening.clearTake()
    if (isPlaying()) props.transport.pause()
    void listening.start()
  }

  const leaveRoom = (): void => {
    listening.stop()
    props.onSongs()
  }

  const seek = (event: InputEvent): void => {
    const input = event.currentTarget as HTMLInputElement
    performance.transport.seekSeconds(Number(input.value))
  }

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
        toggle: togglePlayback,
        enabled: () =>
          props.transport.status() !== 'loading' && !isCalibrating(),
      }),
    )
  })

  return (
    <section
      class={styles.roomPanel}
      data-testid="guitar-night-room"
      data-playback-mode={props.transport.loadMode() ?? 'unloaded'}
    >
      <div class={styles.panelEdge} aria-hidden="true" />
      <div class={styles.roomHeadingRow}>
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
        <div class={styles.roomHeadingMeta}>
          <span class={styles.trackCount}>
            {props.backing.stems.length}{' '}
            {props.backing.stems.length === 1 ? 'track' : 'tracks'} · on this
            device
          </span>
          <div class={styles.roomTools} aria-label="Room tools">
            <button
              type="button"
              classList={{ [styles.listeningActive]: isListening() }}
              aria-pressed={isListening()}
              aria-label={
                listening.status() === 'requesting'
                  ? 'Cancel opening input'
                  : isCalibrating()
                    ? 'Stop calibration'
                    : isListening()
                      ? 'Stop Listening'
                      : 'Turn on Listening'
              }
              disabled={props.transport.status() === 'loading'}
              onClick={toggleListening}
            >
              <span aria-hidden="true">
                <Mic />
              </span>
              <strong>
                {listening.status() === 'requesting'
                  ? 'Opening input'
                  : isCalibrating()
                    ? 'Calibrating'
                    : 'Listening'}
              </strong>
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

      <Show when={listening.error()}>
        {(message) => (
          <p class={styles.listeningError} role="alert">
            {message()}
          </p>
        )}
      </Show>

      <div class={styles.transportDeck} data-testid="guitar-night-deck">
        <div class={styles.transportIdentity}>
          <span>{mixCopy()}</span>
          <Show
            when={
              props.backing.defaultMix.kind === 'mixed-instrumental' &&
              props.onSeparateGuitar !== undefined
            }
          >
            <button type="button" onClick={() => props.onSeparateGuitar?.()}>
              Separate guitar
            </button>
          </Show>
          <GuitarNightLoopControls
            span={loop.span()}
            pending={loop.isPending()}
            hasStart={loop.markA() !== null}
            hasEnd={loop.markB() !== null}
            format={formatTime}
            onMarkStart={() => loop.markStart(position())}
            onMarkEnd={() => loop.markEnd(position())}
            onClear={loop.clear}
          />
        </div>
        <div class={styles.timeRail}>
          <span>{formatTime(position())}</span>
          <input
            type="range"
            min="0"
            max={Math.max(1, duration())}
            step="0.05"
            value={position()}
            aria-label="Song position"
            aria-valuetext={`${formatTime(position())} of ${formatTime(duration())}`}
            onInput={seek}
          />
          <span>{formatTime(duration())}</span>
        </div>

        <div class={styles.transportControls}>
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
            type="button"
            aria-label={playLabel(props.transport.status())}
            title={playLabel(props.transport.status())}
            disabled={props.transport.status() === 'loading' || isCalibrating()}
            onClick={togglePlayback}
          >
            <span aria-hidden="true">{isPlaying() ? <Pause /> : <Play />}</span>
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

        <div class={styles.channelStrip} aria-label="Backing tracks">
          <For each={props.transport.tracks()}>
            {(track) => (
              <button
                type="button"
                classList={{ [styles.channelMuted]: track.muted }}
                aria-pressed={!track.muted}
                aria-label={`${track.label} ${track.muted ? 'muted' : 'on'}`}
                disabled={!track.available}
                onClick={() =>
                  props.transport.setTrackMuted(track.id, !track.muted)
                }
              >
                <span aria-hidden="true">
                  {track.muted ? <VolumeX /> : <Volume2 />}
                </span>
                <strong>{track.label}</strong>
                <small>{track.muted ? 'Muted' : 'In mix'}</small>
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={props.transport.error()}>
        {(message) => (
          <p class={styles.playbackError} role="alert">
            {message()}
          </p>
        )}
      </Show>

      <div class={styles.roomFooter}>
        <button type="button" onClick={leaveRoom}>
          Songs
        </button>
        <p>
          <span aria-hidden="true" />
          <strong role="status" aria-live="polite" aria-atomic="true">
            {statusCopy(props.transport.status())}
          </strong>
          <small>
            {props.transport.status() === 'armed'
              ? 'Press Play or Space to start audio'
              : `${formatTime(position())} of ${formatTime(duration())}`}
          </small>
        </p>
      </div>
    </section>
  )
}
