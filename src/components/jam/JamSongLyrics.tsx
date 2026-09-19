// ── JamSongLyrics ─────────────────────────────────────────────────────
// The left half of a song room: the words, scrolling with the music.
//
// Deliberately not the stem-mixer's lyrics panel. That one is an editor --
// it owns block marking, LRC generation, tap-to-time and an edit mode,
// none of which belong in a room where someone else is driving playback.
// This is the read-only half of the same idea, and it stays small enough
// that the singer's eye can find the current line without hunting.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { JamZoomSubject } from '@/components/jam/JamLaneZoomControl'
import { JamLaneZoomControl } from '@/components/jam/JamLaneZoomControl'
import { LyricsAlignButtons } from '@/components/LyricsAlignButtons'
import { colorTokenVars } from '@/lib/css-color-token'
import { formatClock } from '@/lib/format-time'
import type { JamLineScore } from '@/lib/jam/jam-line-scoring'
import { canAttachLyrics } from '@/lib/jam/jam-lyrics-attach'
import { formatJamLyricsScale, isJamLyricsScaleDefault, JAM_LYRICS_SCALE_DEFAULT, JAM_LYRICS_SCALE_MAX, JAM_LYRICS_SCALE_MIN, lyricsScaleFromPinch, lyricsScaleFromWheel, steppedJamLyricsScale, } from '@/lib/jam/jam-lyrics-scale'
import { lineIndexAt, restAt, restsBetween } from '@/lib/jam/jam-song'
import { blockOfLine, groupLinesBySinger } from '@/lib/jam/jam-song-blocks'
import { EVERYONE, singerOfLine } from '@/lib/jam/jam-song-parts'
import { jamLyricsAlign, jamLyricsScale, setJamLyricsAlign, setJamLyricsScale, } from '@/lib/jam/jam-view-prefs'
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
  /**
   * A control that floats in a bottom corner of the words -- the guide
   * vocal, today. A function, so the panel decides when it is built; the
   * panel owns WHERE, because which corner is free depends on how the
   * viewer has the words lined up, and only this component knows that.
   *
   * Built ONCE each time it appears. A new function for the same control
   * is not a reason to build it again: a consumer that writes the builder
   * inline hands over a fresh one every time anything it reads changes, and
   * a level control rebuilt mid-drag drops the drag.
   */
  corner?: () => JSX.Element
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

/**
 * What the lane zoom's three buttons say when they size the words.
 *
 * The same control on purpose. Sizing the words is meant to be as easy
 * as zooming the lanes, and the surest way to be as easy as something is
 * to be it. Only the words and the scale differ.
 */
