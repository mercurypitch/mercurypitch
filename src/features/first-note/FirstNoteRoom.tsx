// ============================================================
// FirstNoteRoom — a song leads in; come in on the singer's first note
// ============================================================
//
// The second Ear room (docs/plans/ear-rooms.md). A run is up to six entries
// from the example songs the app ships, the singer's own songs, or a mix: the
// pill over the mic at rest opens the Songs sheet (FirstNoteSongs.tsx),
// and the room reads a song of the singer's own for its entries while it
// is at rest (first-note-own-songs.ts). In each entry, the song's band
// plays its lead-in, counting down its last four beats, and stops where
// the singer comes in; the singer sings that first note. Their entry is
// judged by ear:
// at Singer the note's line shows only once they have come in, and the
// chip says whether they came in on the note. Then the voice draws its
// trail against the line and lands when it holds in the band of light
// around it, and the song carries on from there with its singer back in.
// After a miss, Merc sings the note before the singer comes in.
//
// The skill is the one a karaoke singer needs when an intro ends: coming
// in on the right note, from the band alone. "Show the words", off by
// default, puts the words of the line they come in on over the stage while
// the band counts in and in their turn (owner, 28 Oct 2026).
//
// The page around the world is the room kit's shell (RoomShell.tsx): the
// root, the chip or the result in the head, the level in the bar, Merc's
// line in his bubble, the mic or Again and Done in the dock, the live
// region. This room brings its world (StageScene.tsx), Merc on the boards,
// its words, its stylesheet and its test ids (`first-note-`), and what only
// it has: the song and its credit under the chip, and "Hear the band
// again" over the mic in the singer's turn.
//
// No "How it works" demo yet: Merc's intro line says the task, and
// Learning shows the line from the start.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
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
import { firstNoteShowsWords, sourceHasOwnSongs } from './first-note-choices'
import { bandHalfHeight, layoutStage, RESTING_LINE_SHARE, } from './first-note-layout'
import type { FirstNotePhase } from './first-note-machine'
import { isRunPhase } from './first-note-machine'
import { readOwnSongs, stopReadingOwnSongs, waitingOwnSongs, } from './first-note-own-songs'
import type { FirstNoteSummary } from './first-note-run'
import { foundLine, ON_NOTE_DETAIL } from './first-note-run'
import { FirstNoteLevel } from './FirstNoteLevel'
import styles from './FirstNoteRoom.module.css'
import { FirstNoteSongsButton, FirstNoteSongsSheet } from './FirstNoteSongs'
import { StageScene } from './StageScene'
import type { FirstNoteController } from './useFirstNoteController'
import { useFirstNoteController } from './useFirstNoteController'

export interface FirstNoteRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /** Merc's voice: his sampled one on the phone (FirstNoteScreen). */
  voice?: RoundVoice
  /** The run, when it is not the room's own (a test's). Read once. */
  controller?: FirstNoteController
  /** The theatre's picture, when not the native app's (a fixture's). */
  art?: string
  /** No animation at all (the fixtures). */
  still?: boolean
  /**
   * The way to the Karaoke room's songs, where Import is, for a singer
   * with none of their own split yet: the native shell's (only it can
   * change the tab). Absent, the Songs sheet says how and offers no button.
   */
  onOwnSongs?: () => void
}

/** A stage before its first measure: a phone's size, so nothing is zero. */
const FALLBACK_SIZE = { width: 390, height: 760 }

