// The score room rehearses an imported tab alone — no recording, no backing stems.
// ============================================================
//
// A tab is a complete rehearsal on its own terms: count-in, click, and the same
// stage the play-along room uses. Nothing here claims accuracy or coaching; the
// only evidence on screen is the score itself and this device's own clock.

import type { Accessor } from 'solid-js'
import { createMemo, For, onCleanup, onMount, Show } from 'solid-js'
import { Ear, Mic, Pause, Play, Volume2 } from '@/components/icons'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputHealth } from './GuitarNightInputHealth'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightReference } from './reference-port'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import { SCORE_ROOM_MAX_TEMPO, SCORE_ROOM_MIN_TEMPO, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'

interface GuitarNightScoreRoomProps {
  reference: Accessor<GuitarNightReference>
  /** The instrument the stage rows describe. */
  tuning?: Accessor<InstrumentTuning>
  onInstrument?(instrument: StringedInstrument): void
  onStringCount?(count: number): void
  onSongs(): void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

/** Beats are counted from one on screen, the way a player counts them. */
function formatBeat(beat: number): string {
  return `beat ${Math.round(beat) + 1}`
}

const COUNT_IN_CHOICES = [0, 2, 4, 8]

export function GuitarNightScoreRoom(props: GuitarNightScoreRoomProps) {
  let roomHeading!: HTMLHeadingElement
  // The tab room counts in beats, not seconds: a tempo change should move the
  // same bars, not a different span of the score.
  const scoreBeats = createMemo(() =>
    props
      .reference()
      .notes.reduce(
        (latest, note) => Math.max(latest, note.startBeat + note.duration),
        0,
      ),
  )
  const loop = useGuitarNightLoopController({ limit: scoreBeats })
  const room = useGuitarNightScoreRoomController({
    reference: () => props.reference(),
    loop: loop.span,
    instrument: () => props.tuning?.().instrument ?? 'guitar',
  })
  // A loop is scheduled into the click at start, so marks moved mid-take take
  // effect on the next one. Say so rather than looking ignored.
  const loopPendingRestart = createMemo(() => {
    const marked = loop.span()
    const running = room.runningLoop()
    if (marked === null || room.status() === 'quiet') return false
    if (running === null) return true
    return running.start !== marked.start || running.end !== marked.end
  })
  const listening = useGuitarListeningController({
    activateAudio: room.activateAudio,
    getAudioGraph: room.getAudioGraph,
  })
  const isRunning = createMemo(
    () => room.status() === 'count-in' || room.status() === 'playing',
  )
  const isListening = createMemo(
    () =>
      listening.status() === 'listening' || listening.status() === 'requesting',
  )

  const stage: GuitarPerformanceStageSource = {
    title: () => props.reference().title,
    notes: () => props.reference().notes,
    timeline: {
      positionSeconds: room.positionSeconds,
      durationSeconds: room.durationSeconds,
      playheadBeat: room.playheadBeat,
      tempoBpm: room.tempoBpm,
    },
  }

  const toggleListening = (): void => {
    if (isListening()) {
      listening.stop()
      return
    }
    void listening.start()
  }

  const leaveRoom = (): void => {
    listening.stop()
    room.stop()
    props.onSongs()
  }

  onMount(() => {
    roomHeading.focus({ preventScroll: true })
    onCleanup(
      installSpacePlaybackToggle({
        toggle: room.toggle,
        enabled: () => room.status() !== 'starting',
      }),
    )
  })

  return (
    <section
      class={styles.roomPanel}
      data-testid="guitar-night-score-room"
      data-room-kind="score"
    >
      <div class={styles.panelEdge} aria-hidden="true" />
      <div class={styles.roomHeadingRow}>
        <div>
          <p class={styles.eyebrow}>
            Tab rehearsal ·{' '}
            {props.reference().tracks.length > 1
              ? props.reference().trackName
              : 'this device'}
          </p>
          <h1 ref={roomHeading} tabindex="-1" title={props.reference().title}>
            {props.reference().title}
          </h1>
        </div>
        <div class={styles.roomHeadingMeta}>
          <span class={styles.trackCount}>
            {props.reference().notes.length} notes ·{' '}
            {Math.round(room.durationBeats())} beats
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
          </div>
        </div>
      </div>

      <GuitarNightStage
        source={stage}
        tuning={props.tuning}
        onInstrument={props.onInstrument}
        onStringCount={props.onStringCount}
        guideLabel={() =>
          props.reference().tracks.length > 1
            ? `${props.reference().title} · ${props.reference().trackName}`
            : props.reference().title
        }
        active={() => true}
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
      />

      <Show when={listening.status() !== 'off'}>
        <GuitarNightInputHealth
          listening={isListening}
          calibrating={() => listening.status() === 'calibrating'}
          health={listening.health}
          timingSource={listening.timingSource}
          latencyMs={listening.latencyMs}
          onCalibrate={() => void listening.calibrate()}
        />
      </Show>

      <Show when={listening.error()}>
        {(message) => (
          <p class={styles.listeningError} role="alert">
            {message()}
          </p>
        )}
      </Show>
      <Show when={room.error()}>
        {(message) => (
          <p class={styles.playbackError} role="alert">
            {message()}
          </p>
        )}
      </Show>

      <div class={styles.transportDeck} data-testid="guitar-night-score-deck">
        <div class={styles.transportIdentity}>
          <span>
            {loopPendingRestart()
              ? 'The click is already scheduled — this loop starts on the next count-in.'
              : 'This tab keeps its own clock. No recording is attached, so nothing has to line up with one.'}
          </span>
          <GuitarNightLoopControls
            span={loop.span()}
            pending={loop.isPending()}
            hasStart={loop.markA() !== null}
            hasEnd={loop.markB() !== null}
            format={formatBeat}
            onMarkStart={() => loop.markStart(room.playheadBeat() ?? 0)}
            onMarkEnd={() => loop.markEnd(room.playheadBeat() ?? scoreBeats())}
            onClear={loop.clear}
          />
        </div>
        <div class={styles.timeRail}>
          <span>{formatTime(room.positionSeconds())}</span>
          {/* No scrubbing: the click is the timeline, and seeking a live
              count-in would desynchronise the beat it schedules. */}
          <progress
            class={styles.songProgress}
            max={Math.max(1, room.durationSeconds())}
            value={room.positionSeconds()}
            aria-label="Score position"
          />
          <span>{formatTime(room.durationSeconds())}</span>
        </div>

        <div class={styles.transportControls}>
          <button
            class={styles.playControl}
            type="button"
            aria-label={isRunning() ? 'Stop the click' : 'Start the count-in'}
            title={isRunning() ? 'Stop the click' : 'Start the count-in'}
            disabled={room.status() === 'starting'}
            onClick={room.toggle}
          >
            <span aria-hidden="true">{isRunning() ? <Pause /> : <Play />}</span>
          </button>
          <div class={styles.playbackSpeed} role="group" aria-label="Tempo">
            <button
              type="button"
              aria-label={`Slow down from ${room.tempoBpm()} BPM`}
              disabled={room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO}
              onClick={() => room.setTempoBpm(room.tempoBpm() - 4)}
            >
              <span aria-hidden="true">−</span>
            </button>
            <output aria-label={`Tempo ${room.tempoBpm()} BPM`}>
              <strong>{room.tempoBpm()}</strong>
              <small>BPM</small>
            </output>
            <button
              type="button"
              aria-label={`Speed up from ${room.tempoBpm()} BPM`}
              disabled={room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO}
              onClick={() => room.setTempoBpm(room.tempoBpm() + 4)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <label class={styles.countInSelect}>
            <span class={styles.visuallyHidden}>Count-in beats</span>
            <span aria-hidden="true">
              <Ear />
            </span>
            <select
              aria-label="Count-in beats"
              value={room.countInBeats()}
              onChange={(event) =>
                room.setCountInBeats(Number(event.currentTarget.value))
              }
            >
              <For each={COUNT_IN_CHOICES}>
                {(beats) => (
                  <option value={beats}>
                    {beats === 0 ? 'No count-in' : `${beats} beats`}
                  </option>
                )}
              </For>
            </select>
          </label>
          <button
            type="button"
            class={styles.hearScoreToggle}
            aria-pressed={room.hearScore()}
            classList={{ [styles.hearScoreActive]: room.hearScore() }}
            onClick={() => room.setHearScore((hearing) => !hearing)}
          >
            <span aria-hidden="true">
              <Volume2 />
            </span>
            <strong>{room.hearScore() ? 'Tab sounds' : 'Tab silent'}</strong>
          </button>
        </div>
      </div>

      <div class={styles.roomFooter}>
        <button type="button" onClick={leaveRoom}>
          Songs
        </button>
        <p>
          <span aria-hidden="true" />
          <strong role="status" aria-live="polite" aria-atomic="true">
            {room.status() === 'count-in'
              ? `Counting in · ${room.countInRemaining()}`
              : room.status() === 'playing'
                ? 'Click is running'
                : room.status() === 'complete'
                  ? 'Score complete'
                  : room.status() === 'starting'
                    ? 'Opening the room clock'
                    : 'Ready when you are'}
          </strong>
          <small>
            {room.status() === 'quiet'
              ? 'Press Play or Space to start the count-in'
              : `${formatTime(room.positionSeconds())} of ${formatTime(room.durationSeconds())}`}
          </small>
        </p>
      </div>
    </section>
  )
}
