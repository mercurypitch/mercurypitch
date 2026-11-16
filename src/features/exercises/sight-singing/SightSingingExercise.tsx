// ============================================================
// SightSingingExercise — Read a line from the staff, sing it
// ============================================================
//
// Lessons 16, 18, 21 and 25's drill (SEASON-2 § 5.2 item 10): a short line
// on the singer's staff, sung note by note. The next note lights once the
// voice has been within 60 cents of the lit one, in any octave, for 450 ms
// all told, or after 8 s.
//
// The line is the setup, read before Start: on the singer's clef (the bass
// clef for a bass or a baritone, `clefForRange`; the setup offers the
// other), in the key, with its signature and each note spelled by it
// (sight-key.ts, sight-line.ts), and named under the head by its letter or
// its syllable, or not at all. The key is the Singing tab's, or a launch's
// (`key` and `scale`); a launch's phrase replaces the six notes the drill
// otherwise picks itself. Hear it first gives the key and never the line:
// do, held, then do's triad up and down, as a sight-singing exam gives the
// key chord (Lesson 16 FACTS 42).

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconMusic } from '@/components/exercise-icons'
import { launchKey, launchScale, launchTargetNotes, } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { activeWeeklyAttempt } from '@/lib/domain/weekly-attempt-context'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { createPersistedSignal } from '@/lib/storage'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { keyName, scaleType } from '@/stores/app-store'
import { flushExerciseHistoryWrites, recordExerciseResult, } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { Choice, clefForRange } from '../note-reading/NoteReadingExercise'
import type { Clef } from '../note-reading/staff-kit'
import { createNoteDemo } from '../stage/note-demo'
import { EXERCISE_SIGHT_SINGING, runStoppedEarly } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { keyForPhrase, keyLabel, sightKey } from './sight-key'
import type { SightLine, SightNames } from './sight-line'
import { isSightNames, nameUnder, startNotes, startWords, writeLine, } from './sight-line'
import styles from './SightSinging.module.css'
import { SightStaff } from './SightStaff'
import { planWalk, useSightSingingController, } from './use-sight-singing-controller'

