// ============================================================
// Sing It in Time: a short tune on the staff, sung on the beat
// ============================================================
//
// Lesson 18's drill, and then Lesson 28's (SEASON-2 § 5.2 item 11): Merc
// gives do, the click counts one bar in, and the singer reads two bars of
// 4/4 and sings them while the beat goes on, three tunes a run. Pitch is
// scored note by note, by pitch class; timing is shown, early, on time or
// late, counted from the singer's first note, so a late start is never a
// wrong note (take-judge.ts).
//
// It runs on the shell every drill runs on, with Merc beside the sheet. He
// says the drill: the brief before a run, a line for each beat of the
// count-in and each note as its beat comes, a line on each tune, and after
// the run the one thing worth singing again. The staff is the feedback: the
// note under the cursor lit, each note marked in tune, off or not heard
// once its window closes, when the voice arrived on it shown under its
// beat, and where the voice sits now riding the cursor (TuneStaff.tsx). The
// beat is always seen; it is heard under the singing only when the singer
// turns on "Click while I sing", off at first, since a raw microphone hears
// the click (Lesson 18 FACTS 52).
//
// Hear it first plays the tune on the sheet in time with the click; Hear do
// plays its do; after a run each tune can be heard again as it should go.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconInTime, IconPlay } from '@/components/exercise-icons'
import { getDifficulty, updateDifficultyFromEma, } from '@/features/practice-intelligence/difficulty-store'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { createPersistedSignal } from '@/lib/storage'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { clefForRange } from '../note-reading/NoteReadingExercise'
import { EXERCISE_SING_IN_TIME, runStoppedEarly } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { createInTimeSound } from './beat-sound'
import { BeatPulse } from './BeatPulse'
import { BRIEF, coachLine, countLine, doLine, hintLine, noteLine, } from './in-time-words'
import { tallyOf } from './run-result'
import styles from './SingInTime.module.css'
import type { NoteVerdict } from './take-judge'
import type { Tune } from './tune-plan'
import { BAR_BEATS, levelFor, noteAt, planRun, TUNES_PER_RUN, } from './tune-plan'
import { createTunePlayer } from './tune-player'
import { TuneStaff } from './TuneStaff'
import { useSingInTimeController } from './use-sing-in-time-controller'

interface SingInTimeExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const NAMES_KEY = 'pitchperfect_sing_in_time_names'
const CLICK_KEY = 'pitchperfect_sing_in_time_click'

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean'

/** What a stopped run's Merc says: it was practice, and its notes are below. */
const STOPPED_LINE =
  'Stopped before the end, so that one was practice. The notes you sang are below.'

/** A verdict's place on a result row's beat line: its offset, a half beat either way at most. */
const tickLeft = (v: NoteVerdict): string =>
  `${(50 + Math.max(-0.5, Math.min(0.5, v.offset ?? 0)) * 100).toFixed(1)}%`

