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
// ============================================================

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { IconPlay, IconSeal } from './ear-icons'
import type { StageKey } from './EarStage'
import { ConsoleLead, ConsoleNote, EarStage, EndPlate, PlateBadge, PlateLine, PlayPad, } from './EarStage'
import { dateLabel } from './instruments'
import { TrackPendulums } from './TrackPendulums'
import type { ThresholdRunMode, useThresholdRun } from './use-threshold-run'

const TRACK_NAMES = ['A', 'B', 'C']

interface ThresholdDrillViewProps {
  title: string
  /** Drill id for the DOM hook (tests, the audit). */
  drillId: string
  /** The bench caption: what the instrument measures. */
  measures: string
  /** One paragraph for the idle console. */
  description: string
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
  run: ReturnType<typeof useThresholdRun>
  /** The drill's instrument, reactive to the run. */
  instrument: () => JSX.Element
  /** The drill's answer pads. */
  pads: () => JSX.Element
  /** Keys that answer while the pads are armed. */
  keys: () => StageKey[]
  /** The reveal sentence: what was true, and which way the level moves. */
  revealLine: () => string
  onBack: () => void
}

export function ThresholdDrillView(
  props: ThresholdDrillViewProps,
): JSX.Element {
  const phase = () => props.run.phase()
  const running = () => phase() !== 'idle' && phase() !== 'done'
  const calibrating = () => props.run.mode() === 'calibration'

  const mode = () => {
    if (phase() === 'idle') return 'on the bench'
    return calibrating() ? 'sealed calibration' : 'practice'
  }

  const progress = () => {
    if (!running()) {
      const latest = props.latestValue()
      return latest === null
        ? 'Unmeasured'
        : `Latest reading ${props.formatValue(latest)}${props.unitShort}`
    }
    const track = calibrating()
      ? `Track ${TRACK_NAMES[props.run.activeTrack()] ?? ''} · `
      : ''
    return `${track}${props.levelCaption} ${props.levelLabel()} · reversal ${props.run.reversalsDone()} of ${props.run.reversalTarget()}`
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
        return props.prompt
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
      return [{ key: 'Space', action: () => props.run.start('practice') }]
    }
    if (phase() === 'answer') return props.keys()
    return []
  }

  const estimate = () => props.run.result()?.estimate ?? null
  const again = (): ThresholdRunMode => props.run.result()?.mode ?? 'practice'

  return (
    <EarStage
      drillId={props.drillId}
      name={props.title}
      mode={mode()}
      progress={progress()}
      status={status()}
      tone={tone()}
      keys={keys}
      focusConsole={() => phase() === 'answer'}
      onBack={props.onBack}
      onStop={running() ? () => props.run.stop() : undefined}
      stopLabel={calibrating() ? 'Abandon' : 'Stop'}
      done={() => phase() === 'done'}
      instrument={() => (
        <>
          {props.instrument()}
          <Show when={running() && calibrating()}>
            <TrackPendulums
              counts={props.run.trackReversals()}
              target={props.run.trackTarget()}
              active={props.run.activeTrack()}
              running
              sealed={false}
            />
          </Show>
        </>
      )}
      console={() => (
        <Show
          when={running()}
          fallback={
            <>
              <ConsoleLead>
                <PlayPad
                  label="Practice run"
                  sub="about a minute"
                  keycap="Space"
                  icon={<IconPlay size={20} />}
                  onClick={() => props.run.start('practice')}
                />
                <PlayPad
                  amber
                  label="Calibration"
                  sub="3 tracks · about 3 min"
                  icon={<IconSeal size={20} />}
                  onClick={() => props.run.start('calibration')}
                />
              </ConsoleLead>
              <ConsoleNote>{props.description}</ConsoleNote>
            </>
          }
        >
          <PlayPad
            state={phase() === 'answer' ? 'armed' : 'sounding'}
            label={phase() === 'answer' ? 'Your call' : 'Listening'}
            sub={
              phase() === 'answer' ? props.measures : `${props.levelLabel()}`
            }
          />
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
                  ? 'Stopped before the tracks could finish — a calibration only counts when all three run to the end, so nothing was marked.'
                  : 'Stopped before the staircase turned — nothing to read yet, and nothing marked.'
              }
              onAgain={() => props.run.start(again())}
              onBack={props.onBack}
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
                    fallback="Practice run — the glass is not marked. A sealed calibration marks it."
                  >
                    Etched on the glass as{' '}
                    <b>
                      {dateLabel(Date.now())} · {marked()}
                    </b>
                    .
                  </Show>
                }
                onAgain={() => props.run.start(again())}
                againLabel={calibrating() ? 'Calibrate again' : 'Run again'}
                onBack={props.onBack}
              >
                <Show when={pooled()}>
                  {(spread) => (
                    <PlateLine>
                      ± {props.formatValue(spread())}
                      {props.unitShort} across 3 pooled tracks
                    </PlateLine>
                  )}
                </Show>
                <Show when={reading().provisional && marked() === undefined}>
                  <PlateBadge>Provisional — short run</PlateBadge>
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
