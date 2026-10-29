// ============================================================
// useThresholdRun — the shared engine under every Ruler-A drill.
//
// Owns everything that is the same whether the stimulus is two
// tones (Hairline) or six clicks (The Grid): the practice
// staircase, the 3-track interleaved calibration, progress,
// result recording, and the stop semantics — a practice track
// that turned around twice still reads (provisional); an
// abandoned calibration is discarded, because a half-measured
// mark must never hit the column.
//
// Stopping CANCELS the run, not just its timer. A stimulus is
// already committed to the audio clock by the time Stop is
// pressed, so the drill also gets a cancelStimulus hook to
// silence what is already scheduled; without both halves, a
// stopped drill keeps sounding and then re-arms its own question
// when the in-flight playStimulus() resolves.
//
// The drill supplies one hook: playStimulus(level), which may
// report visual steps (which tone / which click) through the
// provided api.
//
// A drill that can sound a trial again exactly as it was (options.
// replayable) lets the native room offer Hear it again: once before
// the answer on a practice question, never on a sealed one, and as
// often as wanted once answered (replay-policy.ts). The plate counts
// the replays taken before an answer.
//
// Sound taken away before a question is answered (a call, headphones
// out, the app put away) voids it, and its answer is shut while it is
// held. Once the sound is back it sounds again from its start: the same
// trial once any of it was heard (the drill has stored it by then), or a
// fresh one at the same level if the hold came first. One heard through
// and waiting on its answer is heard again too, since the ear no longer
// holds it (owner, 29 Oct), and that hearing is a replay before its
// answer: it counts as one, even on a sealed run, which otherwise has
// none, and the plate shows it. Answers already given stand.
// ============================================================

import { batch, createSignal, onCleanup } from 'solid-js'
import { gradeForScore } from '@/features/exercises/feedback'
import { playTierSfx } from '@/features/exercises/feedback'
import type { CalibrationTrack, PooledThreshold } from '@/lib/ear/calibration'
import { CALIBRATION_STAIRCASE, calibrationConfig, calibrationReading, createCalibrationTracks, isCalibrationComplete, nextTrackIndex, recordCalibrationTrial, } from '@/lib/ear/calibration'
import type { ThresholdDrill } from '@/lib/ear/drills'
import { INDEX_MAX, scoreReading } from '@/lib/ear/mercury-index'
import type { StaircaseState, ThresholdEstimate } from '@/lib/ear/staircase'
import { createStaircase, recordTrial, thresholdOf } from '@/lib/ear/staircase'
import { trackFirstValue } from '@/lib/first-value'
import { completeCalibrationRun, creditEarSession, latestThresholdReading, markSprintSegmentDone, recordThresholdReading, takeSprintRunLength, } from '@/stores/ear-lab-store'
import { canReplay, PRACTICE_REPLAYS_PER_QUESTION } from './replay-policy'
import { createRevealPacer } from './reveal-pacing'

export type ThresholdRunMode = 'practice' | 'calibration'

/** Trials a 2-down-1-up track spends per turn, until the run shows
 *  its own pace. */
const PRIOR_TRIALS_PER_TURN = 2.5

export type ThresholdRunPhase =
  | 'idle'
  | 'stimulus'
  | 'answer'
  | 'reveal'
  | 'done'

export interface ThresholdRunResult {
  estimate: ThresholdEstimate | PooledThreshold | null
  trials: number
  mode: ThresholdRunMode
  /** Set on calibration runs: the Mercury Index that got marked. */
  markedIndex?: number
  /** Questions heard twice before their answer (practice only). */
  replays?: number
  /** A calibration's three tracks, each its own reading, in track order:
   *  null for a track that found no threshold. */
  trackValues?: Array<number | null>
}

export interface StimulusApi {
  /** Report a visual step (1-based tone/click index) to the view. */
  step: (index: number) => void
  /** True once the run was stopped or torn down — stimulus loops
   *  must check this after every await and bail. */
  cancelled: () => boolean
  /** The trial asked for again: a replayable drill sounds the very
   *  stimulus it played last, not a fresh one at the same level. Only
   *  ever true once this trial's stimulus has begun to sound, so what
   *  the drill kept is this trial's and not the last one's. */
  replay: boolean
}

