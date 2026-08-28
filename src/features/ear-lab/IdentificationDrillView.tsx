// ============================================================
// IdentificationDrillView — the button drills on the stage (Leap,
// Stack, Contour). Same skeleton as Home minus the cadence and mic
// machinery: the prompt sounds, the pads name it, the reveal colours
// the truth AND says it, and the plate reports the rating with its
// movement this run.
//
// Mirrors ThresholdDrillView on the Ruler-A side.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { isProvisional } from '@/lib/ear/elo'
import { IconPlay } from './ear-icons'
import type { PadState, StageKey } from './EarStage'
import { ConsoleNote, EarStage, EndPlate, OutcomeDots, Pads, PlateBadge, PlateDelta, PlateLine, PlayPad, StagePad, } from './EarStage'
import type { useIdentificationController } from './use-identification-controller'

export interface IdentificationChoice {
  id: string
  label: string
  sub?: string
}

interface IdentificationDrillViewProps {
  title: string
  drillId: string
  /** The bench caption: what the instrument measures. */
  measures: string
  description: string
  /** The task in one line, shown at idle. */
  prompt: string
  listenHint: string
  answerHint: string
  choices: IdentificationChoice[]
  /** Pads per row (6 for Leap, 3 for Stack and Contour). */
  columns: number
  /** Narrow rungs in one row rather than labelled pads. */
  compact?: boolean
  controller: ReturnType<typeof useIdentificationController>
  /** Reveal copy for a choice, e.g. "Minor 6th". */
  revealName: (choiceId: string) => string
  /** The drill's instrument, reactive to the controller. */
  instrument: () => JSX.Element
  /** A console of the drill's own in place of the choice pads — Echo's
   *  ladder, which answers through the controller itself. */
  answerConsole?: () => JSX.Element
  /** The keys for that console; replaces the digit keys. */
  answerKeys?: () => StageKey[]
  /** Under the description at idle: a mode toggle, a mic warning. */
  idleAside?: JSX.Element
  /** Starts a run; the controller's start unless the drill has to
   *  acquire something (a microphone) first. */
  onStart?: () => void
  /** The stage's mode word while running; "rating run" by default. */
  runMode?: () => string
  onBack: () => void
  /** The back control's label when back is not the bench. */
  backLabel?: string
}

export function IdentificationDrillView(
  props: IdentificationDrillViewProps,
): JSX.Element {
  // No cleanup here: the controller registers its own onCleanup, so
  // disposing from the view too would just double up.
  const phase = () => props.controller.phase()
  const start = () => {
    if (props.onStart) props.onStart()
    else props.controller.start()
  }
  const running = () => phase() !== 'idle' && phase() !== 'done'
  const correct = () =>
    props.controller.answeredId() === props.controller.expectedId()

  const ratingLine = () =>
    `Rating ${Math.round(props.controller.rating().rating)}${
      isProvisional(props.controller.rating()) ? ' · settling' : ''
    }`

  const progress = () =>
    running()
      ? `Round ${Math.min(
          props.controller.round() + 1,
          props.controller.totalRounds,
        )} of ${props.controller.totalRounds} · ${ratingLine()}`
      : ratingLine()

  const status = () => {
    switch (phase()) {
      case 'playing':
        return props.listenHint
      case 'answer':
        return props.answerHint
      case 'reveal': {
        const expected = props.controller.expectedId()
        if (expected === null) return ''
        return correct()
          ? `Yes — ${props.revealName(expected)}.`
          : `That was ${props.revealName(expected)} — listen again.`
      }
      default:
        return props.prompt
    }
  }

  const tone = () =>
    phase() !== 'reveal'
      ? ('neutral' as const)
      : correct()
        ? ('right' as const)
        : ('wrong' as const)

  /** Keycaps only where a digit can name the choice. */
  const keycap = (index: number): string | undefined =>
    props.choices.length <= 9 ? String(index + 1) : undefined

  const padState = (id: string): PadState => {
    if (phase() !== 'reveal') return null
    if (id === props.controller.expectedId()) return 'right'
    if (id === props.controller.answeredId()) return 'wrong'
    return null
  }

  const keys = (): StageKey[] => {
    if (phase() === 'idle') {
      return [{ key: 'Space', action: () => start() }]
    }
    if (props.answerKeys) return props.answerKeys()
    if (phase() !== 'answer' || props.choices.length > 9) return []
    return props.choices.map((choice, i) => ({
      key: String(i + 1),
      action: () => props.controller.answer(choice.id),
    }))
  }

  return (
    <EarStage
      drillId={props.drillId}
      name={props.title}
      mode={
        phase() === 'idle'
          ? 'on the bench'
          : (props.runMode?.() ?? 'rating run')
      }
      progress={progress()}
      status={status()}
      tone={tone()}
      keys={keys}
      focusConsole={() => phase() === 'answer'}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onStop={running() ? () => props.controller.stop() : undefined}
      done={() => phase() === 'done'}
      instrument={props.instrument}
      console={() => (
        <Show
          when={running()}
          fallback={
            <>
              <PlayPad
                label="Begin"
                sub={`${props.controller.totalRounds} rounds`}
                keycap="Space"
                icon={<IconPlay size={20} />}
                onClick={() => start()}
              />
              <ConsoleNote>{props.description}</ConsoleNote>
              {props.idleAside}
            </>
          }
        >
          <PlayPad
            state={phase() === 'answer' ? 'armed' : 'sounding'}
            label={phase() === 'answer' ? 'Your call' : 'Listening'}
            sub={props.measures}
          />
          <Show
            when={props.answerConsole}
            fallback={
              <Pads
                columns={props.columns}
                compact={props.compact}
                label={props.answerHint}
              >
                <For each={props.choices}>
                  {(choice, i) => (
                    <StagePad
                      keycap={keycap(i())}
                      label={choice.label}
                      sub={choice.sub}
                      state={padState(choice.id)}
                      disabled={phase() !== 'answer'}
                      onClick={() => props.controller.answer(choice.id)}
                    />
                  )}
                </For>
              </Pads>
            }
          >
            {(answerConsole) => answerConsole()()}
          </Show>
        </Show>
      )}
      plate={() => (
        <Show when={props.controller.result()}>
          {(result) => (
            <EndPlate
              kicker="Rating"
              value={String(Math.round(result().rating.rating))}
              unit={`${props.title} rating`}
              note={
                <PlateDelta delta={result().ratingDelta} label="this run" />
              }
              onAgain={() => start()}
              onBack={props.onBack}
              backLabel={props.backLabel}
            >
              <Show when={isProvisional(result().rating)}>
                <PlateBadge>
                  Provisional — settling for {10 - result().rating.attempts}{' '}
                  more answers
                </PlateBadge>
              </Show>
              <PlateLine>
                {result().correct} of {result().total} named correctly
              </PlateLine>
              <OutcomeDots
                outcomes={result().outcomes.map((outcome) => ({
                  correct: outcome.correct,
                  title: `${props.revealName(outcome.expectedId)}${
                    outcome.correct
                      ? ''
                      : ` — answered ${props.revealName(outcome.answeredId)}`
                  }`,
                }))}
              />
            </EndPlate>
          )}
        </Show>
      )}
    />
  )
}
