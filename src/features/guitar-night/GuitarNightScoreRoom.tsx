// The score room rehearses an imported tab alone — no recording, no backing stems.
// ============================================================
//
// A tab is a complete rehearsal on its own terms: count-in, click, and the same
// stage the play-along room uses. Nothing here claims accuracy or coaching; the
// only evidence on screen is the score itself and this device's own clock.

import type { Accessor } from 'solid-js'
import { createMemo, For, onCleanup, onMount, Show } from 'solid-js'
import { Ear, Mic, Pause, Play, RotateCcw, SlidersHorizontal, Volume2, } from '@/components/icons'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { quantizeSpanToBeats } from '@/lib/guitar/loop-span'
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

/** Whether the marks on screen differ from the loop already in the scheduler. */
export function scoreLoopPendingRestart(
  marked: LoopSpan | null,
  running: LoopSpan | null,
  takeActive: boolean,
): boolean {
  if (!takeActive) return false
  const scheduledMarks = marked === null ? null : quantizeSpanToBeats(marked)
  if (running === null) return scheduledMarks !== null
  if (scheduledMarks === null) return true
  return (
    running.start !== scheduledMarks.start || running.end !== scheduledMarks.end
  )
}

export function GuitarNightScoreRoom(props: GuitarNightScoreRoomProps) {
  let roomHeading!: HTMLHeadingElement
  let sessionDetails!: HTMLDetailsElement
  let sessionSummary!: HTMLElement
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
  const displayedReference = createMemo(
    () => room.displayReference() ?? props.reference(),
  )
  const listening = useGuitarListeningController({
    activateAudio: room.activateAudio,
    getAudioGraph: room.getAudioGraph,
  })
  const isRunning = createMemo(
    () => room.status() === 'count-in' || room.status() === 'playing',
  )
  const takeIsActive = createMemo(
    () => room.status() === 'starting' || isRunning(),
  )
  // A loop is scheduled into the click at start, so marks moved mid-take take
  // effect on the next one. Say so rather than looking ignored.
  const loopPendingRestart = createMemo(() =>
    scoreLoopPendingRestart(loop.span(), room.runningLoop(), takeIsActive()),
  )
  const isCalibrating = createMemo(() => listening.status() === 'calibrating')
  const isListening = createMemo(
    () =>
      listening.status() === 'listening' ||
      listening.status() === 'requesting' ||
      isCalibrating(),
  )

  const stage: GuitarPerformanceStageSource = {
    title: () => displayedReference().title,
    notes: () => displayedReference().notes,
    timeline: {
      positionSeconds: room.displayPositionSeconds,
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
    // The score voice is pitched audio. Letting the microphone listen to it
    // would make the room appear to hear the player when it heard itself.
    if (takeIsActive() || room.status() === 'complete') room.stop()
    void listening.start()
  }

  const togglePlayback = (): void => {
    if (isCalibrating()) return
    if (!takeIsActive() && isListening()) listening.stop()
    if (!takeIsActive()) sessionDetails.open = false
    room.toggle()
  }

  const changeInstrument = (instrument: StringedInstrument): void => {
    if (takeIsActive()) return
    if (room.status() === 'complete') room.stop()
    props.onInstrument?.(instrument)
  }

  const changeStringCount = (count: number): void => {
    if (takeIsActive()) return
    if (room.status() === 'complete') room.stop()
    props.onStringCount?.(count)
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
        toggle: togglePlayback,
        enabled: () => room.status() !== 'starting' && !isCalibrating(),
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
            {displayedReference().tracks.length > 1
              ? displayedReference().trackName
              : 'this device'}
          </p>
          <h1
            ref={roomHeading}
            tabindex="-1"
            title={displayedReference().title}
          >
            {displayedReference().title}
          </h1>
        </div>
        <div class={styles.roomHeadingMeta}>
          <span class={styles.trackCount}>
            {displayedReference().notes.length} notes ·{' '}
            {Math.round(room.durationBeats())} beats
          </span>
          <div class={styles.roomTools} aria-label="Room tools">
            <details
              ref={sessionDetails}
              class={styles.scoreSession}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                event.preventDefault()
                event.stopPropagation()
                event.currentTarget.open = false
                queueMicrotask(() => sessionSummary.focus())
              }}
            >
              <summary
                ref={sessionSummary}
                aria-label={`${isCalibrating() ? 'Calibrating input' : isListening() ? 'Listening is on' : 'Session controls'}`}
              >
                <span aria-hidden="true">
                  <SlidersHorizontal />
                </span>
                <strong>
                  {isCalibrating()
                    ? 'Calibrating'
                    : isListening()
                      ? 'Listening'
                      : 'Session'}
                </strong>
              </summary>
              <div class={styles.scoreSessionPanel}>
                <header>
                  <div>
                    <strong>Session</strong>
                    <small>
                      {takeIsActive()
                        ? 'Sound settings are held until this take stops.'
                        : 'Set up the next count-in.'}
                    </small>
                  </div>
                </header>

                <button
                  type="button"
                  class={styles.sessionListening}
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
                  onClick={toggleListening}
                >
                  <span aria-hidden="true">
                    <Mic />
                  </span>
                  <span>
                    <strong>
                      {listening.status() === 'requesting'
                        ? 'Opening input'
                        : isCalibrating()
                          ? 'Calibrating'
                          : isListening()
                            ? 'Listening is on'
                            : 'Turn on Listening'}
                    </strong>
                    <small>Show the note this device hears.</small>
                  </span>
                </button>

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

                <div class={styles.scoreSessionSettings}>
                  <label class={styles.countInSelect}>
                    <span aria-hidden="true">
                      <Ear />
                    </span>
                    <strong>Count-in</strong>
                    <select
                      aria-label="Count-in beats"
                      value={room.countInBeats()}
                      disabled={takeIsActive()}
                      onChange={(event) =>
                        room.setCountInBeats(Number(event.currentTarget.value))
                      }
                    >
                      <For each={COUNT_IN_CHOICES}>
                        {(beats) => (
                          <option value={beats}>
                            {beats === 0 ? 'None' : `${beats} beats`}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                  <button
                    type="button"
                    class={styles.hearScoreToggle}
                    aria-pressed={room.hearScore()}
                    disabled={takeIsActive()}
                    classList={{ [styles.hearScoreActive]: room.hearScore() }}
                    onClick={() => room.setHearScore((hearing) => !hearing)}
                  >
                    <span aria-hidden="true">
                      <Volume2 />
                    </span>
                    <span>
                      <strong>
                        {room.hearScore() ? 'Tab sounds' : 'Tab silent'}
                      </strong>
                      <small>
                        {room.hearScore()
                          ? 'Hear the written part.'
                          : 'Click only.'}
                      </small>
                    </span>
                  </button>
                </div>

                <div class={styles.scoreSessionLoop}>
                  <div>
                    <strong>Loop a phrase</strong>
                    <small>
                      Mark A and B at the playhead. Whole beats keep the click
                      steady.
                    </small>
                  </div>
                  <GuitarNightLoopControls
                    span={loop.span()}
                    pending={loop.isPending()}
                    hasStart={loop.markA() !== null}
                    hasEnd={loop.markB() !== null}
                    format={formatBeat}
                    onMarkStart={() => loop.markStart(room.playheadBeat() ?? 0)}
                    onMarkEnd={() =>
                      loop.markEnd(room.playheadBeat() ?? scoreBeats())
                    }
                    onClear={loop.clear}
                  />
                  <Show when={loopPendingRestart()}>
                    <small class={styles.scoreSessionNotice} role="status">
                      Loop changes begin on the next count-in.
                    </small>
                  </Show>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      <GuitarNightStage
        source={stage}
        tuning={() => displayedReference().tuning}
        onInstrument={
          props.onInstrument === undefined ? undefined : changeInstrument
        }
        onStringCount={
          props.onStringCount === undefined ? undefined : changeStringCount
        }
        instrumentSetupDisabled={takeIsActive}
        guideLabel={() =>
          displayedReference().tracks.length > 1
            ? `${displayedReference().title} · ${displayedReference().trackName}`
            : displayedReference().title
        }
        active={() => true}
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
      />

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
              ? 'Session changes are ready for the next count-in.'
              : 'Authored score clock · no recording attached'}
          </span>
        </div>
        <div class={styles.timeRail}>
          <span>{formatTime(room.displayPositionSeconds())}</span>
          {/* No scrubbing: the click is the timeline, and seeking a live
              count-in would desynchronise the beat it schedules. */}
          <progress
            class={styles.songProgress}
            max={Math.max(1, room.durationSeconds())}
            value={room.displayPositionSeconds()}
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
            disabled={room.status() === 'starting' || isCalibrating()}
            onClick={togglePlayback}
          >
            <span aria-hidden="true">{isRunning() ? <Pause /> : <Play />}</span>
          </button>
          <div class={styles.playbackSpeed} role="group" aria-label="Tempo">
            <button
              type="button"
              aria-label={`Slow down from ${room.tempoBpm()} BPM`}
              disabled={
                takeIsActive() || room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO
              }
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
              disabled={
                takeIsActive() || room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO
              }
              onClick={() => room.setTempoBpm(room.tempoBpm() + 4)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      </div>

      <div class={styles.roomFooter}>
        <div class={styles.roomFooterActions}>
          <button type="button" onClick={leaveRoom}>
            Songs
          </button>
          <Show when={room.status() === 'complete'}>
            <button
              type="button"
              class={styles.replayTake}
              onClick={togglePlayback}
            >
              <span aria-hidden="true">
                <RotateCcw />
              </span>
              {loop.span() === null ? 'Replay' : 'Rehearse loop'}
            </button>
          </Show>
        </div>
        <p>
          <span aria-hidden="true" />
          <strong role="status" aria-live="polite" aria-atomic="true">
            {room.status() === 'count-in'
              ? `Counting in · ${room.countInRemaining()}`
              : room.status() === 'playing'
                ? 'Click is running'
                : room.status() === 'complete'
                  ? 'Take complete'
                  : room.status() === 'starting'
                    ? 'Opening the room clock'
                    : 'Ready when you are'}
          </strong>
          <small>
            {room.status() === 'quiet'
              ? 'Press Play or Space to start the count-in'
              : `${formatTime(room.displayPositionSeconds())} of ${formatTime(room.durationSeconds())}`}
          </small>
        </p>
      </div>
    </section>
  )
}
