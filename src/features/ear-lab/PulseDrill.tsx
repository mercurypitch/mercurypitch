// ============================================================
// PulseDrill — rhythm dictation: a bar of onsets, tapped back.
//
// Three bars on one click: a count-in, the call, the response. The
// call's onsets sound in the room's click voice; the response bar
// keeps a soft click on the beat so the player is tapping against
// the same grid the call stood on. Every tap goes through the tap
// ledger — the page-clock stamp of the touch, measured from the
// instant the response bar was scheduled, the app's round trip
// subtracted — and the take is judged by rhythm-take: each onset
// met in order, no extras.
//
// Rated like the other button drills (useIdentificationController):
// the item is the pattern, the "answer" is whether the take met it.
// The reading on the bench is the finest subdivision the rating
// clears, a note value rather than a percent.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Show, untrack } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { PULSE_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { isProvisional } from '@/lib/ear/elo'
import { clearedSubdivision, judgeTake, toleranceFor, } from '@/lib/ear/rhythm-take'
import { createTapLedger } from '@/lib/ear/tap-input'
import { PULSE_TIMING } from '@/lib/ear/timing'
import { micLatencyMs } from '@/stores/mic-latency-store'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import { IconPlay } from './ear-icons'
import { useEarRoom } from './ear-room-context'
import { ConsoleLink, ConsoleNote, EarStage, EndPlate, OutcomeDots, PlateBadge, PlateDelta, PlateLine, PlayPad, TapPad, } from './EarStage'
import { useLastCall } from './reveal-pacing'
import type { DrumBar, DrumReveal } from './RhythmDrum'
import { RhythmDrum } from './RhythmDrum'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const MISS = 'miss'

const PULSE_DESCRIPTION =
  'Four clicks count you in, a bar of onsets sounds, and the next bar is yours: tap the call back on the same beat. Every onset must be met in order, nothing extra. The reading is the finest subdivision you clear — quarters, eighths, triplets, sixteenths.'

