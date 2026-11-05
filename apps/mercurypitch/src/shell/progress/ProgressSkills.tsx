// ============================================================
// Skill threads and your voice: like compared with like, and the latest print
// ============================================================
//
// A thread is one exercise or song sung more than once in the same setup;
// its points are drawn on the snapshot's own scale (0 to 100 percent, as
// the web's thread is), so a small change looks small. Every point is
// listed for a screen reader. The voice card states the latest voiceprint
// and draws its measured range on a keyboard, from the range the card
// already states; a range the page cannot read leaves the keyboard out.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ProgressActionView, ProgressSkillThreadView, ProgressThreadPointView, ProgressTraceView, ProgressVoiceAtlasView, } from '@/features/progress/ProgressPage'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { PulseIcon, SparkleIcon, WaveIcon } from '../icons'
import type { MeasuredRange } from './progress-lines'
import { inAppAction, isBlackKey, keyboardSpan, measuredRange, } from './progress-lines'
import { ActionRow, Tiles } from './progress-parts'

const CHART_W = 300
const CHART_H = 84
const CHART_PAD = 12

/** Where each point sits in the chart: evenly across, its level up. */
function chartPoints(
  levels: readonly number[],
): ReadonlyArray<{ x: number; y: number }> {
  const span = CHART_W - CHART_PAD * 2
  return levels.map((level, index) => ({
    x:
      levels.length === 1
        ? CHART_W / 2
        : CHART_PAD + (span * index) / (levels.length - 1),
    y:
      CHART_PAD +
      (1 - Math.min(1, Math.max(0, level))) * (CHART_H - CHART_PAD * 2),
  }))
}

