// ============================================================
// LegendTakeView — a take of the Legend, and then its result
// ============================================================
//
// While a take is sung: the chip counting the notes lit, the lane
// (LegendLane.tsx), Merc's first note through the count-in, and the room
// kit's mic button to end it. Then its result, as the Ear Lab's plate shows
// a run's: a state chip, the score, the take whole (LegendTrace.tsx), how
// many notes were lit and which way a miss went, the standing once posted,
// and Merc's word on it. The take itself is legend-take.ts.

import type { JSX } from 'solid-js'
import { createMemo, Index, Show } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { MicButton } from '@/components/room-kit/RoomControls'
import { needsSignIn } from '@/db/services/auth-service'
import { challengeResultCopy } from '@/features/challenges/challenge-result-copy'
import type { ChallengeResult } from '@/features/challenges/challenge-result-store'
import { roomChallengeResult } from '@/features/challenges/challenge-result-store'
import { challengeTargetHighlights } from '@/features/challenges/challenge-stage-model'
import type { WeeklyBoard } from '@/features/challenges/weekly-service'
import type { ZenTargetHighlight } from '@/features/zen/types'
import type { MercState } from '@/lib/merc/constants'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { openSignIn } from '../settings/sign-in-state'
import { inCountIn, laneView, missesOf, traceView } from './legend-lane'
import { askLine, litLine, mercLine, missLine, standingLine, } from './legend-lines'
import { legendStill } from './legend-stills'
import type { LegendTake } from './legend-take'
import { LegendLane } from './LegendLane'
import { LegendTrace } from './LegendTrace'

/** The result's trace, drawn to scale (its viewBox). */
const TRACE_BOX = { width: 326, height: 112 }

/** More notes than this and the chip's dots would not fit beside its words. */
const MOST_DOTS = 12

export interface TakeViewProps {
  take: LegendTake
  board: () => WeeklyBoard | null
  onDone: () => void
  /** The same take again: a ranked one through Sing it's checks. */
  onAgain: () => void
}

/** The line on the stage while it is sung, then the take's result. */
export function LegendTakeView(props: TakeViewProps): JSX.Element {
  const phase = (): string => props.take.state().phase
  const ranked = (): boolean => props.take.kind() === 'ranked'

  const clock = (): number => {
    const session = props.take.session()
    if (session === null) return 0
    return props.take.outcome() !== null
      ? session.loopDurationSec()
      : session.elapsedSec()
  }
  const points = () => {
    const done = props.take.outcome()
    return done?.points ?? props.take.session()?.activePoints() ?? []
  }
  const targets = () => props.take.session()?.targets() ?? []
  const highlights = createMemo(
    (): Map<string, ZenTargetHighlight> =>
      props.take.session() === null
        ? new Map()
        : challengeTargetHighlights(points(), targets(), clock()),
  )
  const lit = (): number => {
    let count = 0
    for (const highlight of highlights().values()) {
      if (highlight.cleared) count += 1
    }
    return count
  }
  const before = (): boolean => inCountIn(targets(), clock())
  const chip = (): string => {
    if (phase() === 'starting') return 'Opening the microphone'
    const kind = ranked() ? 'Ranked take' : 'Practice'
    return before()
      ? `${kind} · Get ready`
      : `${kind} · ${litLine(lit(), targets().length)}`
  }
  const dot = (index: number): 'done' | 'now' | undefined => {
    const target = targets()[index]
    if (target === undefined) return undefined
    if (clock() >= target.endSec) return 'done'
    if (clock() >= target.startSec) return 'now'
    return undefined
  }
  const result = (): ChallengeResult | null => {
    const presented = roomChallengeResult()
    return presented !== null &&
      presented.challengeId === props.take.challenge()?.id
      ? presented
      : null
  }

  return (
    <div class="mp-legend-take" data-testid="legend-take">
      <Show when={phase() === 'starting' || phase() === 'live'}>
        <p
          class="mp-legend-chip"
          aria-live="polite"
          data-testid="legend-take-chip"
        >
          <span>{chip()}</span>
          <Show when={targets().length > 0 && targets().length <= MOST_DOTS}>
            <span class="mp-legend-dots" aria-hidden="true">
              <Index each={targets()}>
                {(_target, index) => <i data-state={dot(index)} />}
              </Index>
            </span>
          </Show>
        </p>
        <div class="mp-legend-take__stage">
          <LegendLane
            view={(box) =>
              laneView(targets(), points(), highlights(), clock(), box)
            }
            summary={() =>
              `${props.take.challenge()?.title ?? 'The Legend'}: ${litLine(lit(), targets().length)}`
            }
          />
          <Show when={phase() === 'live' && before()}>
            <Merc
              pose="listen"
              say={() => {
                const first = targets()[0]
                return first === undefined
                  ? 'Sing each note as the line reaches it.'
                  : `It starts on ${midiToNoteNameOctave(Math.round(first.startMidi))}. Sing each note as the line reaches it.`
              }}
              aside="Sung as written, for everyone"
            />
          </Show>
        </div>
        <p class="mp-legend-take__hint">
          {phase() === 'live' && !before()
            ? 'Sing each note as the line reaches it.'
            : ''}
        </p>
        <div class="mp-legend-take__dock">
          <MicButton
            state={phase() === 'live' ? 'sing' : 'wait'}
            level={props.take.level}
            pulse={false}
            disabled={phase() !== 'live'}
            label={ranked() ? 'End and score' : 'Stop'}
            onClick={() => props.take.stop()}
            testId="legend-stop"
          />
          <span class="mp-legend-take__dock-label" aria-hidden="true">
            {ranked() ? 'End and score' : 'Stop'}
          </span>
        </div>
      </Show>

      <Show when={phase() === 'blocked'}>
        <div class="mp-legend-result" role="alert" data-testid="legend-blocked">
          <p class="mp-legend-result__line">
            {props.take.block() === 'denied'
              ? 'The microphone is off for this app. Allow it in Settings, then try again.'
              : 'The microphone did not open. Check that no other app is using it, then try again.'}
          </p>
          <div class="mp-legend-pair mp-legend-result__actions">
            <button
              type="button"
              class="mp-legend-btn mp-legend-btn--fill"
              data-testid="legend-back"
              onClick={() => props.onDone()}
            >
              Back to the Legend
            </button>
          </div>
        </div>
      </Show>

      <Show when={phase() === 'result' ? props.take.outcome() : null}>
        {(done) => (
          <Result
            take={props.take}
            score={done().summary.score}
            trace={traceView(targets(), done().points, highlights(), TRACE_BOX)}
            lit={lit()}
            total={targets().length}
            misses={missLine(missesOf(targets(), done().points, highlights()))}
            result={result()}
            board={props.board()}
            onAgain={props.onAgain}
            onDone={props.onDone}
          />
        )}
      </Show>
    </div>
  )
}

