// ============================================================
// RoomShell: the page every exercise room draws around its world
// ============================================================
//
// Echo, Long note, Lip roll and Ng slides are each one page over a world
// of their own: the sky, the lantern, the bay, the bridge. Around that
// world the page is the same in all four, and it is here:
//
//   RoomShell    the root: the room's classes (its own, the kit's surface,
//                its stage's), its phase and the demo's mode as data, the
//                focus handed on when a control goes (focus-handoff.ts),
//                the one polite live region, and the demo's layer over
//                everything (demo-kit/DemoLayer.tsx)
//   ShellHead    the chip under the bar, or the result's numbers, and the
//                unlock chip, mounted for the room's whole life
//   ShellBarEnd  the level pill and "?" in the bar (RoomBar.tsx)
//   ShellSkip    the demo's Skip
//   ShellBubble  Merc's line, where the room says his head is
//   ShellDock    under the world: the mic with the demo's take pill over
//                it, or Again and Done, or the mic's notice
//
// A room the Warm-up opens (`routine`, routine-stop.ts) is in warm-up mode:
// the head's chip says "Warm-up 2 of 4" before the take, "Skip stop" takes
// the level's place in the bar, the dock has no Again or Done at the
// result, and the root holds the result, then hands it to the routine.
//
// A room makes its shell once (createRoomShell: its test ids, its
// stylesheet, its run and its demo) and puts the parts in its own order:
// Long note draws its own head (its timer and its line) over its stage,
// and its Skip sits in the stage.
//
// What stays in a room, and why:
//
//   - its world and Merc in it: only the room knows how to lay them out
//     and draw them, and so where Merc's head is for his line;
//   - its words: the mic's start line, the level's lines, the result's
//     numbers, and what a screen reader hears of them;
//   - its stylesheet: every part takes its classes from the room's CSS
//     module (`styles`: .said, .skip, .bottom and .bottomAway, and for the
//     head and the bubble .head, .chip and .bubble), so each room keeps its
//     own look and its own class names;
//   - its test ids, under its own prefix (`ids`: lip-mic, echo-said);
//   - where the demo's tooltips point (its demo/tip-targets.ts);
//   - what only it has: Echo's "Hear it again", and Long note's timer,
//     its line in the head, its note picker and "Pick another note".
//
// The glide rooms are one page under two worlds: glide/GlideRoomScreen.tsx.

