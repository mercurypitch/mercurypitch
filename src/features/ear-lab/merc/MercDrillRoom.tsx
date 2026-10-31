// ============================================================
// MercDrillRoom — every drill of the Ear Lab, in Merc's room.
//
// The native face of EarStage (EAR_LAB_WITH_MERC): the same props, the
// same drills, drawn full screen with the rail out of reach.
//
//   - The header: Close, the drill and the run it is in (practice run,
//     rated run, today's short run, sealed calibration), and "?".
//   - The run chip: a staircase's level and about how many are left,
//     with its trace; a rated run's rounds in neutral dots.
//   - The stage: the dark ground in its station's own two lights
//     (room.module.css), the instrument filling most of the screen.
//   - The console, at the foot of the stage: Merc and his bubble (the
//     task in full on the first question, the question again whenever
//     an answer is due, the verdict after), the drill's own pads, and
//     the pinned row: Hear it again, Compare on a miss whose pick the
//     drill can sound (the answer, then the pick), and the lamp or Next.
//
// Merc listens while the sound plays, waits while the singer answers,
// nods at a right answer and gives a wrong one nothing; he celebrates
// only on a plate worth it. His words reach a screen reader after the
// sound, never over it, and nothing buzzes while a test sound plays.
//
// Close mid-run asks first ("End the run?") and keeps nothing; so do a
// swipe down and Android's back. Sound taken away before a question is
// answered (a call, headphones out, the app put away) pauses the run,
// and Resume plays that question again from its start.
//
// A slip on a rated plate can start a pair practice on its two items
// (pair-practice.ts): a practice run, named in Merc's first line, that
// ends on a tally rather than a rating.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, useContext, } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { EngineContext } from '@/contexts/EngineContext'
import { VIEW_FOR_DRILL } from '@/features/ear-lab/drill-views'
import { IconClose } from '@/features/ear-lab/ear-icons'
import type { EarStageProps } from '@/features/ear-lab/EarStage'
import { StageSkinContext, useStageKeys } from '@/features/ear-lab/EarStage'
import { InstrumentSkinContext } from '@/features/ear-lab/instrument-skin'
import { setRevealRule } from '@/features/ear-lab/reveal-pacing'
import type { RoomBeat, RoomCompare, RoomPlate, ThresholdPlate, } from '@/features/ear-lab/stage-room'
import { requestRoomStart } from '@/features/ear-lab/stage-room'
import { FACULTY_LABEL, findThresholdDrill } from '@/lib/ear/drills'
import { haptics } from '@/lib/haptics'
import { audioRoute } from '@/stores/audio-route-store'
import { armSprintSegment, earToday, latestCalibration, sprintProgress, todaysSprint, } from '@/stores/ear-lab-store'
import { registerRoomBack, setExerciseFocus } from '@/stores/native-shell-store'
import { removeNotificationsByChannel, TOUR_OFFER_CHANNEL, } from '@/stores/notifications-store'
import { setPendingEarDrill } from '@/stores/ui-store'
import { useWakeAudio } from './audio-wake'
import { practiceEstimate } from './Glass'
import { LIT_INSTRUMENTS } from './lit'
import { IconQuestion } from './merc-icons'
import type { SoundStop } from './merc-lines'
import { calibrationBefore, compareHint, exitWords, modeWords, practiceLine, practicePlateLine, ratingPlateLine, sealedPlateLine, soundStoppedWords, thresholdPlateLine, } from './merc-lines'
import { PlateNext, PlateOnDesk } from './MercPlate'
import { markMoreBelow } from './more-below'
import { PinnedRow } from './PinnedRow'
import plateStyles from './plate.module.css'
import styles from './room.module.css'
import type { RoomState } from './room-context'
import { RoomContext } from './room-context'
import type { PlateAction, TodaySegment } from './room-policy'
import { bubbleShows, closeAsksFirst, doneLabel, mercPose, plateAction, verdictHaptic, } from './room-policy'
import { RunLine } from './RunLine'
import { noteReturn, recordTodayMove, roomOrigin, setRoomOrigin, todayMoveOf, } from './session'
import { CalibrationBefore, ExitConfirm, HelpSheet, SoundStopped, } from './Sheets'
import { ROOM_SKIN } from './skin'
import { watchSoundStop } from './sound-stop'
import { drillName, stationOf } from './stations'
import { mercStill, WILD_BACKDROP } from './stills'