interface Props {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const CLEF_KEY = 'pitchperfect_sight_singing_clef'
const NAMES_KEY = 'pitchperfect_sight_singing_names'

const isClef = (value: unknown): value is Clef =>
  value === 'treble' || value === 'bass'

const CLEF_OPTIONS: readonly { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
]

const NAMES_OPTIONS: readonly { value: SightNames; label: string }[] = [
  { value: 'letters', label: 'Letters' },
  { value: 'solfege', label: 'Do re mi' },
  { value: 'off', label: 'Off' },
]

/** Hear it first: do held a second, a breath, then the triad at 0.6 s a note (Lesson 16 FACTS 42). */
const DO_MS = 1000
const DO_GAP_MS = 400
const TRIAD_MS = 560
const TRIAD_GAP_MS = 40

const BRIEF =
  'Read the line, then sing it note by note: hold each note to light the next. Any octave counts.'

/** A launch's note names as MIDI notes, the unreadable left out. */
function midisOf(names: readonly string[] | undefined): number[] {
  return (names ?? []).flatMap((name) => {
    try {
      const midi = noteToMidi(name)
      return Number.isFinite(midi) ? [midi] : []
    } catch {
      return []
    }
  })
}

const SightSingingExercise: Component<Props> = (props) => {
  const audioEngine = untrack(() => props.audioEngine)
  const practiceEngine = untrack(() => props.practiceEngine)
  const weeklyAttemptAtLaunch = untrack(activeWeeklyAttempt)
  const weeklyVoiceHandoff =
    weeklyAttemptAtLaunch?.exercise === EXERCISE_SIGHT_SINGING
  const launchedMidiSequence = midisOf(
    untrack(() => launchTargetNotes(EXERCISE_SIGHT_SINGING)),
  )

  const [clef, setClef] = createPersistedSignal<Clef>(
    CLEF_KEY,
    untrack(() => clefForRange(vocalRangePreset())),
    { validator: isClef },
  )
  const [names, setNames] = createPersistedSignal<SightNames>(
    NAMES_KEY,
    'letters',
    { validator: isSightNames },
  )

  /** The phrase a launch armed: a routine's, a lesson's, a Legend's. */
  const phrase = createMemo(() =>
    weeklyVoiceHandoff
      ? launchedMidiSequence
      : midisOf(launchTargetNotes(EXERCISE_SIGHT_SINGING)),
  )
  /** The scale's name as the launch or the app gives it: a launch that
   *  names a key and no scale means its major. */
  const scaleId = () =>
    launchScale(EXERCISE_SIGHT_SINGING) ??
    (launchKey(EXERCISE_SIGHT_SINGING) !== undefined ? 'major' : scaleType())
  /**
   * The key: a launch's, else the Singing tab's; and for a phrase no launch
   * keyed, a key that holds its notes.
   */
  const key = createMemo(() => {
    const launched = launchKey(EXERCISE_SIGHT_SINGING)
    if (launched !== undefined) return sightKey(launched, scaleId())
    const app = sightKey(keyName(), scaleId())
    const notes = phrase()
    return notes.length >= 2 ? keyForPhrase(notes, app) : app
  })

  // A new line after each run, when the drill picks its own.
  const [round, setRound] = createSignal(0)
  /** The notes to sing: the launch's phrase, or six the drill picks in the key and the singer's range. */
  const sung = createMemo(() => {
    round()
    const notes = phrase()
    if (notes.length >= 2) return notes
    const k = key()
    const { min, max } = getComfortableMidiRange(vocalRangePreset())
    return planWalk(
      k.steps.map((step) => k.pc + step),
      min,
      max,
    )
  })
  /** The line on the setup's staff: the one the next run sings. */
  const line = createMemo(() =>
    writeLine(sung(), key(), clef(), vocalRangePreset(), {
      fixed: phrase().length >= 2,
    }),
  )
  /** The line a run is singing, kept as it started. */
  const [runLine, setRunLine] = createSignal<SightLine | null>(null)
  const shown = () => runLine() ?? line()

  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    foldsOctaves: true,
    selfPaced: true,
    config: () => ({
      type: 'sight-singing',
      targetNotes: shown().notes.map((n) => midiToNoteName(n.midi)),
      pattern:
        weeklyAttemptAtLaunch?.exercise === EXERCISE_SIGHT_SINGING
          ? `legend:${weeklyAttemptAtLaunch.challengeId}`
          : `${key().name}:${scaleId()}`,
    }),
  })

  // A Legend attempt scores its early end itself (unsung notes 0), so only
  // an ordinary run is marked when stopped before its last note. The attempt
  // is one run: once it is spent, a run on this screen is a practice round
  // (weekly-attempt.ts), so each run asks again as it starts. It is spent
  // when its run ends, though its save clears it only seconds later, and a
  // Start in between begins a practice round. Once the save settles, the
  // attempt answers for itself: a save that failed leaves it armed, so the
  // retry is the attempt again.
  let legendRunEnded = false
  const legendAttemptLive = () =>
    weeklyVoiceHandoff &&
    !legendRunEnded &&
    untrack(activeWeeklyAttempt)?.exercise === EXERCISE_SIGHT_SINGING
  const [legendRun, setLegendRun] = createSignal(legendAttemptLive())
  const controller = useSightSingingController(base, {
    marksStoppedRuns: () => !legendRun(),
    names,
  })

  // Hear it first: do, then do's triad up and down, in the singer's octave.
  const demo = createNoteDemo(audioEngine)
  onCleanup(() => demo.stop())
  const playStart = (): Promise<void> => {
    const [home, ...triad] = startNotes(line(), vocalRangePreset())
    if (home === undefined) return Promise.resolve()
    return demo.play(
      [
        { midi: home, ms: DO_MS, gapMs: DO_GAP_MS },
        ...triad.map((midi) => ({ midi })),
      ],
      { noteMs: TRIAD_MS, gapMs: TRIAD_GAP_MS },
    )
  }

  const handleStart = async () => {
    // The notes arrive already fitted to the singer's range (App's launch
    // choke point), or in the singer's own octave for a lesson's line
    // (`ownOctave`); the drill's own six are picked in it. The line is
    // written where the singer's staff reads it and sung where it is
    // written, unless that leaves the range (sight-line.ts).
    const toSing = line()
    setLegendRun(legendAttemptLive())
    if (toSing.notes.length === 0) return
    setRunLine(toSing)
    controller.setNotes(toSing.notes.map((n) => n.midi))
    if (!(await base.start())) {
      setRunLine(null)
      return
    }
    controller.startRounds()
  }

  const handleStop = () => {
    controller.stopRounds()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  let recordedCompletedAt: number | null = null
  createEffect(() => {
    const r = base.result()
    if (
      r &&
      r.type === 'sight-singing' &&
      r.completedAt !== recordedCompletedAt
    ) {
      recordedCompletedAt = r.completedAt
      const legendRunEnding = untrack(legendRun)
      if (legendRunEnding) legendRunEnded = true
      const entry = {
        type: r.type,
        score: r.score,
        metrics: r.metrics,
        completedAt: r.completedAt,
      }
      untrack(() => {
        // The next run's line, read on the setup's staff meanwhile.
        setRound((n) => n + 1)
        if (!weeklyVoiceHandoff) {
          recordExerciseResult(entry)
          return
        }
        const outcomePromise = base.voiceCapture.awaitOutcome()
        void outcomePromise
          .then((weeklyVoiceCapture) => {
            recordExerciseResult(entry, { weeklyVoiceCapture })
            return flushExerciseHistoryWrites()
          })
          .finally(() => {
            if (legendRunEnding) legendRunEnded = false
          })
      })
    }
  })

  const status = () => base.state().status
  const isActive = () => status() === 'active'
  const complete = () => status() === 'complete'
  // The staff shows the line being sung for as long as a run is up.
  createEffect(() => {
    if (status() === 'idle' || complete()) setRunLine(null)
  })

  const metrics = () => base.state().metrics
  const currentIdx = createMemo(() => metrics().noteIndex ?? 0)
  const holdPct = () => metrics().holdPct ?? 0
  const detectedMidi = () => metrics().detectedMidi ?? 0
  const centsOff = () => metrics().centsOff ?? 0
  const sequence = () => controller.getSequence()
  const notesDone = createMemo(() => metrics().notesCompleted ?? 0)
  const marks = createMemo(() => {
    notesDone()
    return controller.getMarks()
  })

  const targetMidi = createMemo(() => {
    const seq = sequence()
    const idx = currentIdx()
    if (seq.length === 0 || idx < 0 || idx >= seq.length) return undefined
    return seq[idx]!.midi
  })

  const litNote = () => shown().notes[currentIdx()]
  /** The hold bar's words: the lit note by its name, or with the names off by none. */
  const holdLabel = (): string => {
    const note = litNote()
    const name = note === undefined ? null : nameUnder(note, names())
    return name === null
      ? 'Hold the lit note to continue'
      : `Hold ${name} to continue`
  }
  const voiceHz = () => {
    const p = base.currentPitch()
    return p !== null && p.freq > 0 ? p.freq : null
  }
  /** Merc's line during a run: where the singer is, and what to do. */
  const say = (): string => {
    const n = shown().notes.length
    const at = `Note ${Math.min(currentIdx() + 1, n)} of ${n}`
    return holdPct() > 0 ? `${at}: hold it.` : `${at}: read it, then sing.`
  }
  const hint = () => `${line().notes.length} notes · ${keyLabel(key())}`

  return (
    <ExerciseShell
      type={EXERCISE_SIGHT_SINGING}
      title="Sight-Singing"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      resultStoppedEarly={() => runStoppedEarly(base.result()?.metrics)}
      voiceCapture={weeklyVoiceHandoff ? undefined : base.voiceCapture}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      icon={<IconMusic size={20} />}
      demo={{
        play: playStart,
        stop: demo.stop,
        line: () =>
          `Listen: do, then ${startWords(line())}, in ${keyLabel(key())}.`,
      }}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>{BRIEF}</p>
          <span class="idle-hint">{hint()}</span>
        </div>
      }
      idleSettings={
        // Space on a chip presses the chip: the shell's own Space starts
        // the run from anywhere else on the page.
        <div class={styles.setup} data-exercise-native-space="true">
          <div class={styles.sheetCard}>
            <div class={styles.label}>
              <span>
                {complete() && phrase().length < 2 ? 'Next line' : 'The line'} ·
                in {keyLabel(key())}
              </span>
              <span>{line().notes.length} notes</span>
            </div>
            <SightStaff line={line()} names={names()} />
          </div>
          <div class={styles.choices}>
            <Choice
              label="Clef"
              options={CLEF_OPTIONS}
              value={clef()}
              onChange={setClef}
            />
            <Choice
              label="Names"
              options={NAMES_OPTIONS}
              value={names()}
              onChange={setNames}
            />
          </div>
        </div>
      }
      onStart={() => void handleStart()}
      stopLabel={legendRun() ? 'Stop & Score' : 'Stop'}
      onStop={handleStop}
      tracker={{
        pitchHistory: base.pitchHistory,
        targetNoteMidi: targetMidi,
        upcomingTargets: () =>
          sequence()
            .slice(currentIdx() + 1)
            .map((n) => n.midi),
      }}
      activePhase={
        <div class={styles.say} role="status" aria-live="polite">
          {say()}
        </div>
      }
      activeContent={
        <div class={styles.run}>
          <div class={styles.sheetCard} data-live={isActive()}>
            <div class={styles.label}>
              <span>in {keyLabel(shown().key)}</span>
              <span class={styles.where}>Any octave</span>
            </div>
            <SightStaff
              line={shown()}
              names={names()}
              current={currentIdx()}
              marks={marks()}
              voiceHz={voiceHz()}
            />
          </div>

          {/* Hold-to-pass progress for the current note */}
          <div class={`sight-singing-hold ${styles.hold}`}>
            <div class={styles.holdBar}>
              <div class={styles.holdFill} style={{ width: `${holdPct()}%` }} />
            </div>
            <span class={styles.holdLabel}>{holdLabel()}</span>
          </div>

          {/* DEV-only pitch debug readout for testing recognition. */}
          <Show when={import.meta.env.DEV}>
            <div class={styles.debug}>
              detected:{' '}
              {detectedMidi() > 0
                ? `${midiToNoteName(Math.round(detectedMidi()))} (${centsOff() >= 0 ? '+' : ''}${centsOff()}¢ folded)`
                : '—'}{' '}
              · target: {midiToNoteName(targetMidi() ?? 0)} · hold {holdPct()}%
            </div>
          </Show>
        </div>
      }
      resultSummary={
        // The score spans ALL notes (unsung ones count zero), so say the
        // parts out loud: coverage, then quality on what was sung — a
        // bare "1 of 6 - 70%" read as nonsense (owner testing).
        <>
          {base.result()?.metrics.notesScored} of{' '}
          {base.result()?.metrics.notesAttempted} notes sung ·{' '}
          {base.result()?.metrics.avgAccuracy}% on those · Best:{' '}
          {base.result()?.metrics.bestNote}%
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change"
    />
  )
}

export default SightSingingExercise
