// ============================================================
// GlideRoomScreen: the glide rooms' page, around each room's world
// ============================================================
//
// Lip roll and Ng slides are one room under two worlds: the same core
// (useGlideRoom.ts), the same machine, the same demo, and the same page,
// which is this one, on the room kit's shell (RoomShell.tsx):
//
//   intro     the chip's row under the bar, Merc's line over his head, the
//             level and "?" in the bar, the mic
//   settle    the mic hears the singer's easy note
//   run       "Wave 2 of 3" in the chip; Merc speaks only in the breaths
//   result    the share lit ("88%") over a chip each for the breaks, the
//             jumps and the tops, the best, Again and Done; Merc's line
//             over the buttons
//   blocked   the mic's notice and Try again
//
// In the Warm-up (`routine`, room-kit routine-stop.ts) the shell puts the
// stop's chip, "Skip stop" and the held result in; the page says what the
// routine's card shows ("88% lit") and that the result has settled once
// the view has pulled back.
//
// The head's and the controls' heights are the room's CSS custom
// properties (`clear`), read here once a resize, so the room's world keeps
// Merc and its marks clear of both.
//
// What stays in each room (LipRollRoom.tsx, NgSlidesRoom.tsx), and why:
// its world (`layout`, `scene`), which only it can lay out and draw; where
// Merc's head is in that world (`mercHead`), so his line sits over it; its
// words (`words`); its stylesheet and test ids; and where its demo's
// tooltips point (`aim`, its demo/tip-targets.ts).

