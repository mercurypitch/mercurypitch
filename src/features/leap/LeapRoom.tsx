// ============================================================
// LeapRoom — Merc sings a note and names a leap; sing his note, then leap
// ============================================================
//
// The third Ear room (docs/plans/ear-rooms.md, Room 3). A run is six leaps.
// In each, Merc stands on the near ledge at his note's height, names the
// leap (with the song that opens on it, below Professional) and sings his
// note; at Learning he sings the target too. The singer sings his note,
// then leaps to the far ledge: the voice draws its trail from his line to
// the target's, and lands when it holds in the band of light there; the
// lantern lights. After a miss, Merc sings both notes, his line drawn as he
// does. The skill is the singer's: hearing how far the next note is from
// this one, which every melody asks of them.
//
// The page around the world is the room kit's shell (RoomShell.tsx): the
// root, the chip or the result in the head, the level in the bar, Merc's
// line in his bubble, the mic or Again and Done in the dock, the live
// region. This room brings its world (CliffScene.tsx), Merc on his ledge,
// its words, its stylesheet and its test ids (`leap-`), and what only it
// has: the leap's lamp under the chip, "Hear Merc again" over the mic in
// the singer's turn, and the result's leaps, each a row that plays it
// again (LeapResult.tsx).
//
// No "How it works" demo yet: Merc's line says the task, and Learning has
// him sing both notes before the singer's turn.

import type { JSX } from 'solid-js'
import { createMemo, onMount, Show } from 'solid-js'
import { Volume2 } from '@/components/icons'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { createMeasure } from '@/components/room-kit/room-measure'
import { createRoomShell, RoomShell, ShellBarEnd, ShellBubble, ShellDock, ShellHead, } from '@/components/room-kit/RoomShell'
import surface from '@/components/room-kit/RoomSurface.module.css'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { headOf, trailPath, trailY } from '@/components/room-kit/voice-trail'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { bandHalfHeight, layoutCliffs } from './cliff-layout'
import { CliffScene } from './CliffScene'
import type { LeapPhase } from './leap-machine'
import type { LeapRound } from './leap-round'
import { leapName, namesPrecisely } from './leap-rules'
import { detailLine } from './leap-run'
import { LeapLevel } from './LeapLevel'
import { LeapLamp, LeapResult } from './LeapResult'
import styles from './LeapRoom.module.css'
import type { LeapController } from './useLeapController'
import { useLeapController } from './useLeapController'

export interface LeapRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /** Merc's voice: his sampled one on the phone (LeapScreen). */
  voice?: RoundVoice
  /** The run, when it is not the room's own (a test's). Read once. */
  controller?: LeapController
  /** No animation at all (the fixtures). */
  still?: boolean
}

/** A stage before its first measure: a phone's size, so nothing is zero. */
const FALLBACK_SIZE = { width: 390, height: 760 }

/** The mic for each phase: ready, waiting, the singer's turn, or done. */
export function leapMicState(phase: LeapPhase): MicState {
  switch (phase) {
    case 'intro':
    case 'blocked':
      return 'ready'
    case 'sing':
      return 'sing'
    case 'result':
      return 'done'
    default:
      return 'wait'
  }
}

/** The mic's name as the phase has it. */
function micName(phase: LeapPhase): string {
  switch (phase) {
    case 'starting':
      return 'Opening the microphone'
    case 'call':
      return 'Listen to Merc. Tap to stop'
    case 'landed':
    case 'missed':
      return 'The next leap is coming. Tap to stop'
    default:
      return labelFor(leapMicState(phase), "Start: hear Merc's note, then leap")
  }
}

