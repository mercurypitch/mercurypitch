// ============================================================
// SheetMusicView — Standard notation view for melodies
//
// Renders a melody with VexFlow and overlays an interactive layer:
//  - a playback cursor + current-note highlight driven by currentBeat()
//  - click a note to seek there (onSeek)
//  - click empty staff to place a note / right-click to delete (onMelodyChange)
// The overlay maps 1:1 to the rendered SVG (renderer draws at the measured
// width, no CSS scaling), so screen clicks are layout coordinates directly.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Music } from '@/components/icons'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import { ensureSheetMusicFonts } from '@/lib/sheet-music-fonts'
import type { SheetLayout, SheetSystemBox } from '@/lib/sheet-music-renderer'
import { beatToCursor, midiToStaffY, noteBoxAt, renderSheetMusic, staffYToMidi, systemAtY, xToBeat, } from '@/lib/sheet-music-renderer'
import { setSheetInteractionMode, sheetInteractionMode, } from '@/stores/settings-store'
import type { MelodyItem, NoteName, ScaleDegree } from '@/types'
import styles from './SheetMusicView.module.css'

interface SheetMusicViewProps {
  melody: () => MelodyItem[]
  musicKey: () => string
  scaleType: () => string
  /** Name of the melody/song being shown, so the score says what it is
   *  rather than just its key — Split view otherwise reads as two
   *  unrelated pieces. */
  melodyName?: () => string | null
  beatsPerBar?: number
  /** playback position (beats); enables the cursor + highlight when provided */
  currentBeat?: () => number
  isPlaying?: () => boolean
  /** seek playback to a beat when a note is clicked */
  onSeek?: (beat: number) => void
  /** scale degrees for pitch snapping when placing notes */
  scale?: () => ScaleDegree[]
  /** enables note entry/deletion when provided */
  onMelodyChange?: (melody: MelodyItem[]) => void
  /** length in beats of a newly placed note (default 1) */
  noteDuration?: () => number
  /** compact top toolbar area (e.g. a length picker) rendered above the staff */
  toolbar?: () => JSX.Element
  /** optional data-tour hook for the container */
  dataTour?: string
}

interface SheetRenderSnapshot {
  melody: MelodyItem[]
  key: string
  scaleType: string
  beatsPerBar: number | undefined
}

function snapToScale(midi: number, scale: ScaleDegree[]): ScaleDegree | null {
  if (!scale.length) return null
  let best = scale[0]
  let bestD = Infinity
  for (const d of scale) {
    const dist = Math.abs(d.midi - midi)
    if (dist < bestD) {
      best = d
      bestD = dist
    }
  }
  return best
}