import type { Accessor, JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { TipAim } from '@/components/demo-kit/tip-target'
import type { DemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { createMeasure, cssPx } from '@/components/room-kit/room-measure'
import { ResultCard } from '@/components/room-kit/RoomHeader'
import type { RoomStyles, ShellRun } from '@/components/room-kit/RoomShell'
import { createRoomShell, RoomShell, ShellBarEnd, ShellBubble, ShellDock, ShellHead, ShellSkip, } from '@/components/room-kit/RoomShell'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import type { ExerciseLevel } from '@/stores/exercise-level'
import type { GlideRoomState } from './glide-room-machine'
import { glideMicState } from './glide-room-machine'

/** The room's box: its size and where its head and its controls end, px. */
export interface GlideRoomBox {
  readonly width: number
  readonly height: number
  /** The chip's bottom edge, px from the box's top. */
  readonly chipBottom: number
  /** The controls' top edge (the mic), px from the box's top. */
  readonly controlsTop: number
  /** From the controls' top edge to the box's bottom, px. */
  readonly controlsClear: number
}

/** A run's numbers, as the page shows them: the share of the world lit. */
export interface GlideScreenSummary {
  /** The world lit, whole per cent: the big number. */
  readonly litPct: number
}

/** What the page reads of the room's controller (GlideRoomController). */
export interface GlideScreenRoom<
  S extends GlideScreenSummary,
> extends ShellRun {
  state: Accessor<GlideRoomState>
  /** Merc's line in his bubble; '' for none. */
  line: Accessor<string>
  /** "Wave 2 of 3" during a run; null for none. */
  chip: Accessor<string | null>
  singing: Accessor<boolean>
  summary: Accessor<S | null>
  /** The note a run starts from, for a later stop of the Warm-up. */
  settledNote: () => number | null
}

/** The room's own words on the page. */
export interface GlideScreenWords<S> {
  /** What the mic says at rest: a tap starts a run. */
  readonly start: string
  /**
   * The level pill's lines (the room kit's LevelControl, in the bar beside
   * "?"): what each level asks of an arch.
   */
  readonly levels: Readonly<Record<ExerciseLevel, string>>
  /** Under the share: "of the waves lit". */
  readonly lit: string
  /** The result's chips, in order. */
  readonly chips: (summary: S) => string[]
  /** The best, under the chips; null for none. */
  readonly best: (summary: S) => string | null
}

/** The room's CSS custom properties for the chip's and the controls' heights. */
export interface GlideScreenClear {
  readonly chip: string
  readonly controls: string
}

export interface GlideRoomScreenProps<
  S extends GlideScreenSummary,
  C extends string,
  T extends string,
  L extends { readonly height: number },
> {
  room: GlideScreenRoom<S>
  /** The exercise, as the Warm-up names it. */
  exercise: PremiumExerciseId
  /** "How it works"; null on another's run (the fixtures). */
  demo: ExerciseDemo<C, T> | null
  /** The room's test ids start with this: `lip` gives lip-mic. */
  ids: string
  /** The root's test id. */
  testId: string
  /** The root's classes: the room's own, the kit's surface, its stage's. */
  class: string
  /**
   * The room's stylesheet: the shell's classes (RoomShell.tsx says which)
   * and the result's .resultHead, .chips, .pill and .best.
   */
  styles: RoomStyles
  clear: GlideScreenClear
  words: GlideScreenWords<S>
  /** The room's world, laid out in its box. */
  layout: (box: GlideRoomBox) => L
  /** The world, drawn: its scene, with Merc in it. */
  scene: (layout: Accessor<L>) => JSX.Element
  /** The top of Merc's head as he waits at a root, px from the box's top. */
  mercHead: (layout: L) => number
  /** A class of the room's own for Merc's line at the result. */
  bubbleAtResult?: string
  /** Where a demo tooltip points, as the room is drawn now. */
  aim: (
    tip: DemoTip<C, T>,
    layer: HTMLElement,
    layout: L | null,
  ) => TipAim | null
  /** Leave the room (Done). */
  onDone: () => void
  /** No animation at all (the fixtures). */
  still?: boolean
  /** A stop of the Warm-up: the room in warm-up mode. Read once. */
  routine?: RoutineStop
}

/** At the result Merc's line sits this far over the controls, px. */
const RESULT_BUBBLE_GAP = 12
/**
 * The result has settled once the view has pulled back to the whole world,
 * ms: the rooms' 1200 ms move to it (.scene[data-result] in their CSS).
 */
export const GLIDE_RESULT_SETTLE_MS = 1200

/** "88%": the result's big number is the share of the world lit. */
export function litText(summary: GlideScreenSummary): string {
  return `${summary.litPct}%`
}

export function GlideRoomScreen<
  S extends GlideScreenSummary,
  C extends string,
  T extends string,
  L extends { readonly height: number },
>(props: GlideRoomScreenProps<S, C, T, L>): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const room = props.room
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const stop = props.routine
  // eslint-disable-next-line solid/reactivity -- the room's, made once
  const exercise = props.exercise
  const shell = createRoomShell({
    // eslint-disable-next-line solid/reactivity -- the room's, made once
    ids: props.ids,
    // eslint-disable-next-line solid/reactivity -- the room's, made once
    styles: props.styles,
    run: room,
    // eslint-disable-next-line solid/reactivity -- the room's, made once
    demo: props.demo,
    routine:
      stop === undefined
        ? null
        : {
            stop,
            settleMs: GLIDE_RESULT_SETTLE_MS,
            result: () => {
              const summary = room.summary()
              return summary === null
                ? null
                : {
                    id: exercise,
                    line: `${litText(summary)} lit`,
                    settledNote: room.settledNote(),
                  }
            },
          },
  })
  const phase = shell.phase
  const scripted = shell.scripted
  let rootEl: HTMLDivElement | undefined

  const box = createMeasure(
    () => rootEl,
    (el): GlideRoomBox => {
      const style = window.getComputedStyle(el)
      const top = Number.parseFloat(style.paddingTop) || 0
      const bottom = Number.parseFloat(style.paddingBottom) || 0
      const height = el.clientHeight
      const controlsClear = bottom + cssPx(style, props.clear.controls)
      return {
        width: el.clientWidth,
        height,
        chipBottom: top + cssPx(style, props.clear.chip),
        controlsTop: height - controlsClear,
        controlsClear,
      }
    },
  )

  const layout = createMemo((): L | null => {
    const b = box()
    if (b === null || b.width <= 0 || b.height <= 0) return null
    return props.layout(b)
  })

  /** Merc's line over his head; at the result, over the buttons. */
  const bubbleBottom = (): number => {
    const l = layout()
    const b = box()
    if (l === null || b === null) return 0
    if (phase() === 'result') return b.controlsClear + RESULT_BUBBLE_GAP
    return l.height - props.mercHead(l)
  }
  const showLine = (): boolean =>
    room.line() !== '' && phase() !== 'blocked' && shell.take() === null
  const showLevel = (): boolean =>
    !scripted() &&
    (phase() === 'intro' || phase() === 'result' || phase() === 'blocked')
  /** The mic: ready, waiting through a count-in or a breath, or hearing an arch. */
  const micState = (): MicState =>
    glideMicState(room.state().phase, room.singing(), scripted())

  /**
   * What a screen reader hears, from one polite region there from the
   * start: the result and Merc's line at the result, the chip and his line
   * during a run, his line otherwise.
   */
  const said = (): string => {
    // The demo speaks for itself (its layer's region).
    if (shell.busy() || scripted()) return ''
    const summary = phase() === 'result' ? room.summary() : null
    if (summary !== null) {
      const chips = props.words.chips(summary).join('. ')
      return `${litText(summary)} ${props.words.lit}. ${chips}. ${room.line()}`
    }
    const chip = room.chip()
    return chip === null ? room.line() : `${chip}. ${room.line()}`.trim()
  }

  const micLabel = (): string => {
    if (scripted()) return props.words.start
    if (phase() === 'starting') return 'Opening the microphone'
    if (phase() === 'settle') return 'Listening for your note. Tap to stop'
    return labelFor(micState(), props.words.start)
  }

  return (
    <RoomShell
      shell={shell}
      ref={(el) => (rootEl = el)}
      class={props.class}
      testId={props.testId}
      said={said()}
      aim={(tip, layer) => props.aim(tip, layer, layout())}
    >
      <Show when={layout()}>{(l) => props.scene(l)}</Show>

      <ShellHead shell={shell} summary={room.summary} chip={room.chip()}>
        {(summary) => (
          <div class={props.styles.resultHead}>
            <ResultCard
              value={litText(summary())}
              detail={props.words.lit}
              testId={`${props.ids}-result`}
              detailTestId={`${props.ids}-result-label`}
            />
            <div class={props.styles.chips}>
              <For each={props.words.chips(summary())}>
                {(text) => (
                  <span
                    data-testid={`${props.ids}-result-chip`}
                    class={props.styles.pill}
                  >
                    {text}
                  </span>
                )}
              </For>
            </div>
            <Show when={props.words.best(summary())}>
              {(best) => (
                <p data-testid={`${props.ids}-best`} class={props.styles.best}>
                  {best()}
                </p>
              )}
            </Show>
          </div>
        )}
      </ShellHead>

      <ShellBarEnd
        shell={shell}
        showLevel={showLevel()}
        level={
          <LevelControl
            lines={props.words.levels}
            testId={`${props.ids}-level`}
          />
        }
      />
      <ShellSkip shell={shell} />

      <ShellBubble
        shell={shell}
        show={showLine()}
        line={room.line()}
        bottom={bubbleBottom()}
        atResult={props.bubbleAtResult}
      />

      <ShellDock
        shell={shell}
        onDone={() => props.onDone()}
        mic={micState()}
        micLabel={micLabel()}
        still={props.still}
      />
    </RoomShell>
  )
}
