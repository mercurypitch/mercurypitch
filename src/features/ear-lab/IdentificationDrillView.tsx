// ============================================================
// IdentificationDrillView — the button drills on the stage (Leap,
// Stack, Contour). Same skeleton as Home minus the cadence and mic
// machinery: the prompt sounds, the pads name it, the reveal colours
// the truth AND says it, and the plate reports the rating with its
// movement this run.
//
// Mirrors ThresholdDrillView on the Ruler-A side.
//
// On a phone build with the Ear Lab with Merc it also hands the native
// room what it draws on its own (`room`, stage-room.ts): the round line,
// the rating's move at the verdict, the plate in numbers. A run a
// station row or Today's button asked for starts as the room opens. A
// slip on the plate between two of the drill's items starts a pair
// practice on them (pair-practice.ts), which rates nothing and ends on
// a plate of its own.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, For, onMount, Show, untrack } from 'solid-js'
import { isProvisional, PROVISIONAL_ATTEMPTS } from '@/lib/ear/elo'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { useArmingCue } from './arming-cue'
import { IconPlay } from './ear-icons'
import type { PadState, StageKey } from './EarStage'
import { EndPlate, OutcomeDots, Pads, PlateBadge, PlateDelta, PlateLine, PlayPad, StagePad, } from './EarStage'
import { useLastCall } from './reveal-pacing'
import { slipsOf } from './slips'
import type { PlateSlip, RoomPlate, StageRoom } from './stage-room'
import { identificationBeat, ratedRunPlate, takeRoomStart } from './stage-room'
import { EarStage } from './stage-switch'
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
  /** A lamp per pad, lit while its stimulus sounds (The Pull). */
  padLamp?: (choiceId: string) => boolean
  /** Pads per row (6 for Leap, 3 for Stack and Contour). */
  columns: number
  /** Narrow rungs in one row rather than labelled pads. */
  compact?: boolean
  controller: ReturnType<typeof useIdentificationController>
  /** Reveal copy for a choice, e.g. "Minor 6th". */
  revealName: (choiceId: string) => string
  /** "named" unless the answer was tapped or sung back. */
  answerVerb?: string
  /** After a miss, where it went wrong: "first slip at note 2". */
  slipNote?: () => string | undefined
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