export const SheetMusicView: Component<SheetMusicViewProps> = (props) => {
  let scrollRef: HTMLDivElement | undefined
  let innerRef: HTMLDivElement | undefined
  let vexRef: HTMLDivElement | undefined
  let canDraw = false
  let latestRenderInput: SheetRenderSnapshot | undefined

  const [layout, setLayout] = createSignal<SheetLayout | null>(null)
  const [renderError, setRenderError] = createSignal<string | null>(null)
  const [fontsReady, setFontsReady] = createSignal(false)
  const editable = (): boolean => typeof props.onMelodyChange === 'function'
  // Scrub mode turns the editable score into a transport surface (click a
  // bar to jump, drag to scrub) without leaving the view. Only meaningful
  // when editing is available — read-only instances already seek.
  const scrubMode = (): boolean =>
    editable() && sheetInteractionMode() === 'scrub'

  const measureWidth = (): number => {
    const w = scrollRef?.clientWidth ?? 960
    return Math.max(360, Math.min(1400, w - 4))
  }

  const draw = (input: SheetRenderSnapshot): void => {
    if (!vexRef) return
    try {
      const l = renderSheetMusic({
        container: vexRef,
        melody: input.melody,
        key: input.key,
        scaleType: input.scaleType,
        beatsPerBar: input.beatsPerBar,
        width: measureWidth(),
      })
      setLayout(l)
      setRenderError(null)
    } catch (error) {
      vexRef.replaceChildren()
      setLayout(null)
      setRenderError(
        error instanceof Error
          ? error.message
          : 'The score could not be drawn.',
      )
    }
  }

  // Redraw on any content change. createEffect runs once on mount.
  createEffect(() => {
    latestRenderInput = {
      melody: props.melody(),
      key: props.musicKey(),
      scaleType: props.scaleType(),
      beatsPerBar: props.beatsPerBar,
    }
    if (fontsReady()) draw(latestRenderInput)
  })

  // VexFlow registers its bundled fonts asynchronously. Wait before creating
  // SVG text so browsers that do not repaint private-use glyphs after a
  // FontFace load never expose hexadecimal missing-glyph boxes.
  onMount(() => {
    let disposed = false
    void ensureSheetMusicFonts()
      .then(() => {
        if (disposed) return
        canDraw = true
        setFontsReady(true)
      })
      .catch(() => {
        if (disposed) return
        setRenderError(
          'The music notation font could not be loaded. Reopen this view to try again.',
        )
      })

    onCleanup(() => {
      disposed = true
    })
  })

  // Redraw on container resize (debounced via rAF).
  onMount(() => {
    if (!scrollRef) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (canDraw && latestRenderInput !== undefined) {
          draw(latestRenderInput)
        }
      })
    })
    ro.observe(scrollRef)
    onCleanup(() => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    })
  })

  // Playback cursor + current-note highlight + auto-scroll.
  // Last smooth-scroll target, so the follow logic issues one scrollTo per
  // system hop instead of restarting the animation every animation frame.
  let lastFollowTarget = -1
  const [cursorX, setCursorX] = createSignal<number | null>(null)
  const [cursorTop, setCursorTop] = createSignal(0)
  const [cursorH, setCursorH] = createSignal(0)
  const [hl, setHl] = createSignal<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  createEffect(() => {
    const l = layout()
    const beatFn = props.currentBeat
    if (!l || !beatFn) {
      setCursorX(null)
      setHl(null)
      return
    }
    const beat = beatFn()
    const pos = beatToCursor(l, beat)
    if (!pos) {
      setCursorX(null)
      setHl(null)
      return
    }
    setCursorX(pos.x)
    setCursorTop(pos.top)
    setCursorH(pos.bottom - pos.top)

    // Highlight the note currently sounding.
    const active = l.notes.find(
      (n) => !n.isRest && beat >= n.startBeat && beat < n.endBeat,
    )
    const sys = active ? l.systems[active.systemIndex] : undefined
    if (active && sys) {
      setHl({
        x: active.x - Math.max(8, active.width / 2) - 2,
        y: sys.top,
        w: Math.max(16, active.width) + 4,
        h: sys.bottom - sys.top,
      })
    } else {
      setHl(null)
    }

    // Follow playback: nudge horizontally near the edges; vertically, once
    // the cursor's system sinks past the middle of the visible sheet (or
    // jumps above it on a loop wrap / backwards seek), glide that system up
    // to the top quarter of the view.
    if (props.isPlaying?.() === true && scrollRef) {
      const c = scrollRef
      const m = 80
      if (pos.x < c.scrollLeft + m) c.scrollLeft = Math.max(0, pos.x - m)
      else if (pos.x > c.scrollLeft + c.clientWidth - m)
        c.scrollLeft = pos.x - c.clientWidth + m
      const midY = c.scrollTop + c.clientHeight / 2
      if (pos.bottom > midY || pos.top < c.scrollTop) {
        const target = Math.max(
          0,
          Math.round(pos.top - Math.max(16, c.clientHeight * 0.25)),
        )
        if (target !== lastFollowTarget) {
          lastFollowTarget = target
          c.scrollTo({ top: target, behavior: 'smooth' })
        }
      }
    } else {
      lastFollowTarget = -1
    }
  })

  const localCoords = (e: MouseEvent): { px: number; py: number } | null => {
    if (!innerRef) return null
    const r = innerRef.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }

  const nextId = (): number => {
    let max = 0
    for (const m of props.melody())
      if (typeof m.id === 'number' && m.id > max) max = m.id
    return max + 1
  }

  // Pitch tolerance for treating a click as "on a note" (≈ one staff space).
  const NOTE_Y_TOL = 12

  /** Where a click at (px, py) would land a new note: the containing system,
   *  the duration-snapped start beat, and the scale-snapped pitch. One
   *  routine feeds both the hover ghost and the actual placement, so the
   *  preview can never lie about what a click will do. */
  const placementAt = (
    px: number,
    py: number,
  ): {
    sys: SheetSystemBox
    startBeat: number
    dur: number
    note: MelodyItem['note']
  } | null => {
    const l = layout()
    if (!l) return null
    const sys = systemAtY(l, py)
    if (!sys) return null
    const beat = xToBeat(l, sys, px)
    const dur = props.noteDuration?.() ?? 1
    const snapUnit = dur >= 1 ? 1 : 0.5
    const startBeat = Math.max(0, Math.round(beat / snapUnit) * snapUnit)

    const rawMidi = staffYToMidi(sys, py)
    const scale = props.scale?.() ?? []
    const snapped = snapToScale(rawMidi, scale)
    let note: MelodyItem['note']
    if (snapped) {
      note = {
        midi: snapped.midi,
        name: snapped.name as NoteName,
        octave: snapped.octave,
        freq: snapped.freq,
      }
    } else {
      const { name, octave } = midiToNote(rawMidi)
      note = { midi: rawMidi, name, octave, freq: midiToFreq(rawMidi) }
    }
    return { sys, startBeat, dur, note }
  }

  // Hover ghost: a dashed preview of the note a click would place — its
  // pitch position, snapped beat column, duration glyph, and name.
  const [ghost, setGhost] = createSignal<{
    x: number
    y: number
    dur: number
    label: string
  } | null>(null)

  /** Seek to whatever sits under (px, py): a note's start, else the nearest
   *  beat in the bar. Shared by read-only clicks and scrub mode. */
  const seekAt = (px: number, py: number): void => {
    const l = layout()
    if (!l || !props.onSeek) return
    const hit = noteBoxAt(l, px, py)
    if (hit) {
      props.onSeek(hit.startBeat)
      return
    }
    const sys = systemAtY(l, py)
    if (!sys) return
    const beat = Math.round(xToBeat(l, sys, px))
    props.onSeek(Math.max(0, Math.min(beat, l.totalBeats)))
  }

  // Drag-to-scrub (scrub mode): press anywhere on the staff and drag.
  let scrubbing = false

  const handleDown = (e: MouseEvent): void => {
    if (!scrubMode()) return
    const c = localCoords(e)
    if (!c) return
    scrubbing = true
    seekAt(c.px, c.py)
  }

  const endScrub = (): void => {
    scrubbing = false
  }

  const handleMove = (e: MouseEvent): void => {
    if (!editable()) return
    const l = layout()
    const c = localCoords(e)
    if (!l || !c) {
      setGhost(null)
      return
    }
    if (scrubMode()) {
      setGhost(null)
      if (scrubbing) seekAt(c.px, c.py)
      return
    }
    // Over an existing notehead a click seeks instead of placing.
    if (noteBoxAt(l, c.px, c.py, NOTE_Y_TOL)) {
      setGhost(null)
      return
    }
    const p = placementAt(c.px, c.py)
    if (!p) {
      setGhost(null)
      return
    }
    const pos = beatToCursor(l, p.startBeat)
    setGhost({
      x: pos?.x ?? c.px,
      y: midiToStaffY(p.sys, p.note.midi),
      dur: p.dur,
      label: `${p.note.name}${p.note.octave}`,
    })
  }

  const handleClick = (e: MouseEvent): void => {
    const l = layout()
    const c = localCoords(e)
    if (!l || !c) return

    if (!editable() || scrubMode()) {
      // Read-only and scrub mode: a click in a note's column seeks to that
      // note; anywhere else in a bar jumps to the nearest beat.
      seekAt(c.px, c.py)
      return
    }

    // Editing: a click landing on a notehead seeks; empty staff places a note.
    const onNote = noteBoxAt(l, c.px, c.py, NOTE_Y_TOL)
    if (onNote && props.onSeek) {
      props.onSeek(onNote.startBeat)
      return
    }

    // Otherwise place a note at the clicked staff position — exactly what
    // the hover ghost previewed (same placementAt routine).
    const p = placementAt(c.px, c.py)
    if (!p) return
    const item: MelodyItem = {
      id: nextId(),
      note: p.note,
      duration: p.dur,
      startBeat: p.startBeat,
    }
    props.onMelodyChange?.([...props.melody(), item])
  }

  const handleContextMenu = (e: MouseEvent): void => {
    if (!editable() || scrubMode()) return
    const l = layout()
    const c = localCoords(e)
    if (!l || !c) return
    const hit = noteBoxAt(l, c.px, c.py, NOTE_Y_TOL)
    if (hit && hit.melodyId !== null) {
      e.preventDefault()
      props.onMelodyChange?.(
        props.melody().filter((m) => m.id !== hit.melodyId),
      )
    }
  }

  onCleanup(() => {
    if (vexRef) vexRef.innerHTML = ''
  })

  return (
    <section class={styles.frame} data-tour={props.dataTour}>
      <header class={styles.header}>
        <div class={styles.scoreIdentity}>
          <span class={styles.scoreIcon} aria-hidden="true">
            <Music />
          </span>
          <span>
            <span class={styles.kicker}>
              Live score · {props.musicKey()}{' '}
              {props.scaleType().replaceAll('-', ' ')}
            </span>
            <strong
              class={styles.scoreTitle}
              classList={{
                [styles.scoreTitleName]: (props.melodyName?.() ?? '') !== '',
              }}
              title={props.melodyName?.() ?? undefined}
              data-testid="sheet-melody-name"
            >
              {props.melodyName?.() ??
                `${props.musicKey()} ${props.scaleType().replaceAll('-', ' ')}`}
            </strong>
          </span>
        </div>
        <div class={styles.headerTools}>
          <span class={styles.modeHint}>
            {editable()
              ? scrubMode()
                ? 'Click a bar to jump · drag to scrub'
                : 'Click to add · right-click to remove'
              : props.isPlaying?.() === true
                ? 'Following playback'
                : 'Click the staff to seek'}
          </span>
          <Show when={editable()}>
            <div
              class={styles.modeToggle}
              role="tablist"
              aria-label="Score pointer mode"
            >
              <button
                type="button"
                role="tab"
                class={styles.modeTab}
                classList={{ [styles.modeTabActive]: !scrubMode() }}
                aria-selected={!scrubMode()}
                data-testid="sheet-mode-edit"
                title="Edit — click the staff to add notes"
                onClick={() => setSheetInteractionMode('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                class={styles.modeTab}
                classList={{ [styles.modeTabActive]: scrubMode() }}
                aria-selected={scrubMode()}
                data-testid="sheet-mode-scrub"
                title="Scrub — click or drag on the staff to move playback"
                onClick={() => setSheetInteractionMode('scrub')}
              >
                Scrub
              </button>
            </div>
          </Show>
        </div>
      </header>

      {props.toolbar?.()}

      <div ref={scrollRef} class={styles.sheetScroll}>
        <Show
          when={props.melody().length > 0}
          fallback={
            <div class={styles.emptyState} role="status">
              <span class={styles.emptyMark} aria-hidden="true">
                <Music />
              </span>
              <strong>No melody to notate yet</strong>
              <span>
                Load a melody or add notes in Compose to build the score.
              </span>
            </div>
          }
        >
          <div
            ref={innerRef}
            class={styles.sheetInner}
            style={{
              width: `${layout()?.width ?? measureWidth()}px`,
              height: `${layout()?.height ?? 200}px`,
            }}
          >
            <div ref={vexRef} class={styles.vexHost} />

            {hl() && (
              <div
                class={styles.noteHighlight}
                style={{
                  left: `${hl()!.x}px`,
                  top: `${hl()!.y}px`,
                  width: `${hl()!.w}px`,
                  height: `${hl()!.h}px`,
                }}
              />
            )}

            {cursorX() !== null && (
              <div
                class={styles.playCursor}
                classList={{ [styles.playCursorActive]: props.isPlaying?.() }}
                style={{
                  left: `${cursorX()!}px`,
                  top: `${cursorTop()}px`,
                  height: `${cursorH()}px`,
                }}
              />
            )}

            <Show when={ghost()}>
              {(g) => (
                <>
                  <svg
                    class={styles.ghostNote}
                    data-testid="sheet-ghost-note"
                    viewBox="0 0 26 46"
                    width="26"
                    height="46"
                    style={{
                      left: `${g().x - 9}px`,
                      top: `${g().y - 38}px`,
                    }}
                    aria-hidden="true"
                  >
                    {/* Notehead — hollow for half/whole, tinted for shorter */}
                    <ellipse
                      cx="9"
                      cy="38"
                      rx="6.3"
                      ry="4.5"
                      transform="rotate(-15 9 38)"
                      fill={g().dur >= 2 ? 'none' : 'currentColor'}
                      fill-opacity={g().dur >= 2 ? undefined : 0.4}
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-dasharray="3 2"
                    />
                    {/* Stem (whole notes have none) */}
                    <Show when={g().dur < 4}>
                      <line
                        x1="15.1"
                        y1="37"
                        x2="15.1"
                        y2="7"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-dasharray="3 2"
                      />
                    </Show>
                    {/* Flags: one for eighth, two for sixteenth */}
                    <Show when={g().dur <= 0.5}>
                      <path
                        d="M15.1 7 C 21 11 22 17 17.5 23"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-dasharray="3 2"
                      />
                    </Show>
                    <Show when={g().dur <= 0.25}>
                      <path
                        d="M15.1 14 C 21 18 22 24 17.5 30"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-dasharray="3 2"
                      />
                    </Show>
                    {/* Dot for dotted half (3 beats) */}
                    <Show when={g().dur === 3}>
                      <circle cx="20.5" cy="37" r="1.8" fill="currentColor" />
                    </Show>
                  </svg>
                  <span
                    class={styles.ghostLabel}
                    style={{
                      left: `${g().x + 14}px`,
                      top: `${g().y - 32}px`,
                    }}
                  >
                    {g().label}
                  </span>
                </>
              )}
            </Show>

            <div
              class={styles.clickLayer}
              classList={{
                [styles.clickLayerEdit]: editable() && !scrubMode(),
                [styles.clickLayerScrub]: scrubMode(),
              }}
              data-testid="sheet-click-layer"
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              onMouseDown={handleDown}
              onMouseUp={endScrub}
              onMouseMove={handleMove}
              onMouseLeave={() => {
                setGhost(null)
                endScrub()
              }}
            />
            <Show when={!fontsReady() && renderError() === null}>
              <div
                class={`${styles.emptyState} ${styles.errorState}`}
                role="status"
              >
                <span class={styles.emptyMark} aria-hidden="true">
                  <Music />
                </span>
                <strong>Preparing notation</strong>
                <span>
                  Loading the engraving font before drawing the score.
                </span>
              </div>
            </Show>
            <Show when={renderError()}>
              {(message) => (
                <div
                  class={`${styles.emptyState} ${styles.errorState}`}
                  role="alert"
                >
                  <span class={styles.emptyMark} aria-hidden="true">
                    <Music />
                  </span>
                  <strong>Notation unavailable</strong>
                  <span>{message()}</span>
                </div>
              )}
            </Show>
          </div>
        </Show>
      </div>
    </section>
  )
}
