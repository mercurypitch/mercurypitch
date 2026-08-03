// ── JamSongLyrics ─────────────────────────────────────────────────────
// The left half of a song room: the words, scrolling with the music.
//
// Deliberately not the stem-mixer's lyrics panel. That one is an editor --
// it owns block marking, LRC generation, tap-to-time and an edit mode,
// none of which belong in a room where someone else is driving playback.
// This is the read-only half of the same idea, and it stays small enough
// that the singer's eye can find the current line without hunting.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { formatClock } from '@/lib/format-time'
import type { JamLineScore } from '@/lib/jam/jam-line-scoring'
import { canAttachLyrics } from '@/lib/jam/jam-lyrics-attach'
import { lineIndexAt, restAt, restsBetween } from '@/lib/jam/jam-song'
import { blockOfLine, groupLinesBySinger } from '@/lib/jam/jam-song-blocks'
import { EVERYONE, singerOfLine } from '@/lib/jam/jam-song-parts'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import type { LyricsLineTiming } from '@/lib/jam/types'
import { assignJamSongLines, jamAssignBrush, jamIsHost, jamLineIsMine, jamPeerId, jamPeers, jamSong, jamSongParts, } from '@/stores/jam-store'
import { JamAssignBar } from './JamAssignBar'
import { JamLyricsFinder } from './JamLyricsFinder'
import styles from './JamSongLyrics.module.css'

interface JamSongLyricsProps {
  lines: LyricsLineTiming[]
  positionSec: () => number
  /** Shows the note name under each line when the room wants pitch help. */
  showNotes: boolean
  /** Your score per line, filled in as the playhead leaves each one. */
  scores?: () => Record<number, JamLineScore>
  /** Jump the song to a line. Absent for anyone who cannot move the room. */
  onSeek?: (toSec: number) => void
}

/**
 * Where a line's score sits on the good/close/missed scale.
 *
 * Three bands rather than a number's worth of precision: mid-song, a
 * singer reads a colour, not a figure. The exact number is still there for
 * anyone who wants it, and for the screen reader.
 */
function scoreBand(score: number): 'good' | 'close' | 'missed' {
  if (score >= 80) return 'good'
  if (score >= 50) return 'close'
  return 'missed'
}

/** A person, for the per-line "who sings this" button. */
const SingerIcon: Component = () => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="8" cy="5" r="3" />
    <path d="M2.5 14a5.5 5.5 0 0 1 11 0z" />
  </svg>
)

/** Dots that empty as the rest runs out -- the karaoke count-in idea. */
const RestDots: Component<{ total: number; left: number }> = (props) => (
  <div class={styles.rest} aria-label={`${Math.ceil(props.left)} seconds`}>
    <For each={Array.from({ length: props.total })}>
      {(_dot, i) => (
        <span
          class={styles.restDot}
          classList={{
            // Dots go out from the left as time passes, so the number
            // still lit IS the seconds remaining.
            [styles.restDotSpent]: i() < props.total - Math.ceil(props.left),
          }}
        />
      )}
    </For>
  </div>
)