const SingInTimeExercise: Component<SingInTimeExerciseProps> = (props) => {
  const audioEngine = untrack(() => props.audioEngine)
  const practiceEngine = untrack(() => props.practiceEngine)
  const [names, setNames] = createPersistedSignal<boolean>(NAMES_KEY, true, {
    validator: isBoolean,
  })
  const [click, setClick] = createPersistedSignal<boolean>(CLICK_KEY, false, {
    validator: isBoolean,
  })

  const level = () => launchDifficulty(EXERCISE_SING_IN_TIME)
  const sound = createInTimeSound(audioEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: () => ({
      type: EXERCISE_SING_IN_TIME,
      pattern: `level:${level()}`,
    }),
  })
  const run = useSingInTimeController(base, { sound })
  const player = createTunePlayer({ sound })

  /** The next run's tunes, planned now so the first can be read before Start. */
  const plan = (): Tune[] =>
    planRun({
      level: level(),
      clef: clefForRange(vocalRangePreset()),
      voice: vocalRangePreset(),
      random: Math.random,
    })
  const [planned, setPlanned] = createSignal<Tune[]>(untrack(plan))
  const [levelUp, setLevelUp] = createSignal<number | null>(null)

  /** The app's audio context made and running, from inside the tap that wants sound. */
  const ready = async (): Promise<void> => {
    try {
      await audioEngine.init()
      await audioEngine.resume()
    } catch {
      // No sound is no reason to stop: the beat is drawn either way.
    }
  }

  const handleStart = async (): Promise<void> => {
    player.stop()
    const tunes = planned()
    const lv = level()
    const clicking = click()
    void ready()
    if (!(await base.start())) return
    run.startRun({ tunes, click: clicking, level: lv })
  }

  const handleStop = (): void => run.stop()

  onCleanup(() => {
    player.stop()
    base.reset()
  })

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  let recordedAt: number | null = null
  createEffect(() => {
    const r = base.result()
    if (r === null || r.type !== EXERCISE_SING_IN_TIME) return
    if (r.completedAt === recordedAt) return
    recordedAt = r.completedAt
    untrack(() => {
      recordExerciseResult({
        type: r.type,
        score: r.score,
        metrics: r.metrics,
        completedAt: r.completedAt,
      })
      const before = getDifficulty(EXERCISE_SING_IN_TIME)
      const after = updateDifficultyFromEma(EXERCISE_SING_IN_TIME)
      setLevelUp(after !== null && after > before ? after : null)
      // the next run's tunes, at the level it will be sung at
      setPlanned(plan())
    })
  })

  const status = () => base.state().status
  const complete = () => status() === 'complete'
  const result = () => base.result()
  const stopped = () => runStoppedEarly(result()?.metrics)

  // ── The run ──
  const tune = () => run.tunes()[run.index()] ?? planned()[0]
  const beat = () => run.beat()
  /** The count-in's beat, 1 to 4. */
  const count = () => Math.floor((beat() ?? -4) + 4) + 1
  /** The note whose beat has come. */
  const noteUp = createMemo(() => {
    const b = beat()
    const t = tune()
    if (b === null || b < 0 || t === undefined) return null
    return t.notes[noteAt(t, b)]
  })
  const say = (): string => {
    const t = tune()
    switch (run.phase()) {
      case 'do':
        return t === undefined ? '' : doLine(t)
      case 'count':
        return countLine(count())
      case 'sing': {
        const n = noteUp()
        return n === null ? '' : noteLine(n, names())
      }
      case 'review':
        return run.review() ?? ''
      default:
        return ''
    }
  }
  const where = (): string => {
    const b = beat()
    if (run.phase() === 'sing' && b !== null && b >= 0) {
      const bar = Math.floor(b / BAR_BEATS) + 1
      const inBar = (Math.floor(b) % BAR_BEATS) + 1
      return `Bar ${bar} · beat ${inBar}`
    }
    if (run.phase() === 'count') return 'Count-in'
    if (run.phase() === 'review') return `Tune ${run.index() + 1} heard`
    return `${tune()?.bpm ?? 0} BPM`
  }
  const voiceHz = () => {
    const p = base.currentPitch()
    return run.phase() === 'sing' && p !== null && p.freq > 0 ? p.freq : null
  }

  // ── Before a run, and between runs ──
  const first = () => planned()[0]
  /** Merc's words in the bubble outside a run. */
  const bubble = (): string => {
    const playing = player.playing()
    if (playing?.kind === 'do')
      return `This is do. The tune is in ${first().key.name} major.`
    if (playing?.kind === 'again')
      return `Listen: tune ${playing.tune + 1} on the beat, as it goes.`
    if (complete() && result() !== null) {
      if (stopped()) return STOPPED_LINE
      return coachLine(run.tunes(), run.marks(), run.shifts())
    }
    return BRIEF
  }
  // the tune on the sheet as the tap found it, read before the context is awaited
  const playDemo = async (): Promise<void> => {
    const tune = first()
    await ready()
    await player.demo(tune)
  }
  const hearDo = (): void => {
    const tune = first()
    void ready().then(() => player.hearDo(tune))
  }
  /** The run's tune playing again, by its place; null when none is. */
  const againTune = (): number | null => {
    const playing = player.playing()
    return playing?.kind === 'again' ? playing.tune : null
  }
  /** Plays a sung tune again, or stops it when it is the one playing. */
  const hearAgain = (index: number): void => {
    const again = run.tunes()[index]
    if (again === undefined) return
    const was = againTune()
    player.stop()
    if (was === index) return
    void ready().then(() => player.again(again, index))
  }
  const demoBeat = () =>
    player.playing()?.kind === 'demo' ? player.beat() : null

  const tally = createMemo(() => tallyOf(run.marks()))

  return (
    <ExerciseShell
      type={EXERCISE_SING_IN_TIME}
      title="Sing It in Time"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      resultStoppedEarly={stopped}
      voiceCapture={base.voiceCapture}
      error={() => base.error()}
      onBack={() => props.onBack()}
      icon={<IconInTime size={20} />}
      demo={{
        play: playDemo,
        stop: player.stop,
        line: () =>
          `Listen: do, the count-in, then the tune on the beat, in ${first().key.name} major.`,
      }}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>{bubble()}</p>
          <span class="idle-hint">{hintLine(level())}</span>
        </div>
      }
      idleSettings={
        // Space on a control presses it: the shell's own Space starts the
        // run from anywhere else on the page.
        <div class={styles.setup} data-exercise-native-space="true">
          <div class={styles.sheetCard} data-live={demoBeat() !== null}>
            <div class={styles.label}>
              <span>
                {complete() ? 'Next tune' : `Tune 1 of ${TUNES_PER_RUN}`} · in{' '}
                {first().key.name}
              </span>
              <span>{first().bpm} BPM</span>
            </div>
            <TuneStaff tune={first()} names={names()} beat={demoBeat()} />
          </div>
          <div class={styles.pills}>
            <button
              type="button"
              class={styles.pill}
              aria-pressed={player.playing()?.kind === 'do'}
              onClick={hearDo}
            >
              <IconPlay size={15} />
              Hear do
            </button>
            <button
              type="button"
              class={styles.pill}
              aria-pressed={names()}
              onClick={() => setNames(!names())}
            >
              {names() ? 'Names on' : 'Names off'}
            </button>
          </div>
          <button
            type="button"
            role="switch"
            class={styles.switchRow}
            aria-checked={click()}
            onClick={() => setClick(!click())}
          >
            <span class={styles.switchText}>
              <span class={styles.switchTitle}>Click while I sing</span>
              <span class={styles.switchNote}>
                {click()
                  ? 'The click goes on under your singing.'
                  : 'Off: the click counts you in, then the beat is shown.'}
              </span>
            </span>
            <span class={styles.switch} aria-hidden="true" />
          </button>
        </div>
      }
      onStart={() => void handleStart()}
      startLabel="Start"
      stopLabel="Stop"
      onStop={handleStop}
      activePhase={
        <div
          class={styles.say}
          classList={{ [styles.sayCount]: run.phase() === 'count' }}
          role="status"
          aria-live="polite"
        >
          {say()}
        </div>
      }
      activeContent={
        <div class={styles.run} data-phase={run.phase()}>
          <div class={styles.sheetCard} data-live={run.phase() === 'sing'}>
            <div class={styles.label}>
              <span>
                Tune {run.index() + 1} of {run.tunes().length} · in{' '}
                {tune()?.key.name}
              </span>
              <span class={styles.where}>{where()}</span>
            </div>
            <Show when={tune()}>
              {(t) => (
                <TuneStaff
                  tune={t()}
                  names={names()}
                  beat={run.phase() === 'review' ? null : beat()}
                  marks={run.marks()[run.index()]}
                  voiceHz={voiceHz()}
                  running
                />
              )}
            </Show>
          </div>
          <BeatPulse
            beat={run.phase() === 'review' ? null : beat()}
            word={
              run.phase() === 'count' || run.phase() === 'do'
                ? 'count'
                : click()
                  ? 'click'
                  : 'beat'
            }
          />
          <div class={styles.tunes} aria-hidden="true">
            <For each={run.tunes()}>
              {(_, i) => (
                <span
                  class={styles.tunePip}
                  data-state={
                    i() < run.tunesDone()
                      ? 'done'
                      : i() === run.index()
                        ? 'now'
                        : 'ahead'
                  }
                />
              )}
            </For>
          </div>
        </div>
      }
      resultSummary={
        <div class={styles.result}>
          <p class={styles.headline}>
            <strong>{tally().inTune}</strong> of {tally().notes} notes in tune
            {' · '}
            {tally().onTime} on the beat
          </p>
          <Show when={levelUp()}>
            {(lv) => (
              <span class={styles.levelUp}>
                Level {lv()} is open: {levelFor(lv()).bpm} BPM
              </span>
            )}
          </Show>
          <div class={styles.byNote} data-testid="note-by-note">
            <div class={styles.label}>
              <span>Note by note</span>
              <span>Early · late</span>
            </div>
            <For each={run.tunes()}>
              {(t, k) => (
                <div class={styles.tuneRow}>
                  <button
                    type="button"
                    class={styles.again}
                    data-exercise-native-space="true"
                    aria-label={`Hear tune ${k() + 1} as it goes`}
                    aria-pressed={againTune() === k()}
                    onClick={() => hearAgain(k())}
                  >
                    <IconPlay size={14} />
                  </button>
                  <div class={styles.notes}>
                    <For each={t.notes}>
                      {(n, i) => {
                        const v = () => run.marks()[k()]?.[i()] ?? null
                        return (
                          <div
                            class={styles.nb}
                            data-pitch={v()?.pitch ?? 'none'}
                            data-timing={v()?.timing ?? ''}
                          >
                            <b class={styles.nbName}>{n.syllable}</b>
                            <span class={styles.nbDot} />
                            <span class={styles.nbTime}>
                              <Show when={v()?.offset != null ? v() : null}>
                                {(m) => (
                                  <i
                                    class={styles.nbTick}
                                    data-timing={m().timing ?? ''}
                                    style={{ left: tickLeft(m()) }}
                                  />
                                )}
                              </Show>
                            </span>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
          <p class={styles.caption}>
            Counted from your first note, so a late start isn't a wrong note.
          </p>
        </div>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
    />
  )
}

export default SingInTimeExercise
