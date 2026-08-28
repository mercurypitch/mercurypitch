// ============================================================
// EarStage — one instrument on the bench, with its console.
//
// The stage a drill runs on inside the Regulator Room: a drill bar
// (back, the drill's name and mode, its live progress, Stop), the
// instrument in the flexible centre with a spoken status line, and
// the answer console fixed at the bottom where the bench's bridge
// would be. When a run ends the instrument and console give way to
// a reading on an engraved plate — never stars.
//
// Nothing here knows which engine is running. Threshold drills,
// identification drills and Home compose it with their own
// instrument, pads and plate; the stage only lays them out, colours
// a reveal AND says it, and works the keyboard (Space begins, digits
// answer). Built to be lifted out of the Ear Lab later.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, useContext, } from 'solid-js'
import { EngineContext } from '@/contexts/EngineContext'
import { unlockAudio } from '@/lib/audio-unlock'
import { earAutoAdvance, setEarAutoAdvance } from '@/stores/ear-lab-store'
import { IconBack, IconCheck, IconClose, IconStop, IconTap } from './ear-icons'
import styles from './EarStage.module.css'

export type StageTone = 'neutral' | 'right' | 'wrong'

export interface StageKey {
  /** `event.key` to match ('1'…'9'), or 'Space' for the space bar. */
  key: string
  action: () => void
}

/** The verdict the Last call plate keeps until the next one. */
export interface LastCall {
  correct: boolean
  /** The verdict sentence — what was true. */
  line: string
  /** The consequence: where the level goes, the rating's move, what
   *  was answered on a miss. */
  consequence?: string
  /** "Trial 7", "Round 3" — where in the run it was called. */
  label?: string
}

interface EarStageProps {
  /** DOM hook (tests, the audit): data-ear-drill. */
  drillId: string
  name: string
  /** Shown small beside the name: "practice", "calibration", "rating". */
  mode: string
  /** The live line under the name: gap, reversal, round, rating. */
  progress: string
  /** The instrument's spoken line; announced politely as it changes. */
  status: string
  tone?: StageTone
  instrument: () => JSX.Element
  console: () => JSX.Element
  /** True once the run is over; the plate replaces instrument + console. */
  done?: () => boolean
  plate?: () => JSX.Element
  /** Set while a run can be stopped; the stop square and the
   *  auto-advance switch show only then. */
  onStop?: () => void
  /** The last verdict, kept under the pads until the next one. */
  lastCall?: () => LastCall | null
  onBack: () => void
  backLabel?: string
  keys?: () => StageKey[]
  /** Flip to true to move focus onto the first live pad (the answer
   *  phase opening), so a keyboard user is already on the console. */
  focusConsole?: () => boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT')
  )
}

interface StageBarProps {
  name: string
  /** Shown small beside the name; the report has none. */
  mode?: string
  progress: string
  onBack: () => void
  /** Where back goes when not the bench: "Back to the page". */
  backLabel?: string
  /** The right-hand control: Stop while a run can be stopped, the
   *  report's range control. */
  aside?: JSX.Element
}

/** The drill bar — back, identity, the live line, one control. Shared
 *  by every stage and by the Ear Report, so the room's bars match. */
export function StageBar(props: StageBarProps): JSX.Element {
  return (
    <div class={styles.bar}>
      <button
        type="button"
        class={styles.back}
        onClick={() => props.onBack()}
        aria-label={props.backLabel ?? 'Back to the bench'}
      >
        <IconBack size={18} />
      </button>
      <div class={styles.identity}>
        <span class={styles.name}>
          {props.name}
          <Show when={props.mode}>
            {(mode) => (
              <>
                {' '}
                <small class={styles.mode}>· {mode()}</small>
              </>
            )}
          </Show>
        </span>
        <span class={styles.progress} data-testid="ear-stage-progress">
          {props.progress}
        </span>
      </div>
      {props.aside}
    </div>
  )
}

interface AutoAdvanceSwitchProps {
  /** "Auto" in the bar, "Auto-advance" in the rack. */
  label?: string
}

/** The one switch behind every drill's pacing: on, the verdict holds
 *  for the rack's setting and the next trial follows by itself; off,
 *  the run parks on the verdict until Next. The bar and the rack
 *  both render it, and both read the same persisted signal. */
