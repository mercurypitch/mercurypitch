// ============================================================
// PulseDrill — rhythm dictation: a bar of onsets, tapped back.
//
// A count-in, the call, and then everything stops. The bar is the
// player's and nothing runs in it — no click, no lamp — until their
// first tap starts it; that tap stands for the call's first onset,
// exactly on time, and the rest is judged by its distance from the
// anchor (`anchored-take.ts`). From the tap the beat ticks softly
// under the bar and a progress line fills left to right. The pad is
// live before the call ends, every tap answers with a tick in the
// room's voice, and Space taps as well as the pointer. Patterns above
// the middle of the bank cross the barline, so the faster
// subdivisions come with air around them rather than squeezed in.
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
import type { Subdivision } from '@/lib/ear/rhythm-take'
import { anchorTaps, barBeats, clearedSubdivision, finestSubdivision, toleranceFor, } from '@/lib/ear/rhythm-take'
import { createTapLedger } from '@/lib/ear/tap-input'
import { PULSE_TIMING } from '@/lib/ear/timing'
import { micLatencyMs } from '@/stores/mic-latency-store'
import type { AnchoredTake } from './anchored-take'
import { startAnchoredTake } from './anchored-take'
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

const PULSE_DESCRIPTION =
  'Four clicks count you in and a bar of onsets sounds. Then it waits: nothing plays until your first tap — pad or Space — which is the first onset, wherever you place it. From there the beat keeps you company and the bar fills left to right. Tap the rest of the call at the same tempo, every onset in order, nothing extra. The reading is the finest subdivision you clear — quarters, eighths, triplets, sixteenths.'

export function PulseDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findIdentificationDrill('pulse')
  if (!drill) throw new Error('pulse drill missing from catalogue')

  const [bar, setBar] = createSignal<DrumBar>(null)
  const [beat, setBeat] = createSignal(0)
  const [beats, setBeats] = createSignal(4)
  const [take, setTake] = createSignal<DrumReveal | null>(null)
  const [begun, setBegun] = createSignal(true)
  const [tapCount, setTapCount] = createSignal(0)
  /** Null until the tap that starts the bar; then where the anchor
   *  stood in it and how long the bar has left, for the drum's fill. */
  const [barRun, setBarRun] = createSignal<{
    from: number
    durationMs: number
  } | null>(null)
  /** The grid the pattern sits on. Pulse dictates, so the guides
   *  only go up at the reveal: before it they would say how fine
   *  the pattern is, which is half of what the ear is asked for. */
  const [grid, setGrid] = createSignal<Subdivision | null>(null)
  /** The take's taps in beats, so they land under the score as
   *  they happen rather than only at the reveal. */
  const [liveTaps, setLiveTaps] = createSignal<readonly number[]>([])
  const ledger = createTapLedger({ latencyMs: micLatencyMs })
  const raw = () => micLatencyMs() <= 0

  let scheduled: ScheduledClick[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let trialCancelled = false
  let takeHandle: AnchoredTake | null = null
  /** The round's first onset, in ms: the place a take is anchored
   *  on, and so what turns the ledger's taps into beats. */
  let firstOnsetMs = 0

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
    setBarRun(null)
    setGrid(null)
    setLiveTaps([])
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
    const barMs = patternBeats * period
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
        setBarRun(null)
        setBeats(patternBeats)
        setGrid(null)
        setLiveTaps([])
        firstOnsetMs = onsetsMs[0] ?? 0

        const start = ctx.currentTime + PULSE_TIMING.leadS
        const startMs = performance.now() + PULSE_TIMING.leadS * 1000
        const level = room.volume() * audioEngine.getVolume()
        const soft = { voice: 'soft' as const, gainLevel: level * 0.6 }
        const call = { voice: room.clickVoice(), gainLevel: level }
        const s = period / 1000

        // The count-in keeps the beat; the call bar carries only its
        // onsets, so the pattern is heard and not counted along.
        for (let k = 0; k < PULSE_TIMING.beats; k++) {
          scheduled.push(scheduleClick(ctx, start + k * s, soft))
          later(PULSE_TIMING.leadS * 1000 + k * period, () => {
            setBar('count')
            setBeat(k + 1)
          })
        }
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
        // The call ends and the lamps stop: the bar is the player's and
        // nothing is running in it until they start it.
        later(PULSE_TIMING.leadS * 1000 + countMs + barMs, () => {
          setBar('response')
          setBeat(0)
        })

        // The open bar: everything stops here and the first tap starts it.
        takeHandle = startAnchoredTake({
          ctx,
          openAtMs: startMs + countMs + barMs,
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
            setGrid(finestSubdivision(item.payload))
            ledger.disarm()
            setBar(null)
            setBeat(0)
            setBarRun(null)
            controller.answer(outcome.verdict.correct ? item.itemId : MISS)
          },
        })

        // The answer opens a breath before the call ends, so an eager
        // first tap is the anchor and never lands on a dead pad.
        await new Promise<void>((resolve) => {
          later(
            PULSE_TIMING.leadS * 1000 +
              countMs +
              barMs -
              PULSE_TIMING.armEarlyMs,
            resolve,
          )
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
        return bar() === 'count' ? 'Count-in…' : 'Listen to the call…'
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
          grid={grid()}
          liveTaps={liveTaps()}
          run={barRun()}
          waiting={phase() === 'answer' && barRun() === null}
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
                <ConsoleNote>
                  Your first tap anchors the bar, so a steady delay cancels
                  itself out.
                </ConsoleNote>
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
                    ? 'first tap starts your bar'
                    : phase() === 'reveal'
                      ? 'next call coming'
                      : bar() === 'count'
                        ? 'count-in'
                        : 'the call'
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
