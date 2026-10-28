// ============================================================
// ChartDrill — rhythm reading: the pattern on the paper, tapped at
// sight.
//
// Pulse's mirror. Nothing is sounded but the beat: the pattern is
// written on the drum's upper rule from the moment the round opens,
// four clicks count the tempo in, and then everything stops. The bar
// waits for the player the same way Pulse's does — silence until the
// first tap, which anchors the take as the pattern's first onset, and
// the rest is judged by its distance from the anchor
// (`anchored-take.ts`). From that tap the beat ticks under the bar and
// the progress line fills left to right.
// Ear training reversed: the eye reads, the hand keeps the time.
//
// Same bank shapes as Pulse under its own ids and rating, so the
// bench can show where reading and dictation part ways.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, onMount, Show, untrack } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { CHART_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { isProvisional, PROVISIONAL_ATTEMPTS } from '@/lib/ear/elo'
import type { Subdivision } from '@/lib/ear/rhythm-take'
import { anchorTaps, barBeats, clearedSubdivision, finestSubdivision, toleranceFor, } from '@/lib/ear/rhythm-take'
import { createTapLedger } from '@/lib/ear/tap-input'
import { PULSE_TIMING } from '@/lib/ear/timing'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { micLatencyMs } from '@/stores/mic-latency-store'
import type { AnchoredTake } from './anchored-take'
import { startAnchoredTake } from './anchored-take'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import { IconPlay } from './ear-icons'
import { useEarRoom } from './ear-room-context'
import { ConsoleNote, EndPlate, OutcomeDots, PlateBadge, PlateDelta, PlateLine, PlayPad, TapPad, } from './EarStage'
import { useLastCall } from './reveal-pacing'
import type { DrumBar, DrumReveal } from './RhythmDrum'
import { RhythmDrum } from './RhythmDrum'
import type { RatingPlate, StageRoom } from './stage-room'
import { identificationBeat, takeRoomStart } from './stage-room'
import { EarStage } from './stage-switch'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

/** The task in one line: the idle status, and Merc's first bubble. */
const PROMPT = 'A written bar over the click. Tap it at sight.'

const MISS = 'miss'

const CHART_DESCRIPTION =
  'The pattern is written on the drum. Nothing sounds but the beat. Four clicks count the tempo in, then it waits: nothing plays until your first tap (pad or Space), which is the first written onset, wherever you place it. From there the beat keeps you company and the bar fills left to right. Tap the rest of the chart at the same tempo, every onset in order, nothing extra. Reading, where Pulse is dictation.'

