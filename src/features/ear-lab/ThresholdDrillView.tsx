// ============================================================
// ThresholdDrillView — every Ruler-A drill on the stage.
//
// Hairline and The Grid differ only in their instrument, their pads
// and their unit; the run itself — practice staircase or the
// three-track calibration, progress, stop semantics, the reading —
// is the same and is laid out here once on EarStage: the drill bar
// carries the live level and reversal count, the instrument sits in
// the centre, the console offers Practice or Calibration at idle and
// the pads once a trial has sounded, and the plate reports the
// reading in the drill's unit. A calibration adds the three track
// pendulums under the instrument and, sealed, etches the glass.
//
// Mirrors IdentificationDrillView on the Ruler-B side.
//
// On a phone build with the Ear Lab with Merc it also hands the native
// room what it draws on its own (`room`, stage-room.ts): the run line
// and its staircase trace, Hear it again, the plate in numbers. A run a
// station row or Today's button asked for starts as the room opens.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, onMount, Show, untrack } from 'solid-js'
import { calibrationDueAt } from '@/lib/ear/calibration'
import { findThresholdDrill } from '@/lib/ear/drills'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { useArmingCue } from './arming-cue'
import { IconPlay, IconSeal } from './ear-icons'
import type { StageKey, StageReserve } from './EarStage'
import { ConsoleLead, ConsoleNote, EndPlate, PlateBadge, PlateLine, PlayPad, TurnsStrip, } from './EarStage'
import styles from './EarStage.module.css'
import { dateLabel } from './instruments'
import { useLastCall } from './reveal-pacing'
import type { RoomBeat, StageRoom, ThresholdPlate, TracePoint, } from './stage-room'
import { takeRoomStart } from './stage-room'
import { EarStage } from './stage-switch'
import { TrackPendulums } from './TrackPendulums'
import { useCompactStage } from './use-compact-stage'
import type { ThresholdRunMode, useThresholdRun } from './use-threshold-run'

const TRACK_NAMES = ['A', 'B', 'C']

/** The protocol, said once at the top of the ritual. */
const RITUAL_STATUS =
  'Three separate measurements run at once, shuffled trial by trial and pooled. Only this reading marks the glass.'

interface ThresholdDrillViewProps {
  title: string
  /** Drill id for the DOM hook (tests, the audit). */
  drillId: string
  /** The bench caption: what the instrument measures. */
  measures: string
  /** One paragraph for the idle console. */
  description: string
  /** Lines of that paragraph the instrument card shows before More. */
  descriptionLines?: number
  /** Under the description at idle: a drill's link to its sound. */
  idleAside?: JSX.Element
  /** The task in one line, shown at idle. */
  prompt: string
  listenHint: string
  answerHint: string
  /** The live staircase level, pre-formatted with its unit. */
  levelLabel: () => string
  /** Caption for that level, e.g. "Gap" or "Offset". */
  levelCaption: string
  /** A reading formatted for display (no unit). */
  formatValue: (value: number) => string
  /** Unit shown under the reading, e.g. "cents". */
  unitLabel: string
  /** Unit shown inline, e.g. "¢" or " ms". */
  unitShort: string
  /** Newest stored reading, or null before the first run. */
  latestValue: () => number | null
  /** The bench's amber control: open in the sealed protocol, with no
   *  practice offered. Begin starts the three-track calibration. */
  ritual?: boolean
  run: ReturnType<typeof useThresholdRun>
  /** The drill's instrument, reactive to the run. */
  instrument: () => JSX.Element
  /** The drill's answer pads. */
  pads: () => JSX.Element
  /** Keys that answer while the pads are armed. */
  keys: () => StageKey[]
  /** The reveal sentence: what was true, and which way the level moves. */
  revealLine: () => string
  /** A reveal sentence the console keeps room for from the first
   *  question: the drill's longer form, at the level a run starts on.
   *  Any longer one the run says after that widens the room then. */
  revealReserve?: string
  /** Starts a run; the run's start unless the drill has to acquire
   *  something (a microphone) first. */
  onStart?: (mode: ThresholdRunMode) => void
  /** Hide Calibration: a sung run is practice only. */
  practiceOnly?: () => boolean
  onBack: () => void
  /** The back control's label when back is not the bench. */
  backLabel?: string
  /** A trial sounds in this many parts (Hairline's two tones): the
   *  native room says which is playing. */
  parts?: number
}