/** A line through the points, and the area under it. */
function ThreadLine(props: {
  levels: readonly number[]
  gradientId: string
}): JSX.Element {
  const points = () => chartPoints(props.levels)
  const line = () =>
    points()
      .map((point) => `${point.x},${point.y}`)
      .join(' ')
  const area = () => {
    const all = points()
    const firstX = all[0]?.x ?? 0
    const lastX = all.at(-1)?.x ?? 0
    return `M${firstX},${CHART_H} L${line().replaceAll(' ', ' L')} L${lastX},${CHART_H} Z`
  }
  return (
    <svg
      class="mp-prog-line"
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={props.gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop class="mp-prog-line__stop-top" offset="0" />
          <stop class="mp-prog-line__stop-foot" offset="1" />
        </linearGradient>
      </defs>
      <path
        class="mp-prog-line__grid"
        d={`M0 ${CHART_PAD}H${CHART_W}M0 ${CHART_H / 2}H${CHART_W}M0 ${CHART_H - CHART_PAD}H${CHART_W}`}
      />
      <Show when={points().length > 1}>
        <path d={area()} fill={`url(#${props.gradientId})`} />
        <polyline class="mp-prog-line__path" points={line()} />
      </Show>
      <For each={points()}>
        {(point, index) => (
          <circle
            class="mp-prog-line__dot"
            data-latest={index() === points().length - 1 ? 'on' : undefined}
            cx={point.x}
            cy={point.y}
            r={index() === points().length - 1 ? 7 : 5}
          />
        )}
      </For>
    </svg>
  )
}

/** The labels under a thread: every point when there are three or fewer, else the ends. */
function labelledPoints(
  points: readonly ProgressThreadPointView[],
): ProgressThreadPointView[] {
  if (points.length <= 3) return [...points]
  const first = points[0]
  const last = points.at(-1)
  return last === undefined ? [first] : [first, last]
}

function Thread(props: {
  thread: ProgressSkillThreadView
  index: number
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  const latest = () => props.thread.points.at(-1)
  return (
    <article class="mp-prog-thread" data-thread={props.thread.id}>
      <div class="mp-prog-thread__head">
        <div class="mp-prog-thread__name">
          <h3>{props.thread.label}</h3>
          <p class="mp-prog-meta">{props.thread.context}</p>
        </div>
        <Show when={latest()}>
          {(point) => (
            <p class="mp-prog-thread__latest">
              <b>{point().value}</b>
              <span class="mp-prog-meta">{props.thread.metricLabel}</span>
            </p>
          )}
        </Show>
      </div>
      <ThreadLine
        levels={props.thread.points.map((point) => point.level)}
        gradientId={`mp-prog-thread-${props.index}`}
      />
      <ol
        class="mp-prog-sr"
        aria-label={`${props.thread.label}, ${props.thread.metricLabel}`}
      >
        <For each={props.thread.points}>
          {(point) => (
            <li>
              {point.label}: {point.value}
            </li>
          )}
        </For>
      </ol>
      <div class="mp-prog-thread__labels" aria-hidden="true">
        <For each={labelledPoints(props.thread.points)}>
          {(point) => (
            <span>
              {point.label} <b>{point.value}</b>
            </span>
          )}
        </For>
      </div>
      <p class="mp-prog-card__text">{props.thread.summary}</p>
      <Show when={inAppAction(props.thread.action)}>
        {(action) => (
          <ActionRow
            action={action()}
            lead={<PulseIcon size={20} />}
            onAction={props.onAction}
          />
        )}
      </Show>
    </article>
  )
}

export function ThreadsCard(props: {
  threads: readonly ProgressSkillThreadView[]
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  return (
    <section
      class="mp-prog-card"
      aria-labelledby="mp-prog-threads"
      data-testid="progress-threads"
    >
      <div class="mp-prog-card__head">
        <h2 class="mp-prog-eyebrow" id="mp-prog-threads">
          Skill threads
        </h2>
        <span class="mp-prog-meta">Like compared with like</span>
      </div>
      <Show
        when={props.threads.length > 0}
        fallback={
          <>
            <p class="mp-prog-card__lead">No comparable thread yet.</p>
            <p class="mp-prog-card__text">
              Repeat the same exercise to begin an earlier and later view.
            </p>
          </>
        }
      >
        <For each={props.threads}>
          {(thread, index) => (
            <Thread thread={thread} index={index()} onAction={props.onAction} />
          )}
        </For>
      </Show>
    </section>
  )
}

/** The keyboard's white keys between two notes, and its black ones. */
function keys(span: MeasuredRange): { white: number[]; black: number[] } {
  const white: number[] = []
  const black: number[] = []
  for (let midi = span.low; midi <= span.high; midi += 1) {
    if (isBlackKey(midi)) black.push(midi)
    else white.push(midi)
  }
  return { white, black }
}

/** The measured range, lit on a keyboard from C2 to C6 (or wider). */
function RangeKeys(props: { range: MeasuredRange }): JSX.Element {
  const span = () => keyboardSpan(props.range)
  const layout = () => keys(span())
  const width = () => layout().white.length * 11
  const lit = (midi: number): boolean =>
    midi >= props.range.low && midi <= props.range.high
  /** A black key sits over the gap after the white key below it. */
  const blackX = (midi: number): number =>
    layout().white.indexOf(midi - 1) * 11 + 7.5
  const label = () =>
    `Measured range ${midiToNoteNameOctave(props.range.low)} to ${midiToNoteNameOctave(props.range.high)}, on a keyboard from ${midiToNoteNameOctave(span().low)} to ${midiToNoteNameOctave(span().high)}.`
  return (
    <figure class="mp-prog-keys">
      <svg
        viewBox={`0 0 ${width()} 40`}
        role="img"
        aria-label={label()}
        preserveAspectRatio="none"
      >
        <For each={layout().white}>
          {(midi, index) => (
            <rect
              class="mp-prog-keys__white"
              data-lit={lit(midi) ? 'on' : undefined}
              x={index() * 11}
              y="0"
              width="10"
              height="40"
              rx="3"
            />
          )}
        </For>
        <For each={layout().black}>
          {(midi) => (
            <rect
              class="mp-prog-keys__black"
              data-lit={lit(midi) ? 'on' : undefined}
              x={blackX(midi)}
              y="0"
              width="6"
              height="24"
              rx="2"
            />
          )}
        </For>
      </svg>
      <figcaption class="mp-prog-keys__ends" aria-hidden="true">
        <span>{midiToNoteNameOctave(span().low)}</span>
        <span class="mp-prog-keys__lit">
          {midiToNoteNameOctave(props.range.low)} to{' '}
          {midiToNoteNameOctave(props.range.high)}
        </span>
        <span>{midiToNoteNameOctave(span().high)}</span>
      </figcaption>
    </figure>
  )
}

/** A voice trace the snapshot carries, as a quiet line. */
function VoiceTrace(props: { trace: ProgressTraceView }): JSX.Element {
  return (
    <figure class="mp-prog-trace">
      <ThreadLine
        levels={props.trace.values}
        gradientId="mp-prog-voice-trace"
      />
      <figcaption class="mp-prog-meta">{props.trace.label}</figcaption>
    </figure>
  )
}

/** The voice card's rows: the constellation with the twin's portrait, the rest plain. */
function VoiceAction(props: {
  action: ProgressActionView
  voice: ProgressVoiceAtlasView
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  const constellation = () => props.action.id === 'voice-constellation'
  return (
    <ActionRow
      action={props.action}
      line={
        constellation() && props.voice.twinName !== undefined
          ? `Closest voice: ${props.voice.twinName}`
          : undefined
      }
      lead={
        constellation() ? (
          <Show
            when={props.voice.portraitUrl}
            fallback={<SparkleIcon size={20} />}
          >
            {(src) => (
              <img
                class="mp-prog-row__portrait"
                src={src()}
                alt=""
                width="36"
                height="36"
                loading="lazy"
                decoding="async"
              />
            )}
          </Show>
        ) : (
          <WaveIcon size={20} />
        )
      }
      onAction={props.onAction}
    />
  )
}

export function VoiceCard(props: {
  voice?: ProgressVoiceAtlasView
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  const range = () => {
    const metric = props.voice?.metrics.find((fact) => fact.id === 'range')
    return metric === undefined ? null : measuredRange(metric.value)
  }
  return (
    <section
      class="mp-prog-card"
      aria-labelledby="mp-prog-voice"
      data-testid="progress-voice"
    >
      <div class="mp-prog-card__head">
        <h2 class="mp-prog-eyebrow" id="mp-prog-voice">
          Your voice
        </h2>
        <span class="mp-prog-meta">
          {props.voice?.measuredAtLabel ?? 'Not mapped yet'}
        </span>
      </div>
      <p class="mp-prog-card__lead">
        {props.voice?.title ?? 'Your voice begins with a voiceprint.'}
      </p>
      <Show when={range()}>
        {(measured) => <RangeKeys range={measured()} />}
      </Show>
      <Show when={props.voice?.trace}>
        {(trace) => <VoiceTrace trace={trace()} />}
      </Show>
      <Tiles facts={props.voice?.metrics ?? []} />
      <p class="mp-prog-card__text">
        {props.voice?.description ??
          'Map your range once to place your voice beside your practice record.'}
      </p>
      <Show when={props.voice}>
        {(voice) => (
          <For
            each={voice().actions.filter(
              (action) => inAppAction(action) !== undefined,
            )}
          >
            {(action) => (
              <VoiceAction
                action={action}
                voice={voice()}
                onAction={props.onAction}
              />
            )}
          </For>
        )}
      </Show>
    </section>
  )
}
