// ============================================================
// HomeDrill — scale-degree identification, the Ear Lab's spine.
//
// A cadence plants the key (the four lamps on the fork's box light
// as the chords land), a probe note sets the fork ringing, and the
// answer comes by tap — the seven rungs of the ladder in the console
// — or by mic: sing or play the degree on any instrument. The reveal
// colours the truth: the correct rung goes signal green; a wrong
// pick goes garnet beside it while the probe replays and falls to
// the tonic. Mic answers add the production half of the diagnostic:
// "Yes — Sol, 12¢ sharp."
//
// The component owns the microphone lifecycle (micManager + f0
// stream); the controller only opens answer windows on it.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { isProvisional } from '@/lib/ear/elo'
import type { DegreeSet } from '@/lib/ear/item-bank'
import { degreeLabel, HOME_SET } from '@/lib/ear/item-bank'
import { micManager } from '@/lib/mic-manager'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { earPlayerRating, homeAnswerMode, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import { useArmingCue } from './arming-cue'
import { IconMic, IconPlay } from './ear-icons'
import type { PadState, StageKey } from './EarStage'
import { ConsoleNote, ConsoleStack, ConsoleWarning, EarStage, EndPlate, ModeToggle, OutcomeDots, Pads, PlateBadge, PlateDelta, PlateLine, PlayPad, StagePad, } from './EarStage'
import { useLastCall } from './reveal-pacing'
import { TuningFork } from './TuningFork'
import type { HomeAnswerMode, SingCapture } from './use-home-controller'
import { useHomeController } from './use-home-controller'

/** The words and shape a degree drill puts on the stage: Home's by
 *  default, Gravity's over the chromatic twelve. */
export interface HomeDrillCopy {
  drillId: string
  name: string
  measures: string
  /** Mic-manager consumer id, one per drill. */
  micConsumer: string
  padLabel: string
  columns: number
  prompt: string
  description: string
  ratingUnit: string
  /** Keycaps per degree, when the digit does not fit (twelve pads). */
  keycaps?: readonly string[]
}

export const HOME_COPY: HomeDrillCopy = {
  drillId: 'home',
  name: 'Home',
  measures: 'Function · degree',
  micConsumer: 'ear-home-drill',
  padLabel: 'Which degree was that?',
  columns: 7,
  prompt: 'A cadence plants the key, then one note sounds — name its degree.',
  description:
    'A short cadence tells your ear where home is. Then one note sounds — name its scale degree. This is the hearing that transfers to real music: not “a major sixth”, but “that note is La, and it wants to fall to Sol”.',
  ratingUnit: 'Function rating',
}

interface HomeDrillProps {
  onBack: () => void
  /** The degrees to run over; Home's seven unless told otherwise. */
  set?: DegreeSet
  copy?: HomeDrillCopy
}

const MODES: ReadonlyArray<{ id: HomeAnswerMode; label: string }> = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

export function HomeDrill(props: HomeDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  // The set and the copy are fixed for the drill's life: a stage is
  // mounted per drill, never re-pointed.
  // eslint-disable-next-line solid/reactivity
  const set = props.set ?? HOME_SET
  // eslint-disable-next-line solid/reactivity
  const copy = props.copy ?? HOME_COPY
  const labelOf = (degree: number): string =>
    degreeLabel(set.degrees.find((d) => d.degree === degree))
  const [micError, setMicError] = createSignal('')

  let f0: F0Stream | null = null
  const capture: SingCapture = {
    startWindow: () => f0?.startTask(),
    takeFrames: () =>
      (f0?.takeFrames() ?? []).map((frame) => ({
        f0: frame.f0,
        conf: frame.conf,
      })),
  }

  const controller = useHomeController(audioEngine, capture, {
    cancelAudio: () => audioEngine.stopTone(60),
    set,
  })

  function releaseMic(): void {
    f0?.dispose()
    f0 = null
    micManager.release(copy.micConsumer)
  }
  // The controller registers its own cleanup; this one owns the mic.
  onCleanup(releaseMic)

  async function handleStart(): Promise<void> {
    setMicError('')
    let mode: HomeAnswerMode = homeAnswerMode()
    if (mode === 'mic' && f0 === null) {
      try {
        await audioEngine.init()
        await audioEngine.resume()
        const ctx = audioEngine.getAudioContext()
        if (!ctx) throw new Error('Audio engine has no context')
        const stream = await micManager.acquire(copy.micConsumer)
        f0 = createF0Stream(ctx, stream)
      } catch {
        setMicError(
          'Microphone unavailable — starting in tap mode. Allow mic access to sing your answers.',
        )
        mode = 'tap'
      }
    } else if (mode === 'tap' && f0 !== null) {
      // Switched back to tapping: hand the device back rather than
      // holding an open mic for a run that will never listen.
      releaseMic()
    }
    controller.start(mode)
  }

  const phase = () => controller.phase()
  const running = () => phase() !== 'idle' && phase() !== 'done'
  const target = () => controller.currentDegree()
  const correct = () => controller.answeredDegree() === target()?.degree

  const centsLabel = (): string => {
    const cents = controller.lastCents()
    if (cents === null) return ''
    if (Math.abs(cents) < 8) return ', dead in tune'
    return `, ${Math.abs(cents)}¢ ${cents > 0 ? 'sharp' : 'flat'}`
  }

  const status = () => {
    switch (phase()) {
      case 'cadence':
        return 'Planting the key…'
      case 'probe':
        return 'The note — which degree is it?'
      case 'answer':
        if (controller.mode() === 'mic') {
          return controller.unclear()
            ? 'Did not catch that — once more, louder and steadier.'
            : 'Sing or play the degree you heard…'
        }
        return copy.padLabel
      case 'reveal': {
        const degree = target()
        if (!degree) return ''
        if (controller.answeredDegree() === null) {
          return `No clear take — that was ${degree.solfege} (${degreeLabel(degree)}). Round skipped, rating untouched.`
        }
        return correct()
          ? `Yes — ${degree.solfege} (${degreeLabel(degree)})${centsLabel()}.`
          : `That was ${degree.solfege} (${degreeLabel(degree)}) — hear it fall home.`
      }
      default:
        return copy.prompt
    }
  }

  const tone = () => {
    if (phase() !== 'reveal' || controller.answeredDegree() === null) {
      return 'neutral' as const
    }
    return correct() ? ('right' as const) : ('wrong' as const)
  }

  const ratingLine = () =>
    `${controller.mode() === 'mic' && running() ? 'Voice · ' : ''}Rating ${Math.round(
      controller.rating().rating,
    )}${isProvisional(controller.rating()) ? ' · settling' : ''}`

  const progress = () =>
    running()
      ? `Round ${Math.min(controller.round() + 1, controller.totalRounds)} of ${
          controller.totalRounds
        } · ${ratingLine()}`
      : ratingLine()

  const padState = (degree: number): PadState => {
    if (phase() !== 'reveal') return null
    if (degree === target()?.degree) return 'right'
    if (degree === controller.answeredDegree()) return 'wrong'
    return null
  }

  /** Auto-advance off: the verdict waits for the Next pad. */
  const parked = () => controller.parked()

  const keys = (): StageKey[] => {
    if (phase() === 'idle') {
      return [{ key: 'Space', action: () => void handleStart() }]
    }
    if (parked()) return [{ key: 'Space', action: () => controller.next() }]
    if (phase() !== 'answer' || controller.mode() !== 'tap') return []
    return set.degrees.map((degree, i) => ({
      key: copy.keycaps?.[i] ?? String(degree.degree),
      action: () => controller.answer(degree.degree),
    }))
  }

  /** The ear-vs-voice line, once both modes have been rated. */
  const earVsVoice = (): string | null => {
    const ear = earPlayerRating(set.tapDrillId)
    const voice = earPlayerRating(set.micDrillId)
    if (ear.attempts === 0 || voice.attempts === 0) return null
    const gap = Math.round(ear.rating - voice.rating)
    if (Math.abs(gap) < 40) return 'Ear and voice are moving together.'
    return gap > 0
      ? `Your ear (tap ${Math.round(ear.rating)}) leads your voice (sing ${Math.round(voice.rating)}) — the hearing is there; drill the production.`
      : `Your voice (sing ${Math.round(voice.rating)}) leads your ear (tap ${Math.round(ear.rating)}) — rare, and worth more tap rounds.`
  }

  let ratingBefore = 0
  createEffect(() => {
    if (phase() === 'cadence') {
      ratingBefore = untrack(() => controller.rating().rating)
    }
  })

  useArmingCue(() => phase() === 'answer')

  const lastCall = useLastCall(phase, () => {
    const answered = controller.answeredDegree()
    const degree = target()
    const move = `Rating ${Math.round(ratingBefore)} → ${Math.round(
      controller.rating().rating,
    )}`
    const named =
      answered !== null && degree && answered !== degree.degree
        ? `You named ${labelOf(answered)} · `
        : ''
    return {
      correct: answered !== null && correct(),
      line: status(),
      consequence: answered === null ? 'Rating untouched' : `${named}${move}`,
      label: `Round ${controller.round() + 1}`,
    }
  })

  return (
    <EarStage
      drillId={copy.drillId}
      name={copy.name}
      measures={copy.measures}
      description={copy.description}
      mode={
        phase() === 'idle'
          ? 'on the bench'
          : controller.mode() === 'mic'
            ? 'sung answers'
            : 'rating run'
      }
      progress={progress()}
      status={status()}
      tone={tone()}
      keys={keys}
      focusConsole={() =>
        (phase() === 'answer' && controller.mode() === 'tap') || parked()
      }
      onBack={props.onBack}
      onStop={running() ? () => controller.stop() : undefined}
      lastCall={lastCall}
      armed={() => phase() === 'answer'}
      done={() => phase() === 'done'}
      instrument={() => (
        <TuningFork
          cadenceStep={
            phase() === 'cadence'
              ? controller.cadenceStep()
              : phase() === 'idle' || phase() === 'done'
                ? 0
                : 4
          }
          ringing={phase() === 'probe'}
          listening={phase() === 'answer' && controller.mode() === 'mic'}
          reveal={
            phase() === 'reveal' && target()
              ? {
                  degree: degreeLabel(target()),
                  solfege: target()?.solfege ?? '',
                  correct:
                    controller.answeredDegree() === null ? null : correct(),
                }
              : null
          }
        />
      )}
      console={() => (
        <Show
          when={running()}
          fallback={
            <>
              <PlayPad
                label="Begin"
                sub={`${controller.totalRounds} rounds`}
                keycap="Space"
                icon={
                  homeAnswerMode() === 'mic' ? (
                    <IconMic size={20} />
                  ) : (
                    <IconPlay size={20} />
                  )
                }
                onClick={() => void handleStart()}
              />
              <ConsoleStack>
                <ModeToggle
                  label="How to answer"
                  value={homeAnswerMode()}
                  options={MODES}
                  onChange={setHomeAnswerMode}
                />
                <Show when={homeAnswerMode() === 'mic'}>
                  <ConsoleNote>
                    Mic mode answers by ear alone — no buttons to luck into —
                    and reads your intonation on every note. Octave does not
                    matter; sing or play the degree anywhere comfortable.
                  </ConsoleNote>
                </Show>
                <Show when={micError() !== ''}>
                  <ConsoleWarning>{micError()}</ConsoleWarning>
                </Show>
              </ConsoleStack>
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
                    ? controller.mode() === 'mic'
                      ? 'Listening'
                      : 'Your call'
                    : phase() === 'cadence'
                      ? 'The key'
                      : phase() === 'reveal'
                        ? 'Next'
                        : 'The note'
                }
                icon={
                  controller.mode() === 'mic' && phase() === 'answer' ? (
                    <IconMic size={20} />
                  ) : undefined
                }
              />
            }
          >
            <PlayPad
              label="Next"
              keycap="Space"
              icon={<IconPlay size={20} />}
              onClick={() => controller.next()}
            />
          </Show>
          <Pads columns={copy.columns} compact label={copy.padLabel}>
            <For each={set.degrees}>
              {(degree, i) => (
                <StagePad
                  keycap={copy.keycaps?.[i()] ?? String(degree.degree)}
                  label={degreeLabel(degree)}
                  sub={degree.solfege}
                  state={padState(degree.degree)}
                  disabled={phase() !== 'answer' || controller.mode() === 'mic'}
                  onClick={() => controller.answer(degree.degree)}
                />
              )}
            </For>
          </Pads>
        </Show>
      )}
      plate={() => (
        <Show when={controller.result()}>
          {(result) => (
            <EndPlate
              kicker="Rating"
              value={String(Math.round(result().rating.rating))}
              unit={result().mode === 'mic' ? 'Voice rating' : copy.ratingUnit}
              note={
                <PlateDelta delta={result().ratingDelta} label="this run" />
              }
              onAgain={() => void handleStart()}
              onBack={props.onBack}
            >
              <Show when={isProvisional(result().rating)}>
                <PlateBadge>
                  Provisional — settling for {10 - result().rating.attempts}{' '}
                  more answers
                </PlateBadge>
              </Show>
              <PlateLine>
                {result().correct} of {result().total} named correctly
                {result().skipped > 0
                  ? ` · ${result().skipped} skipped (unclear)`
                  : ''}
                {result().medianAbsCents !== null
                  ? ` · voice typically ${result().medianAbsCents}¢ off when right`
                  : ''}
              </PlateLine>
              <Show when={earVsVoice()}>
                {(line) => <PlateLine>{line()}</PlateLine>}
              </Show>
              <OutcomeDots
                outcomes={result().outcomes.map((outcome) => ({
                  correct: outcome.correct,
                  skipped: !outcome.correct && outcome.answered === 0,
                  title: `Degree ${labelOf(outcome.degree)}${
                    outcome.correct
                      ? ''
                      : outcome.answered === 0
                        ? ' — skipped'
                        : ` — answered ${labelOf(outcome.answered)}`
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
