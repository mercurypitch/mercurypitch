// ============================================================
// Ear Lab — transformed up-down staircase (Ruler A).
//
// A 2-down-1-up rule converges on the 70.7% point of the
// psychometric function (Levitt 1971): two correct in a row makes
// the task harder, a single miss makes it easier. What comes out
// is a difference limen in a real unit — cents, ms, dB, notes —
// never a percentage. That is the whole point of the Ear Lab: a
// cent is a cent forever, so the reading stays comparable across
// sessions, devices and months, and it keeps falling as the ear
// improves instead of parking at 75% the way accuracy does.
// ============================================================

/** Which way the stimulus level moves to make the task harder. */
export type HarderDirection = 'lower' | 'higher'

/** Geometric suits ratio scales (cents, ms); linear suits counts
 *  (notes of melodic span), where half a step is meaningless. */
export type StepMode = 'geometric' | 'linear'

type Move = 'harder' | 'easier'

export interface StaircaseConfig {
  /** Opening stimulus level, in the drill's unit. */
  start: number
  /** Floor and ceiling on the level, in the drill's unit. */
  min: number
  max: number
  /** `lower` for cents/ms/dB, `higher` for memory span. */
  harderIs: HarderDirection
  stepMode: StepMode
  /** Step used early on — a factor when geometric, an absolute
   *  increment when linear. Big, to reach the neighbourhood fast. */
  coarseStep: number
  /** Step used once the track has settled; this one sets how fine
   *  the final reading can be. */
  fineStep: number
  /** Reversals to see before switching to `fineStep`. */
  narrowAfterReversals: number
  /** The run ends at this many reversals... */
  reversalsToStop: number
  /** ...and the threshold averages this many trailing ones. Kept
   *  even so up- and down-turnarounds cancel rather than bias. */
  reversalsToAverage: number
  /** Guard against a track that never converges (inattentive run,
   *  broken audio path) so a session can always end. */
  maxTrials: number
}

export interface StaircaseState {
  readonly config: StaircaseConfig
  /** Level the next trial should be presented at. */
  level: number
  trials: number
  /** Correct answers since the last move — the "2 down" counter. */
  runOfCorrect: number
  /** Levels at which the track turned around, oldest first. */
  reversals: number[]
  lastMove: Move | null
  done: boolean
}

export interface ThresholdEstimate {
  /** The difference limen, in the drill's unit. */
  value: number
  /** Half-width of the ±1σ band across the averaged reversals,
   *  in the same unit. Wide means the run was noisy — show it. */
  spread: number
  reversalsUsed: number
  /** True while the run is short: display it greyed, and never let
   *  it mark the Mercury Column. */
  provisional: boolean
}

export const DEFAULT_STAIRCASE: StaircaseConfig = {
  start: 50,
  min: 0.5,
  max: 200,
  harderIs: 'lower',
  stepMode: 'geometric',
  coarseStep: 2,
  // 2^(1/3): three fine steps per octave of stimulus level.
  fineStep: 1.26,
  narrowAfterReversals: 2,
  reversalsToStop: 8,
  reversalsToAverage: 6,
  maxTrials: 60,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function nextLevel(
  level: number,
  move: Move,
  step: number,
  config: StaircaseConfig,
): number {
  // Harder means a smaller level only when smaller *is* harder.
  const shrink = (move === 'harder') === (config.harderIs === 'lower')
  const raw =
    config.stepMode === 'geometric'
      ? shrink
        ? level / step
        : level * step
      : shrink
        ? level - step
        : level + step
  return clamp(raw, config.min, config.max)
}

export function createStaircase(
  config: StaircaseConfig = DEFAULT_STAIRCASE,
): StaircaseState {
  return {
    config,
    level: clamp(config.start, config.min, config.max),
    trials: 0,
    runOfCorrect: 0,
    reversals: [],
    lastMove: null,
    done: false,
  }
}

/** Feed one trial's outcome in; get the next state back. Pure, so a
 *  session can replay or rewind a track without side effects. */
export function recordTrial(
  state: StaircaseState,
  correct: boolean,
): StaircaseState {
  if (state.done) return state

  const { config } = state
  const runOfCorrect = correct ? state.runOfCorrect + 1 : 0
  const trials = state.trials + 1

  // 2-down-1-up: two in a row to descend, a single miss to ascend.
  // One lone correct answer holds the level and waits for its pair.
  const move: Move | null = !correct
    ? 'easier'
    : runOfCorrect >= 2
      ? 'harder'
      : null

  if (move === null) return { ...state, trials, runOfCorrect }

  // A turnaround is booked at the level that was just tested — that
  // is the point the track actually pivoted on.
  const turned = state.lastMove !== null && move !== state.lastMove
  const reversals = turned ? [...state.reversals, state.level] : state.reversals

  const step =
    reversals.length >= config.narrowAfterReversals
      ? config.fineStep
      : config.coarseStep

  return {
    ...state,
    level: nextLevel(state.level, move, step, config),
    trials,
    runOfCorrect: 0,
    reversals,
    lastMove: move,
    done:
      reversals.length >= config.reversalsToStop || trials >= config.maxTrials,
  }
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function sd(values: readonly number[], centre: number): number {
  if (values.length < 2) return 0
  const variance =
    values.reduce((a, v) => a + (v - centre) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** The reading, averaged over the trailing reversals. Null until the
 *  track has turned around at least twice — before that there is no
 *  threshold, only a guess, and we would rather show nothing. */
export function thresholdOf(state: StaircaseState): ThresholdEstimate | null {
  const { config, reversals } = state
  if (reversals.length < 2) return null

  const want = Math.min(config.reversalsToAverage, reversals.length)
  // Drop to an even count: averaging an odd number of turnarounds
  // leans toward whichever direction got the extra one.
  const evenWant = want - (want % 2)
  const used = reversals.slice(reversals.length - evenWant)

  if (config.stepMode === 'linear') {
    const value = mean(used)
    return {
      value,
      spread: sd(used, value),
      reversalsUsed: used.length,
      provisional: used.length < config.reversalsToAverage,
    }
  }

  // Ratio-scaled levels average in log space, else a single high
  // reversal drags the reading up out of proportion.
  const logs = used.map(Math.log)
  const logMean = mean(logs)
  const value = Math.exp(logMean)
  const logSd = sd(logs, logMean)
  // Convert the log-space σ back to a symmetric half-width so the UI
  // can render a plain "± x cents".
  const spread = (value * Math.exp(logSd) - value / Math.exp(logSd)) / 2

  return {
    value,
    spread,
    reversalsUsed: used.length,
    provisional: used.length < config.reversalsToAverage,
  }
}
