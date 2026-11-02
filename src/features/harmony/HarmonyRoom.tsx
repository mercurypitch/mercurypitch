// ============================================================
// HarmonyRoom — Merc sings a line; sing it a third above him
// ============================================================
//
// The fourth Ear room (docs/plans/ear-rooms.md, Room 4). A run is six
// lines. In each, Merc stands on the jetty and sings his line, each note a
// teal lamp across the lake; at Learning he sings the harmony too. The
// singer sings the harmony, a third above his line (some lines a third
// below at Professional), each note a gold lamp that lights as the voice
// holds it. Taking turns, the singer sings after him on the speaker;
// together, in headphones, he sings his line again and the singer sings
// with him. After a missed note, Merc sings his note and the third from it.
// The skill is the singer's: holding a line of their own a third from
// another voice, the first harmony every duet asks.
//
// The page around the world is the room kit's shell (RoomShell.tsx): the
// chip or the result in the head, the way and the level in the bar, Merc's
// line in his bubble, the mic or Again and Done in the dock, the live
// region. This room brings its world (LakeScene.tsx), Merc on the jetty,
// its words, its stylesheet and its test ids (`harmony-`), and what only
// it has: the task and together's tag under the chip, the way's chip and
// its sheet (HarmonyWays.tsx), "Hear Merc again" over the mic in the
// singer's own turn, and the result's lines, each a row that plays it in
// two voices (HarmonyResult.tsx).
//
// No "How it works" demo yet: Merc's line says the task, the lamps show
// where to go, and Learning has him sing the harmony first.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, } from 'solid-js'
import { Headphones, Volume2 } from '@/components/icons'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { createMeasure } from '@/components/room-kit/room-measure'
import { createRoomShell, RoomShell, ShellBarEnd, ShellBubble, ShellDock, ShellHead, } from '@/components/room-kit/RoomShell'
import surface from '@/components/room-kit/RoomSurface.module.css'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { HarmonyController } from './harmony-controller-contract'
import type { HarmonyPhase } from './harmony-machine'
import type { HarmonyWay } from './harmony-rules'
import { detailLine } from './harmony-run'
import { HarmonyLevel } from './HarmonyLevel'
import type { HarmonyTaskState } from './HarmonyResult'
import { HarmonyResult, HarmonyTask } from './HarmonyResult'
import styles from './HarmonyRoom.module.css'
import { HarmonyWays } from './HarmonyWays'
import type { LakeLayout } from './lake-layout'
import { layoutLake, nameTop, restingLines, xOf, yOf } from './lake-layout'
import { LakeScene } from './LakeScene'
import { useHarmonyController } from './useHarmonyController'

export interface HarmonyRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /** Merc's voice: his sampled one on the phone (HarmonyScreen). */
  voice?: RoundVoice
  /** The run, when it is not the room's own (a test's). Read once. */
  controller?: HarmonyController
  /** No animation at all (the fixtures). */
  still?: boolean
}

/** A stage before its first measure: a phone's size, so nothing is zero. */
const FALLBACK_SIZE = { width: 390, height: 760 }
/** At the result, the room Merc's line needs beside him, px: three lines and a gap. */
const RESULT_BUBBLE_ROOM = 100
/** Merc's bubble at its widest, px (RoomHeader.module.css). */
const BUBBLE_MAX = 320

/** The mic for each phase: ready, waiting, the singer's turn, or done. */
export function harmonyMicState(phase: HarmonyPhase): MicState {
  switch (phase) {
    case 'intro':
    case 'blocked':
      return 'ready'
    case 'sing':
    case 'together':
      return 'sing'
    case 'result':
      return 'done'
    default:
      return 'wait'
  }
}

/** The mic's start, as its name says it at rest, for the way. */
function startLabel(way: HarmonyWay): string {
  return way === 'together'
    ? 'Start: Merc sings his line, then you sing it with him'
    : 'Start: Merc sings his line, then it is your turn'
}

/** The mic's name as the phase has it. */
function micName(phase: HarmonyPhase, way: HarmonyWay, task: string): string {
  switch (phase) {
    case 'starting':
      return 'Opening the microphone'
    case 'call':
      return 'Listen to Merc. Tap to stop'
    case 'sing':
      return `Your turn. Sing ${task.toLowerCase()} Merc's line. Tap to stop`
    case 'together':
      return 'Singing together. Tap to stop'
    case 'landed':
    case 'missed':
      return 'The next line is coming. Tap to stop'
    default:
      return labelFor(harmonyMicState(phase), startLabel(way))
  }
}

/** The task's lamp as the phase has it. */
function taskState(phase: HarmonyPhase): HarmonyTaskState {
  if (phase === 'landed') return 'landed'
  if (phase === 'missed') return 'missed'
  return 'toCome'
}