/** The same text with its first letter upper case. */
const sentenceCase = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1)

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
  /** Auto-advance off: the verdict waits for the Next pad. */
  const parked = () => props.controller.parked()

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
        // A reveal name is written to follow "That was", so Pull's starts
        // lower case ("the first, Ti leaning to Do′"). After "Yes." it opens
        // a sentence of its own.
        return correct()
          ? `Yes. ${sentenceCase(props.revealName(expected))}.`
          : `That was ${props.revealName(expected)}. Listen again.`
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
    if (parked()) {
      return [{ key: 'Space', action: () => props.controller.next() }]
    }
    if (props.answerKeys) return props.answerKeys()
    if (phase() !== 'answer' || props.choices.length > 9) return []
    return props.choices.map((choice, i) => ({
      key: String(i + 1),
      action: () => props.controller.answer(choice.id),
    }))
  }

  // The rating as the round opened, so the plate can say where the
  // answer moved it.
  let ratingBefore = 0
  createEffect(() => {
    if (phase() === 'playing') {
      ratingBefore = untrack(() => props.controller.rating().rating)
    }
  })

  useArmingCue(() => phase() === 'answer')

  /** A choice as the plate names it: its sub, its label, or its reveal,
   *  as the drill writes it. Upper-casing the first letter turned
   *  Cadence's vi into a "Vi" that is no chord. */
  const plateName = (id: string): string => {
    const choice = props.choices.find((entry) => entry.id === id)
    return choice?.sub ?? choice?.label ?? props.revealName(id)
  }

  /** What the native room draws on its own; nothing on any other build. */
  const room: StageRoom | undefined = EAR_LAB_WITH_MERC
    ? {
        run: () =>
          props.controller.practice() === null ? 'rated' : 'practice',
        practising: () => {
          const pair = props.controller.practice()
          return pair === null ? null : [plateName(pair[0]), plateName(pair[1])]
        },
        short: () => props.controller.short(),
        beat: () => identificationBeat(phase()),
        sounding: () => phase() === 'playing' || props.controller.replaying(),
        get prompt() {
          return props.prompt
        },
        line: () =>
          running()
            ? {
                kind: 'rounds',
                round: Math.min(
                  props.controller.round() + 1,
                  props.controller.totalRounds,
                ),
                total: props.controller.totalRounds,
                answered:
                  props.controller.round() + (phase() === 'reveal' ? 1 : 0),
              }
            : null,
        replay: {
          allowed: () => props.controller.replayAllowed(),
          play: () => void props.controller.replay(),
        },
        parked: () => props.controller.parked(),
        next: () => props.controller.next(),
        pause: () => props.controller.pause(),
        hold: () => props.controller.holdQuestion(),
        held: () => props.controller.held(),
        resume: () => void props.controller.resumeQuestion(),
        abandon: () => props.controller.abandon(),
        plate: (): RoomPlate | null => {
          const result = props.controller.result()
          if (result === null) return null
          const outcomes = result.outcomes.map((outcome) => ({
            correct: outcome.correct,
            title: `${props.revealName(outcome.expectedId)}${
              outcome.correct
                ? ''
                : ` (answered ${props.revealName(outcome.answeredId)})`
            }`,
          }))
          // A slip between two of the drill's items offers practice on them.
          const slips = slipsOf(result.outcomes, plateName).map(
            (slip): PlateSlip => {
              const pair = props.controller.practicePair(
                slip.expectedId,
                slip.answeredId,
              )
              return pair === null
                ? slip
                : { ...slip, practise: () => props.controller.practise(pair) }
            },
          )
          const practice = props.controller.practice()
          return ratedRunPlate(
            {
              rating: Math.round(result.rating.rating),
              before: Math.round(result.rating.rating - result.ratingDelta),
              source: `${props.title} rating`,
              settling: isProvisional(result.rating)
                ? PROVISIONAL_ATTEMPTS - result.rating.attempts
                : null,
              rounds: result.total,
              right: result.correct,
              rightWord: props.answerVerb ?? 'named',
              outcomes,
              slips,
            },
            practice === null
              ? null
              : [plateName(practice[0]), plateName(practice[1])],
          )
        },
        again: () => start(),
      }
    : undefined

  // A station row or Today's button asked for a run: it starts as the
  // room opens, still inside the tap that opened it.
  onMount(() => {
    if (!EAR_LAB_WITH_MERC) return
    const request = takeRoomStart(props.drillId)
    if (request !== null && phase() === 'idle') start()
  })

  const lastCall = useLastCall(phase, () => {
    const expected = props.controller.expectedId()
    const answered = props.controller.answeredId()
    // A pair practice moves no rating, so it says none.
    const move =
      props.controller.practice() === null
        ? `Rating ${Math.round(ratingBefore)} → ${Math.round(
            props.controller.rating().rating,
          )}`
        : undefined
    const named =
      !correct() && answered !== null && answered !== expected
        ? `You ${props.answerVerb ?? 'named'} ${props.revealName(answered)}`
        : undefined
    const slip = correct() ? undefined : props.slipNote?.()
    return {
      correct: correct(),
      line: status(),
      consequence: [named, slip, move]
        .filter((part) => part !== undefined)
        .join(' · '),
      label: `Round ${props.controller.round() + 1}`,
    }
  })

  return (
    <EarStage
      drillId={props.drillId}
      name={props.title}
      measures={props.measures}
      description={props.description}
      mode={
        phase() === 'idle'
          ? 'on the bench'
          : (props.runMode?.() ?? 'rating run')
      }
      progress={progress()}
      status={status()}
      tone={tone()}
      keys={keys}
      focusConsole={() => phase() === 'answer' || parked()}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onStop={running() ? () => props.controller.stop() : undefined}
      lastCall={lastCall}
      armed={() => phase() === 'answer'}
      done={() => phase() === 'done'}
      room={room}
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
              {props.idleAside}
            </>
          }
        >
          <Show
            when={parked()}
            fallback={
              <PlayPad
                state={phase() === 'answer' ? 'armed' : 'sounding'}
                label={
                  phase() === 'answer'
                    ? 'Your call'
                    : phase() === 'reveal' && !props.controller.replaying()
                      ? 'Next'
                      : 'Listening'
                }
              />
            }
          >
            <PlayPad
              label="Next"
              keycap="Space"
              icon={<IconPlay size={20} />}
              onClick={() => props.controller.next()}
            />
          </Show>
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
                      lamp={props.padLamp?.(choice.id)}
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
                  Provisional: settling for {10 - result().rating.attempts} more
                  answers
                </PlateBadge>
              </Show>
              <PlateLine>
                {result().total === 0
                  ? 'Stopped before the first answer. Nothing marked.'
                  : `${result().correct} of ${result().total} named correctly`}
              </PlateLine>
              <OutcomeDots
                outcomes={result().outcomes.map((outcome) => ({
                  correct: outcome.correct,
                  title: `${props.revealName(outcome.expectedId)}${
                    outcome.correct
                      ? ''
                      : ` (answered ${props.revealName(outcome.answeredId)})`
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