/** Merc at the foot of the stage, with his line. */
function Merc(props: {
  pose: MercState
  say: () => string
  aside?: string
}): JSX.Element {
  return (
    <div class="mp-legend-merc" data-testid="legend-merc">
      <MercPresence
        state={() => props.pose}
        stillSrc={legendStill(props.pose)}
        size={68}
        class="mp-legend-merc__box"
        testId="legend-merc-box"
      />
      <div class="mp-legend-bubble">
        <p class="mp-legend-bubble__say">{props.say()}</p>
        <Show when={props.aside}>
          <p class="mp-legend-bubble__aside">{props.aside}</p>
        </Show>
      </div>
    </div>
  )
}

interface ResultProps {
  take: LegendTake
  score: number
  trace: ReturnType<typeof traceView>
  lit: number
  total: number
  misses: string | null
  result: ChallengeResult | null
  board: WeeklyBoard | null
  onAgain: () => void
  onDone: () => void
}

type ResultState = 'practice' | 'saving' | 'posted' | 'failed'

/** The state chip's words: a state is never its colour alone. */
const STATE_WORDS: Record<ResultState, string> = {
  practice: 'Not ranked',
  saving: 'Saving',
  posted: 'Posted',
  failed: 'Not posted',
}

/** A take's result, as the Ear Lab's plate shows a run's. */
function Result(props: ResultProps): JSX.Element {
  const state = (): ResultState => {
    if (props.take.kind() !== 'ranked') return 'practice'
    const save = props.take.saveState()
    if (save === 'posted' && props.result !== null) return 'posted'
    if (save === 'failed') return 'failed'
    return 'saving'
  }
  return (
    <div
      class="mp-legend-result"
      data-testid="legend-result"
      data-state={state()}
    >
      <div class="mp-legend-result__kicker">
        <p class="mp-legend-cap">
          {state() === 'practice' ? 'Practice' : 'Legend'}
        </p>
        <span class="mp-legend-state" data-state={state()} role="status">
          <Show when={state() === 'saving'}>
            <svg
              class="mp-legend-state__spin"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.25"
                stroke-width="2.6"
              />
              <path
                d="M12 4a8 8 0 0 1 8 8"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
              />
            </svg>
          </Show>
          <Show when={state() === 'posted'}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </Show>
          <Show when={state() === 'failed'}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
            </svg>
          </Show>
          {STATE_WORDS[state()]}
        </span>
      </div>

      <p class="mp-legend-result__score">
        <span class="mp-legend-result__number">{props.score}</span>
        <span class="mp-legend-result__unit">%</span>
      </p>

      <Show when={state() === 'posted' ? props.result : null}>
        {(posted) => (
          <>
            <h2 class="mp-legend-result__headline">
              {challengeResultCopy(posted()).headline}
            </h2>
            <p class="mp-legend-result__line">
              {askLine(posted().score, posted().targetScore)}
            </p>
            <Show when={posted().badgeGranted}>
              <p class="mp-legend-result__line">Its badge is yours.</p>
            </Show>
          </>
        )}
      </Show>
      <Show when={state() === 'saving'}>
        <h2 class="mp-legend-result__headline" data-quiet="true">
          Saving your take
        </h2>
      </Show>
      <Show when={state() === 'failed'}>
        <p class="mp-legend-result__line" role="alert">
          {needsSignIn()
            ? 'Sign in to post Legend scores: this take was not recorded.'
            : 'Your score was not posted. Try the line again when you are ready.'}
        </p>
      </Show>
      <Show when={state() === 'practice'}>
        <h2 class="mp-legend-result__headline" data-quiet="true">
          Practice runs stay off the board.
        </h2>
        <Show when={props.take.challenge()}>
          {(picked) => (
            <p class="mp-legend-result__line">
              {askLine(null, picked().targetScore)}
            </p>
          )}
        </Show>
      </Show>

      <div class="mp-legend-card mp-legend-result__trace">
        <LegendTrace
          view={props.trace}
          box={TRACE_BOX}
          summary={`Your take: ${litLine(props.lit, props.total)}${props.misses === null ? '' : `, ${props.misses}`}`}
        />
        <div class="mp-legend-result__tally">
          <span class="mp-legend-result__lit">
            {litLine(props.lit, props.total)}
          </span>
          <Show when={props.misses}>
            {(line) => <span class="mp-legend-result__misses">{line()}</span>}
          </Show>
        </div>
      </div>

      <Show
        when={
          state() === 'posted' && props.board !== null
            ? standingLine(props.board)
            : null
        }
      >
        {(line) => (
          <p
            class="mp-legend-card mp-legend-you mp-legend-result__you"
            data-testid="legend-result-you"
          >
            <span class="mp-legend-tag" aria-hidden="true">
              You
            </span>
            <span class="mp-legend-you__words">{line()}</span>
          </p>
        )}
      </Show>

      <Show when={state() === 'posted' ? props.result : null}>
        {(posted) => (
          <div class="mp-legend-result__merc">
            <MercPresence
              state={() =>
                posted().tier === 'attempted' ? 'point' : 'celebrate'
              }
              stillSrc={legendStill(
                posted().tier === 'attempted' ? 'point' : 'celebrate',
              )}
              size={68}
              class="mp-legend-merc__box"
              testId="legend-result-merc"
            />
            <div class="mp-legend-bubble">
              <p class="mp-legend-bubble__say">{mercLine(posted().tier)}</p>
            </div>
          </div>
        )}
      </Show>

      <Show when={state() === 'failed' && needsSignIn()}>
        <button
          type="button"
          class="mp-legend-btn mp-legend-btn--fill mp-legend-result__sign-in"
          data-testid="legend-result-sign-in"
          onClick={() => openSignIn()}
        >
          Sign in
        </button>
      </Show>
      <div class="mp-legend-pair mp-legend-result__actions">
        <button
          type="button"
          class="mp-legend-btn"
          classList={{
            'mp-legend-btn--fill': !(state() === 'failed' && needsSignIn()),
            'mp-legend-btn--line': state() === 'failed' && needsSignIn(),
          }}
          data-testid="legend-again"
          aria-disabled={state() === 'saving' ? 'true' : undefined}
          onClick={() => {
            if (state() === 'saving') return
            props.onAgain()
          }}
        >
          Again
        </button>
        <button
          type="button"
          class="mp-legend-btn mp-legend-btn--line"
          data-testid="legend-done"
          onClick={() => props.onDone()}
        >
          Done
        </button>
      </div>
    </div>
  )
}