export function PulseDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findIdentificationDrill('pulse')
  if (!drill) throw new Error('pulse drill missing from catalogue')

  const [bar, setBar] = createSignal<DrumBar>(null)
  const [beat, setBeat] = createSignal(0)
  const [take, setTake] = createSignal<DrumReveal | null>(null)
  const [tapCount, setTapCount] = createSignal(0)
  const ledger = createTapLedger({ latencyMs: micLatencyMs })
  const raw = () => micLatencyMs() <= 0

  let scheduled: ScheduledClick[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let trialCancelled = false

  const period = PULSE_TIMING.periodMs
  const barMs = PULSE_TIMING.beats * period

  function cancelAudio(): void {
    trialCancelled = true
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const click of scheduled) click.cancel()
    scheduled = []
    ledger.disarm()
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
        setTapCount(0)

        const start = ctx.currentTime + PULSE_TIMING.leadS
        const startMs = performance.now() + PULSE_TIMING.leadS * 1000
        const level = room.volume() * audioEngine.getVolume()
        const soft = { voice: 'soft' as const, gainLevel: level * 0.6 }
        const call = { voice: room.clickVoice(), gainLevel: level }
        const s = period / 1000

        // Count-in and response bars keep the beat; the call bar carries
        // only its onsets, so the pattern is heard and not counted along.
        for (let k = 0; k < PULSE_TIMING.beats; k++) {
          scheduled.push(scheduleClick(ctx, start + k * s, soft))
          scheduled.push(
            scheduleClick(ctx, start + (2 * PULSE_TIMING.beats + k) * s, soft),
          )
        }
        for (const onset of onsetsMs) {
          scheduled.push(
            scheduleClick(ctx, start + barMs / 1000 + onset / 1000, call),
          )
        }

        // The lamps ride setTimeout — eyes, not ears.
        const bars: DrumBar[] = ['count', 'call', 'response']
        bars.forEach((name, b) => {
          for (let k = 0; k < PULSE_TIMING.beats; k++) {
            later(
              PULSE_TIMING.leadS * 1000 + (b * PULSE_TIMING.beats + k) * period,
              () => {
                setBar(name)
                setBeat(k + 1)
              },
            )
          }
        })

        // Taps are measured from the response bar's first beat.
        ledger.arm(startMs + 2 * barMs)

        // The take is judged once the response bar and its grace have
        // passed; the controller is in its answer phase by then.
        later(
          PULSE_TIMING.leadS * 1000 +
            3 * barMs +
            toleranceMs +
            PULSE_TIMING.tailMs,
          () => {
            const verdict = judgeTake(
              ledger.taps(),
              onsetsMs,
              toleranceMs,
              barMs,
            )
            const taps = ledger.taps()
            setTake({
              onsets: item.payload,
              met: verdict.met,
              taps: verdict.deviations
                .map((d, i) => (d === null ? null : (onsetsMs[i] + d) / period))
                .filter((b): b is number => b !== null),
              extras: verdict.extras.map((t) => t / period),
              correct: verdict.correct,
            })
            void taps
            ledger.disarm()
            setBar(null)
            setBeat(0)
            controller.answer(verdict.correct ? item.itemId : MISS)
          },
        )

        // The answer opens as the call ends: the response bar is the
        // player's.
        await new Promise<void>((resolve) => {
          later(PULSE_TIMING.leadS * 1000 + 2 * barMs, resolve)
        })
      },
    }
  }

  const controller = useIdentificationController(drill, PULSE_BANK, makeTrial, {
    cancelAudio,
  })

  const phase = () => controller.phase()
  const running = () => phase() !== 'idle' && phase() !== 'done'

  const onTap = (atMs: number) => {
    if (phase() !== 'answer' || !ledger.armed()) return
    ledger.tap(atMs)
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
        return bar() === 'count' ? 'Count-in…' : 'Listen to the call…'
      case 'answer':
        return tapCount() === 0
          ? 'Tap it back — now.'
          : `Tap it back — ${tapCount()} so far.`
      case 'reveal': {
        const verdict = take()
        if (!verdict) return ''
        if (verdict.correct) return 'Clean — every onset met.'
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
        return 'A bar of onsets, then a bar of yours — tap the call back.'
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

  const lastCall = useLastCall(phase, () => ({
    correct: take()?.correct === true,
    line: status(),
    consequence: `Rating ${Math.round(ratingBefore)} → ${Math.round(
      controller.rating().rating,
    )}`,
    label: `Call ${controller.round() + 1}`,
  }))

  return (
    <EarStage
      drillId="pulse"
      name="Pulse"
      measures="Time · rhythm"
      description={PULSE_DESCRIPTION}
      mode={phase() === 'idle' ? 'on the bench' : 'rating run'}
      progress={progress()}
      status={status()}
      tone={tone()}
      keys={() =>
        phase() === 'idle'
          ? [{ key: 'Space', action: () => controller.start() }]
          : parked()
            ? [{ key: 'Space', action: () => controller.next() }]
            : []
      }
      focusConsole={() => phase() === 'answer' || parked()}
      onBack={props.onBack}
      onStop={running() ? () => controller.stop() : undefined}
      lastCall={lastCall}
      done={() => phase() === 'done'}
      instrument={() => (
        <RhythmDrum
          bar={bar()}
          beat={beat()}
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
                sub={`${controller.totalRounds} calls`}
                keycap="Space"
                icon={<IconPlay size={20} />}
                onClick={() => controller.start()}
              />
              <Show
                when={raw()}
                fallback={
                  <ConsoleNote>
                    Round trip {Math.round(micLatencyMs())} ms comes off every
                    tap.
                  </ConsoleNote>
                }
              >
                <ConsoleLink onClick={() => room.openPanel('readiness')}>
                  Round trip unmeasured — taps are raw. Measure it in the
                  readiness panel.
                </ConsoleLink>
              </Show>
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
                      : 'Listen'
                }
                sub={
                  phase() === 'answer'
                    ? 'the call, on the beat'
                    : phase() === 'reveal'
                      ? 'next call coming'
                      : bar() === 'count'
                        ? 'count-in'
                        : 'the call'
                }
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
              unit="Pulse rating"
              note={
                <PlateDelta delta={result().ratingDelta} label="this run" />
              }
              onAgain={() => controller.start()}
              onBack={props.onBack}
            >
              <Show when={isProvisional(result().rating)}>
                <PlateBadge>
                  Provisional — settling for {10 - result().rating.attempts}{' '}
                  more calls
                </PlateBadge>
              </Show>
              <PlateLine>
                {result().correct} of {result().total} calls tapped back clean
                {cleared() ? ` · clears ${cleared()}` : ''}
                {raw() ? ' · raw taps, round trip unmeasured' : ''}
              </PlateLine>
              <OutcomeDots
                outcomes={result().outcomes.map((outcome) => ({
                  correct: outcome.correct,
                  title:
                    PULSE_BANK.find((i) => i.itemId === outcome.expectedId)
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