import type { Accessor, JSX } from 'solid-js'
import { createEffect, Match, on, Show, Switch } from 'solid-js'
import type { DemoTakeId } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import type { DemoLayerProps } from '@/components/demo-kit/DemoLayer'
import { DemoLayer } from '@/components/demo-kit/DemoLayer'
import { DemoTakePill } from '@/components/demo-kit/DemoTakePill'
import type { DemoMode, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { createFocusHandoff } from './focus-handoff'
import type { MicState } from './mic-state'
import { RoomAsk, RoomBarEnd } from './RoomBar'
import { MicBlocked, MicButton, ResultActions } from './RoomControls'
import { RoomBubble, RoomChip } from './RoomHeader'
import type { ShellRoutine } from './routine-stop'
import { createRoutineHold, ROUTINE_WORDS, routineChip } from './routine-stop'
import routineStyles from './RoutineStop.module.css'
import { UnlockChip } from './UnlockChip'
import type { CaptureFailure } from './useExerciseCapture'

/** A room's stylesheet: its CSS module, which the parts take classes from. */
export type RoomStyles = Readonly<Record<string, string>>

/** What the shell reads of a room's run: the same in every room's controller. */
export interface ShellRun {
  /**
   * The room's state: its phase ('starting', 'result' and 'blocked' mean
   * the same in every room) and why the mic did not open.
   */
  state: Accessor<{
    readonly phase: string
    readonly block: CaptureFailure | null
  }>
  /** A take from the start: the mic at rest, Again, Try again. */
  start: () => void
  /** The take ends: the mic while it listens. */
  stop: () => void
  /** The voice's loudness, for the mic's ring. */
  micLevel: () => number
  /** The demo's takes, sung through the room. */
  script: { readonly active: Accessor<boolean> }
}

/** What a room tells its shell, once. */
export interface RoomShellConfig<C extends string, T extends string> {
  /** The room's test ids start with this: `lip` gives lip-mic, lip-said. */
  readonly ids: string
  readonly styles: RoomStyles
  /** The room's run: its controller, or the fixtures' pinned one. */
  readonly run: ShellRun
  /** "How it works"; null on another's run (the fixtures). */
  readonly demo: ExerciseDemo<C, T> | null
  /** A stop of the Warm-up: the room in warm-up mode; null outside one. */
  readonly routine?: ShellRoutine | null
}

/** The shell's reading of the room, for the room and its parts. */
export interface RoomShellState<
  C extends string,
  T extends string,
> extends RoomShellConfig<C, T> {
  /** The room's phase. */
  readonly phase: Accessor<string>
  /** The demo's takes are singing through the room (its script). */
  readonly scripted: Accessor<boolean>
  /** The demo's mode; idle with no demo. */
  readonly mode: Accessor<DemoMode>
  /** The demo has the room: its controls are out of reach. */
  readonly busy: Accessor<boolean>
  /**
   * The take on the demo's pill; null outside its takes. While there is
   * one, Merc's line and the chip keep quiet, so the pill and the tooltip
   * speak one at a time.
   */
  readonly take: Accessor<DemoTakeId | null>
  /** The room is a stop of the Warm-up (routine-stop.ts); null outside one. */
  readonly routine: ShellRoutine | null
  /** "Warm-up 2 of 4" before the singer's take; null otherwise. */
  readonly routineChip: Accessor<string | null>
  /** The room shows its own take's result (not the demo's). */
  readonly atOwnResult: Accessor<boolean>
}

/** The phases before a take: the room at rest, the mic opening or refused. */
const BEFORE_TAKE: ReadonlySet<string> = new Set([
  'intro',
  'starting',
  'blocked',
])

export function createRoomShell<C extends string, T extends string>(
  config: RoomShellConfig<C, T>,
): RoomShellState<C, T> {
  const demo = config.demo
  const routine = config.routine ?? null
  const mode = (): DemoMode => demo?.mode() ?? 'idle'
  const phase = (): string => config.run.state().phase
  const scripted = (): boolean => config.run.script.active()
  return {
    ...config,
    phase,
    scripted,
    mode,
    busy: () => mode() !== 'idle',
    take: () => demo?.take() ?? null,
    routine,
    routineChip: () =>
      routine !== null && !scripted() && BEFORE_TAKE.has(phase())
        ? routineChip(routine.stop)
        : null,
    atOwnResult: () => phase() === 'result' && !scripted(),
  }
}

export interface RoomShellProps<C extends string, T extends string> {
  shell: RoomShellState<C, T>
  /** The root, for the room's own measures. */
  ref?: (el: HTMLDivElement) => void
  /** The root's classes: the room's own, the kit's surface, its stage's. */
  class: string
  classList?: Record<string, boolean>
  testId: string
  /** What a screen reader hears now, from the one polite region. */
  said: string
  /** Where the demo's tooltips point, as the room is drawn now. */
  aim: DemoLayerProps<C, T>['aim']
  /** The room's world and the shell's parts, in the room's order. */
  children: JSX.Element
}

export function RoomShell<C extends string, T extends string>(
  props: RoomShellProps<C, T>,
): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const shell = props.shell
  let root: HTMLDivElement | undefined

  // Focus on a control the room takes away goes to the one in its place.
  const focus = createFocusHandoff()
  const mainControl = (): HTMLElement | null => {
    const mode = shell.mode()
    // The demo's cards take focus themselves.
    if (mode === 'card' || mode === 'end') return null
    let id = `${shell.ids}-mic`
    if (mode === 'playing') id = `${shell.ids}-demo-skip`
    else if (shell.atOwnResult()) {
      id = `${shell.ids}-${shell.routine === null ? 'again' : 'routine-on'}`
    } else if (shell.phase() === 'blocked') id = `${shell.ids}-retry`
    return root?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null
  }
  createEffect(
    on([shell.phase, shell.mode], () => focus.handOff(mainControl), {
      defer: true,
    }),
  )
  // Warm-up mode: the result holds, then goes on to the routine.
  const routine = shell.routine
  const hold =
    routine === null
      ? null
      : createRoutineHold({ routine, atResult: shell.atOwnResult })

  return (
    <div
      ref={(el) => {
        root = el
        props.ref?.(el)
      }}
      data-testid={props.testId}
      class={props.class}
      classList={props.classList}
      data-phase={shell.phase()}
      data-demo={shell.mode()}
      onFocusIn={(event) => focus.noteFocus(event)}
    >
      {props.children}
      <Show when={hold !== null && shell.atOwnResult()}>
        <button
          type="button"
          class={routineStyles.onward}
          aria-label={ROUTINE_WORDS.onward}
          data-testid={`${shell.ids}-routine-on`}
          onClick={() => hold?.tap()}
        />
      </Show>
      <div
        aria-live="polite"
        data-testid={`${shell.ids}-said`}
        class={shell.styles.said}
      >
        {props.said}
      </div>
      <Show when={shell.demo}>
        {(demo) => (
          <DemoLayer
            demo={demo()}
            aim={props.aim}
            copy={DEMO_WORDS}
            testId={`${shell.ids}-demo`}
          />
        )}
      </Show>
    </div>
  )
}