const LYRICS_SIZE_SUBJECT: JamZoomSubject = {
  min: JAM_LYRICS_SCALE_MIN,
  max: JAM_LYRICS_SCALE_MAX,
  isDefault: isJamLyricsScaleDefault,
  format: formatJamLyricsScale,
  outLabel: 'Smaller lyrics',
  outTitle: 'Smaller lyrics',
  inLabel: 'Larger lyrics',
  inTitle: 'Larger lyrics',
  readoutLabel: (shown) =>
    `Lyric size ${shown}. Reset to ${formatJamLyricsScale(JAM_LYRICS_SCALE_DEFAULT)}`,
  resetTitle: 'Reset lyric size',
  testId: 'jam-lyrics-size',
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
  // stuck mid-drag. A CANCELLED pointer (the browser reclaiming a touch
  // for scrolling) abandons it instead: committing a cancelled gesture
  // would paint a range the finger never chose, and leaving the anchor
  // set was the "stuck" half of the owner's tablet report.
  onMount(() => {
    const onUp = () => {
      if (paintFrom() !== null) commitPaint()
    }
    const onCancel = () => {
      setPaintFrom(null)
      setPaintTo(null)
    }
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    onCleanup(() => {
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
    })
  })

  /**
   * Grow the sweep from a pointer position rather than from enter events.
   *
   * Touch pointers are implicitly CAPTURED by the row the finger lands on,
   * so no other row ever fires pointerenter and a drag stayed pinned to
   * its first line (the other half of the tablet report). Hit-testing the
   * coordinates instead works for every pointer type — the same
   * elementFromPoint pattern Piano Night's glissando uses.
   */
  const sweepToPoint = (x: number, y: number): void => {
    if (paintFrom() === null) return
    const row = document.elementFromPoint(x, y)?.closest('[data-line]')
    if (!(row instanceof HTMLElement)) return
    const idx = Number(row.dataset.line)
    if (Number.isInteger(idx)) setPaintTo(idx)
  }

  /**
   * Ctrl+wheel and a two-finger pinch size the words; everything else is
   * left exactly as it was.
   *
   * The second half of that sentence is the hard half. This box scrolls,
   * and reading ahead by dragging it is the thing people do most here, so
   * a plain wheel and a one-finger drag are never cancelled, never
   * handled, and never slowed down by more than two comparisons.
   *
   * Touch events rather than the pointer events the lanes use. A lane
   * list rarely has anywhere to scroll to; this box always does, and
   * `touch-action: pan-y` (see the stylesheet) hands a vertical pan to
   * the browser however many fingers make it. Pointer events cannot take
   * that back -- by the time the pan starts they are already cancelled --
   * so a pinch whose fingers drift vertically would scroll the words
   * while sizing them. A touchmove that is cancelled while two fingers
   * are down is the one thing that stops the pan, and only a non-passive
   * listener is allowed to cancel it.
   *
   * Bound from the ref, like `watchBoxHeight` and for its reason.
   */
  const bindScaleGestures = (box: HTMLDivElement): void => {
    const onWheel = (event: WheelEvent): void => {
      // Ctrl/cmd is also what a trackpad pinch reports. Without it this
      // is a scroll, and it belongs to the scrollbar.
      if (!event.ctrlKey && !event.metaKey) return
      // Or the browser zooms the whole page as well.
      event.preventDefault()
      setJamLyricsScale(
        lyricsScaleFromWheel(jamLyricsScale(), event.deltaY, event.deltaMode),
      )
    }

    let pinchStartDistance = 0
    let pinchStartScale = JAM_LYRICS_SCALE_DEFAULT

    /**
     * The fingers that landed in THIS box.
     *
     * `touches` is every finger on the screen, and one on the words plus
     * one resting on the lanes is not a pinch of either.
     */
    const fingersHere = (event: TouchEvent): Touch[] =>
      Array.from(event.touches).filter(
        (touch) => touch.target instanceof Node && box.contains(touch.target),
      )

    const armPinch = (fingers: Touch[]): void => {
      const [a, b] = fingers
      if (a === undefined || b === undefined) return
      pinchStartDistance = Math.hypot(
        a.clientX - b.clientX,
        a.clientY - b.clientY,
      )
      pinchStartScale = jamLyricsScale()
    }

    const onTouchStart = (event: TouchEvent): void => {
      const fingers = fingersHere(event)
      // Exactly two. A third finger is somebody's palm, and scaling
      // against whichever two happen to be listed first makes the words
      // jump.
      pinchStartDistance = 0
      if (fingers.length !== 2) return
      armPinch(fingers)
      // A second finger means the first was never a sweep. With a singer
      // armed the first touch has already anchored one, and releasing
      // would paint a line the host was only trying to read.
      setPaintFrom(null)
      setPaintTo(null)
    }

    const onTouchMove = (event: TouchEvent): void => {
      if (pinchStartDistance <= 0) return
      const [a, b, extra] = fingersHere(event)
      if (a === undefined || b === undefined || extra !== undefined) return
      // Not cancelable once the browser has committed to a pan -- a second
      // finger added mid-scroll -- and cancelling it then only logs an
      // intervention warning.
      if (event.cancelable) event.preventDefault()
      setJamLyricsScale(
        lyricsScaleFromPinch(
          pinchStartScale,
          pinchStartDistance,
          Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        ),
      )
    }

    const onTouchGone = (event: TouchEvent): void => {
      // A finger lifted mid-pinch must not leave the next one scaling
      // against a distance measured with two.
      pinchStartDistance = 0
      const fingers = fingersHere(event)
      if (fingers.length === 2) armPinch(fingers)
    }

    box.addEventListener('wheel', onWheel, { passive: false })
    box.addEventListener('touchstart', onTouchStart, { passive: true })
    box.addEventListener('touchmove', onTouchMove, { passive: false })
    box.addEventListener('touchend', onTouchGone)
    box.addEventListener('touchcancel', onTouchGone)
    onCleanup(() => {
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('touchstart', onTouchStart)
      box.removeEventListener('touchmove', onTouchMove)
      box.removeEventListener('touchend', onTouchGone)
      box.removeEventListener('touchcancel', onTouchGone)
    })
  }

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
   * How tall the scroll box is, for the centring below.
   *
   * The box gets whatever the panel has left over, and that changes under
   * a song that is standing still: the parts bar wraps onto a second row
   * as the room fills, the seam is dragged, a phone is turned. Each one
   * moves the MIDDLE of the box without moving the song, and the line
   * being sung was left that far from it until the next one came along.
   */
  const [boxHeight, setBoxHeight] = createSignal(0)

  /**
   * Bound from the ref, not from onMount: the box lives under a <Show>
   * and is rebuilt when a song gains its words, and an onMount binding
   * would be left watching the element that no longer exists.
   */
  const watchBoxHeight = (box: HTMLDivElement): void => {
    // jsdom has none. The line is still centred every time the song moves.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setBoxHeight(box.clientHeight))
    observer.observe(box)
    onCleanup(() => observer.disconnect())
  }

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
   *
   * It also follows the LAYOUT: the size of the words and the height of
   * the box. Every line above the sung one grows or shrinks with the
   * scale, so the sung line moves even though the song has not; without
   * re-running, two presses of the plus button push the line being sung
   * out of the bottom of the panel. Both are read before the early
   * returns so that they are tracked whether or not a line is current yet.
   */
  createEffect<string | undefined>((lastLayout) => {
    const layout = `${jamLyricsScale()}/${boxHeight()}`
    const i = currentIndex()
    const box = scrollRef
    if (i < 0 || box === undefined) return layout
    const el = box.querySelector<HTMLElement>(`[data-line="${i}"]`)
    if (el === null) return layout
    // Where the line sits in the box's own content, from the two rects.
    // Not `el.offsetTop`: that is measured from the offsetParent, which
    // here is the PANEL (its backdrop-filter makes it one) and not this
    // box, so it counted the header and the parts bar as lyrics. The
    // "centred" line sat that much too high -- about 85px, which on a
    // phone's 210px box is the top edge, and at a large lyric size is
    // past it, with the line being sung cut in half.
    const lineTop =
      el.getBoundingClientRect().top -
      box.getBoundingClientRect().top -
      box.clientTop +
      box.scrollTop
    const target = lineTop - box.clientHeight / 2 + el.offsetHeight / 2
    box.scrollTo({
      top: Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight)),
      // A new line glides into place. A new layout must not: a pinch or
      // a dragged seam is sixty of these a second, each one restarting
      // the glide, and the sung line would trail the fingers instead of
      // staying put under them. Pinned, it is the fixed point the words
      // grow around.
      behavior:
        lastLayout === undefined || layout === lastLayout ? 'smooth' : 'auto',
    })
    return layout
  })

  /**
   * The corner the words leave free.
   *
   * Right-aligned words run into the right edge, so the control goes left.
   * Anything else leaves the right free -- except for the column of
   * who-sings buttons that lives at the trailing edge of every row, which
   * the stylesheet steps inside of rather than sitting on.
   */
  const cornerSide = (): 'left' | 'right' =>
    jamLyricsAlign() === 'right' ? 'left' : 'right'

  return (
    <div
      class={styles.panel}
      data-corner={props.corner !== undefined ? '' : undefined}
      // No words, no scroller to pad. What stands in for them (the finder)
      // scrolls itself from another stylesheet, so the panel is told instead.
      data-wordless={props.lines.length === 0 ? '' : undefined}
    >
      {/* `when` is a boolean, so only there-or-not re-renders this; and
          the build is untracked, so the builder's identity never does. */}
      <Show when={props.corner !== undefined}>
        <div
          class={styles.corner}
          data-side={cornerSide()}
          data-testid="jam-lyrics-corner"
        >
          {untrack(() => props.corner?.())}
        </div>
      </Show>
      {/* One slim row that everybody gets. The assign bar below is
          host-only, so until now a guest's lyric column had no chrome at
          all and no way to say how they want to read it. */}
      <div class={styles.header} data-testid="jam-lyrics-header">
        <span class={styles.headerLabel}>Lyrics</span>
        <div class={styles.headerTools}>
          {/* Three buttons, not the mixer's one-chip select. That chip is
              one button wide because its header is crowded, and pays for
              it with a menu the operating system draws; this row has the
              room to show all three choices and which one is on. */}
          <LyricsAlignButtons
            lyricsAlign={jamLyricsAlign}
            setLyricsAlign={setJamLyricsAlign}
          />
          {/* The visible half of the lyric size. Ctrl+wheel and a pinch
              on the words are the fast path and the one nobody is told
              about; these are the buttons that say it can be done. */}
          <JamLaneZoomControl
            subject={LYRICS_SIZE_SUBJECT}
            zoom={jamLyricsScale}
            onZoomIn={() =>
              setJamLyricsScale(steppedJamLyricsScale(jamLyricsScale(), 1))
            }
            onZoomOut={() =>
              setJamLyricsScale(steppedJamLyricsScale(jamLyricsScale(), -1))
            }
            onReset={() => setJamLyricsScale(JAM_LYRICS_SCALE_DEFAULT)}
          />
        </div>
      </div>
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
          ref={(box) => {
            scrollRef = box
            bindScaleGestures(box)
            watchBoxHeight(box)
          }}
          data-align={jamLyricsAlign()}
          style={{
            ...colorTokenVars(
              '--brush-color',
              colors()[jamAssignBrush() ?? ''] ?? 'rgba(255,255,255,0.6)',
            ),
            // One number; the stylesheet derives every lyric size from it.
            '--jam-lyrics-scale': jamLyricsScale().toFixed(3),
          }}
        >
          <For each={props.lines}>
            {(line, i) => (
              <div
                data-line={i()}
                // Present only where a click really does jump the song: the
                // stylesheet hangs the pointer cursor on it.
                data-seekable={props.onSeek !== undefined ? '' : undefined}
                class={styles.line}
                style={colorTokenVars(
                  '--singer-color',
                  colors()[singerOfLine(jamSongParts(), i()) ?? ''] ??
                    'transparent',
                )}
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
                onPointerMove={(e) => sweepToPoint(e.clientX, e.clientY)}
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
                {/* Everything that is not the words, in one box. Centred
                    alignment lifts this box out of the flow so the lyric
                    can sit on the PANEL's axis rather than on whatever
                    axis is left once a score and a name have had their
                    share -- which is what made "centred" look off-centre
                    on exactly the lines a singer looks at most. */}
                <span class={styles.lineTrail}>
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
                  <Show when={props.showNotes}>
                    <span class={styles.lineTime}>
                      {formatClock(line.startSec)}
                    </span>
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
                </span>
                {/* Outside the trail: the popover is positioned against
                    the ROW, and a trail box that centring makes absolute
                    would otherwise become its containing block and drop
                    the menu into the middle of the line. */}
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
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