export function AutoAdvanceSwitch(props: AutoAdvanceSwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      class={styles.auto}
      aria-checked={earAutoAdvance()}
      aria-label="Auto-advance"
      title={
        earAutoAdvance()
          ? 'Auto-advance on: the next trial follows the verdict'
          : 'Auto-advance off: each verdict waits for Next'
      }
      data-testid="ear-auto-advance"
      onClick={() => setEarAutoAdvance(!earAutoAdvance())}
    >
      <span class={styles.autoLabel}>{props.label ?? 'Auto'}</span>
      <span class={styles.autoTrack} aria-hidden="true">
        <span class={styles.autoKnob} />
      </span>
    </button>
  )
}

export function EarStage(props: EarStageProps): JSX.Element {
  let consoleEl: HTMLDivElement | undefined

  createEffect(() => {
    const keys = props.keys?.()
    if (!keys || keys.length === 0) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey) return
      if (event.altKey || isTypingTarget(event.target)) return
      const isSpace = event.code === 'Space'
      // A focused button already fires on Space; let the browser have it.
      if (isSpace && event.target instanceof HTMLButtonElement) return
      const match = keys.find((entry) =>
        entry.key === 'Space' ? isSpace : entry.key === event.key,
      )
      if (!match) return
      event.preventDefault()
      match.action()
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })

  createEffect(() => {
    if (props.focusConsole?.() !== true) return
    queueMicrotask(() => {
      const pad = consoleEl?.querySelector<HTMLButtonElement>(
        'button:not(:disabled)',
      )
      pad?.focus({ preventScroll: true })
    })
  })

  return (
    <section
      class={styles.stage}
      data-ear-drill={props.drillId}
      data-testid="ear-stage"
      aria-label={props.name}
    >
      <StageBar
        name={props.name}
        mode={props.mode}
        progress={props.progress}
        onBack={props.onBack}
        backLabel={props.backLabel}
        aside={
          <Show when={props.onStop}>
            <div class={styles.controls}>
              <AutoAdvanceSwitch />
              <button
                type="button"
                class={styles.stop}
                onClick={() => props.onStop?.()}
                aria-label="Stop"
                title="Stop the run"
              >
                <IconStop size={18} />
              </button>
            </div>
          </Show>
        }
      />

      <Show
        when={props.done?.() === true}
        fallback={
          <>
            <div class={styles.body}>
              <figure class={styles.figure}>
                {props.instrument()}
                <figcaption
                  class={styles.status}
                  classList={{
                    [styles.statusRight]: props.tone === 'right',
                    [styles.statusWrong]: props.tone === 'wrong',
                  }}
                  aria-live="polite"
                  data-testid="ear-stage-status"
                >
                  {props.status}
                </figcaption>
              </figure>
            </div>
            <div
              class={styles.console}
              ref={consoleEl}
              data-testid="ear-stage-console"
            >
              {props.console()}
              <Show when={props.lastCall?.()}>
                {(call) => (
                  <aside
                    class={styles.lastCall}
                    classList={{
                      [styles.lastCallRight]: call().correct,
                      [styles.lastCallWrong]: !call().correct,
                    }}
                    data-testid="ear-stage-last-call"
                    data-verdict={call().correct ? 'right' : 'wrong'}
                  >
                    <span class={styles.lastCallMark} aria-hidden="true">
                      <Show
                        when={call().correct}
                        fallback={<IconClose size={13} />}
                      >
                        <IconCheck size={13} />
                      </Show>
                    </span>
                    <span class={styles.lastCallKicker}>
                      {call().label === undefined
                        ? 'Last call'
                        : `Last call · ${call().label}`}
                    </span>
                    <p class={styles.lastCallLine}>{call().line}</p>
                    <Show when={call().consequence}>
                      {(consequence) => (
                        <p class={styles.lastCallNote}>{consequence()}</p>
                      )}
                    </Show>
                  </aside>
                )}
              </Show>
            </div>
          </>
        }
      >
        <div class={styles.plateHost}>{props.plate?.()}</div>
      </Show>
    </section>
  )
}

/* ── Console parts ───────────────────────────────────────────── */

interface PlayPadProps {
  label: string
  sub?: string
  keycap?: string
  amber?: boolean
  /** The lamp states while a run is on: the prompt is sounding, or
   *  the pads are armed. Both are inert. */
  state?: 'sounding' | 'armed'
  disabled?: boolean
  onClick?: () => void
  icon?: JSX.Element
}

/** The lead pad of a console: Begin, Practice, Calibrate — or, once a
 *  run is on, the lamp that says whether to listen or to answer. */
