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
//
// On a phone build with the Ear Lab with Merc it also hands the native
// room what it draws on its own (`room`, stage-room.ts), says the way a
// run answers in the room's mode line, and points a refused microphone
// at the phone's Settings rather than a browser's. A tapped miss offers
// Compare there: the answer's note, then the pick's, in the round's key.
// Each slip on the rated plate starts a pair practice on its two
// degrees (pair-practice.ts), which rates nothing.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { isProvisional, PROVISIONAL_ATTEMPTS } from '@/lib/ear/elo'
import type { DegreeSet } from '@/lib/ear/item-bank'
import { degreeLabel, HOME_SET } from '@/lib/ear/item-bank'
import { micManager } from '@/lib/mic-manager'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { earPlayerRating, homeAnswerMode, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import { nativeShellApi } from '@/stores/native-shell-store'
import { useArmingCue } from './arming-cue'
import { IconMic, IconPlay } from './ear-icons'
import type { PadState, StageKey } from './EarStage'
import { ConsoleLink, ConsoleNote, ConsoleStack, ConsoleWarning, EndPlate, ModeToggle, OutcomeDots, Pads, PlateBadge, PlateDelta, PlateLine, PlayPad, StagePad, } from './EarStage'
import { useLastCall } from './reveal-pacing'
import { runSlips } from './slips'
import type { PlateSlip, RoomBeat, RoomPlate, StageRoom } from './stage-room'
import { ratedRunPlate, takeRoomStart } from './stage-room'
import { EarStage } from './stage-switch'
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
  prompt: 'A cadence plants the key, then one note sounds. Name its degree.',
  description:
    'A short cadence tells your ear where home is. Then one note sounds. Name its scale degree. This is the hearing that transfers to real music: not “a major sixth”, but “that note is La, and it wants to fall to Sol”.',
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

const BEAT: Record<string, RoomBeat> = {
  idle: 'idle',
  cadence: 'listen',
  probe: 'listen',
  answer: 'answer',
  reveal: 'reveal',
  done: 'done',
}

/** A refused microphone, said for where the singer is: the phone's
 *  Settings in the native room, the browser's everywhere else. */
const MIC_REFUSED = EAR_LAB_WITH_MERC
  ? 'The microphone is off for Mercury Pitch, so nothing started. Turn it on in Settings and press Begin again, or answer by tapping.'
  : 'The microphone is not available, so nothing started. Allow microphone access in the browser and press Begin again, or answer by tapping.'

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
  const [micPending, setMicPending] = createSignal(false)

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

  /** True while Begin is waiting on the microphone prompt. A second
   *  Begin then (the pad, Space, the sprint's Start) used to open a
   *  second stream and start a second run over the first. */
  let starting = false

  /** Begin a rated run, or a pair practice on two degrees: either way
   *  through the microphone's question when the answers are sung. */
  async function handleStart(pair?: readonly [number, number]): Promise<void> {
    if (starting) return
    starting = true
    try {
      await startRun(pair)
    } finally {
      starting = false
    }
  }

  /** The pair practice a refused microphone stopped: "Use Tap instead"
   *  starts that practice, not a rated run. Any other start drops it. */
  let refusedPair: readonly [number, number] | undefined

  async function useTapInstead(): Promise<void> {
    setHomeAnswerMode('tap')
    setMicError('')
    await handleStart(refusedPair)
  }

  async function startRun(pair?: readonly [number, number]): Promise<void> {
    setMicError('')
    refusedPair = undefined
    if (homeAnswerMode() === 'mic' && f0 === null) {
      // The permission prompt can take a while, and a denial used to start
      // the run in tap mode with "Sing or play" still selected and nothing
      // said. Now the wait is visible, and a denial stops here with the way
      // to tap one press away; the mode only changes when the player says.
      setMicPending(true)
      try {
        await audioEngine.init()
        await audioEngine.resume()
        const ctx = audioEngine.getAudioContext()
        if (!ctx) throw new Error('Audio engine has no context')
        const stream = await micManager.acquire(copy.micConsumer)
        try {
          f0 = createF0Stream(ctx, stream)
        } catch (error) {
          micManager.release(copy.micConsumer)
          throw error
        }
      } catch {
        refusedPair = pair
        // A start from the plate (Practise, Run again) leaves it for the
        // bench, where the refusal and the way to tap are: no console is
        // drawn under a plate, so the refusal would say nothing at all.
        if (controller.phase() === 'done') controller.reset()
        setMicError(MIC_REFUSED)
        return
      } finally {
        setMicPending(false)
      }
    }
    // Read the mode after the wait: the player may have switched to tapping
    // while the prompt was open, and a run listens or it does not.
    const mode: HomeAnswerMode = homeAnswerMode()
    if (mode === 'tap' && f0 !== null) {
      // Switched back to tapping: hand the device back rather than
      // holding an open mic for a run that will never listen.
      releaseMic()
    }
    if (pair === undefined) controller.start(mode)
    else controller.practise(mode, pair)
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
        return 'The note. Which degree is it?'
      case 'answer':
        if (controller.mode() === 'mic') {
          return controller.unclear()
            ? 'Did not catch that. Once more, louder and steadier.'
            : 'Sing or play the degree you heard…'
        }
        return copy.padLabel
      case 'reveal': {
        const degree = target()
        if (!degree) return ''
        if (controller.answeredDegree() === null) {
          return `No clear take. That was ${degree.solfege} (${degreeLabel(degree)}). Round skipped, rating untouched.`
        }
        return correct()
          ? `Yes. ${degree.solfege} (${degreeLabel(degree)})${centsLabel()}.`
          : `That was ${degree.solfege} (${degreeLabel(degree)}). Hear it fall home.`
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
      ? `Your ear (tap ${Math.round(ear.rating)}) leads your voice (sing ${Math.round(voice.rating)}). The hearing is there; drill the production.`
      : `Your voice (sing ${Math.round(voice.rating)}) leads your ear (tap ${Math.round(ear.rating)}). That's rare, and worth more tap rounds.`
  }

  let ratingBefore = 0
  createEffect(() => {
    if (phase() === 'cadence') {
      ratingBefore = untrack(() => controller.rating().rating)
    }
  })

  useArmingCue(() => phase() === 'answer')

  /** A degree as the plate names it, its number and syllable: "4 Fa". */
  const degreeName = (degree: number): string => {
    const entry = set.degrees.find((candidate) => candidate.degree === degree)
    return entry ? `${degreeLabel(entry)} ${entry.solfege}` : String(degree)
  }
  /** The degree a slip's id stands for: `deg-4` is 4. */
  const degreeOf = (id: string): number => Number(id.slice('deg-'.length))

  /** What the native room draws on its own; nothing on any other build. */
  const room: StageRoom | undefined = EAR_LAB_WITH_MERC
    ? {
        run: () => (controller.practice() === null ? 'rated' : 'practice'),
        practising: () => {
          const pair = controller.practice()
          return pair === null
            ? null
            : [degreeName(pair[0]), degreeName(pair[1])]
        },
        short: () => controller.short(),
        beat: () => BEAT[phase()] ?? 'idle',
        sounding: () =>
          phase() === 'cadence' ||
          phase() === 'probe' ||
          controller.replaying(),
        prompt: copy.prompt,
        line: () =>
          running()
            ? {
                kind: 'rounds',
                round: Math.min(controller.round() + 1, controller.totalRounds),
                total: controller.totalRounds,
                answered: controller.round() + (phase() === 'reveal' ? 1 : 0),
              }
            : null,
        pinned: () =>
          phase() === 'answer' && controller.mode() === 'mic'
            ? 'Listening for your note'
            : null,
        replay: {
          allowed: () => controller.replayAllowed(),
          play: () => void controller.replay(),
        },
        // A tapped miss: the answer's note, then the pick's, by name.
        compare: {
          offered: () => controller.comparable(),
          allowed: () => controller.compareAllowed(),
          play: () => void controller.compare(),
          names: () => {
            const degree = target()
            const picked = set.degrees.find(
              (entry) => entry.degree === controller.answeredDegree(),
            )
            if (!controller.comparable() || !degree || !picked) return null
            return { answer: degree.solfege, pick: picked.solfege }
          },
        },
        parked: () => controller.parked(),
        next: () => controller.next(),
        pause: () => controller.pause(),
        hold: () => controller.holdQuestion(),
        held: () => controller.held(),
        resume: () => void controller.resumeQuestion(),
        abandon: () => controller.abandon(),
        modeNote: () =>
          (phase() === 'idle' ? homeAnswerMode() : controller.mode()) === 'mic'
            ? 'sung answers'
            : 'tapped answers',
        plate: (): RoomPlate | null => {
          const result = controller.result()
          if (result === null) return null
          const source =
            result.mode === 'mic' ? 'Voice rating' : copy.ratingUnit
          const outcomes = result.outcomes.map((outcome) => ({
            correct: outcome.correct,
            skipped: !outcome.correct && outcome.answered === 0,
            title: `Degree ${labelOf(outcome.degree)}${
              outcome.correct
                ? ''
                : outcome.answered === 0
                  ? ' (skipped)'
                  : ` (answered ${labelOf(outcome.answered)})`
            }`,
          }))
          // Every slip is between two degrees, and offers practice on them.
          const slips = runSlips(
            result.outcomes.map((outcome) => ({
              correct: outcome.correct,
              expected: `deg-${outcome.degree}`,
              answered:
                outcome.answered === 0 ? null : `deg-${outcome.answered}`,
            })),
            (id) => degreeName(degreeOf(id)),
          ).map(
            (slip): PlateSlip => ({
              ...slip,
              practise: () =>
                void handleStart([
                  degreeOf(slip.expectedId),
                  degreeOf(slip.answeredId),
                ]),
            }),
          )
          const practice = controller.practice()
          const voice = earVsVoice()
          return ratedRunPlate(
            {
              rating: Math.round(result.rating.rating),
              before: Math.round(result.rating.rating - result.ratingDelta),
              source,
              settling: isProvisional(result.rating)
                ? PROVISIONAL_ATTEMPTS - result.rating.attempts
                : null,
              rounds: result.total,
              right: result.correct,
              replays: controller.replays(),
              outcomes,
              slips,
              // What the run skipped and how the voice sat: a practice's too.
              lines: [
                result.skipped > 0
                  ? `${result.skipped} skipped (unclear)`
                  : null,
                result.medianAbsCents !== null
                  ? `Voice typically ${result.medianAbsCents}¢ off when right`
                  : null,
              ].filter((line): line is string => line !== null),
            },
            practice === null
              ? null
              : [degreeName(practice[0]), degreeName(practice[1])],
            // Ear against voice weighs two ratings: the rated plate's alone.
            voice === null ? [] : [voice],
          )
        },
        again: () => void handleStart(),
      }
    : undefined

  // A station row or Today's button asked for a run, its way of
  // answering already chosen: it starts as the room opens.
  onMount(() => {
    if (!EAR_LAB_WITH_MERC) return
    const request = takeRoomStart(copy.drillId)
    if (request !== null && phase() === 'idle') void handleStart()
  })

  const lastCall = useLastCall(phase, () => {
    const answered = controller.answeredDegree()
    const degree = target()
    // A pair practice moves no rating, so it says none.
    const practising = controller.practice() !== null
    const move = practising
      ? undefined
      : `Rating ${Math.round(ratingBefore)} → ${Math.round(
          controller.rating().rating,
        )}`
    const named =
      answered !== null && degree && answered !== degree.degree
        ? `You named ${labelOf(answered)}`
        : undefined
    return {
      correct: answered !== null && correct(),
      line: status(),
      consequence:
        answered === null
          ? practising
            ? ''
            : 'Rating untouched'
          : [named, move].filter((part) => part !== undefined).join(' · '),
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
      room={room}
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
          scale={set.degrees}
          reveal={
            phase() === 'reveal' && target()
              ? {
                  degree: degreeLabel(target()),
                  solfege: target()?.solfege ?? '',
                  correct:
                    controller.answeredDegree() === null ? null : correct(),
                  semitone: target()?.semitone,
                  picked:
                    controller.answeredDegree() === null || correct()
                      ? null
                      : (set.degrees.find(
                          (d) => d.degree === controller.answeredDegree(),
                        )?.semitone ?? null),
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
                    Mic mode answers by ear alone (no buttons to luck into) and
                    reads your intonation on every note. Octave does not matter;
                    sing or play the degree anywhere comfortable.
                  </ConsoleNote>
                </Show>
                <Show when={micPending()}>
                  <ConsoleNote>Waiting for the microphone…</ConsoleNote>
                </Show>
                <Show when={micError() !== ''}>
                  <ConsoleWarning>{micError()}</ConsoleWarning>
                  {EAR_LAB_WITH_MERC ? (
                    <Show when={nativeShellApi()?.openAppSettings}>
                      {(openSettings) => (
                        <ConsoleLink onClick={() => void openSettings()()}>
                          Open Settings
                        </ConsoleLink>
                      )}
                    </Show>
                  ) : null}
                  <ConsoleLink onClick={() => void useTapInstead()}>
                    Use Tap instead
                  </ConsoleLink>
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
                  Provisional: settling for {10 - result().rating.attempts} more
                  answers
                </PlateBadge>
              </Show>
              <PlateLine>
                {result().total === 0
                  ? 'Stopped before the first answer. Nothing marked.'
                  : `${result().correct} of ${result().total} named correctly`}
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
                        ? ' (skipped)'
                        : ` (answered ${labelOf(outcome.answered)})`
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
