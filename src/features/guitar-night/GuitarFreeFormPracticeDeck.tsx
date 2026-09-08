// Free-form Practice keeps one seek rail above a centered Play, Stop, and Record deck.
// ============================================================
// THESIS: The accepted melody keeps the recorder's two-row musical controls.
// OWN-WORLD: Existing charcoal faceplate, brass Play, ivory controls, red Record.
// STORY: Mark a phrase, play against its notes, then inspect the earned result.
// FIRST VIEWPORT: Full-width rail; options flank three centered transport keys.
// FORM: A scoped extension of Velvet Rehearsal, with no new visual identity.

import { createSignal, onCleanup, Show } from 'solid-js'
import { MusicNote, Pause, Play, SlidersHorizontal, Square, Trophy, VolumeX, } from '@/components/icons'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { OverflowMenu } from '@/components/OverflowMenu'
import { LoopRangeRail } from '@/components/shared/LoopRangeRail'
import { nextGuitarNightScoreCountIn } from './guitar-night-score-count-in'
import styles from './GuitarFreeFormPracticeDeck.module.css'
import { GuitarRecordButton, recordingTime } from './GuitarRecordingControls'
import type { GuitarFreeFormPractice } from './useGuitarFreeFormPractice'
import { SCORE_ROOM_MAX_TEMPO, SCORE_ROOM_MIN_TEMPO, } from './useGuitarNightScoreRoomController'
import type { GuitarRecordingController } from './useGuitarRecordingController'

export interface GuitarFreeFormPracticeDeckProps {
  practice: GuitarFreeFormPractice
  /** The room supplies its coordinated Record start/stop proxy. */
  recording: GuitarRecordingController
  disabled?: boolean
  onScore(): void
}