export interface ThresholdRunOptions {
  /** Silence anything already committed to the audio clock. Called
   *  on stop and on unmount, before the phase flips. */
  cancelStimulus?: () => void
  /** playStimulus honours `api.replay`, so a trial can be heard again. */
  replayable?: boolean
}

export function useThresholdRun(
  drill: ThresholdDrill,
  playStimulus: (level: number, api: StimulusApi) => Promise<void>,
  options?: ThresholdRunOptions,
) {
  const [phase, setPhase] = createSignal<ThresholdRunPhase>('idle')
  const [mode, setMode] = createSignal<ThresholdRunMode>('practice')
  const [trials, setTrials] = createSignal(0)
  const [reversalsDone, setReversalsDone] = createSignal(0)
  const [level, setLevel] = createSignal(drill.staircase.start)
  /** Turns a practice run ends on: the catalogue's, or the fewer a
   *  sprint segment promised on its card. */
  const [practiceReversals, setPracticeReversals] = createSignal(
    drill.staircase.reversalsToStop,
  )
  const [stimulusStep, setStimulusStep] = createSignal(0)
  const [lastCorrect, setLastCorrect] = createSignal<boolean | null>(null)
  const [result, setResult] = createSignal<ThresholdRunResult | null>(null)
  /** Calibration only: reversals per interleaved track, for the strip. */
  const [trackReversals, setTrackReversals] = createSignal<number[]>([])
  const [activeTrack, setActiveTrack] = createSignal(0)
  /** Replays taken before an answer, this run and this question. */
  const [replays, setReplays] = createSignal(0)
  const [replaysThisTrial, setReplaysThisTrial] = createSignal(0)
  /** True while a replay sounds, before or after the answer. */
  const [replaying, setReplaying] = createSignal(false)
  /** The run took the shorter length a Today's segment armed. */
  const [short, setShort] = createSignal(false)
  /** The question in flight was voided; it waits for resumeQuestion(). */
  const [held, setHeld] = createSignal(false)
  /** The held question had been heard through: heard again, it is a
   *  replay. */
  let heardThrough = false

  let single: StaircaseState | null = null
  let tracks: CalibrationTrack[] = []
  let activeTrackIndex = 0
  let startedAt = 0
  let cancelled = false
  /** Bumped when a question is sounded again from its start: the sound
   *  it replaces must not arm the answer when it resolves. */
  let question = 0
  /** Bumped by every start(). A round still awaiting its stimulus when
   *  the run was stopped and started again would otherwise resume once
   *  that stimulus resolves — `cancelled` is false again by then — and
   *  arm the new run's question over the old trial. */
  let run = 0
  /** Bumped by every new trial; a replay or a resumed question keeps it. */
  let trial = 0
  /** The last trial whose stimulus began to sound: by its first step the
   *  drill has stored it, and it can be sounded again exactly. */
  let heardTrial = 0
  /** Bumped by every replay and by the next trial, which silences one
   *  still sounding: only the latest replay's end clears the flag. */
  let replayToken = 0
  const pacer = createRevealPacer(
    () => {
      setLastCorrect(null)
      void playRound()
    },
    () => cancelled,
  )

  /** The step reporter a stimulus is given: it also notes that this
   *  trial's stimulus has begun to sound. */
  function stepper(stale: () => boolean): (index: number) => void {
    const mine = trial
    return (index) => {
      if (index > 0 && !stale()) heardTrial = mine
      setStimulusStep(index)
    }
  }

  /** Turns each track needs: the sealed protocol's six, or the
   *  drill's own for practice. */
  function trackTarget(): number {
    return mode() === 'calibration'
      ? CALIBRATION_STAIRCASE.reversalsToStop
      : practiceReversals()
  }

  /** Total turns a full run needs (progress display). */
  function reversalTarget(): number {
    return mode() === 'calibration' ? trackTarget() * 3 : trackTarget()
  }

  /** About how many questions remain: the turns still needed at the
   *  run's own pace so far (a prior of two and a half trials a turn
   *  until it has turned twice), never more than the caps allow. */
  function questionsLeft(): number {
    const turnsLeft = Math.max(0, reversalTarget() - reversalsDone())
    const pace =
      reversalsDone() >= 2 ? trials() / reversalsDone() : PRIOR_TRIALS_PER_TURN
    const live =
      mode() === 'calibration'
        ? tracks.map((t) => t.state)
        : single
          ? [single]
          : []
    const capacity = live
      .filter((state) => !state.done)
      .reduce((sum, state) => sum + (state.config.maxTrials - state.trials), 0)
    return Math.min(Math.round(turnsLeft * pace), capacity)
  }

  function currentStaircase(): StaircaseState | null {
    if (mode() === 'practice') return single
    return tracks[activeTrackIndex]?.state ?? null
  }

  /** Where a practice run's reading is recorded: the drill's own id,
   *  or the track start() was given — Span's sung runs read under
   *  'span-sing'. Calibration always reads under the drill. */
  let runTrackId = drill.id

  function start(runMode: ThresholdRunMode, track?: { drillId: string }): void {
    cancelled = false
    heardThrough = false
    run += 1
    runTrackId =
      runMode === 'practice' ? (track?.drillId ?? drill.id) : drill.id
    startedAt = performance.now()
    batch(() => {
      setMode(runMode)
      setTrials(0)
      setReversalsDone(0)
      setResult(null)
      setLastCorrect(null)
      setReplays(0)
      setReplaying(false)
      setHeld(false)
    })
    // The sprint card arms the shorter length its segment promised.
    // Whichever run starts next takes it, in either mode, so it cannot
    // leak into a later run of the drill from the bench.
    const armed = takeSprintRunLength(drill.id)
    setShort(runMode === 'practice' && armed?.reversals !== undefined)
    if (runMode === 'practice') {
      const reversalsToStop =
        armed?.reversals ?? drill.staircase.reversalsToStop
      setPracticeReversals(reversalsToStop)
      single = createStaircase({ ...drill.staircase, reversalsToStop })
      tracks = []
    } else {
      single = null
      tracks = createCalibrationTracks(
        drill.id,
        calibrationConfig(
          drill.staircase,
          latestThresholdReading(drill.id)?.value ?? null,
        ),
      )
    }
    setTrackReversals(tracks.map(() => 0))
    setActiveTrack(0)
    void playRound()
  }

  async function playRound(): Promise<void> {
    const mine = run
    question += 1
    const asked = question
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    if (stale()) return
    // A replay of the last verdict still sounding stops: the next trial
    // is not played over it.
    if (replaying()) {
      options?.cancelStimulus?.()
      endReplay()
    }

    if (mode() === 'calibration') {
      const index = nextTrackIndex(tracks)
      if (index === null) {
        finish(true)
        return
      }
      activeTrackIndex = index
      setActiveTrack(index)
    } else if (!single || single.done) {
      finish(true)
      return
    }

    const currentLevel = currentStaircase()?.level ?? drill.staircase.start
    trial += 1
    batch(() => {
      setLevel(currentLevel)
      setStimulusStep(0)
      setReplaysThisTrial(0)
      setPhase('stimulus')
    })
    const api: StimulusApi = {
      step: stepper(stale),
      cancelled: stale,
      replay: false,
    }
    await playStimulus(currentLevel, api)
    // Stop may have landed while the stimulus was sounding, or the run
    // may have been started again; arming the answer here would
    // resurrect a finished run.
    if (stale()) return
    setPhase('answer')
  }

  /** The drill translates its buttons into right/wrong; the run
   *  moves the track and paces the reveal. */
  function answerCorrect(correct: boolean): void {
    if (phase() !== 'answer' || cancelled) return

    if (mode() === 'practice' && single) {
      single = recordTrial(single, correct)
      setReversalsDone(single.reversals.length)
    } else if (mode() === 'calibration') {
      tracks = recordCalibrationTrial(tracks, activeTrackIndex, correct)
      setReversalsDone(
        tracks.reduce((sum, t) => sum + t.state.reversals.length, 0),
      )
      setTrackReversals(tracks.map((t) => t.state.reversals.length))
    }

    playTierSfx(
      correct
        ? { label: 'Perfect', className: 'perfect' }
        : { label: 'Missed', className: 'missed' },
    )

    batch(() => {
      setTrials((t) => t + 1)
      setLastCorrect(correct)
      setPhase('reveal')
    })

    // The verdict is on the stage; the pacer decides when the next
    // trial sounds — the rack's hold, or Next.
    pacer.hold(correct)
  }

  /** Whether Hear it again would sound now (replay-policy.ts). */
  function replayAllowed(): boolean {
    if (options?.replayable !== true) return false
    const now = phase()
    return canReplay({
      run: mode() === 'calibration' ? 'sealed' : 'practice',
      beat:
        now === 'stimulus'
          ? 'listen'
          : now === 'answer' || now === 'reveal'
            ? now
            : 'other',
      sounding: now === 'stimulus' || replaying(),
      usedThisQuestion: replaysThisTrial(),
    })
  }

  /** Sound this trial again. Before the answer the pads wait for it, as
   *  they did the first time; after it, a hold counting down stops and
   *  waits for Next. The phase and the flag move in one step at either
   *  end, so a sung answer's window that waits through the replay (Span)
   *  never sees a question neither sounding nor open. */
  async function replay(): Promise<void> {
    if (!replayAllowed()) return
    const mine = run
    const asked = question
    replayToken += 1
    const token = replayToken
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    const before = phase()
    batch(() => {
      if (before === 'answer') {
        setReplaysThisTrial((n) => n + 1)
        setReplays((n) => n + 1)
        setPhase('stimulus')
      } else {
        pacer.pause()
      }
      setStimulusStep(0)
      setReplaying(true)
    })
    const own = (): boolean => mine === run && token === replayToken
    try {
      // Replays come only once the trial has been heard through.
      await playStimulus(level(), {
        step: stepper(stale),
        cancelled: stale,
        replay: true,
      })
    } catch (error) {
      if (own()) setReplaying(false)
      throw error
    }
    batch(() => {
      if (own()) setReplaying(false)
      if (!stale() && before === 'answer') setPhase('answer')
    })
  }

  function finish(complete: boolean): void {
    const elapsed = performance.now() - startedAt

    if (mode() === 'practice') {
      const estimate = single ? thresholdOf(single) : null
      if (estimate) {
        recordThresholdReading({
          drillId: runTrackId,
          value: estimate.value,
          spread: estimate.spread,
          tracks: 1,
          source: 'practice',
          provisional: estimate.provisional,
        })
      }
      setResult({
        estimate,
        trials: trials(),
        mode: 'practice',
        replays: replays(),
      })
    } else {
      const pooled = calibrationReading(tracks, drill.staircase.stepMode)
      let markedIndex: number | undefined
      if (pooled) {
        markedIndex = completeCalibrationRun([
          {
            drillId: drill.id,
            value: pooled.value,
            spread: pooled.standardError,
          },
        ]).index
      }
      setResult({
        estimate: pooled,
        trials: trials(),
        mode: 'calibration',
        markedIndex,
        // In track order, so the plate names each by its letter.
        trackValues: tracks.map(
          (track) => thresholdOf(track.state)?.value ?? null,
        ),
      })
    }

    creditEarSession(elapsed)
    // A drill played anywhere counts toward today's sprint — the
    // sprint names what to practice, it does not own the only door
    // into it. Idempotent, so a second run cannot double-book.
    // A segment counts when the run reached its end, not when it was
    // abandoned part-way.
    if (complete) {
      markSprintSegmentDone(drill.id)
      trackFirstValue('ear')
    }
    setPhase('done')
  }

  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    // Cancel FIRST: the in-flight playStimulus() checks this when it
    // resolves, and without it the run would re-arm its question
    // after the user has already seen the end card.
    cancelled = true
    pacer.cancel()
    options?.cancelStimulus?.()
    endReplay()

    // Nothing answered: nothing to credit, and no sprint segment, session
    // or streak is booked for a run that never happened.
    if (trials() === 0) {
      setResult({ estimate: null, trials: 0, mode: mode() })
      setPhase('done')
      return
    }
    if (mode() === 'practice' || isCalibrationComplete(tracks)) {
      finish(false)
      return
    }
    setResult({ estimate: null, trials: trials(), mode: 'calibration' })
    setPhase('done')
  }

  function reset(): void {
    cancelled = true
    pacer.cancel()
    options?.cancelStimulus?.()
    endReplay()
    setPhase('idle')
    setResult(null)
    setLastCorrect(null)
  }

  function dispose(): void {
    cancelled = true
    pacer.cancel()
    options?.cancelStimulus?.()
    endReplay()
  }

  /** A replay silenced from outside may never end on its own (a drill
   *  whose stimulus resolves on a timer the silencing cleared): its flag
   *  goes now, and its end, if it comes, finds a newer token. */
  function endReplay(): void {
    replayToken += 1
    setReplaying(false)
  }

  /** The sound was taken away. A question still sounding, or waiting on
   *  its answer, is void, and back to sounding, so no answer lands while
   *  it is held; one already held stays as it is. A verdict counting
   *  down waits for Next, and a replay of it stops, to be heard whole
   *  once the sound is back. */
  function holdQuestion(): void {
    if (phase() === 'reveal') {
      if (replaying()) {
        question += 1
        options?.cancelStimulus?.()
        batch(() => {
          endReplay()
          setStimulusStep(0)
        })
      }
      pacer.pause()
      return
    }
    const sounding = phase() === 'stimulus'
    if ((!sounding && phase() !== 'answer') || held() || cancelled) return
    question += 1
    options?.cancelStimulus?.()
    heardThrough = !sounding
    batch(() => {
      setReplaying(false)
      setStimulusStep(0)
      setPhase('stimulus')
      setHeld(true)
    })
  }

  /** The voided question, from its start: the same trial, at the same
   *  level. Sounded again as it was once any of it was heard; a hold
   *  that came before its first step may also have come before the drill
   *  stored it (the Grid waits on the audio context first), so then it is
   *  played fresh, never the last trial's stimulus at this level. One
   *  heard through and waiting on its answer counts a replay, this
   *  question's and the run's, as Hear it again would have. */
  async function resumeQuestion(): Promise<void> {
    if (!held() || cancelled) return
    const mine = run
    question += 1
    const asked = question
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    batch(() => {
      if (heardThrough) {
        setReplaysThisTrial((n) => n + 1)
        setReplays((n) => n + 1)
      }
      setHeld(false)
      setPhase('stimulus')
    })
    heardThrough = false
    await playStimulus(level(), {
      step: stepper(stale),
      cancelled: stale,
      replay: heardTrial === trial,
    })
    if (stale()) return
    setPhase('answer')
  }

  /** Leave mid-run keeping nothing. A threshold run writes nothing
   *  until it finishes, so cancelling is the whole of it. */
  function abandon(): void {
    dispose()
  }

  onCleanup(dispose)

  /** Letter grade from where the reading lands on the drill's own
   *  0-1000 scale — the same mapping the Mercury Index uses, so a
   *  grade and a column contribution can never disagree. */
  function grade(): 'S' | 'A' | 'B' | 'C' | 'D' | null {
    const r = result()
    if (!r?.estimate) return null
    return gradeForScore(
      (scoreReading(r.estimate.value, drill.scale) / INDEX_MAX) * 100,
    )
  }

  return {
    phase,
    trackId: () => runTrackId,
    mode,
    trials,
    reversalsDone,
    reversalTarget,
    trackTarget,
    questionsLeft,
    trackReversals,
    activeTrack,
    level,
    stimulusStep,
    lastCorrect,
    /** Where this track's level goes after the verdict — the Last
     *  call plate's consequence line. Null before the first trial. */
    nextLevel: () => currentStaircase()?.level ?? null,
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    /** A hold counting down waits for Next instead. */
    pause: pacer.pause,
    result,
    grade,
    replays,
    replaying,
    replayAllowed,
    replay,
    /** Replays still open before this answer: practice questions count
     *  them, every other run has none to count. */
    replaysLeft: (): number | null =>
      mode() === 'practice' && phase() !== 'reveal'
        ? Math.max(0, PRACTICE_REPLAYS_PER_QUESTION - replaysThisTrial())
        : null,
    /** The drill can sound a trial again at all. */
    replayable: options?.replayable === true,
    /** A Today's short run. */
    short,
    held,
    holdQuestion,
    resumeQuestion,
    start,
    answerCorrect,
    stop,
    reset,
    dispose,
    abandon,
  }
}
