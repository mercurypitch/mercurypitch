// ============================================================
// HomeNoteRoom — hear the band's intro, then sing the note it calls home
// ============================================================
//
// The first Ear room (docs/plans/ear-rooms.md). A run is six keys. In each
// the band plays a short intro, stops, and the singer sings home: the note
// the chords lean on, in any octave. The voice draws its trail over the
// harbour against the lighthouse's beam, which is home's line, and lands
// when it holds in the band of light around it; the band then plays home's
// chord under the voice. After a miss, Merc sings home over that chord.
// The skill is the one a karaoke singer needs when an intro ends: finding
// the first note from the music, not from someone singing it first.
//
// The page around the world is the room kit's shell (RoomShell.tsx): the
// root, the chip or the result in the head, the level in the bar, Merc's
// line in his bubble, the mic or Again and Done in the dock, the live
// region. This room brings its world (HarbourScene.tsx), Merc on the pier,
// its words, its stylesheet and its test ids (`home-note-`), and what only
// it has: "Hear it again" over the mic in the singer's turn.
//
// No "How it works" demo yet: the intro line says the task, and Learning's
// first rounds have Merc sing home before the singer's turn.

import type { JSX } from 'solid-js'
import { createMemo, onMount, Show } from 'solid-js'
import { Volume2 } from '@/components/icons'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { createMeasure } from '@/components/room-kit/room-measure'
import { ResultCard } from '@/components/room-kit/RoomHeader'
import { createRoomShell, RoomShell, ShellBarEnd, ShellBubble, ShellDock, ShellHead, } from '@/components/room-kit/RoomShell'
import surface from '@/components/room-kit/RoomSurface.module.css'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { headOf, trailPath, trailY } from '@/components/room-kit/voice-trail'
import { bandHalfHeight, layoutHarbour } from './harbour-layout'
import { HarbourScene } from './HarbourScene'
import type { HomeNotePhase } from './home-note-machine'
import type { HomeNoteSummary } from './home-note-run'
import { detailLine } from './home-note-run'
import { HomeNoteLevel } from './HomeNoteLevel'
import styles from './HomeNoteRoom.module.css'
import type { HomeNoteController } from './useHomeNoteController'
import { useHomeNoteController } from './useHomeNoteController'

export interface HomeNoteRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /** Merc's voice: his sampled one on the phone (HomeNoteScreen). */
  voice?: RoundVoice
  /** The run, when it is not the room's own (a test's). Read once. */
  controller?: HomeNoteController
  /** No animation at all (the fixtures). */
  still?: boolean
}

/** A stage before its first measure: a phone's size, so nothing is zero. */
const FALLBACK_SIZE = { width: 390, height: 760 }

/** The mic for each phase: ready, waiting, the singer's turn, or done. */
export function homeMicState(phase: HomeNotePhase): MicState {
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
function micName(phase: HomeNotePhase): string {
  switch (phase) {
    case 'starting':
      return 'Opening the microphone'
    case 'band':
      return 'Listen to the band. Tap to stop'
    case 'landed':
    case 'missed':
      return 'The next key is coming. Tap to stop'
    default:
      return labelFor(
        homeMicState(phase),
        'Start: hear the band, then sing home',
      )
  }
}

export function HomeNoteRoom(props: HomeNoteRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useHomeNoteController({ voice: props.voice })
  const shell = createRoomShell<string, string>({
    ids: 'home-note',
    styles,
    run: room,
    demo: null,
  })
  const phase = (): HomeNotePhase => room.state().phase

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
    return layoutHarbour(width, height, MERC_FEET)
  })

  // The trail is written straight to its path every frame of the turn.
  let trailEl: SVGPathElement | undefined
  let headEl: SVGCircleElement | undefined
  onMount(() => {
    // eslint-disable-next-line solid/reactivity -- the frame loop calls it, reading the layout as it is now
    room.drawTrail((trail) => {
      if (trailEl === undefined || headEl === undefined) return
      if (trail === null) {
        trailEl.setAttribute('d', '')
        headEl.setAttribute('cx', '-20')
        return
      }
      const geometry = layout().trail
      trailEl.setAttribute('d', trailPath(trail.points, trail.now, geometry))
      const head = headOf(trail.points, trail.now)
      if (head === null || head.cents === null) {
        headEl.setAttribute('cx', '-20')
        return
      }
      headEl.setAttribute('cx', geometry.headX.toFixed(1))
      headEl.setAttribute('cy', trailY(head.cents, geometry).toFixed(1))
    })
  })

  const lit = (): boolean => room.inBand() || phase() === 'landed'
  const bubbleShows = (): boolean =>
    room.line() !== '' &&
    (phase() === 'intro' ||
      phase() === 'result' ||
      phase() === 'landed' ||
      phase() === 'missed' ||
      phase() === 'blocked')
  /** Over Merc's head, px up from the room's bottom. */
  const bubbleBottom = (): number => {
    const { merc, height } = layout()
    return height - (merc.top + merc.size * 0.2)
  }

  /** What a screen reader hears, from the one polite region. */
  const said = (): string => {
    const round = room.round()
    switch (phase()) {
      case 'band':
        return round === null
          ? ''
          : `Key ${round.index + 1} of ${room.state().rounds.length}. Listen to the band.`
      case 'sing':
        return 'Your turn. Sing home.'
      case 'result': {
        const summary = room.summary()
        if (summary === null) return room.line()
        const detail = detailLine(summary)
        return `${summary.found} of ${summary.rounds} found.${detail === null ? '' : ` ${detail}.`} ${room.line()}`
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
      classList={{ [styles.still]: props.still === true }}
      testId="home-note-room"
      said={said()}
      aim={() => null}
    >
      <div ref={stageEl} class={styles.stage}>
        <HarbourScene
          layout={layout()}
          bandHalf={bandHalfHeight(room.rules().tolCents, layout())}
          beat={room.beat()}
          turn={phase() === 'sing'}
          lit={lit()}
          still={props.still}
          trailRef={(path, head) => {
            trailEl = path
            headEl = head
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
            testId="home-note-merc"
          />
        </div>
      </div>

      <ShellHead shell={shell} summary={room.summary} chip={room.chip()}>
        {(summary) => (
          <HomeResult summary={summary()} level={room.resultLevel()} />
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
        level={<HomeNoteLevel />}
      />

      <ShellDock
        shell={shell}
        onDone={() => props.onDone()}
        mic={homeMicState(phase())}
        micLabel={micName(phase())}
        still={props.still}
        overMic={
          <Show when={room.canHearAgain()}>
            <button
              type="button"
              class={styles.hear}
              onClick={() => room.hearAgain()}
              data-testid="home-note-hear-again"
            >
              <Volume2 />
              <span>Hear the band again</span>
            </button>
          </Show>
        }
      />
    </RoomShell>
  )
}

interface HomeResultProps {
  summary: HomeNoteSummary
  level: string
}

/** The result: keys found, how quickly, and at which level. */
function HomeResult(props: HomeResultProps): JSX.Element {
  return (
    <div class={styles.resultHead}>
      <ResultCard
        value={`${props.summary.found} of ${props.summary.rounds}`}
        detail={detailLine(props.summary)}
        testId="home-note-result"
        detailTestId="home-note-detail"
      />
      <Show when={props.level !== ''}>
        <p class={styles.levelNote} data-testid="home-note-result-level">
          Keys found at {props.level}
        </p>
      </Show>
    </div>
  )
}