export function GuitarFreeFormPracticeDeck(
  props: GuitarFreeFormPracticeDeckProps,
) {
  const [previewSeconds, setPreviewSeconds] = createSignal<number | null>(null)
  const [stopping, setStopping] = createSignal(false)
  let scrubbing = false
  let scrubChanged = false
  let disposed = false
  onCleanup(() => {
    disposed = true
  })

  const unavailable = () => props.disabled === true || props.recording.busy()
  const configurationLocked = () =>
    unavailable() || props.practice.busy() || stopping()
  const playActive = () => props.practice.running() || props.practice.pending()
  const position = () =>
    previewSeconds() ?? props.practice.room.displayPositionSeconds()
  const seek = (seconds: number): void => {
    if (scrubbing) {
      scrubChanged = true
      setPreviewSeconds(seconds)
    } else props.practice.seekSeconds(seconds)
  }
  const finishScrub = (): void => {
    if (!scrubbing) return
    const seconds = previewSeconds()
    scrubbing = false
    setPreviewSeconds(null)
    if (scrubChanged && seconds !== null && !configurationLocked()) {
      props.practice.seekSeconds(seconds)
    }
    scrubChanged = false
  }
  const stop = async (): Promise<void> => {
    if (unavailable() || stopping()) return
    const practice = props.practice
    const reference = practice.room.displayReference()
    setStopping(true)
    try {
      await practice.settle()
      if (
        !disposed &&
        props.disabled !== true &&
        props.practice === practice &&
        practice.room.displayReference() === reference
      )
        await practice.seekBeat(0)
    } finally {
      if (!disposed) setStopping(false)
    }
  }
  const settings = (): OverflowMenuItem[] => [
    {
      key: 'practice-tempo-down',
      label: 'Slower by 5 bpm',
      disabled:
        configurationLocked() ||
        props.practice.room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO,
      onSelect: () => {
        void props.practice.setTempo(props.practice.room.tempoBpm() - 5)
      },
    },
    {
      key: 'practice-tempo-up',
      label: 'Faster by 5 bpm',
      disabled:
        configurationLocked() ||
        props.practice.room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO,
      onSelect: () => {
        void props.practice.setTempo(props.practice.room.tempoBpm() + 5)
      },
    },
    {
      key: 'practice-count-in',
      label: `Count-in: ${props.practice.room.countInBeats() === 0 ? 'Off' : `${props.practice.room.countInBeats()} beats`}`,
      note: 'Cycle Off, 1, 2, and 4 beats',
      separatorBefore: true,
      disabled: configurationLocked(),
      onSelect: () => {
        void props.practice.setCountIn(
          nextGuitarNightScoreCountIn(props.practice.room.countInBeats()),
        )
      },
    },
    {
      key: 'practice-mark-a',
      label: 'Set A at the playhead',
      separatorBefore: true,
      disabled: configurationLocked(),
      onSelect: () => props.practice.mark('A'),
    },
    {
      key: 'practice-mark-b',
      label: 'Set B at the playhead',
      disabled: configurationLocked(),
      onSelect: () => props.practice.mark('B'),
    },
    {
      key: 'practice-clear-loop',
      label: 'Clear A–B marks',
      disabled:
        configurationLocked() ||
        (props.practice.loop.markA() === null &&
          props.practice.loop.markB() === null),
      onSelect: () => {
        void props.practice.clearLoop()
      },
    },
  ]
  const soundAndResults = (): OverflowMenuItem[] => [
    {
      key: 'practice-guide',
      label: 'Guide notes',
      note: 'Synthesized accepted notes, not the original recording',
      checked: props.practice.room.hearScore(),
      checkType: 'checkbox',
      disabled: unavailable(),
      onSelect: () =>
        props.practice.room.setHearScore(!props.practice.room.hearScore()),
    },
    {
      key: 'practice-results',
      label: 'Score results',
      separatorBefore: true,
      disabled: configurationLocked(),
      icon: () => <Trophy />,
      onSelect: () => props.onScore(),
    },
  ]

  return (
    <div class={styles.deck} data-testid="guitar-free-form-practice-deck">
      <div class={styles.timeline}>
        <output aria-label="Practice position">
          {recordingTime(position())}
        </output>
        <LoopRangeRail
          axisDomain={() => ({
            start: 0,
            end: props.practice.room.durationSeconds(),
          })}
          axisValue={position}
          markDomain={() => ({
            start: 0,
            end: props.practice.room.durationBeats(),
          })}
          markA={() => props.practice.loop.markA()}
          markB={() => props.practice.loop.markB()}
          toAxis={(beat) => props.practice.room.secondsForBeat(beat)}
          fromAxis={(seconds) => props.practice.room.beatForSeconds(seconds)}
          active={() => props.practice.loop.isLooping()}
          disabled={() =>
            configurationLocked() || props.practice.room.durationSeconds() <= 0
          }
          markStep={() => 1}
          minimumMarkGap={() => 1}
          snapMarkValue={(beat) => Math.round(beat)}
          formatAxisValue={(seconds) => `${seconds.toFixed(1)} seconds`}
          formatMarkValue={(beat) => `Beat ${Number((beat + 1).toFixed(2))}`}
          seekLabel="Practice position"
          onSeek={seek}
          onScrubStart={() => {
            scrubbing = true
            scrubChanged = false
          }}
          onScrubEnd={finishScrub}
          onMoveMarkA={(beat) => props.practice.changeMark('A', beat)}
          onMoveMarkB={(beat) => props.practice.changeMark('B', beat)}
          testIdPrefix="guitar-free-form-practice"
        />
        <span>{recordingTime(props.practice.room.durationSeconds())}</span>
      </div>
      <div class={styles.controls}>
        <div class={styles.options}>
          <OverflowMenu
            label="Practice tempo and loop"
            items={settings()}
            disabled={configurationLocked()}
            triggerClass={styles.option}
            panelClass={styles.menu}
            triggerContent={
              <>
                <SlidersHorizontal />
                <span>
                  {Math.round(props.practice.room.tempoBpm())}
                  <small> bpm</small>
                </span>
              </>
            }
          />
        </div>
        <div
          class={styles.transport}
          role="group"
          aria-label="Practice transport"
        >
          <button
            type="button"
            class={styles.play}
            aria-label={playActive() ? 'Pause practice' : 'Play practice'}
            title={playActive() ? 'Pause practice' : 'Play practice'}
            aria-busy={props.practice.pending()}
            disabled={
              unavailable() ||
              stopping() ||
              (props.practice.busy() && !props.practice.pending()) ||
              props.practice.room.durationSeconds() <= 0
            }
            onClick={() => props.practice.toggle()}
          >
            <span aria-hidden="true">
              <Show when={playActive()} fallback={<Play />}>
                <Pause />
              </Show>
            </span>
          </button>
          <button
            type="button"
            aria-label="Stop practice"
            title="Finish this take and return to the beginning"
            aria-busy={stopping()}
            disabled={
              unavailable() ||
              stopping() ||
              (props.practice.busy() && !props.practice.pending())
            }
            onClick={() => {
              void stop()
            }}
          >
            <span aria-hidden="true">
              <Square />
            </span>
          </button>
          <GuitarRecordButton
            controller={props.recording}
            iconOnly
            showDuration={false}
            disabled={props.disabled === true || stopping()}
          />
        </div>
        <div class={styles.results}>
          <button
            type="button"
            class={styles.wideAction}
            aria-label={
              props.practice.room.hearScore()
                ? 'Mute guide notes'
                : 'Hear guide notes'
            }
            title="Synthesized accepted notes"
            aria-pressed={props.practice.room.hearScore()}
            disabled={unavailable()}
            onClick={() =>
              props.practice.room.setHearScore(!props.practice.room.hearScore())
            }
          >
            <Show when={props.practice.room.hearScore()} fallback={<VolumeX />}>
              <MusicNote />
            </Show>
          </button>
          <button
            type="button"
            class={styles.wideAction}
            aria-label="Score results"
            title="Score results"
            disabled={configurationLocked()}
            onClick={() => props.onScore()}
          >
            <Trophy />
          </button>
          <OverflowMenu
            label="Practice sound and results"
            items={soundAndResults()}
            disabled={unavailable()}
            triggerClass={`${styles.option} ${styles.compactAction}`}
            panelClass={styles.menu}
            triggerContent={
              <Show
                when={props.practice.room.hearScore()}
                fallback={<VolumeX />}
              >
                <MusicNote />
              </Show>
            }
          />
        </div>
      </div>
    </div>
  )
}