export function PlayPad(props: PlayPadProps): JSX.Element {
  const engines = useContext(EngineContext)
  return (
    <button
      type="button"
      class={styles.playPad}
      classList={{
        [styles.playPadAmber]: props.amber === true,
        [styles.playPadSounding]: props.state === 'sounding',
        [styles.playPadArmed]: props.state === 'armed',
      }}
      disabled={props.disabled === true || props.state !== undefined}
      onClick={() => {
        // Still inside the tap: iOS only un-suspends a context, and only
        // promotes the page to the audible session, from a gesture.
        unlockAudio(engines?.audioEngine.getAudioContext())
        props.onClick?.()
      }}
    >
      {props.icon}
      <span>{props.label}</span>
      <Show when={props.sub}>
        <small>{props.sub}</small>
      </Show>
      <Show when={props.keycap}>
        <kbd>{props.keycap}</kbd>
      </Show>
    </button>
  )
}

/** A column of lead pads (Practice above Calibrate). */
export function ConsoleLead(props: { children: JSX.Element }): JSX.Element {
  return <div class={styles.lead}>{props.children}</div>
}

export function ConsoleNote(props: { children: JSX.Element }): JSX.Element {
  return <p class={styles.consoleNote}>{props.children}</p>
}

interface TapPadProps {
  label: string
  sub?: string
  /** Lit while a take is on: the pad is listening for taps. */
  armed?: boolean
  disabled?: boolean
  /** A tap, with the page-clock time of the pointer or key event —
   *  the event's own stamp, not a later performance.now(), so the
   *  rhythm seam measures the touch and not the render. */
  onTap: (atMs: number) => void
}

/** The rhythm seam's input: one wide pad that takes taps on pointer
 *  down (a click would arrive a frame or two late) and on Space or
 *  Enter, and flashes brass for each. */
export function TapPad(props: TapPadProps): JSX.Element {
  const [hit, setHit] = createSignal(false)
  let flash: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(flash))
  const register = (atMs: number) => {
    props.onTap(atMs)
    setHit(true)
    clearTimeout(flash)
    flash = setTimeout(() => setHit(false), 110)
  }
  return (
    <button
      type="button"
      class={styles.tapPad}
      classList={{
        [styles.tapPadArmed]: props.armed === true,
        [styles.tapPadHit]: hit(),
      }}
      disabled={props.disabled === true}
      data-testid="ear-tap-pad"
      onPointerDown={(event) => {
        // Secondary mouse buttons are not taps; touch and pen report 0.
        if (event.button > 0) return
        event.preventDefault()
        register(event.timeStamp)
      }}
      onKeyDown={(event) => {
        if (event.repeat) return
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        register(event.timeStamp)
      }}
    >
      <IconTap size={22} />
      <span>{props.label}</span>
      <Show when={props.sub}>
        <small>{props.sub}</small>
      </Show>
    </button>
  )
}

/** A quiet link in the console — to the room's sound, say. */
export function ConsoleLink(props: {
  onClick: () => void
  children: JSX.Element
}): JSX.Element {
  return (
    <button
      type="button"
      class={styles.consoleLink}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}

/** Free-form column beside the lead pad (mode toggles, warnings). */
export function ConsoleStack(props: { children: JSX.Element }): JSX.Element {
  return <div class={styles.consoleStack}>{props.children}</div>
}

/** Wrap a console whose only child is the pads (no lead column). */
export function consoleSingleClass(): string {
  return styles.consoleSingle
}

interface PadsProps {
  columns: number
  label: string
  /** Narrow rungs in one row (Home's ladder, Leap's twelve). */
  compact?: boolean
  children: JSX.Element
}

export function Pads(props: PadsProps): JSX.Element {
  return (
    <div
      class={styles.pads}
      classList={{ [styles.padsCompact]: props.compact === true }}
      style={{ '--pad-columns': String(props.columns) }}
      role="group"
      aria-label={props.label}
      data-testid="ear-stage-pads"
    >
      {props.children}
    </div>
  )
}

export type PadState = 'right' | 'wrong' | null

interface StagePadProps {
  keycap?: string
  label: string
  sub?: string
  state?: PadState
  disabled?: boolean
  onClick: () => void
}

/** One answer pad. A reveal colours it and marks it — the mark and the
 *  status line carry the verdict for anyone who cannot see the colour. */
export function StagePad(props: StagePadProps): JSX.Element {
  return (
    <button
      type="button"
      class={styles.pad}
      classList={{
        [styles.padRight]: props.state === 'right',
        [styles.padWrong]: props.state === 'wrong',
      }}
      disabled={props.disabled === true}
      onClick={() => props.onClick()}
      data-state={props.state ?? undefined}
    >
      <span class={styles.padHead}>
        <Show when={props.keycap}>
          <kbd class={styles.padKey}>{props.keycap}</kbd>
        </Show>
        <Show when={props.state === 'right'}>
          <span class={styles.padMark} aria-label="Right">
            <IconCheck size={14} />
          </span>
        </Show>
        <Show when={props.state === 'wrong'}>
          <span class={styles.padMark} aria-label="Wrong">
            <IconClose size={14} />
          </span>
        </Show>
      </span>
      <span class={styles.padLabel}>{props.label}</span>
      <Show when={props.sub}>
        <span class={styles.padSub}>{props.sub}</span>
      </Show>
    </button>
  )
}

interface ModeToggleProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; label: string }>
  onChange: (value: T) => void
}

