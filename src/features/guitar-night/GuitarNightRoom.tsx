// Guitar Night Room turns a prepared backing into a deliberate, silent-until-play stage.
// ============================================================

import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { Ear, Mic, Pause, Play, SkipBack, Volume2, VolumeX, } from '@/components/icons'
import type { GuitarBackingSession, GuitarBackingTransportStatus, } from '@/features/guitar/backing/guitar-backing-transport'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { clampRate, MAX_RATE, MIN_RATE, } from '@/features/guitar-practice/practice-rate'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { createGuitarNightPerformanceAdapter } from './createGuitarNightPerformanceAdapter'
import styles from './GuitarNightApp.module.css'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightBackingLease, GuitarNightStemKind } from './song-port'
import { useGuitarListeningController } from './useGuitarListeningController'

interface GuitarNightRoomProps {
  backing: GuitarNightBackingLease
  transport: GuitarBackingTransportController
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
  const [doctorOpen, setDoctorOpen] = createSignal(false)
  const listening = useGuitarListeningController({
    activateAudio: () => props.transport.activate(),
    getAudioGraph: () => props.transport.getAudioGraph(),
  })
  const performance = createGuitarNightPerformanceAdapter(
    () => props.transport,
    () => props.backing.title,
    () => EMPTY_STAGE_NOTES,
  )
  const isPlaying = createMemo(() => props.transport.status() === 'playing')
  const isListening = createMemo(
    () =>
      listening.status() === 'listening' || listening.status() === 'requesting',
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

  onMount(() => roomHeading.focus({ preventScroll: true }))

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
              onClick={toggleListening}
            >
              <span aria-hidden="true">
                <Mic />
              </span>
              <strong>
                {listening.status() === 'requesting'
                  ? 'Opening input'
                  : 'Listening'}
              </strong>
            </button>
            <button
              type="button"
              aria-expanded={doctorOpen()}
              aria-controls="guitar-night-doctor"
              onClick={() => setDoctorOpen((open) => !open)}
            >
              <span aria-hidden="true">
                <Ear />
              </span>
              <strong>Jam Doctor</strong>
              <Show when={listening.events().length > 0}>
                <small>{listening.events().length}</small>
              </Show>
            </button>
          </div>
        </div>
      </div>

      <GuitarNightStage
        source={performance.stage}
        active={() => true}
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
      />

      <Show when={doctorOpen()}>
        <aside
          class={styles.doctorPanel}
          id="guitar-night-doctor"
          aria-labelledby="guitar-night-doctor-title"
        >
          <div class={styles.doctorHeading}>
            <div>
              <span>Jam Doctor</span>
              <strong id="guitar-night-doctor-title">
                {listening.events().length > 0
                  ? 'What this take reveals'
                  : 'No take yet'}
              </strong>
            </div>
            <Show when={listening.events().length > 0}>
              <button type="button" onClick={listening.clearTake}>
                Clear take
              </button>
            </Show>
          </div>
          <Show
            when={listening.observations().length > 0}
            fallback={
              <p>
                Turn on Listening and play a few clean attacks. Headphones or an
                instrument input keep the reading focused on your guitar.
              </p>
            }
          >
            <dl class={styles.doctorObservations}>
              <For each={listening.observations()}>
                {(observation) => (
                  <div>
                    <dt>{observation.label}</dt>
                    <dd>{observation.value}</dd>
                    <small>{observation.detail}</small>
                  </div>
                )}
              </For>
            </dl>
            <p class={styles.doctorPrivacy}>
              Measured from this take on this device. Audio is not saved.
            </p>
          </Show>
        </aside>
      </Show>

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
            disabled={props.transport.status() === 'loading'}
            onClick={togglePlayback}
          >
            <span aria-hidden="true">{isPlaying() ? <Pause /> : <Play />}</span>
            <strong>{playLabel(props.transport.status())}</strong>
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
              value="0.78"
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
              ? 'Press Play backing to start audio'
              : `${formatTime(position())} of ${formatTime(duration())}`}
          </small>
        </p>
      </div>
    </section>
  )
}
