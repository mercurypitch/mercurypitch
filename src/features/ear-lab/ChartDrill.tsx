// ============================================================
// ChartDrill — rhythm reading: the pattern on the paper, tapped at
// sight.
//
// Pulse's mirror. Nothing is sounded but the beat: the pattern is
// written on the drum's upper rule from the moment the round opens,
// four clicks count the tempo in, and then the bar waits for the
// player the same way Pulse's does — the soft rail ticks on, the
// first tap anchors the take as the pattern's first onset, and the
// rest is judged by its distance from the anchor (`anchored-take.ts`).
// Ear training reversed: the eye reads, the hand keeps the time.
//
// Same bank shapes as Pulse under its own ids and rating, so the
// bench can show where reading and dictation part ways.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Show, untrack } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { CHART_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { isProvisional } from '@/lib/ear/elo'
import { barBeats, clearedSubdivision, toleranceFor, } from '@/lib/ear/rhythm-take'
import { createTapLedger } from '@/lib/ear/tap-input'
import { PULSE_TIMING } from '@/lib/ear/timing'
import { micLatencyMs } from '@/stores/mic-latency-store'
import type { AnchoredTake } from './anchored-take'
import { startAnchoredTake } from './anchored-take'
import { useArmingCue } from './arming-cue'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import { IconPlay } from './ear-icons'
import { useEarRoom } from './ear-room-context'
import { ConsoleNote, EarStage, EndPlate, OutcomeDots, PlateBadge, PlateDelta, PlateLine, PlayPad, TapPad, } from './EarStage'
import { useLastCall } from './reveal-pacing'
import type { DrumBar, DrumReveal } from './RhythmDrum'
import { RhythmDrum } from './RhythmDrum'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const MISS = 'miss'

const CHART_DESCRIPTION =
  'The pattern is written on the drum — nothing sounds but the beat. Four clicks count the tempo in, then the bar is yours to start: your first tap — pad or Space — is the first written onset, wherever you place it. Tap the rest of the chart at the same tempo, every onset in order, nothing extra. Reading, where Pulse is dictation.'

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
  const ledger = createTapLedger({ latencyMs: micLatencyMs })
  const raw = () => micLatencyMs() <= 0

  let scheduled: ScheduledClick[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let trialCancelled = false
  let takeHandle: AnchoredTake | null = null

  const period = PULSE_TIMING.periodMs
  const countMs = PULSE_TIMING.beats * period

  function cancelAudio(): void {
    trialCancelled = true
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const click of scheduled) click.cancel()
    scheduled = []
    takeHandle?.cancel()
    takeHandle = null
    ledger.disarm()
    setBar(null)
    setBeat(0)
    setScore(null)
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
        setBeats(patternBeats)
        setScore(item.payload)

        const start = ctx.currentTime + PULSE_TIMING.leadS
        const startMs = performance.now() + PULSE_TIMING.leadS * 1000
        const level = room.volume() * audioEngine.getVolume()
        const soft = { voice: 'soft' as const, gainLevel: level * 0.6 }
        const s = period / 1000

        // Only the count-in sounds — the pattern is on the paper.
        for (let k = 0; k < PULSE_TIMING.beats; k++) {
          scheduled.push(scheduleClick(ctx, start + k * s, soft))
          later(PULSE_TIMING.leadS * 1000 + k * period, () => {
            setBar('count')
            setBeat(k + 1)
          })
        }

        // The open bar follows the count-in straight away.
        takeHandle = startAnchoredTake({
          ctx,
          openAtS: start + countMs / 1000,
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
          onJudged: (outcome) => {
            setTake({
              onsets: item.payload,
              met: outcome.verdict.met,
              taps: outcome.tapsBeats,
              extras: outcome.extrasBeats,
              correct: outcome.verdict.correct,
            })
            setBegun(outcome.begun)
            ledger.disarm()
            setBar(null)
            setBeat(0)
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
    }
  }

  const controller = useIdentificationController(drill, CHART_BANK, makeTrial, {
    cancelAudio,
  })

  const phase = () => controller.phase()
  const running = () => phase() !== 'idle' && phase() !== 'done'

  const onTap = (atMs: number) => {
    if (phase() !== 'answer' || !takeHandle) return
    takeHandle.tap(atMs)
    setTapCount(ledger.taps().length)
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
        return 'Count-in — read the chart…'
      case 'answer':
        return tapCount() === 0
          ? 'Yours — your first tap starts the bar.'
          : `Tapping — ${tapCount()} so far.`
      case 'reveal': {
        const verdict = take()
        if (!verdict) return ''
        if (verdict.correct) return 'Clean — every onset met.'
        if (!begun()) return 'No take — the bar came and went untapped.'
        const missed = verdict.met.filter((m) => !m).length
        const parts = []
        if (missed > 0)
          parts.push(`${missed} onset${missed === 1 ? '' : 's'} missed`)
        if (verdict.extras.length > 0)
          parts.push(
            `${verdict.extras.length} extra tap${verdict.extras.length === 1 ? '' : 's'}`,
          )
        return `Not quite — ${parts.join(', ')}.`
      }
      default:
        return 'A written bar over the click — tap it at sight.'
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

  useArmingCue(() => phase() === 'answer')

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
      instrument={() => (
        <RhythmDrum
          bar={bar()}
          beat={beat()}
          beats={beats()}
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
                  Provisional — settling for {10 - result().rating.attempts}{' '}
                  more charts
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