export function LeapRoom(props: LeapRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useLeapController({ voice: props.voice })
  const shell = createRoomShell<string, string>({
    ids: 'leap',
    styles,
    run: room,
    demo: null,
  })
  const phase = (): LeapPhase => room.state().phase

  let stageEl: HTMLDivElement | undefined
  const size = createMeasure(
    () => stageEl,
    (el) => ({ width: el.clientWidth, height: el.clientHeight }),
  )
  const layout = createMemo(() => {
    const measured = size()
    const { width, height } =
      measured === undefined || measured === null || measured.width === 0
        ? FALLBACK_SIZE
        : measured
    return layoutCliffs(
      width,
      height,
      room.round(),
      MERC_FEET,
      phase() === 'result',
    )
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
      const geometry = layout().trail
      trailEl.setAttribute('d', trailPath(trail.points, trail.now, geometry))
      const head = headOf(trail.points, trail.now)
      if (head === null || head.cents === null) {
        away()
        return
      }
      const x = geometry.headX.toFixed(1)
      const y = trailY(head.cents, geometry).toFixed(1)
      headEl.setAttribute('cx', x)
      headEl.setAttribute('cy', y)
      ringEl.setAttribute('cx', x)
      ringEl.setAttribute('cy', y)
      ringEl.setAttribute('transform', `rotate(-90 ${x} ${y})`)
      ringEl.style.strokeDasharray = `${(trail.hold * 100).toFixed(1)} 100`
    })
  })

  const bubbleShows = (): boolean =>
    room.line() !== '' &&
    (phase() === 'intro' ||
      phase() === 'call' ||
      phase() === 'result' ||
      phase() === 'landed' ||
      phase() === 'missed' ||
      phase() === 'blocked')
  /** Over Merc's head, px up from the room's bottom. */
  const bubbleBottom = (): number => {
    const { merc, height } = layout()
    return height - (merc.top + merc.size * 0.2)
  }

  /** The leap's name, as the run names it. */
  const named = (round: LeapRound): string =>
    leapName(round.kind, namesPrecisely(room.runRules()))

  /** What a screen reader hears, from the one polite region. */
  const said = (): string => {
    const round = room.round()
    switch (phase()) {
      case 'call':
        return round === null
          ? ''
          : `Leap ${round.index + 1} of ${room.state().rounds.length}. ${named(round)}. ${room.line()}`
      case 'sing':
        return round === null
          ? ''
          : `Your turn. Sing Merc's note, then leap ${named(round).toLowerCase()}.`
      case 'result': {
        const summary = room.summary()
        if (summary === null) return room.line()
        const detail = detailLine(summary)
        return `${summary.landed} of ${summary.rounds} landed.${detail === null ? '' : ` ${detail}.`} ${room.line()}`
      }
      default:
        return [room.chip(), room.line()]
          .filter((part) => part !== null && part !== '')
          .join('. ')
    }
  }

  const fromName = (): string | null => {
    const round = room.round()
    return round === null ? null : midiToNoteNameOctave(round.from)
  }
  const toName = (): string | null => {
    const round = room.round()
    return round === null || !room.revealed()
      ? null
      : midiToNoteNameOctave(round.to)
  }

  return (
    <RoomShell
      shell={shell}
      class={`${styles.room} ${surface.surface} mp-dark-stage`}
      classList={{
        [styles.still]: props.still === true,
        [styles.atResult]: phase() === 'result',
      }}
      testId="leap-room"
      said={said()}
      aim={() => null}
    >
      <div ref={stageEl} class={styles.stage}>
        <CliffScene
          layout={layout()}
          bandHalf={bandHalfHeight(room.rules().tolCents, layout())}
          fromName={fromName()}
          toName={toName()}
          live={room.round() !== null}
          turn={phase() === 'sing'}
          onFrom={room.onFrom()}
          warm={room.onTarget() && phase() === 'sing'}
          lit={phase() === 'landed'}
          answering={room.answering()}
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
            testId="leap-merc"
          />
        </div>
      </div>

      <ShellHead
        shell={shell}
        summary={room.summary}
        chip={room.chip()}
        belowChip={
          <Show when={room.lamp()}>{(lamp) => <LeapLamp lamp={lamp()} />}</Show>
        }
      >
        {(summary) => (
          <LeapResult
            summary={summary()}
            level={room.resultLevel()}
            rules={room.runRules()}
            outcomes={room.state().outcomes}
            playing={room.replaying()}
            onPlay={(index) => room.replayLeap(index)}
          />
        )}
      </ShellHead>

      <ShellBubble
        shell={shell}
        show={bubbleShows()}
        line={room.line()}
        bottom={bubbleBottom()}
      />

      <ShellBarEnd
        shell={shell}
        showLevel={
          phase() === 'intro' || phase() === 'result' || phase() === 'blocked'
        }
        level={<LeapLevel />}
      />

      <ShellDock
        shell={shell}
        onDone={() => props.onDone()}
        mic={leapMicState(phase())}
        micLabel={micName(phase())}
        still={props.still}
        overMic={
          <Show when={room.canHearAgain()}>
            <button
              type="button"
              class={styles.hear}
              onClick={() => room.hearAgain()}
              data-testid="leap-hear-again"
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