/** The mic for each phase: ready, waiting, the singer's turn, or done. */
export function firstMicState(phase: FirstNotePhase): MicState {
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
function micName(phase: FirstNotePhase): string {
  switch (phase) {
    case 'starting':
      return 'Opening the microphone'
    case 'band':
      return 'Listen to the band. Tap to stop'
    case 'landed':
    case 'missed':
      return 'The next entry is coming. Tap to stop'
    default:
      return labelFor(
        firstMicState(phase),
        "Start: hear the band, then come in on the singer's first note",
      )
  }
}

export function FirstNoteRoom(props: FirstNoteRoomProps): JSX.Element {
  const [songsOpen, setSongsOpen] = createSignal(false)
  /* eslint-disable solid/reactivity -- read once, as documented */
  const room =
    props.controller ??
    useFirstNoteController({
      voice: props.voice,
      onNoSongs: () => setSongsOpen(true),
    })
  /* eslint-enable solid/reactivity */
  const shell = createRoomShell<string, string>({
    ids: 'first-note',
    styles,
    run: room,
    demo: null,
  })
  const phase = (): FirstNotePhase => room.state().phase

  // The singer's own songs are read at rest, one at a time, while they are
  // chosen; a run lets go of the read, so it never competes with the mic.
  // A song that turns up waiting at rest is read too: the session store
  // loading after the room opened, or a split finishing while it rests.
  createEffect(() => {
    if (isRunPhase(phase()) || !sourceHasOwnSongs()) {
      untrack(stopReadingOwnSongs)
      return
    }
    waitingOwnSongs()
    untrack(readOwnSongs)
  })
  onCleanup(stopReadingOwnSongs)

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
    const share = room.round()?.lineShare ?? RESTING_LINE_SHARE
    return layoutStage(width, height, share, MERC_FEET)
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

  /**
   * The words of the line the singer comes in on, with "Show the words"
   * on: while the band counts in and in their turn, where Merc's bubble is
   * between rounds (it is not up then). Null without words to show.
   */
  const words = (): string | null => {
    if (!firstNoteShowsWords()) return null
    if (phase() !== 'band' && phase() !== 'sing') return null
    const text = room.round()?.entry.words ?? ''
    return text === '' ? null : text
  }

  /** What a screen reader hears, from the one polite region. */
  const said = (): string => {
    const round = room.round()
    switch (phase()) {
      case 'band': {
        if (round === null) return ''
        const line = words()
        return `Entry ${round.index + 1} of ${room.state().rounds.length}: ${round.song.title}. Listen to the band.${line === null ? '' : ` Your line: ${line}`}`
      }
      case 'sing':
        return [room.chip(), 'Sing the first note.']
          .filter((part) => part !== null && part !== 'Your turn')
          .join('. ')
      case 'result': {
        const summary = room.summary()
        if (summary === null) return room.line()
        return `${summary.onNote} of ${summary.rounds} on the note. ${foundLine(summary, room.resultLevel())}. ${room.line()}`
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
      testId="first-note-room"
      said={said()}
      aim={() => null}
    >
      <div ref={stageEl} class={styles.stage}>
        <StageScene
          layout={layout()}
          bandHalf={bandHalfHeight(room.rules().tolCents, layout())}
          lineShown={room.lineShown()}
          turn={phase() === 'sing'}
          lit={lit()}
          countdown={room.countdown()}
          art={props.art}
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
            sparkles="left"
            testId="first-note-merc"
          />
        </div>
      </div>

      <ShellHead shell={shell} summary={room.summary} chip={room.chip()}>
        {(summary) => (
          <FirstResult summary={summary()} level={room.resultLevel()} />
        )}
      </ShellHead>

      <Show when={phase() !== 'result' ? room.round() : null}>
        {(round) => (
          <p class={styles.song} data-testid="first-note-song">
            <span class={styles.songTitle}>{round().song.title}</span>
            <Show when={round().song.credit !== ''}>
              <span class={styles.songCredit}>{round().song.credit}</span>
            </Show>
          </p>
        )}
      </Show>

      <ShellBubble
        shell={shell}
        show={bubbleShows()}
        line={room.line()}
        bottom={bubbleBottom()}
      />

      <Show when={words()}>
        {(text) => (
          <div
            class={styles.words}
            style={{ bottom: `${bubbleBottom()}px` }}
            data-testid="first-note-words"
          >
            <span class={styles.wordsLabel}>Your line</span>
            <p class={styles.wordsText}>{text()}</p>
          </div>
        )}
      </Show>

      <ShellBarEnd
        shell={shell}
        showLevel={
          phase() === 'intro' || phase() === 'result' || phase() === 'blocked'
        }
        level={<FirstNoteLevel />}
      />

      <ShellDock
        shell={shell}
        onDone={() => props.onDone()}
        mic={firstMicState(phase())}
        micLabel={micName(phase())}
        still={props.still}
        besideResult={
          <button
            type="button"
            class={styles.textButton}
            onClick={() => setSongsOpen(true)}
            data-testid="first-note-change-songs"
          >
            Change the songs
          </button>
        }
        overMic={
          <>
            <Show when={phase() === 'intro'}>
              <FirstNoteSongsButton onOpen={() => setSongsOpen(true)} />
            </Show>
            <Show when={room.canHearAgain()}>
              <button
                type="button"
                class={styles.hear}
                onClick={() => room.hearAgain()}
                data-testid="first-note-hear-again"
              >
                <Volume2 />
                <span>Hear the band again</span>
              </button>
            </Show>
          </>
        }
      />

      <FirstNoteSongsSheet
        isOpen={songsOpen()}
        close={() => setSongsOpen(false)}
        onOwnSongs={props.onOwnSongs}
      />
    </RoomShell>
  )
}

interface FirstResultProps {
  summary: FirstNoteSummary
  level: string
}

/** The result: entries on the note, then notes found, and at which level. */
function FirstResult(props: FirstResultProps): JSX.Element {
  return (
    <div class={styles.resultHead}>
      <ResultCard
        value={`${props.summary.onNote} of ${props.summary.rounds}`}
        detail={ON_NOTE_DETAIL}
        testId="first-note-result"
        detailTestId="first-note-detail"
      />
      <p class={styles.levelNote} data-testid="first-note-result-level">
        {foundLine(props.summary, props.level)}
      </p>
    </div>
  )
}