const BEAT: Record<string, RoomBeat> = {
  idle: 'idle',
  stimulus: 'listen',
  answer: 'answer',
  reveal: 'reveal',
  done: 'done',
}

export function ThresholdDrillView(
  props: ThresholdDrillViewProps,
): JSX.Element {
  const phase = () => props.run.phase()
  const start = (runMode: ThresholdRunMode) => {
    if (props.onStart) props.onStart(runMode)
    else props.run.start(runMode)
  }
  const running = () => phase() !== 'idle' && phase() !== 'done'
  const calibrating = () => props.run.mode() === 'calibration'
  /** Auto-advance off: the verdict waits for the Next pad. */
  const parked = () => props.run.parked()
  const ritual = () => props.ritual === true
  const compact = useCompactStage()

  const name = () => (ritual() ? 'Calibration' : props.title)
  const mode = () => {
    if (ritual()) return props.title
    if (phase() === 'idle') return 'on the bench'
    return calibrating() ? 'sealed calibration' : 'practice'
  }

  const progress = () => {
    if (!running()) {
      if (ritual() && phase() === 'idle') {
        return 'Three short staircases, shuffled and pooled · about 50 questions'
      }
      const latest = props.latestValue()
      return latest === null
        ? 'Unmeasured'
        : `Latest reading ${props.formatValue(latest)}${props.unitShort}`
    }
    const left = `about ${props.run.questionsLeft()} questions left`
    if (calibrating()) {
      // The whole run, not the active track: the end is in sight.
      const track = TRACK_NAMES[props.run.activeTrack()] ?? ''
      return `Turns ${props.run.reversalsDone()} of ${props.run.reversalTarget()} · Track ${track} · ${props.levelLabel()} · ${left}`
    }
    return `${props.levelCaption} ${props.levelLabel()} · turns ${props.run.reversalsDone()} of ${props.run.reversalTarget()} · ${left}`
  }

  const status = () => {
    switch (phase()) {
      case 'stimulus':
        return props.listenHint
      case 'answer':
        return props.answerHint
      case 'reveal':
        return props.revealLine()
      default:
        return ritual() ? RITUAL_STATUS : props.prompt
    }
  }

  const tone = () => {
    if (phase() !== 'reveal') return 'neutral' as const
    return props.run.lastCorrect() === true
      ? ('right' as const)
      : ('wrong' as const)
  }

  const keys = (): StageKey[] => {
    if (phase() === 'idle') {
      const mode: ThresholdRunMode = ritual() ? 'calibration' : 'practice'
      return [{ key: 'Space', action: () => start(mode) }]
    }
    if (parked()) return [{ key: 'Space', action: () => props.run.next() }]
    if (phase() === 'answer') return props.keys()
    return []
  }

  /** "Gap 12.0¢ → 9.5¢": where this track's level goes next. */
  const consequence = (): string | undefined => {
    const next = props.run.nextLevel()
    return next === null ? undefined : levelMove(next)
  }
  const levelMove = (next: number): string => {
    const track = calibrating()
      ? `Track ${TRACK_NAMES[props.run.activeTrack()] ?? ''} · `
      : ''
    const unit = props.unitShort
    return `${track}${props.levelCaption} ${props.formatValue(props.run.level())}${unit} → ${props.formatValue(next)}${unit}`
  }

  // Room for the console at its tallest from the first question on: the
  // question line's sentences, and a verdict under the pads. The longest
  // verdict so far stands in for the next one: from the first question
  // the drill's own (revealReserve) or the one this trial would get, and
  // any longer one the run says after that.
  const [longestReveal, setLongestReveal] = createSignal('')
  createEffect(() => {
    if (!running()) {
      setLongestReveal(props.revealReserve ?? '')
      return
    }
    const line = props.revealLine()
    if (line.length > untrack(longestReveal).length) setLongestReveal(line)
  })
  const reserve = (): StageReserve | null =>
    running()
      ? {
          lines: [props.listenHint, props.answerHint, longestReveal()],
          lastCall: {
            correct: false,
            line: longestReveal(),
            consequence: consequence() ?? levelMove(props.run.level()),
            // The verdict it stands in for is the next one.
            label: `Trial ${props.run.trials() + 1}`,
          },
        }
      : null

  useArmingCue(() => phase() === 'answer')

  const lastCall = useLastCall(phase, () => ({
    correct: props.run.lastCorrect() === true,
    line: props.revealLine(),
    consequence: consequence(),
    label: `Trial ${props.run.trials()}`,
  }))

  const estimate = () => props.run.result()?.estimate ?? null
  const again = (): ThresholdRunMode => props.run.result()?.mode ?? 'practice'

  /** What the native room draws on its own; nothing on any other build. */
  // eslint-disable-next-line solid/reactivity -- built once; each field reads the run when the room asks
  const room = EAR_LAB_WITH_MERC ? roomFor() : undefined

  function roomFor(): StageRoom {
    // The newest reading as the run found it, for "finer than last time".
    let previous: number | null = null
    createEffect(() => {
      if (phase() === 'stimulus' && props.run.trials() === 0) {
        previous = untrack(props.latestValue)
      }
    })

    // The staircase as it went: one point per verdict, marked where it
    // turned round.
    const [trace, setTrace] = createSignal<TracePoint[]>([])
    let turnsSeen = 0
    createEffect(() => {
      const now = phase()
      untrack(() => {
        if (now === 'stimulus' && props.run.trials() === 0) {
          setTrace([])
          turnsSeen = 0
        }
        if (now !== 'reveal' || calibrating()) return
        const turns = props.run.reversalsDone()
        setTrace((points) => [
          ...points,
          { level: props.run.level(), turn: turns > turnsSeen },
        ])
        turnsSeen = turns
      })
    })

    const scale = findThresholdDrill(props.drillId)?.scale
    const lowerIsBetter = scale === undefined || scale.expert < scale.novice

    const note = (marked: number | undefined): string => {
      if (marked !== undefined) {
        return `Etched on the glass as ${dateLabel(Date.now())} · ${marked}. Next calibration due ${dateLabel(calibrationDueAt(Date.now()))}.`
      }
      if (estimate() !== null) {
        return 'Practice run: the glass is not marked. A sealed calibration marks it.'
      }
      return calibrating()
        ? 'Stopped before the tracks could finish. A calibration only counts when all three run to the end, so nothing was marked.'
        : 'Stopped before the staircase turned. Nothing to read yet, and nothing marked.'
    }

    const plate = (): ThresholdPlate | null => {
      const result = props.run.result()
      if (result === null) return null
      const reading = result.estimate
      return {
        kind: 'threshold',
        value: reading?.value ?? null,
        format: props.formatValue,
        unit: props.unitLabel,
        unitShort: props.unitShort,
        lowerIsBetter,
        previous,
        calibration: result.mode === 'calibration',
        markedIndex: result.markedIndex,
        provisional:
          reading !== null && 'provisional' in reading && reading.provisional,
        note: note(result.markedIndex),
        tracks: result.trackValues,
        trials: result.trials,
        turns: props.run.reversalsDone(),
        replays: result.replays ?? 0,
      }
    }

    return {
      // The ritual only ever runs a sealed calibration, so it says so
      // before Begin too.
      run: () => (ritual() || calibrating() ? 'sealed' : 'practice'),
      short: () => props.run.short(),
      beat: () => BEAT[phase()] ?? 'idle',
      sounding: () => phase() === 'stimulus' || props.run.replaying(),
      get prompt() {
        return ritual() ? RITUAL_STATUS : props.prompt
      },
      line: () => {
        if (!running()) return null
        if (calibrating()) {
          return {
            kind: 'calibration',
            track: props.run.activeTrack() + 1,
            tracks: TRACK_NAMES.length,
            left: props.run.questionsLeft(),
            answered: props.run.trials(),
          }
        }
        return {
          kind: 'threshold',
          level: `${props.levelCaption} ${props.levelLabel()}`,
          left: props.run.questionsLeft(),
          trace: trace(),
          turns: props.run.reversalsDone(),
        }
      },
      pinned: () => {
        const parts = props.parts
        const step = props.run.stimulusStep()
        return parts !== undefined && step > 0 && phase() === 'stimulus'
          ? `Playing ${step} of ${parts}`
          : null
      },
      replay: props.run.replayable
        ? {
            allowed: () => props.run.replayAllowed(),
            play: () => void props.run.replay(),
            left: () => props.run.replaysLeft(),
          }
        : undefined,
      parked: () => props.run.parked(),
      next: () => props.run.next(),
      pause: () => props.run.pause(),
      hold: () => props.run.holdQuestion(),
      held: () => props.run.held(),
      resume: () => void props.run.resumeQuestion(),
      abandon: () => props.run.abandon(),
      get ritual() {
        return ritual()
      },
      plate,
      again: () => start(again()),
      // Read where it is shown: Span's sung answers are practice only,
      // and the answer mode can change under "?".
      get calibrate() {
        return props.practiceOnly?.() === true || ritual()
          ? undefined
          : // eslint-disable-next-line solid/reactivity -- a press's handler, called from the room's button
            () => start('calibration')
      },
    }
  }

  // A station row or Today's button asked for a run: it starts as the
  // room opens, still inside the tap that opened it.
  onMount(() => {
    if (!EAR_LAB_WITH_MERC) return
    const request = takeRoomStart(props.drillId)
    if (request !== null && phase() === 'idle') start('practice')
  })

  return (
    <EarStage
      drillId={props.drillId}
      name={name()}
      cardName={props.title}
      measures={props.measures}
      description={props.description}
      descriptionLines={props.descriptionLines}
      mode={mode()}
      progress={progress()}
      progressAside={
        <Show when={running() && calibrating()}>
          <TurnsStrip
            counts={props.run.trackReversals()}
            target={props.run.trackTarget()}
            active={props.run.activeTrack()}
          />
        </Show>
      }
      status={status()}
      tone={tone()}
      keys={keys}
      focusConsole={() => phase() === 'answer' || parked()}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onStop={running() ? () => props.run.stop() : undefined}
      lastCall={lastCall}
      reserve={reserve}
      armed={() => phase() === 'answer'}
      done={() => phase() === 'done'}
      room={room}
      instrument={() => (
        <>
          {/* At rest in the ritual the pendulums stand alone, as the
              mock's calibration stage does; the loupe joins them once
              the trials sound. */}
          <Show when={!(ritual() && phase() === 'idle')}>
            {props.instrument()}
          </Show>
          <Show when={running() && calibrating() && !compact()}>
            <TrackPendulums
              counts={props.run.trackReversals()}
              target={props.run.trackTarget()}
              active={props.run.activeTrack()}
              running
              sealed={false}
            />
          </Show>
          <Show when={ritual() && phase() === 'idle'}>
            <TrackPendulums
              counts={[0, 0, 0]}
              target={props.run.trackTarget()}
              active={-1}
              running={false}
              sealed={false}
              tall
            />
          </Show>
        </>
      )}
      console={() => (
        <Show
          when={running()}
          fallback={
            <Show
              when={ritual()}
              fallback={
                <>
                  <ConsoleLead>
                    <PlayPad
                      label="Practice run"
                      sub="about a minute"
                      keycap="Space"
                      icon={<IconPlay size={20} />}
                      onClick={() => start('practice')}
                    />
                    <Show when={props.practiceOnly?.() !== true}>
                      <PlayPad
                        amber
                        label="Calibration"
                        sub="about 50 questions"
                        icon={<IconSeal size={20} />}
                        onClick={() => start('calibration')}
                      />
                    </Show>
                  </ConsoleLead>
                  {props.idleAside}
                </>
              }
            >
              <ConsoleLead>
                <PlayPad
                  amber
                  label="Begin"
                  sub="about 50 questions · marks the glass"
                  keycap="Space"
                  icon={<IconSeal size={20} />}
                  onClick={() => start('calibration')}
                />
              </ConsoleLead>
              <ConsoleNote>
                No hints, no retries, no adaptation beyond the staircase itself.
                Stopping it marks nothing.
              </ConsoleNote>
            </Show>
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
                    : phase() === 'reveal'
                      ? 'Next'
                      : 'Listening'
                }
                // The parked Next pad's icon and keycap, held unseen: on a
                // desk they made the pad, and with it the console, 2 to 6
                // px taller each time a run parked on a verdict.
                icon={<IconPlay size={20} class={styles.reserved} />}
                heldKeycap="Space"
              />
            }
          >
            <PlayPad
              label="Next"
              keycap="Space"
              icon={<IconPlay size={20} />}
              onClick={() => props.run.next()}
            />
          </Show>
          {props.pads()}
        </Show>
      )}
      plate={() => (
        <Show
          when={estimate()}
          fallback={
            <EndPlate
              kicker="Stopped"
              value="—"
              note={
                calibrating()
                  ? 'Stopped before the tracks could finish. A calibration only counts when all three run to the end, so nothing was marked.'
                  : 'Stopped before the staircase turned. Nothing to read yet, and nothing marked.'
              }
              onAgain={() => start(again())}
              againLabel={calibrating() ? 'Calibrate again' : 'Run again'}
              onBack={props.onBack}
              backLabel={props.backLabel}
            />
          }
        >
          {(reading) => {
            const marked = () => props.run.result()?.markedIndex
            const pooled = () =>
              'standardError' in reading()
                ? (reading() as { standardError: number }).standardError
                : null
            return (
              <EndPlate
                kicker={marked() !== undefined ? 'Sealed' : 'Reading'}
                sealed={marked() !== undefined}
                value={props.formatValue(reading().value)}
                unit={`${props.unitLabel}${
                  marked() !== undefined
                    ? ' · pooled from three tracks'
                    : reading().provisional
                      ? ' · provisional'
                      : ''
                }`}
                note={
                  <Show
                    when={marked() !== undefined}
                    fallback="Practice run: the glass is not marked. A sealed calibration marks it."
                  >
                    Etched on the glass as{' '}
                    <b>
                      {dateLabel(Date.now())} · {marked()}
                    </b>
                    . Next calibration due{' '}
                    {dateLabel(calibrationDueAt(Date.now()))}.
                  </Show>
                }
                onAgain={() => start(again())}
                againLabel={calibrating() ? 'Calibrate again' : 'Run again'}
                onBack={props.onBack}
                backLabel={props.backLabel}
              >
                <Show when={marked() !== undefined}>
                  <div class={styles.plateFigure}>
                    <TrackPendulums
                      counts={[
                        props.run.trackTarget(),
                        props.run.trackTarget(),
                        props.run.trackTarget(),
                      ]}
                      target={props.run.trackTarget()}
                      active={-1}
                      running={false}
                      sealed
                    />
                  </div>
                </Show>
                <Show when={pooled()}>
                  {(spread) => (
                    <PlateLine>
                      ± {props.formatValue(spread())}
                      {props.unitShort} across 3 pooled tracks
                    </PlateLine>
                  )}
                </Show>
                <Show when={reading().provisional && marked() === undefined}>
                  <PlateBadge>Provisional · short run</PlateBadge>
                </Show>
                <Show when={props.run.grade()}>
                  {(grade) => (
                    <PlateLine>
                      Grade {grade()} · {props.run.trials()} trials
                    </PlateLine>
                  )}
                </Show>
              </EndPlate>
            )
          }}
        </Show>
      )}
    />
  )
}