/** The trail's path through its points: a gap where the voice was silent. */
function trailPath(
  layout: LakeLayout,
  points: readonly { pos: number; midi: number | null }[],
): string {
  let d = ''
  let open = false
  for (const point of points) {
    if (point.midi === null) {
      open = false
      continue
    }
    const x = xOf(layout, point.pos).toFixed(1)
    const y = yOf(layout, point.midi).toFixed(1)
    d += `${open ? 'L' : 'M'}${x} ${y}`
    open = true
  }
  return d
}

export function HarmonyRoom(props: HarmonyRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const given = props.controller
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = given ?? useHarmonyController({ voice: props.voice })
  const shell = createRoomShell<string, string>({
    ids: 'harmony',
    styles,
    run: room,
    demo: null,
  })
  const phase = (): HarmonyPhase => room.state().phase

  let stageEl: HTMLDivElement | undefined
  const size = createMeasure(
    () => stageEl,
    (el) => ({ width: el.clientWidth, height: el.clientHeight }),
  )
  /** The line on the lake: the run's, or one at rest of the level's length. */
  const lines = createMemo(
    () => room.current() ?? restingLines(room.rules().notes),
  )
  const layout = createMemo(() => {
    const measured = size()
    const { width, height } =
      measured === undefined || measured === null || measured.width === 0
        ? FALLBACK_SIZE
        : measured
    return layoutLake(width, height, lines(), MERC_FEET, phase() === 'result')
  })

  // The result's lines' card, measured on the stage: Merc's line beside
  // him shows only where it clears the card, under it or to its left (a
  // short phone has no room under it; the live region still says it).
  let cardEl: HTMLElement | undefined
  const [card, setCard] = createSignal<{
    left: number
    bottom: number
  } | null>(null)
  const measureCard = (): void => {
    if (cardEl === undefined || stageEl === undefined || !cardEl.isConnected) {
      setCard(null)
      return
    }
    const stage = stageEl.getBoundingClientRect()
    const box = cardEl.getBoundingClientRect()
    setCard({ left: box.left - stage.left, bottom: box.bottom - stage.top })
  }
  const cardObserver = new ResizeObserver(measureCard)
  onCleanup(() => cardObserver.disconnect())
  const seeCard = (el: HTMLElement): void => {
    cardEl = el
    cardObserver.disconnect()
    cardObserver.observe(el)
  }
  // The room's size moves the card: measured again with the layout.
  createEffect(() => {
    layout()
    if (phase() === 'result') measureCard()
  })

  // The trail is written straight to its path every frame of the turn.
  let trailEl: SVGPathElement | undefined
  let headEl: SVGCircleElement | undefined
  let ringEl: SVGCircleElement | undefined
  onMount(() => {
    // eslint-disable-next-line solid/reactivity -- the frame loop calls it, reading the layout as it is now
    room.drawTrail((trail) => {
      if (
        trailEl === undefined ||
        headEl === undefined ||
        ringEl === undefined
      ) {
        return
      }
      const away = (): void => {
        headEl?.setAttribute('cx', '-20')
        ringEl?.setAttribute('cx', '-40')
      }
      if (trail === null) {
        trailEl.setAttribute('d', '')
        away()
        return
      }
      trailEl.setAttribute('d', trailPath(layout(), trail.points))
      const head = trail.head
      if (head === null || head.midi === null) {
        away()
        return
      }
      const x = xOf(layout(), head.pos).toFixed(1)
      const y = yOf(layout(), head.midi).toFixed(1)
      headEl.setAttribute('cx', x)
      headEl.setAttribute('cy', y)
      ringEl.setAttribute('cx', x)
      ringEl.setAttribute('cy', y)
      ringEl.setAttribute('transform', `rotate(-90 ${x} ${y})`)
      ringEl.style.strokeDasharray = `${(trail.hold * 100).toFixed(1)} 100`
    })
  })

  /** At the result, just right of Merc; else the stylesheet's. */
  const bubbleLeft = (): number | undefined => {
    if (phase() !== 'result') return undefined
    const { merc } = layout()
    return merc.left + merc.size + 6
  }
  /** Merc's line beside him at the result clears the lines' card. */
  const bubbleClear = (): boolean => {
    const left = bubbleLeft()
    const box = card()
    if (left === undefined || box === null) return true
    const under = layout().jetty.top - box.bottom >= RESULT_BUBBLE_ROOM
    return under || left + BUBBLE_MAX + 8 <= box.left
  }
  const bubbleShows = (): boolean =>
    room.line() !== '' &&
    phase() !== 'sing' &&
    phase() !== 'together' &&
    phase() !== 'starting' &&
    bubbleClear()
  /**
   * Just over the highest lamp and the harmony's first name, px up from
   * the room's bottom; at the result beside Merc, its foot on the jetty's
   * deck, under the lines' card.
   */
  const bubbleBottom = (): number => {
    const { lampsTop, height, jetty } = layout()
    if (phase() === 'result') return height - jetty.top
    const first = lines().harmony[0]
    const named =
      room.current() !== null &&
      room.rules().showsHarmony &&
      first !== undefined
    const top = named ? Math.min(lampsTop, nameTop(layout(), first)) : lampsTop
    return height - (top - 14)
  }
  const task = (): string => room.task() ?? 'A third above'

  /** What a screen reader hears, from the one polite region. */
  const said = (): string => {
    const current = room.current()
    switch (phase()) {
      case 'call':
        return current === null
          ? ''
          : `Line ${current.index + 1} of ${room.state().lines.length}. ${task()}. ${room.line()}`
      case 'sing':
        return `Your turn. Sing ${task().toLowerCase()} Merc's line.`
      case 'together':
        return `Together. Sing ${task().toLowerCase()} Merc's line as he sings it.`
      case 'result': {
        const summary = room.summary()
        if (summary === null) return room.line()
        return `${summary.inHarmony} of ${summary.lines} lines in harmony. ${detailLine(summary)}. ${room.line()}`
      }
      default:
        return [room.chip(), room.line()]
          .filter((part) => part !== null && part !== '')
          .join('. ')
    }
  }

  return (
    <RoomShell
      shell={shell}
      class={`${styles.room} ${surface.surface} mp-dark-stage`}
      classList={{
        [styles.still]: props.still === true,
        [styles.atResult]: phase() === 'result',
      }}
      testId="harmony-room"
      said={said()}
      aim={() => null}
    >
      <div ref={stageEl} class={styles.stage}>
        <LakeScene
          layout={layout()}
          merc={lines().merc}
          harmony={lines().harmony}
          mercLit={room.mercLit()}
          lamps={room.harmonyLamps()}
          showsHarmony={room.rules().showsHarmony}
          live={room.current() !== null}
          turn={phase() === 'sing' || phase() === 'together'}
          answering={room.answering()}
          away={phase() === 'result'}
          still={props.still}
          trailRef={(path, head, ring) => {
            trailEl = path
            headEl = head
            ringEl = ring
          }}
        />
        <div
          class={styles.merc}
          style={{
            width: `${layout().merc.size.toFixed(1)}px`,
            height: `${layout().merc.size.toFixed(1)}px`,
            transform: `translate(${layout().merc.left.toFixed(1)}px, ${layout().merc.top.toFixed(1)}px)`,
          }}
        >
          <MercView
            state={room.mercState}
            voice={room.mercVoice}
            sparkles="right"
            testId="harmony-merc"
          />
        </div>
      </div>

      <ShellHead
        shell={shell}
        summary={room.summary}
        chip={room.chip()}
        belowChip={
          <Show when={room.task()}>
            {(name) => (
              <div class={styles.tags}>
                <HarmonyTask name={name()} state={taskState(phase())} />
                <Show when={phase() === 'together'}>
                  <p
                    class={styles.together}
                    role="img"
                    aria-label="Sung together, in headphones"
                    data-testid="harmony-together"
                  >
                    <Headphones />
                    Together
                  </p>
                </Show>
              </div>
            )}
          </Show>
        }
      >
        {(summary) => (
          <HarmonyResult
            summary={summary()}
            level={room.resultLevel()}
            outcomes={room.state().outcomes}
            playing={room.replaying()}
            onPlay={(index) => room.replayLine(index)}
            cardRef={seeCard}
          />
        )}
      </ShellHead>

      <ShellBubble
        shell={shell}
        show={bubbleShows()}
        line={room.line()}
        bottom={bubbleBottom()}
        left={bubbleLeft()}
      />

      <ShellBarEnd
        shell={shell}
        showLevel={
          phase() === 'intro' || phase() === 'result' || phase() === 'blocked'
        }
        level={
          <>
            <HarmonyWays />
            <HarmonyLevel />
          </>
        }
      />

      <ShellDock
        shell={shell}
        onDone={() => props.onDone()}
        mic={harmonyMicState(phase())}
        micLabel={micName(phase(), room.way(), task())}
        still={props.still}
        overMic={
          <Show when={room.canHearAgain()}>
            <button
              type="button"
              class={styles.hear}
              onClick={() => room.hearAgain()}
              data-testid="harmony-hear-again"
            >
              <Volume2 />
              <span>Hear Merc again</span>
            </button>
          </Show>
        }
      />
    </RoomShell>
  )
}