export function ModeToggle<T extends string>(
  props: ModeToggleProps<T>,
): JSX.Element {
  return (
    <div class={styles.toggle} role="radiogroup" aria-label={props.label}>
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            role="radio"
            class={styles.toggleOption}
            classList={{ [styles.toggleOn]: props.value === option.id }}
            aria-checked={props.value === option.id}
            onClick={() => props.onChange(option.id)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  )
}

export function ConsoleWarning(props: { children: JSX.Element }): JSX.Element {
  return <p class={styles.warn}>{props.children}</p>
}

/* ── The end plate ───────────────────────────────────────────── */

interface EndPlateProps {
  /** "Reading", "Rating", "Sealed", "Stopped". */
  kicker: string
  /** The number, already formatted; '—' when there is none. */
  value: string
  /** Unit and qualifier under the number: "¢ · provisional". */
  unit?: string
  /** The one serif sentence: what the number means for the glass. */
  note?: JSX.Element
  sealed?: boolean
  /** Muted lines under the note (grade, trials, ear vs voice). */
  children?: JSX.Element
  onAgain?: () => void
  againLabel?: string
  onBack: () => void
  backLabel?: string
}

export function EndPlate(props: EndPlateProps): JSX.Element {
  let first: HTMLButtonElement | undefined
  onMount(() => queueMicrotask(() => first?.focus({ preventScroll: true })))

  return (
    <div
      class={styles.plate}
      classList={{ [styles.plateSealed]: props.sealed === true }}
      role="status"
      data-testid="ear-stage-plate"
    >
      <span class={styles.plateKicker}>{props.kicker}</span>
      <p class={styles.plateValue}>
        {props.value}
        <Show when={props.unit}>
          <small class={styles.plateUnit}>{props.unit}</small>
        </Show>
      </p>
      <Show when={props.note}>
        <p class={styles.plateNote}>{props.note}</p>
      </Show>
      {props.children}
      <div class={styles.plateActions}>
        <Show when={props.onAgain}>
          <button
            type="button"
            class={`${styles.quiet} ${styles.quietPrimary}`}
            onClick={() => props.onAgain?.()}
            ref={first}
          >
            {props.againLabel ?? 'Run again'}
          </button>
        </Show>
        <button
          type="button"
          class={styles.quiet}
          onClick={() => props.onBack()}
          ref={(el) => {
            if (!props.onAgain) first = el
          }}
        >
          {props.backLabel ?? 'Back to the bench'}
        </button>
      </div>
    </div>
  )
}

export function PlateLine(props: { children: JSX.Element }): JSX.Element {
  return <p class={styles.plateLine}>{props.children}</p>
}

export function PlateBadge(props: { children: JSX.Element }): JSX.Element {
  return <span class={styles.plateBadge}>{props.children}</span>
}

export function PlateDelta(props: {
  delta: number
  label: string
}): JSX.Element {
  return (
    <span
      class={styles.plateDelta}
      classList={{
        [styles.deltaUp]: props.delta >= 0,
        [styles.deltaDown]: props.delta < 0,
      }}
    >
      {props.delta >= 0 ? '+' : ''}
      {props.delta} {props.label}
    </span>
  )
}

export interface OutcomeDot {
  correct: boolean
  skipped?: boolean
  title: string
}

export function OutcomeDots(props: { outcomes: OutcomeDot[] }): JSX.Element {
  return (
    <div class={styles.dots} aria-label="Round by round">
      <For each={props.outcomes}>
        {(outcome) => (
          <span
            class={styles.dot}
            classList={{
              [styles.dotMiss]: !outcome.correct && outcome.skipped !== true,
              [styles.dotSkip]: outcome.skipped === true,
            }}
            title={outcome.title}
          />
        )}
      </For>
    </div>
  )
}