export function ChartDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findIdentificationDrill('chart')
  if (!drill) throw new Error('chart drill missing from catalogue')

  const [bar, setBar] = createSignal<DrumBar>(null)
  const [beat, setBeat] = createSignal(0)
  const [beats, setBeats] = createSignal(4)
  const [score, setScore] = createSignal<readonly number[] | null>(null)
  const [take, setTake] = createSignal<DrumReveal | null>(null)
  const [begun, setBegun] = createSignal(true)
  const [tapCount, setTapCount] = createSignal(0)
  /** Null until the tap that starts the bar; then where the anchor
   *  stood in it and how long the bar has left, for the drum's fill. */
  const [barRun, setBarRun] = createSignal<{
    from: number
    durationMs: number
  } | null>(null)
  /** The grid the pattern sits on, drawn with the score — reading
   *  a gallop means seeing where its second note belongs. */
  const [grid, setGrid] = createSignal<Subdivision | null>(null)
  /** The take's taps in beats, so they land under the score as
   *  they happen rather than only at the reveal. */
  const [liveTaps, setLiveTaps] = createSignal<readonly number[]>([])
  const ledger = createTapLedger({ latencyMs: micLatencyMs })
  const raw = () => micLatencyMs() <= 0

  let scheduled: ScheduledClick[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let trialCancelled = false
  /** Bumped by every silencing. A replay still waiting on the audio
   *  engine when it comes (the room closed, the run stopped, the sound
   *  taken away) sounds nothing once the engine is ready. */
  let silenced = 0
  let takeHandle: AnchoredTake | null = null
  /** The round's first onset, in ms: the place a take is anchored
   *  on, and so what turns the ledger's taps into beats. */
  let firstOnsetMs = 0

  const period = PULSE_TIMING.periodMs
  const countMs = PULSE_TIMING.beats * period

  /** Silence the clicks and lamps in flight, and nothing else: a replay
   *  at the reveal leaves the take and the reveal on the drum. */
  function stopSounds(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const click of scheduled) click.cancel()
    scheduled = []
  }

  function cancelAudio(): void {
    silenced += 1
    trialCancelled = true
    stopSounds()
    takeHandle?.cancel()
    takeHandle = null
    ledger.disarm()
    setBar(null)
    setBeat(0)
    setBarRun(null)
    setGrid(null)
    setLiveTaps([])
    setScore(null)
  }

  /** A replay at the reveal silenced, its lamps out with it: the take
   *  and the reveal stay on the drum. */
  function silenceReplay(): void {
    silenced += 1
    stopSounds()
    setBar(null)
    setBeat(0)
  }

  const later = (ms: number, fn: () => void) => {
    timers.push(
      setTimeout(() => {
        if (!trialCancelled) fn()
      }, ms),
    )
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const onsetsMs = item.payload.map((b) => b * period)
    const patternBeats = barBeats(item.payload)
    const toleranceMs = toleranceFor(item)
    /** The count-in from `start`, with its lamps. */
    const soundCountIn = (
      ctx: AudioContext,
      start: number,
      soft: { voice: 'soft'; gainLevel: number },
    ) => {
      const s = period / 1000
      for (let k = 0; k < PULSE_TIMING.beats; k++) {
        scheduled.push(scheduleClick(ctx, start + k * s, soft))
        later(PULSE_TIMING.leadS * 1000 + k * period, () => {
          setBar('count')
          setBeat(k + 1)
        })
      }
    }
    return {
      expectedId: item.itemId,
      play: async () => {
        await audioEngine.init()
        await audioEngine.resume()
        const ctx = audioEngine.getAudioContext()
        if (!ctx) return
        cancelAudio()
        trialCancelled = false
        setTake(null)
        setBegun(true)
        setTapCount(0)
        setBarRun(null)
        setBeats(patternBeats)
        setGrid(finestSubdivision(item.payload))
        setLiveTaps([])
        firstOnsetMs = onsetsMs[0] ?? 0
        setScore(item.payload)

        const start = ctx.currentTime + PULSE_TIMING.leadS
        const startMs = performance.now() + PULSE_TIMING.leadS * 1000
        const level = room.volume() * audioEngine.getVolume()
        const soft = { voice: 'soft' as const, gainLevel: level * 0.6 }

        // Only the count-in sounds — the pattern is on the paper.
        soundCountIn(ctx, start, soft)

        // The count-in ends and the lamps stop: the bar is the player's
        // and nothing is running in it until they start it.
        later(PULSE_TIMING.leadS * 1000 + countMs, () => {
          setBar('response')
          setBeat(0)
        })

        // The open bar follows the count-in straight away.
        takeHandle = startAnchoredTake({
          ctx,
          openAtMs: startMs + countMs,
          periodMs: period,
          beats: patternBeats,
          onsetsMs,
          toleranceMs,
          tailMs: PULSE_TIMING.tailMs,
          waitBeats: PULSE_TIMING.waitBeats,
          rail: soft,
          tick: { voice: room.clickVoice(), gainLevel: level * 0.8 },
          ledger,
          onBeat: (b) => {
            setBar('response')
            setBeat(b)
          },
          onStart: setBarRun,
          onJudged: (outcome) => {
            setTake({
              onsets: item.payload,
              met: outcome.verdict.met,
              taps: outcome.tapsBeats,
              extras: outcome.extrasBeats,
              correct: outcome.verdict.correct,
            })
            setBegun(outcome.begun)
            setLiveTaps([])
            ledger.disarm()
            setBar(null)
            setBeat(0)
            setBarRun(null)
            setScore(null)
            controller.answer(outcome.verdict.correct ? item.itemId : MISS)
          },
        })

        // The answer opens a breath before the count-in ends, so an
        // eager first tap is the anchor and never lands on a dead pad.
        await new Promise<void>((resolve) => {
          later(
            PULSE_TIMING.leadS * 1000 + countMs - PULSE_TIMING.armEarlyMs,
            resolve,
          )
        })
      },
      // Hear it again after the answer: the question's only sound was
      // its count-in, so what is heard is the chart itself, the count-in
      // and then the written rhythm, with no take after it. The reveal
      // and the take stay on the drum. Resolves as the bar ends.
      replay: async () => {
        const asked = silenced
        await audioEngine.init()
        await audioEngine.resume()
        const ctx = audioEngine.getAudioContext()
        if (!ctx || asked !== silenced) return
        stopSounds()
        trialCancelled = false
        const start = ctx.currentTime + PULSE_TIMING.leadS
        const level = room.volume() * audioEngine.getVolume()
        soundCountIn(ctx, start, { voice: 'soft', gainLevel: level * 0.6 })
        const call = { voice: room.clickVoice(), gainLevel: level }
        for (const onset of onsetsMs) {
          scheduled.push(
            scheduleClick(ctx, start + countMs / 1000 + onset / 1000, call),
          )
        }
        for (let k = 0; k < patternBeats; k++) {
          later(PULSE_TIMING.leadS * 1000 + countMs + k * period, () => {
            setBar('call')
            setBeat(k + 1)
          })
        }
        await new Promise<void>((resolve) => {
          later(
            PULSE_TIMING.leadS * 1000 + countMs + patternBeats * period,
            () => {
              setBar(null)
              setBeat(0)
              resolve()
            },
          )
        })
      },
    }
  }

  const controller = useIdentificationController(drill, CHART_BANK, makeTrial, {
    cancelAudio,
    silenceReplay,
    // The take runs on the call's clock: sound taken away during it
    // voids the round, and the call plays again from its count-in.
    timedAnswer: true,
  })

  const phase = () => controller.phase()
  const running = () => phase() !== 'idle' && phase() !== 'done'

  const onTap = (atMs: number) => {
    if (phase() !== 'answer' || !takeHandle) return
    takeHandle.tap(atMs)
    const taps = ledger.taps()
    setTapCount(taps.length)
    setLiveTaps(anchorTaps(taps, firstOnsetMs).map((t) => t / period))
  }

  const ratingLine = () =>
    `Rating ${Math.round(controller.rating().rating)}${
      isProvisional(controller.rating()) ? ' · settling' : ''
    }${raw() ? ' · raw' : ''}`

  const progress = () =>
    running()
      ? `Round ${Math.min(controller.round() + 1, controller.totalRounds)} of ${controller.totalRounds} · ${ratingLine()}`
      : ratingLine()

  const status = () => {
    switch (phase()) {
      case 'playing':
        return 'Count-in. Read the chart…'
      case 'answer':
        return tapCount() === 0
          ? 'Yours. Your first tap starts the bar.'
          : `Tapping: ${tapCount()} so far.`
      case 'reveal': {
        const verdict = take()
        if (!verdict) return ''
        if (verdict.correct) return 'Clean. Every onset met.'
        if (!begun()) return 'No take. The bar came and went untapped.'
        const missed = verdict.met.filter((m) => !m).length
        const parts = []
        if (missed > 0)
          parts.push(`${missed} onset${missed === 1 ? '' : 's'} missed`)
        if (verdict.extras.length > 0)
          parts.push(
            `${verdict.extras.length} extra tap${verdict.extras.length === 1 ? '' : 's'}`,
          )
        return `Not quite: ${parts.join(', ')}.`
      }
      default:
        return PROMPT
    }
  }

  const tone = () =>
    phase() !== 'reveal'
      ? ('neutral' as const)
      : take()?.correct === true
        ? ('right' as const)
        : ('wrong' as const)

  const cleared = () => clearedSubdivision(controller.rating().rating)
  /** Auto-advance off: the verdict waits for the Next pad. */
  const parked = () => controller.parked()

  let ratingBefore = 0
  createEffect(() => {
    if (phase() === 'playing') {
      ratingBefore = untrack(() => controller.rating().rating)
    }
  })

  /** What the native room draws on its own; nothing on any other build. */
  const mercRoom: StageRoom | undefined = EAR_LAB_WITH_MERC
    ? {
        run: () => 'rated',
        short: () => controller.short(),
        beat: () => identificationBeat(phase()),
        sounding: () => phase() === 'playing' || controller.replaying(),
        prompt: PROMPT,
        line: () =>
          running()
            ? {
                kind: 'rounds',
                noun: 'Chart',
                round: Math.min(controller.round() + 1, controller.totalRounds),
                total: controller.totalRounds,
                answered: controller.round() + (phase() === 'reveal' ? 1 : 0),
                extra: `${Math.round(60_000 / period)} BPM`,
              }
            : null,
        pinned: () =>
          phase() === 'answer' && bar() === 'response' && beat() > 0
            ? `Beat ${beat()} of ${beats()}`
            : null,
        replay: {
          allowed: () => controller.replayAllowed(),
          play: () => void controller.replay(),
        },
        parked: () => controller.parked(),
        next: () => controller.next(),
        pause: () => controller.pause(),
        hold: () => controller.holdQuestion(),
        held: () => controller.held(),
        resume: () => void controller.resumeQuestion(),
        abandon: () => controller.abandon(),
        plate: (): RatingPlate | null => {
          const result = controller.result()
          if (result === null) return null
          const lines = [
            cleared() ? `Clears ${cleared()}` : null,
            raw() ? 'Raw taps, round trip unmeasured' : null,
          ].filter((line): line is string => line !== null)
          return {
            kind: 'rating',
            rating: Math.round(result.rating.rating),
            before: Math.round(result.rating.rating - result.ratingDelta),
            source: 'Chart rating',
            settling: isProvisional(result.rating)
              ? PROVISIONAL_ATTEMPTS - result.rating.attempts
              : null,
            settlingNoun: 'charts',
            rounds: result.total,
            right: result.correct,
            rightWord: 'tapped clean',
            outcomes: result.outcomes.map((outcome) => ({
              correct: outcome.correct,
              title:
                CHART_BANK.find((i) => i.itemId === outcome.expectedId)?.name ??
                outcome.expectedId,
            })),
            // A rhythm is met or missed, never heard as another one.
            slips: [],
            lines,
          }
        },
        again: () => controller.start(),
      }
    : undefined

  // A station row or Today's button asked for a run: it starts as the
  // room opens, still inside the tap that opened it.
  onMount(() => {
    if (!EAR_LAB_WITH_MERC) return
    const request = takeRoomStart(drill.id)
    if (request !== null && phase() === 'idle') controller.start()
  })

  const lastCall = useLastCall(phase, () => ({
    correct: take()?.correct === true,
    line: status(),
    consequence: `Rating ${Math.round(ratingBefore)} → ${Math.round(
      controller.rating().rating,
    )}`,
    label: `Chart ${controller.round() + 1}`,
  }))

  return (
    <EarStage
      drillId="chart"
      name="The Chart"
      measures="Time · reading"
      description={CHART_DESCRIPTION}
      mode={phase() === 'idle' ? 'on the bench' : 'rating run'}
      progress={progress()}
      status={status()}
      tone={tone()}
      keys={() =>
        phase() === 'idle'
          ? [{ key: 'Space', action: () => controller.start() }]
          : parked()
            ? [{ key: 'Space', action: () => controller.next() }]
            : phase() === 'answer'
              ? [{ key: 'Space', action: (atMs) => onTap(atMs) }]
              : []
      }
      focusConsole={() => phase() === 'answer' || parked()}
      onBack={props.onBack}
      onStop={running() ? () => controller.stop() : undefined}
      lastCall={lastCall}
      armed={() => phase() === 'answer'}
      done={() => phase() === 'done'}
      room={mercRoom}
      instrument={() => (
        <RhythmDrum
          bar={bar()}
          beat={beat()}
          beats={beats()}
          grid={grid()}
          liveTaps={liveTaps()}
          run={barRun()}
          waiting={phase() === 'answer' && barRun() === null}
          score={score()}
          upperWord="the chart"
          reveal={phase() === 'reveal' ? take() : null}
        />
      )}
      console={() => (
        <Show
          when={running()}
          fallback={
            <>
              <PlayPad
                label="Begin"
                sub={`${controller.totalRounds} charts`}
                keycap="Space"
                icon={<IconPlay size={20} />}
                onClick={() => controller.start()}
              />
              <ConsoleNote>
                Your first tap anchors the bar, so a steady delay cancels itself
                out.
              </ConsoleNote>
            </>
          }
        >
          <Show
            when={parked()}
            fallback={
              <TapPad
                label={
                  phase() === 'answer'
                    ? 'Tap'
                    : phase() === 'reveal'
                      ? take()?.correct === true
                        ? 'Clean'
                        : 'Not quite'
                      : 'Read'
                }
                sub={
                  phase() === 'answer'
                    ? 'first tap starts your bar'
                    : phase() === 'reveal'
                      ? 'next chart coming'
                      : 'count-in'
                }
                keycap="Space"
                armed={phase() === 'answer'}
                disabled={phase() !== 'answer'}
                onTap={onTap}
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
        </Show>
      )}
      plate={() => (
        <Show when={controller.result()}>
          {(result) => (
            <EndPlate
              kicker="Rating"
              value={String(Math.round(result().rating.rating))}
              unit="Chart rating"
              note={
                <PlateDelta delta={result().ratingDelta} label="this run" />
              }
              onAgain={() => controller.start()}
              onBack={props.onBack}
            >
              <Show when={isProvisional(result().rating)}>
                <PlateBadge>
                  Provisional: settling for {10 - result().rating.attempts} more
                  charts
                </PlateBadge>
              </Show>
              <PlateLine>
                {result().correct} of {result().total} charts tapped clean
                {cleared() ? ` · clears ${cleared()}` : ''}
                {raw() ? ' · raw taps, round trip unmeasured' : ''}
              </PlateLine>
              <OutcomeDots
                outcomes={result().outcomes.map((outcome) => ({
                  correct: outcome.correct,
                  title:
                    CHART_BANK.find((i) => i.itemId === outcome.expectedId)
                      ?.name ?? outcome.expectedId,
                }))}
              />
            </EndPlate>
          )}
        </Show>
      )}
    />
  )
}