/** Two-sound questions, said "pair" in the room's words. */
const PAIR_DRILLS = new Set(['hairline', 'beat-hunt', 'desk-weight'])

/** Today's plan, by name, for the plate's main button. */
function todaySegments(): TodaySegment[] {
  return todaysSprint().map((segment) => ({
    drillId: segment.drillId,
    name: drillName(segment.drillId),
  }))
}

/** The plate worth a celebration: a seal, a first reading, a better
 *  one, a rating that rose. A practice moves nothing to celebrate. */
function plateWorthIt(plate: RoomPlate | null): boolean {
  if (plate === null) return false
  if (plate.kind === 'practice') return false
  if (plate.kind === 'rating')
    return plate.rounds > 0 && plate.rating > plate.before
  if (plate.markedIndex !== undefined) return true
  if (plate.value === null) return false
  if (plate.previous === null) return true
  return plate.lowerIsBetter
    ? plate.value < plate.previous
    : plate.value > plate.previous
}

export function MercDrillRoom(props: EarStageProps): JSX.Element {
  const engines = useContext(EngineContext)
  // eslint-disable-next-line solid/reactivity -- a stage is mounted per drill, and its room with it
  const room = props.room
  const done = (): boolean => props.done?.() === true
  const beat = (): RoomBeat => {
    if (done()) return 'done'
    return room?.beat() ?? 'idle'
  }
  const sounding = (): boolean => room?.sounding() ?? false
  const running = (): boolean =>
    beat() === 'listen' || beat() === 'answer' || beat() === 'reveal'
  const verdict = (): 'right' | 'wrong' | null => {
    if (beat() !== 'reveal') return null
    if (props.tone === 'right') return 'right'
    if (props.tone === 'wrong') return 'wrong'
    return null
  }
  const run = () => room?.run() ?? 'practice'
  const short = (): boolean => room?.short?.() ?? false
  const ritual = (): boolean => room?.ritual === true
  const plate = createMemo((): RoomPlate | null =>
    done() ? (room?.plate?.() ?? null) : null,
  )
  // eslint-disable-next-line solid/reactivity -- a room is mounted per drill
  const station = stationOf(props.drillId)

  // ── The room over the tab ─────────────────────────────────────

  const wake = useWakeAudio()

  onMount(() => {
    // The rail steps aside while the room is up, as for a held note, and
    // verdicts pace by Merc's rule. The bench's tour walks the bench,
    // which the room has covered.
    setExerciseFocus(true)
    setRevealRule('merc')
    removeNotificationsByChannel(TOUR_OFFER_CHANNEL)
  })
  onCleanup(() => {
    setExerciseFocus(false)
    setRevealRule('switch')
  })

  // ── Answers counted, for Merc's bubble ────────────────────────

  const [answered, setAnswered] = createSignal(0)
  createEffect(
    on(beat, (now, before) => {
      if (now === 'listen' && (before === 'idle' || before === 'done')) {
        setAnswered(0)
      }
      if (now === 'reveal' && before !== 'reveal') setAnswered((n) => n + 1)
    }),
  )

  // ── Feel: the verdict under the thumb, never over a test sound ─

  const [feel, setFeel] = createSignal<'tap' | 'warning' | null>(null)
  createEffect(
    on(beat, (now, before) => {
      if (now !== 'reveal' || before === 'reveal') return
      const judged = untrack(verdict)
      if (judged !== null) setFeel(verdictHaptic(judged === 'right'))
    }),
  )
  createEffect(() => {
    const due = feel()
    if (due === null || sounding()) return
    setFeel(null)
    if (due === 'tap') haptics.tapLight()
    else haptics.warning()
  })
  createEffect(
    on(plate, (now) => {
      if (now?.kind === 'threshold' && now.markedIndex !== undefined) {
        haptics.seal?.()
      }
    }),
  )

  // ── Merc ──────────────────────────────────────────────────────

  const pose = () =>
    mercPose({
      beat: beat(),
      sounding: sounding(),
      verdict: verdict(),
      plateWorthIt: plateWorthIt(plate()),
    })

  /** The level's move under a staircase's verdict, as the drill says
   *  it. A rated run's carries the rating, which stays for the plate. */
  const aside = (): string | null => {
    if (beat() !== 'reveal' || run() === 'rated') return null
    return props.lastCall?.()?.consequence ?? null
  }

  /** The task in full: a pair practice names its two. */
  const prompt = (): string => {
    const pair = room?.practising?.() ?? null
    return pair === null ? (room?.prompt ?? props.status) : practiceLine(pair)
  }

  /** Compare, while a miss whose pick it can sound is on the stage. */
  const compare = (): RoomCompare | null =>
    room?.compare !== undefined && room.compare.offered() ? room.compare : null

  /** Under that miss: what the two differ by, where the drill can say,
   *  and that Compare plays them side by side. */
  const hint = (): string | null => {
    if (beat() !== 'reveal') return null
    const offered = compare()
    return offered === null ? null : compareHint(offered.difference?.() ?? null)
  }

  const shows = () => bubbleShows({ beat: beat(), answered: answered() })
  const bubble = (): {
    say: string
    aside: string | null
    hint: string | null
  } | null => {
    switch (shows()) {
      case 'prompt':
        return { say: prompt(), aside: null, hint: null }
      // The drill's own words for the answer it waits on.
      case 'ask':
        return { say: props.status, aside: null, hint: null }
      case 'verdict':
        return { say: props.status, aside: aside(), hint: hint() }
      case 'none':
        return null
    }
  }

  const plateLine = (): string => {
    const now = plate()
    if (now === null) return props.status
    if (now.kind === 'practice') {
      return practicePlateLine({
        right: now.right,
        rounds: now.rounds,
        slip: now.slips[0] ?? null,
      })
    }
    if (now.kind === 'rating') {
      return ratingPlateLine({
        rating: now.rating,
        before: now.before,
        rounds: now.rounds,
        slip: now.slips[0] ?? null,
      })
    }
    if (now.markedIndex !== undefined) return sealedPlateLine(now.markedIndex)
    return thresholdPlateLine({
      value: now.value,
      shown: now.value === null ? '' : now.format(now.value),
      unit: now.unit,
      previous: now.previous,
      lowerIsBetter: now.lowerIsBetter,
    })
  }

  // What a screen reader hears: the line after the sound, never over it.
  const [heard, setHeard] = createSignal('')
  createEffect(() => {
    if (sounding()) return
    switch (beat()) {
      case 'listen':
        return
      case 'answer':
        setHeard(props.status)
        return
      case 'reveal':
        setHeard([props.status, aside(), hint()].filter(Boolean).join(' '))
        return
      case 'idle':
        setHeard(prompt())
        return
      case 'done':
        setHeard(plateLine())
    }
  })

  // ── Keys and focus ────────────────────────────────────────────

  useStageKeys(() => props.keys?.())
  let controls: HTMLDivElement | undefined
  createEffect(() => {
    if (props.focusConsole?.() !== true) return
    queueMicrotask(() =>
      controls
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus({ preventScroll: true }),
    )
  })

  // ── Sheets ────────────────────────────────────────────────────

  const [helpOpen, setHelpOpen] = createSignal<false | 'help' | 'rulers'>(false)
  const [exitOpen, setExitOpen] = createSignal(false)
  const [calibrating, setCalibrating] = createSignal<(() => void) | null>(null)

  /** Back to wherever the run was opened from, the new number lit. */
  const leave = (kept: boolean): void => {
    noteReturn({
      origin: roomOrigin(),
      drillId: kept ? props.drillId : null,
    })
    props.onBack()
  }

  const close = (): void => {
    if (closeAsksFirst(beat())) setExitOpen(true)
    else leave(done())
  }

  const endRun = (): void => {
    setExitOpen(false)
    setSoundStop(null)
    room?.abandon()
    leave(false)
  }

  // Android's back: the topmost sheet first, then Close.
  onMount(() => {
    // eslint-disable-next-line solid/reactivity -- answers each press of Back, like a handler
    const release = registerRoomBack(() => {
      if (exitOpen()) {
        setExitOpen(false)
        return true
      }
      if (calibrating() !== null) {
        if (ritual()) leave(false)
        else setCalibrating(null)
        return true
      }
      if (helpOpen() !== false) {
        setHelpOpen(false)
        return true
      }
      if (soundStop() !== null) return true
      close()
      return true
    })
    onCleanup(release)
  })

  // A swipe down from the top half asks the same as Close.
  let swipe: { x: number; y: number; id: number } | null = null
  const onPointerDown = (event: PointerEvent): void => {
    if (event.clientY > window.innerHeight * 0.5) return
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId }
  }
  const onPointerUp = (event: PointerEvent): void => {
    const start = swipe
    swipe = null
    if (start === null || start.id !== event.pointerId) return
    const dy = event.clientY - start.y
    const dx = Math.abs(event.clientX - start.x)
    if (dy > 90 && dx < 60 && !exitOpen()) close()
  }

  // ── The sound taken away ──────────────────────────────────────

  const [soundStop, setSoundStop] = createSignal<{
    cause: SoundStop
    voided: boolean
  } | null>(null)

  const stopSound = (cause: SoundStop): void => {
    if (!running() || soundStop() !== null || room?.hold === undefined) return
    room.hold()
    setSoundStop({ cause, voided: room.held?.() === true })
  }

  const resumeSound = (): void => {
    const was = soundStop()
    setSoundStop(null)
    wake()
    if (was?.voided === true) room?.resume?.()
  }

  watchSoundStop({
    running,
    sounding,
    context: () => engines?.audioEngine.getAudioContext(),
    stop: stopSound,
  })

  // ── The plate and what next ───────────────────────────────────

  // Today's three keep what they moved, for the day's close.
  createEffect(
    on(plate, (now) => {
      if (now === null) return
      const planned = todaysSprint().some(
        (segment) => segment.drillId === props.drillId,
      )
      const finished = sprintProgress().done.includes(props.drillId)
      if (!planned || !finished) return
      const move = todayMoveOf(props.drillId, now)
      if (move !== null) recordTodayMove(earToday(), move)
    }),
  )

  const action = (): PlateAction =>
    plateAction({
      origin: roomOrigin(),
      drillId: props.drillId,
      plan: todaySegments(),
      done: new Set(sprintProgress().done),
    })

  const followAction = (): void => {
    const next = action()
    switch (next.kind) {
      case 'today': {
        const segment = todaysSprint().find(
          (entry) => entry.drillId === next.drillId,
        )
        if (
          segment === undefined ||
          VIEW_FOR_DRILL[segment.drillId] === undefined
        ) {
          leave(true)
          return
        }
        wake()
        armSprintSegment(segment)
        setRoomOrigin({ kind: 'today' })
        requestRoomStart({ drillId: segment.drillId })
        setPendingEarDrill(segment.drillId)
        return
      }
      case 'today-done':
        noteReturn({
          origin: { kind: 'today' },
          drillId: props.drillId,
          todayDone: true,
        })
        props.onBack()
        return
      case 'again':
        wake()
        room?.again?.()
    }
  }

  const askCalibration = (begin: () => void): void => {
    setCalibrating(() => begin)
  }

  const facultyOf = (): string => {
    const faculty = findThresholdDrill(props.drillId)?.faculty
    return faculty === undefined ? 'Resolution' : FACULTY_LABEL[faculty]
  }

  // ── The skin's view of the room ───────────────────────────────

  const state: RoomState = {
    beat,
    verdict,
    sounding,
    running,
    ritual,
    askCalibration,
    tapped: () => haptics.tapLight(),
  }

  const exitText = () => {
    const line = room?.line() ?? null
    const progress =
      line === null
        ? null
        : line.kind === 'threshold'
          ? { count: line.turns, noun: 'turn' }
          : line.kind === 'calibration'
            ? { count: line.answered, noun: 'question' }
            : {
                count: line.answered,
                noun: (line.noun ?? 'Round').toLowerCase(),
              }
    return exitWords(progress)
  }

  const calibrationText = () =>
    calibrationBefore({
      pair: PAIR_DRILLS.has(props.drillId),
      estimate: practiceEstimate(),
      sealed: latestCalibration()?.index ?? null,
    })

  const stoppedText = () => {
    const now = soundStop()
    return soundStoppedWords({
      cause: now?.cause ?? 'interrupted',
      voided: now?.voided === true,
      onSpeaker: audioRoute() === 'speaker',
      pair: PAIR_DRILLS.has(props.drillId),
    })
  }

  const name = (): string => props.name
  const modeLine = (): string => {
    if (beat() === 'done' && plate()?.kind === 'threshold') {
      const sealed = (plate() as ThresholdPlate).markedIndex
      if (sealed !== undefined) return 'Sealed'
    }
    const note = room?.modeNote?.() ?? null
    const words = room === undefined ? props.mode : modeWords(run(), short())
    return note === null ? words : `${words} · ${note}`
  }

  return (
    <RoomContext.Provider value={state}>
      <StageSkinContext.Provider value={ROOM_SKIN}>
        <InstrumentSkinContext.Provider value={LIT_INSTRUMENTS}>
          <section
            class={styles.room}
            data-station={station ?? undefined}
            style={
              station === 'wild'
                ? { '--room-backdrop': `url(${WILD_BACKDROP})` }
                : undefined
            }
            data-ear-drill={props.drillId}
            data-testid="ear-stage"
            data-merc-room=""
            data-beat={beat()}
            aria-label={props.name}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <div class={styles.world}>
              <Show
                when={!done()}
                fallback={
                  <div class={plateStyles.wrap} ref={markMoreBelow}>
                    <PlateOnDesk
                      plate={plate()}
                      own={props.plate?.()}
                      drillId={props.drillId}
                      short={short()}
                      faculty={facultyOf()}
                      onPractise={(start) => {
                        // Inside the tap, as Run again: iOS lets the audio
                        // wake only there.
                        wake()
                        start()
                      }}
                    />
                  </div>
                }
              >
                <figure
                  class={styles.figure}
                  onPointerDown={() => {
                    // A touch on the instrument holds a verdict that was
                    // counting down: the singer is looking.
                    if (beat() === 'reveal') room?.pause?.()
                  }}
                >
                  {props.instrument()}
                </figure>
              </Show>
            </div>

            <header class={styles.header}>
              <button
                type="button"
                class={styles.round}
                aria-label={
                  done()
                    ? doneLabel(roomOrigin())
                    : running()
                      ? 'End the run'
                      : 'Close'
                }
                data-testid="merc-close"
                onClick={close}
              >
                <IconClose size={18} />
              </button>
              <div class={styles.identity}>
                <h1 class={styles.name}>{name()}</h1>
                <span class={styles.mode} data-testid="merc-mode">
                  {modeLine()}
                </span>
              </div>
              <button
                type="button"
                class={styles.round}
                aria-label={`About ${props.cardName ?? props.name}, and its settings`}
                data-testid="merc-help-open"
                onClick={() => setHelpOpen('help')}
              >
                <IconQuestion size={20} />
              </button>
            </header>

            <Show when={running() ? (room?.line() ?? null) : null}>
              {(line) => <RunLine line={line()} />}
            </Show>
            <Show when={running() || done() ? null : (props.chip?.() ?? null)}>
              {(chip) => {
                // The chip's first word is where it starts; a new one is
                // the reading settling, and the chip rings once.
                let first: string | undefined
                return (
                  <div class={styles.runLine} data-testid="merc-chip">
                    <Show when={chip().value} keyed>
                      {(value) => {
                        first ??= value
                        return (
                          <div
                            class={styles.pill}
                            data-settled={value === first ? undefined : ''}
                          >
                            <span class={styles.left}>{chip().label}</span>
                            <span class={styles.level}>{value}</span>
                          </div>
                        )
                      }}
                    </Show>
                  </div>
                )
              }}
            </Show>

            <Show
              when={!done()}
              fallback={
                <section class={styles.console} aria-label="What next">
                  <div class={styles.mercRow}>
                    <div class={styles.mercBox}>
                      <MercPresence
                        state={pose}
                        stillSrc={mercStill(pose())}
                        size={72}
                        testId="merc-room-merc"
                      />
                    </div>
                    <div class={styles.bubble}>
                      <p class={styles.say}>{plateLine()}</p>
                    </div>
                  </div>
                  <PlateNext
                    sealed={
                      plate()?.kind === 'threshold' &&
                      (plate() as ThresholdPlate).markedIndex !== undefined
                    }
                    label={action().label}
                    again={action().kind !== 'again'}
                    calibrate={
                      room?.calibrate !== undefined &&
                      plate()?.kind === 'threshold' &&
                      !ritual()
                    }
                    onFollow={followAction}
                    onCalibrate={() =>
                      askCalibration(() => room?.calibrate?.())
                    }
                    onAgain={() => {
                      wake()
                      room?.again?.()
                    }}
                    onDone={() => leave(true)}
                    onRulers={() => setHelpOpen('rulers')}
                  />
                </section>
              }
            >
              <section
                class={styles.console}
                aria-label="Answer"
                data-testid="ear-stage-console"
              >
                <div class={styles.mercRow}>
                  <div class={styles.mercBox}>
                    <MercPresence
                      state={pose}
                      stillSrc={mercStill(pose())}
                      size={72}
                      testId="merc-room-merc"
                    />
                    {/* Merc listening: two arcs of the sound beside him. */}
                    <svg
                      class={styles.ears}
                      viewBox="0 0 22 26"
                      aria-hidden="true"
                      data-on={pose() === 'listen' ? '' : undefined}
                    >
                      <path d="M4 8a7 7 0 0 1 0 10" />
                      <path d="M10 4a12 12 0 0 1 0 18" />
                    </svg>
                  </div>
                  <div
                    class={styles.bubble}
                    classList={{ [styles.bubbleHidden]: bubble() === null }}
                    data-testid="merc-bubble"
                    aria-hidden="true"
                  >
                    <p class={styles.say}>{bubble()?.say ?? ' '}</p>
                    <Show when={bubble()?.aside}>
                      {(line) => <p class={styles.move}>{line()}</p>}
                    </Show>
                    <Show when={bubble()?.hint}>
                      {(line) => (
                        <p class={styles.aside} data-testid="merc-compare-hint">
                          {line()}
                        </p>
                      )}
                    </Show>
                  </div>
                </div>

                <div class={styles.controls} ref={controls}>
                  {props.console()}
                </div>

                <Show when={running()}>
                  <PinnedRow
                    room={room}
                    beat={beat()}
                    run={run()}
                    compare={compare()}
                  />
                </Show>
              </section>
            </Show>

            <p
              class={styles.srOnly}
              aria-live="polite"
              data-testid="ear-stage-status"
            >
              {heard()}
            </p>

            <Show when={helpOpen()}>
              {(open) => (
                <HelpSheet
                  name={props.cardName ?? props.name}
                  drillId={props.drillId}
                  measures={props.measures}
                  description={props.description}
                  answerMode={props.answerMode ?? null}
                  running={running()}
                  rulersFirst={open() === 'rulers'}
                  onClose={() => setHelpOpen(false)}
                />
              )}
            </Show>

            <Show when={exitOpen()}>
              <ExitConfirm
                {...exitText()}
                onLeave={endRun}
                onStay={() => setExitOpen(false)}
              />
            </Show>

            <Show when={soundStop()}>
              <SoundStopped
                {...stoppedText()}
                onResume={resumeSound}
                onLeave={endRun}
              />
            </Show>

            <Show when={calibrating()}>
              {(begin) => (
                <CalibrationBefore
                  {...calibrationText()}
                  onBegin={() => {
                    const go = begin()
                    setCalibrating(null)
                    wake()
                    go()
                  }}
                  onLater={() => {
                    setCalibrating(null)
                    if (ritual() && beat() === 'idle') leave(false)
                  }}
                />
              )}
            </Show>
          </section>
        </InstrumentSkinContext.Provider>
      </StageSkinContext.Provider>
    </RoomContext.Provider>
  )
}