export interface ShellHeadProps<C extends string, T extends string, S> {
  shell: RoomShellState<C, T>
  /** The take's numbers; null until its result. */
  summary: Accessor<S | null>
  /** The chip's words during a take; null for none. */
  chip: string | null
  /** The room's own row under the chip (Home note's chord lamps). */
  belowChip?: JSX.Element
  /** The result's numbers, drawn by the room. */
  children: (summary: Accessor<S>) => JSX.Element
}

/** The chip under the bar, or the result's numbers; the unlock chip under them. */
export function ShellHead<C extends string, T extends string, S>(
  props: ShellHeadProps<C, T, S>,
): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const shell = props.shell
  return (
    <div
      data-testid={`${shell.ids}-header`}
      class={shell.styles.head}
      inert={shell.busy()}
    >
      <Switch>
        <Match when={shell.phase() === 'result' ? props.summary() : null}>
          {(summary) => props.children(summary)}
        </Match>
        <Match when={shell.phase() !== 'result'}>
          <div class={shell.styles.chip}>
            <RoomChip
              text={
                shell.take() !== null
                  ? null
                  : (shell.routineChip() ?? props.chip)
              }
              testId={`${shell.ids}-chip`}
            />
          </div>
          {props.belowChip}
        </Match>
      </Switch>
      {/* In warm-up mode the routine claims the badges, and its path says
          them (features/warm-up): the tap layer over a held result would
          leave a chip here that no tap can open. */}
      {shell.routine === null ? (
        <UnlockChip
          atResult={shell.phase() === 'result' && !shell.busy()}
          testId={`${shell.ids}-unlock`}
        />
      ) : null}
    </div>
  )
}

export interface ShellBarEndProps<C extends string, T extends string> {
  shell: RoomShellState<C, T>
  /** The room's level pill (LevelControl, with its lines). */
  level: JSX.Element
  /**
   * The level shows: at rest and at a result, never mid-take. Never in
   * warm-up mode: the Warm-up's path carries the level.
   */
  showLevel: boolean
}

/**
 * The room's side of the bar: its level pill, and "?" while the demo
 * allows. In warm-up mode "Skip stop" takes the level's place before the
 * take, and "?" goes at the held result.
 */
export function ShellBarEnd<C extends string, T extends string>(
  props: ShellBarEndProps<C, T>,
): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const shell = props.shell
  const routine = shell.routine
  const skipStop = (): boolean =>
    routine !== null &&
    shell.mode() === 'idle' &&
    !shell.scripted() &&
    (shell.phase() === 'intro' || shell.phase() === 'blocked')
  const canAsk = (): boolean =>
    shell.demo?.canAsk() === true &&
    !(routine !== null && shell.phase() === 'result')
  return (
    <RoomBarEnd>
      <Show when={props.showLevel && routine === null}>{props.level}</Show>
      <Show when={skipStop()}>
        <button
          type="button"
          class={routineStyles.skip}
          data-testid={`${shell.ids}-skip-stop`}
          onClick={() => routine?.stop.skip()}
        >
          {ROUTINE_WORDS.skip}
        </button>
      </Show>
      <Show when={canAsk()}>
        <RoomAsk
          onAsk={() => shell.demo?.ask()}
          label={DEMO_WORDS.ask}
          testId={`${shell.ids}-ask`}
        />
      </Show>
    </RoomBarEnd>
  )
}

export interface ShellSkipProps<C extends string, T extends string> {
  shell: RoomShellState<C, T>
}