export const JamSongLyrics: Component<JamSongLyricsProps> = (props) => {
  let scrollRef: HTMLDivElement | undefined

  /**
   * Which line the per-line menu is open on, if any.
   *
   * Kept alongside the brush in the assign bar: the bar is for sweeping a
   * verse, this is for fixing one line without arming anything.
   */
  const [assigning, setAssigning] = createSignal<number | null>(null)

  /**
   * The drag in progress while a singer is armed.
   *
   * Held as an anchor plus a moving end rather than a committed range, so
   * the sheet can show what WILL be painted before the pointer comes up --
   * and so an accidental drag can be abandoned by releasing off the list.
   */
  const [paintFrom, setPaintFrom] = createSignal<number | null>(null)
  const [paintTo, setPaintTo] = createSignal<number | null>(null)

  const painting = () => jamAssignBrush() !== null

  const inPaintRange = (i: number) => {
    const a = paintFrom()
    const b = paintTo()
    if (a === null || b === null) return false
    return i >= Math.min(a, b) && i <= Math.max(a, b)
  }

  const commitPaint = () => {
    const a = paintFrom()
    const b = paintTo()
    const brush = jamAssignBrush()
    if (a !== null && b !== null && brush !== null) {
      assignJamSongLines(a, b, brush)
    }
    setPaintFrom(null)
    setPaintTo(null)
  }

  // A pointer released anywhere ends the sweep, including outside the
  // list -- otherwise letting go over the pitch lanes leaves the sheet
  // stuck mid-drag.
  onMount(() => {
    const onUp = () => {
      if (paintFrom() !== null) commitPaint()
    }
    document.addEventListener('pointerup', onUp)
    onCleanup(() => document.removeEventListener('pointerup', onUp))
  })

  const blocks = createMemo(() =>
    groupLinesBySinger(props.lines, jamSongParts()),
  )

  const everyone = createMemo(() => {
    const mine = jamPeerId()
    const ids = jamPeers().map((p) => ({ id: p.id, name: p.displayName }))
    return mine === null || mine === ''
      ? ids
      : [{ id: mine, name: 'You' }, ...ids]
  })

  const colors = createMemo(() =>
    buildPeerColorMap(everyone().map((p) => p.id)),
  )

  const nameOf = (id: string) =>
    everyone().find((p) => p.id === id)?.name ?? 'Someone'

  const currentIndex = () => lineIndexAt(props.lines, props.positionSec())
  const rests = createMemo(() => restsBetween(props.lines))
  const activeRest = () => restAt(rests(), props.positionSec())

  /**
   * Keep the sung line centred in THIS panel.
   *
   * Not scrollIntoView: it scrolls every scrollable ancestor, so following
   * the song dragged the whole page down and the header, the picker and
   * the transport all scrolled out of reach. Setting scrollTop moves only
   * this element.
   *
   * Centring rather than pinning to the top because a singer needs the
   * NEXT line as much as the current one. The clamp is what makes the
   * first and last lines behave -- they simply stop at the ends instead of
   * needing half a panel of padding to centre into.
   */
  createEffect(() => {
    const i = currentIndex()
    const box = scrollRef
    if (i < 0 || box === undefined) return
    const el = box.querySelector<HTMLElement>(`[data-line="${i}"]`)
    if (el === null) return
    const target = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2
    box.scrollTo({
      top: Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight)),
      behavior: 'smooth',
    })
  })

  return (
    <div class={styles.panel}>
      {/* Inside the panel, not above it. An outer wrapper made the panel a
          flex sibling of the bar, and the scroll box then sized itself
          against the wrong box and overflowed -- on a phone that clipped
          the words to nothing. The bar edits these lyrics, so this is also
          where it belongs. */}
      <JamAssignBar />
      <Show
        when={props.lines.length > 0}
        fallback={
          // The finder shows itself only when the song is one it can fix
          // (a session of yours, with no words yet). Everything else --
          // an instrumental, the demo -- falls through to the plain note.
          <>
            <JamLyricsFinder />
            <Show when={!canAttachLyrics(jamSong())}>
              <p class={styles.empty}>
                No lyrics for this song — sing along by ear.
              </p>
            </Show>
          </>
        }
      >
        {/* The armed colour is set once here rather than per line: the
            preview is the brush, and every row shows the same brush. */}
        <div
          class={styles.scroll}
          ref={scrollRef}
          style={{
            '--brush-color':
              colors()[jamAssignBrush() ?? ''] ?? 'rgba(255,255,255,0.6)',
          }}
        >
          <For each={props.lines}>
            {(line, i) => (
              <div
                data-line={i()}
                class={styles.line}
                style={{
                  '--singer-color':
                    colors()[singerOfLine(jamSongParts(), i()) ?? ''] ??
                    'transparent',
                }}
                classList={{
                  [styles.lineCurrent]: i() === currentIndex(),
                  // Everything already sung dims rather than disappearing,
                  // so the singer keeps a sense of where they are in the
                  // song rather than only where they are in the bar.
                  [styles.linePast]:
                    currentIndex() >= 0 && i() < currentIndex(),
                  // Somebody else's line: still readable, because following
                  // the whole song is the point of a lyric sheet, but
                  // visibly not yours to come in on.
                  [styles.lineNotMine]:
                    singerOfLine(jamSongParts(), i()) !== null &&
                    !jamLineIsMine(i()),
                  // Raised while its popover is open -- see the CSS note.
                  [styles.lineAssigning]: assigning() === i(),
                  // Block shape: tint the whole run, round only its ends,
                  // so a verse reads as one thing rather than as N rows
                  // that happen to share a colour.
                  [styles.lineOwned]:
                    singerOfLine(jamSongParts(), i()) !== null,
                  [styles.blockStart]:
                    blockOfLine(blocks(), i())?.fromLine === i(),
                  [styles.blockEnd]: blockOfLine(blocks(), i())?.toLine === i(),
                  [styles.painting]: painting(),
                  [styles.paintPreview]: inPaintRange(i()),
                }}
                onPointerDown={(e) => {
                  if (!painting() || !jamIsHost()) return
                  // Or the browser starts a text selection across the sheet
                  // and the drag paints nothing.
                  e.preventDefault()
                  setPaintFrom(i())
                  setPaintTo(i())
                }}
                onPointerEnter={() => {
                  if (paintFrom() !== null) setPaintTo(i())
                }}
                onClick={() => {
                  // While a singer is armed the row belongs to the brush;
                  // the sweep has already handled it on pointer up.
                  if (painting()) return
                  // Otherwise: jump to the line. The gesture people reach
                  // for first -- "take it from the chorus".
                  if (!jamIsHost()) return
                  setAssigning(null)
                  props.onSeek?.(line.startSec)
                }}
              >
                {/* The count-in sits above the line it leads into, which
                    is where the singer's eye already is. */}
                <Show
                  when={
                    activeRest()?.rest.beforeLine === i()
                      ? activeRest()
                      : undefined
                  }
                >
                  {(r) => (
                    <RestDots
                      total={r().rest.dotCount}
                      left={r().secondsLeft}
                    />
                  )}
                </Show>
                <span class={styles.lineText}>{line.text}</span>
                {/* The name rides the FIRST line of a block and nothing
                    else. Repeating it down a six-line verse is six times
                    the ink for one fact, and the tint already says the run
                    belongs together. */}
                <Show
                  when={
                    blockOfLine(blocks(), i())?.fromLine === i() &&
                    singerOfLine(jamSongParts(), i()) !== null
                  }
                >
                  <span class={styles.singerName}>
                    {nameOf(singerOfLine(jamSongParts(), i()) ?? '')}
                  </span>
                </Show>
                {/* Only on lines already sung: a score appearing beside the
                    line you are singing would be judging a phrase that is
                    not finished. */}
                <Show when={props.scores?.()[i()]}>
                  {(s) => (
                    <span
                      class={styles.lineScore}
                      classList={{
                        [styles[`lineScore_${scoreBand(s().score)}`] ?? '']:
                          true,
                      }}
                      aria-label={`${s().score} out of 100`}
                    >
                      {s().score}
                    </span>
                  )}
                </Show>
                {/* Host-only, and quiet until wanted: a button per line is
                    a lot of furniture over a lyric sheet, so it only inks
                    in on hover, on focus, or once the line HAS a singer. */}
                <Show when={jamIsHost()}>
                  <button
                    type="button"
                    class={styles.assignBtn}
                    classList={{
                      [styles.assignBtnSet]:
                        singerOfLine(jamSongParts(), i()) !== null,
                    }}
                    title="Who sings this line"
                    aria-label={`Who sings line ${i() + 1}`}
                    onClick={(e) => {
                      // Or the row's seek would fire underneath it.
                      e.stopPropagation()
                      setAssigning(assigning() === i() ? null : i())
                    }}
                  >
                    <SingerIcon />
                  </button>
                </Show>
                <Show when={jamIsHost() && assigning() === i()}>
                  <div class={styles.assign}>
                    <For
                      each={[{ id: EVERYONE, name: 'Everyone' }, ...everyone()]}
                    >
                      {(who) => (
                        <button
                          type="button"
                          class={styles.assignItem}
                          onClick={(e) => {
                            e.stopPropagation()
                            assignJamSongLines(i(), i(), who.id)
                            setAssigning(null)
                          }}
                        >
                          <span
                            class={styles.assignDot}
                            style={{
                              background:
                                who.id === EVERYONE
                                  ? 'transparent'
                                  : (colors()[who.id] ?? '#58a6ff'),
                            }}
                          />
                          {who.name}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={props.showNotes}>
                  <span class={styles.lineTime}>
                    {formatClock(line.startSec)}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
