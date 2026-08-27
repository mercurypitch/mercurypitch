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
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { isProvisional } from '@/lib/ear/elo'
import { HOME_DEGREES, HOME_DRILL_ID, HOME_SING_DRILL_ID, } from '@/lib/ear/item-bank'
import { micManager } from '@/lib/mic-manager'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { earPlayerRating, homeAnswerMode, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import { IconMic, IconPlay } from './ear-icons'
import type { PadState, StageKey } from './EarStage'
import { ConsoleNote, ConsoleStack, ConsoleWarning, EarStage, EndPlate, ModeToggle, OutcomeDots, Pads, PlateBadge, PlateDelta, PlateLine, PlayPad, StagePad, } from './EarStage'
import { TuningFork } from './TuningFork'
import type { HomeAnswerMode, SingCapture } from './use-home-controller'
import { useHomeController } from './use-home-controller'

interface HomeDrillProps {
  onBack: () => void
}

const MIC_CONSUMER = 'ear-home-drill'

const MODES: ReadonlyArray<{ id: HomeAnswerMode; label: string }> = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

export function HomeDrill(props: HomeDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
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
  })

  function releaseMic(): void {
    f0?.dispose()
    f0 = null
    micManager.release(MIC_CONSUMER)
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
        const stream = await micManager.acquire(MIC_CONSUMER)
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
        return 'Which degree was that?'
      case 'reveal': {
        const degree = target()
        if (!degree) return ''
        if (controller.answeredDegree() === null) {
          return `No clear take — that was ${degree.solfege} (${degree.degree}). Round skipped, rating untouched.`
        }
        return correct()
          ? `Yes — ${degree.solfege} (${degree.degree})${centsLabel()}.`
          : `That was ${degree.solfege} (${degree.degree}) — hear it fall home.`
      }
      default:
        return 'A cadence plants the key, then one note sounds — name its degree.'
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

  const keys = (): StageKey[] => {
    if (phase() === 'idle') {
      return [{ key: 'Space', action: () => void handleStart() }]
    }
    if (phase() !== 'answer' || controller.mode() !== 'tap') return []
    return HOME_DEGREES.map((degree) => ({
      key: String(degree.degree),
      action: () => controller.answer(degree.degree),
    }))
  }

  /** The ear-vs-voice line, once both modes have been rated. */
  const earVsVoice = (): string | null => {
    const ear = earPlayerRating(HOME_DRILL_ID)
    const voice = earPlayerRating(HOME_SING_DRILL_ID)
    if (ear.attempts === 0 || voice.attempts === 0) return null
    const gap = Math.round(ear.rating - voice.rating)
    if (Math.abs(gap) < 40) return 'Ear and voice are moving together.'
    return gap > 0
      ? `Your ear (tap ${Math.round(ear.rating)}) leads your voice (sing ${Math.round(voice.rating)}) — the hearing is there; drill the production.`
      : `Your voice (sing ${Math.round(voice.rating)}) leads your ear (tap ${Math.round(ear.rating)}) — rare, and worth more tap rounds.`
  }

  return (
    <EarStage
      drillId="home"
      name="Home"
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
      focusConsole={() => phase() === 'answer' && controller.mode() === 'tap'}
      onBack={props.onBack}
      onStop={running() ? () => controller.stop() : undefined}
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
                  degree: target()?.degree ?? 0,
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
                <ConsoleNote>
                  <Show
                    when={homeAnswerMode() === 'mic'}
                    fallback="A short cadence tells your ear where home is. Then one note sounds — name its scale degree. This is the hearing that transfers to real music: not “a major sixth”, but “that note is La, and it wants to fall to Sol”."
                  >
                    Mic mode answers by ear alone — no buttons to luck into —
                    and reads your intonation on every note. Octave does not
                    matter; sing or play the degree anywhere comfortable.
                  </Show>
                </ConsoleNote>
                <Show when={micError() !== ''}>
                  <ConsoleWarning>{micError()}</ConsoleWarning>
                </Show>
              </ConsoleStack>
            </>
          }
        >
          <PlayPad
            state={phase() === 'answer' ? 'armed' : 'sounding'}
            label={
              phase() === 'answer'
                ? controller.mode() === 'mic'
                  ? 'Listening'
                  : 'Your call'
                : phase() === 'cadence'
                  ? 'The key'
                  : 'The note'
            }
            sub={
              controller.mode() === 'mic'
                ? 'sing or play it'
                : 'Function · degree'
            }
            icon={
              controller.mode() === 'mic' && phase() === 'answer' ? (
                <IconMic size={20} />
              ) : undefined
            }
          />
          <Pads columns={7} compact label="Which degree was that?">
            <For each={HOME_DEGREES}>
              {(degree) => (
                <StagePad
                  keycap={String(degree.degree)}
                  label={String(degree.degree)}
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
              unit={
                result().mode === 'mic' ? 'Voice rating' : 'Function rating'
              }
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
                  title: `Degree ${outcome.degree}${
                    outcome.correct
                      ? ''
                      : outcome.answered === 0
                        ? ' — skipped'
                        : ` — answered ${outcome.answered}`
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