/** The demo's Skip, while it plays. */
export function ShellSkip<C extends string, T extends string>(
  props: ShellSkipProps<C, T>,
): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const shell = props.shell
  return (
    <Show when={shell.mode() === 'playing'}>
      <button
        type="button"
        data-testid={`${shell.ids}-demo-skip`}
        class={shell.styles.skip}
        onClick={() => shell.demo?.skip()}
      >
        {DEMO_WORDS.skip}
      </button>
    </Show>
  )
}

export interface ShellBubbleProps<C extends string, T extends string> {
  shell: RoomShellState<C, T>
  /** Merc's line shows. */
  show: boolean
  line: string
  /** Its bottom edge, px up from the room's bottom: over Merc's head. */
  bottom: number
  /** A class of the room's own while its result shows (Lip roll's). */
  atResult?: string
}

/** Merc's line in his bubble, placed by the room. */
export function ShellBubble<C extends string, T extends string>(
  props: ShellBubbleProps<C, T>,
): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const shell = props.shell
  const atResult = (): Record<string, boolean> | undefined => {
    const name = props.atResult
    return name === undefined
      ? undefined
      : { [name]: shell.phase() === 'result' }
  }
  return (
    <Show when={props.show}>
      <div
        class={shell.styles.bubble}
        classList={atResult()}
        style={{ bottom: `${props.bottom}px` }}
      >
        <RoomBubble testId={`${shell.ids}-bubble`}>{props.line}</RoomBubble>
      </div>
    </Show>
  )
}

export interface ShellDockProps<C extends string, T extends string> {
  shell: RoomShellState<C, T>
  /** Again, at a take's own result: by default a new take (the run's start). */
  onAgain?: () => void
  onDone: () => void
  /** The mic: its state and its name. */
  mic: MicState
  micLabel: string
  /**
   * The mic's tap: by default it starts a take from the intro and stops
   * the run in any other phase.
   */
  onMic?: () => void
  /** Nothing moves (a room's `still`, its fixtures). */
  still?: boolean
  /** Beside Again and Done: Long note's "Pick another note". */
  besideResult?: JSX.Element
  /** Over the mic, under the demo's pill: Long note's note picker. */
  overMic?: JSX.Element
}

/**
 * Under the world: the mic, Again and Done at a take's own result, or the
 * mic's notice and Try again (the run's start). Under the demo's play card
 * and end card it keeps its place unseen (the room's .bottomAway), and the
 * demo's take pill stands over the mic while the demo sings. In warm-up
 * mode the result has nothing under it: the routine takes the room on.
 */
export function ShellDock<C extends string, T extends string>(
  props: ShellDockProps<C, T>,
): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const shell = props.shell
  const run = shell.run
  const again = (): void => {
    if (props.onAgain === undefined) run.start()
    else props.onAgain()
  }
  const tapMic = (): void => {
    if (props.onMic !== undefined) props.onMic()
    else if (shell.phase() === 'intro') run.start()
    else run.stop()
  }
  return (
    <div
      class={shell.styles.bottom}
      classList={{
        [shell.styles.bottomAway]:
          shell.mode() === 'card' || shell.mode() === 'end',
      }}
      inert={shell.busy()}
    >
      <Switch>
        <Match when={shell.atOwnResult() && shell.routine !== null}>
          {null}
        </Match>
        <Match when={shell.atOwnResult()}>
          <ResultActions
            onAgain={again}
            onDone={() => props.onDone()}
            againTestId={`${shell.ids}-again`}
            doneTestId={`${shell.ids}-done`}
          />
          {props.besideResult}
        </Match>
        <Match when={shell.phase() === 'blocked'}>
          <MicBlocked
            block={run.state().block}
            onRetry={() => run.start()}
            retryTestId={`${shell.ids}-retry`}
          />
        </Match>
        <Match when={true}>
          <Show when={shell.scripted()}>
            <DemoTakePill
              take={shell.take()}
              copy={DEMO_WORDS}
              testId={`${shell.ids}-demo-take`}
            />
          </Show>
          {props.overMic}
          <MicButton
            state={props.mic}
            level={run.micLevel}
            pulse={shell.demo?.micPulse() === true}
            still={props.still}
            disabled={shell.phase() === 'starting'}
            label={props.micLabel}
            onClick={tapMic}
            testId={`${shell.ids}-mic`}
          />
        </Match>
      </Switch>
    </div>
  )
}
