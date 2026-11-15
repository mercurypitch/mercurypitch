// ============================================================
// Studio note editor — a MIDI clip's notes, big: a drawer under the lanes on a computer and a tablet that resizes and fills the arrangement, the whole screen on a phone
// ============================================================
//
// Loaded on its first open (StudioNoteEditorHost.tsx), so no page pays for
// it before then. It opens on the clip the editor state names
// (note-editor-state.ts), takes the focus, and gives it back to the clip
// when it closes. Done closes it; Escape clears the selection, then closes
// it; =, - and Z zoom the roll as they zoom the lanes, and B switches
// between Select and Draw. The drawer's top edge drags to another height,
// kept on this device, and Expand fills the arrangement. The header names
// the lane and the clip and holds the editing tools (StudioNoteTools.tsx);
// the roll (StudioNoteRoll.tsx) draws the notes, and edits a piano's
// through the engine (useStudioNoteEditing.ts). A note the editor touches
// sounds through the lane's instrument (note-audition.ts); a gesture's draft
// goes to the render service (midi/midi-render-editor.ts), so the clip
// plays as the gesture would leave it, and the header says while the
// clip's render runs and when it failed.
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, } from 'solid-js'
import { Maximize2, Minimize2, RotateCcw } from '@/components/icons'
import { isTypingTarget } from '@/lib/space-playback'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import { studioClipTickWindow, studioSongBeats } from '@/lib/studio/midi/time'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { studioSequence } from '@/lib/studio/model/sequences'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'
import type { StudioMidiRenderState } from '../midi/midi-render-editor'
import { useStudioMidiEditor } from '../midi/midi-render-editor'
import { studioMidiSound, studioMidiSoundWords, } from '../record/midi/studio-midi-sound'
import { FitWidth, RotateCw, ZoomIn, ZoomOut } from '../studio-icons'
import common from '../StudioPage.module.css'
import { studioClipTakeName } from '../timeline/StudioTimelineClip'
import { studioTrackColor, studioTrackHue } from '../timeline/track-hues'
import type { StudioNoteAuditionClock } from './note-audition'
import { createStudioNoteAudition } from './note-audition'
import type { StudioNoteEditorState } from './note-editor-state'
import { studioNoteStatusWords } from './note-editor-words'
import styles from './StudioNoteEditor.module.css'
import type { StudioNoteRollControls, StudioNoteRollTransport, } from './StudioNoteRoll'
import { StudioNoteRoll } from './StudioNoteRoll'
import { StudioNoteSelectionTools, StudioNoteTools } from './StudioNoteTools'
import { useStudioNoteEditing } from './useStudioNoteEditing'

/** The Studio's own undo and redo, for the editor's buttons: a phone's editor covers the top bar's. */
export interface StudioNoteHistory {
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

export interface StudioNoteEditorProps {
  state: StudioNoteEditorState
  clip: StudioClip
  project: StudioProject
  assets: readonly StudioAsset[]
  phone: boolean
  tablet: boolean
  /** The transport, and its clock for the notes the editor sounds. */
  transport: StudioNoteRollTransport & Partial<StudioNoteAuditionClock>
  /** The Studio's commands: each edit is one, and one undo step. */
  dispatch(command: StudioCommand): boolean
  /** Whether the song can be edited now. */
  writable: boolean
  history?: StudioNoteHistory
}

/** The drawer's least height, and how much of the arrangement it takes on its own. */
export const STUDIO_NOTE_EDITOR_MIN_HEIGHT = 220
const AUTO_SHARE = 0.56
/** A tablet's drawer takes more: rows a finger can take, eight of a piano's or seven of a kit's at 1180 by 820. */
const TABLET_SHARE = 0.7
const AUTO_MOST = 560
/** The ruler and one lane stay in view over a drawer at its tallest. */
const LANES_LEFT = 36 + 64
const RESIZE_STEP = 16
/** How long a word from the editor stays in its status line. */
const NOTICE_MS = 5000
/** Said when the clip's render fails: it plays its earlier audio. */
export const NOTE_RENDER_FAILED =
  "Studio couldn't render the new notes. The clip plays its earlier audio."

export function StudioNoteEditor(props: StudioNoteEditorProps) {
  let section: HTMLElement | undefined
  let controls: StudioNoteRollControls | null = null
  const [room, setRoom] = createSignal(0)
  const [dragged, setDragged] = createSignal<number | null>(null)
  let resize: { pointer: number; y: number; from: number } | null = null

  const track = createMemo(() =>
    props.project.tracks.find((each) => each.id === props.clip.trackId),
  )
  const sequence = createMemo(() =>
    props.clip.midi === undefined
      ? undefined
      : studioSequence(props.project, props.clip.midi.sequenceId),
  )
  const trackName = () => track()?.name ?? 'Lane'
  const instrument = createMemo(() =>
    studioLaneInstrument(track() ?? { name: '', role: 'other' }),
  )
  const sound = () => studioMidiSound(instrument())
  const color = createMemo(() => {
    const lane = track()
    if (lane === undefined) return 'var(--studio-accent)'
    const order = [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .findIndex((each) => each.id === lane.id)
    return studioTrackColor(studioTrackHue(lane, order))
  })
  // The take's own name; none when its file has none, rather than the lane's twice.
  const takeName = () => {
    const asset = props.assets.find((each) => each.id === props.clip.assetId)
    return asset?.originalName === undefined
      ? null
      : studioClipTakeName(asset, trackName())
  }
  const title = () =>
    [trackName(), takeName()].filter((part) => part !== null).join(', ')
  // The lane's words, to their first full stop: "Plays the drum kit."
  const soundWords = () => studioMidiSoundWords(instrument()).split('. ')[0]
  const status = createMemo(() => {
    const notes = sequence()
    if (notes === undefined) return ''
    return studioNoteStatusWords({
      notes: notes.notes,
      window: studioClipTickWindow(props.clip, notes),
      meter: {
        ...studioSongBeats(props.clip, notes, props.project.tempoBpm),
        beatsPerBar: 4,
      },
      sound: sound(),
    })
  })

  const drawer = () => !props.phone && !props.state.expanded()
  const tallest = () =>
    Math.max(STUDIO_NOTE_EDITOR_MIN_HEIGHT, room() - LANES_LEFT)
  const automatic = () =>
    Math.min(
      AUTO_MOST,
      Math.round(room() * (props.tablet ? TABLET_SHARE : AUTO_SHARE)),
    )
  const height = () => {
    const wanted = dragged() ?? props.state.height() ?? automatic()
    return Math.round(
      Math.max(STUDIO_NOTE_EDITOR_MIN_HEIGHT, Math.min(tallest(), wanted)),
    )
  }

  function close(): void {
    props.state.close()
  }

  const [notice, setNotice] = createSignal('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  function announce(words: string): void {
    clearTimeout(noticeTimer)
    setNotice(words)
    noticeTimer = setTimeout(() => setNotice(''), NOTICE_MS)
  }
  onCleanup(() => clearTimeout(noticeTimer))

  const audition = createStudioNoteAudition({
    clock: {
      clock: () => props.transport.clock?.() ?? null,
      unlock: () => props.transport.unlock?.() ?? Promise.resolve(false),
    },
    sound,
  })
  onCleanup(audition.dispose)
  const renders = useStudioMidiEditor()
  // What the clip's render is doing: idle, rendering a draft or an edit, or failed.
  const rendering = createMemo(
    () => renders?.renderState(props.clip.id)() ?? 'idle',
  )
  createEffect(
    on(rendering, (now, before) => {
      if (now === 'failed' && before !== 'failed') announce(NOTE_RENDER_FAILED)
    }),
  )
  const editor = useStudioNoteEditing({
    clip: () => props.clip,
    sequence,
    songTempoBpm: () => props.project.tempoBpm,
    writable: () => props.writable,
    playheadFrame: () =>
      props.transport.playing()
        ? props.transport.frameNow()
        : props.transport.playheadFrame(),
    dispatch: (command) => props.dispatch(command),
    close,
    clipboard: () => props.state.clipboard(),
    setClipboard: (clipboard) => props.state.setClipboard(clipboard),
    audition,
    preview: (draft) => renders?.preview(props.clip.id, draft),
    announce,
  })
  // A phone's selection edits sit in a bar over the status line.
  const thumbNotes = () => (props.phone ? sequence() : undefined)
  const kit = () => sound() === 'drums'

  /** B switches between Select and Draw. */
  function toolKey(event: KeyboardEvent): boolean {
    if (event.key.toLowerCase() !== 'b' || event.repeat) return false
    if (event.ctrlKey || event.metaKey || event.altKey) return false
    editor.setTool(editor.tool() === 'draw' ? 'select' : 'draw')
    return true
  }

  function keyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || isTypingTarget(event.target)) return
    if (toolKey(event) || editor.keyDown(event)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else viewKey(event)
  }

  /** = and - zoom the roll; Z fits the clip in it. */
  function viewKey(event: KeyboardEvent): void {
    const key = event.key
    if (key === '=' || key === '+' || key === '-') {
      event.preventDefault()
      controls?.zoom(key === '-' ? -1 : 1)
    } else if (key.toLowerCase() === 'z' && !event.shiftKey && !event.repeat) {
      event.preventDefault()
      controls?.fit()
    }
  }

  function resizeDown(event: PointerEvent): void {
    if (event.button !== 0 || !section) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    resize = {
      pointer: event.pointerId,
      y: event.clientY,
      from: section.getBoundingClientRect().height,
    }
    setDragged(resize.from)
  }

  function resizeMove(event: PointerEvent): void {
    if (resize?.pointer !== event.pointerId) return
    setDragged(resize.from + resize.y - event.clientY)
  }

  function resizeEnd(event: PointerEvent): void {
    if (resize?.pointer !== event.pointerId) return
    resize = null
    props.state.setHeight(height())
    setDragged(null)
  }

  function resizeKey(event: KeyboardEvent): void {
    const next = {
      ArrowUp: height() + RESIZE_STEP,
      ArrowDown: height() - RESIZE_STEP,
      Home: STUDIO_NOTE_EDITOR_MIN_HEIGHT,
      End: tallest(),
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    props.state.setHeight(
      Math.max(STUDIO_NOTE_EDITOR_MIN_HEIGHT, Math.min(tallest(), next)),
    )
  }

  onMount(() => {
    const host = section?.parentElement
    const observer =
      typeof ResizeObserver === 'undefined' || !host
        ? null
        : new ResizeObserver(() => setRoom(host.clientHeight))
    if (host) {
      observer?.observe(host)
      setRoom(host.clientHeight)
    }
    const clipId = props.clip.id
    audition.warm()
    queueMicrotask(() => {
      if (section?.isConnected === true) section.focus({ preventScroll: true })
    })
    onCleanup(() => {
      observer?.disconnect()
      // Back to the clip, unless the focus went somewhere on purpose.
      const active = document.activeElement
      const ours =
        active === null ||
        active === document.body ||
        section?.contains(active) === true
      if (!ours) return
      queueMicrotask(() => {
        const now = document.activeElement
        if (now !== null && now !== document.body && now.isConnected) return
        document
          .querySelector<HTMLElement>(
            `[data-studio-clip="${CSS.escape(clipId)}"]`,
          )
          ?.focus({ preventScroll: true })
      })
    })
  })

  return (
    <section
      ref={section}
      class={styles.editor}
      classList={{
        [styles.expanded]: !props.phone && props.state.expanded(),
        [styles.full]: props.phone,
        [styles.touch]: props.phone || props.tablet,
        [styles.resizing]: dragged() !== null,
      }}
      style={{
        '--studio-track': color(),
        height: drawer() && room() > 0 ? `${height()}px` : undefined,
      }}
      aria-label={`Note editor: ${title()}`}
      tabindex="-1"
      data-studio-note-editor={props.clip.id}
      onKeyDown={keyDown}
      onKeyUp={(event) => editor.keyUp(event)}
    >
      <Show when={drawer()}>
        <div
          class={styles.resize}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Note editor height"
          aria-valuemin={STUDIO_NOTE_EDITOR_MIN_HEIGHT}
          aria-valuemax={tallest()}
          aria-valuenow={height()}
          tabIndex={0}
          title="Drag to resize. Double-click for the automatic height."
          onPointerDown={resizeDown}
          onPointerMove={resizeMove}
          onPointerUp={resizeEnd}
          onPointerCancel={resizeEnd}
          onLostPointerCapture={resizeEnd}
          onKeyDown={resizeKey}
          onDblClick={() => props.state.setHeight(null)}
        />
      </Show>
      <div class={styles.header}>
        <div class={styles.identity}>
          <span class={styles.dot} aria-hidden="true" />
          <div class={styles.names}>
            <h2 class={styles.title}>
              {trackName()}
              <Show when={takeName()}>
                {(name) => (
                  <span class={styles.clipName}>{` · ${name()}`}</span>
                )}
              </Show>
            </h2>
            <p class={styles.sound}>
              {soundWords()}
              <StudioNoteRenderState state={rendering()} />
            </p>
          </div>
        </div>
        <span class={styles.chip}>
          {sound() === 'drums' ? 'MIDI · KIT' : 'MIDI · PIANO'}
        </span>
        <div class={styles.tools} data-studio-note-tools="">
          <Show when={sequence()}>
            {(shown) => (
              <>
                <StudioNoteTools
                  editing={editor}
                  notes={shown().notes}
                  writable={props.writable}
                  compact={props.phone}
                />
                <Show when={!props.phone}>
                  <StudioNoteSelectionTools
                    editing={editor}
                    notes={shown().notes}
                    writable={props.writable}
                    compact={false}
                    kit={kit()}
                  />
                </Show>
              </>
            )}
          </Show>
        </div>
        <div class={styles.actions}>
          <Show when={props.history}>
            {(history) => (
              <HistoryButtons history={history()} writable={props.writable} />
            )}
          </Show>
          <Show when={!props.phone}>
            <button
              type="button"
              class={common.iconButton}
              aria-label="Fill the arrangement"
              aria-pressed={props.state.expanded()}
              title={
                props.state.expanded()
                  ? 'Show the lanes again'
                  : 'Fill the arrangement with the notes'
              }
              onClick={() => props.state.setExpanded(!props.state.expanded())}
            >
              <Show when={props.state.expanded()} fallback={<Maximize2 />}>
                <Minimize2 />
              </Show>
            </button>
          </Show>
          <button
            type="button"
            class={common.primaryButton}
            title="Close the note editor (Esc)"
            aria-keyshortcuts="Escape"
            data-studio-note-done=""
            onClick={close}
          >
            Done
          </button>
        </div>
      </div>
      <Show when={sequence()}>
        {(notes) => (
          <StudioNoteRoll
            clip={props.clip}
            sequence={notes()}
            songTempoBpm={props.project.tempoBpm}
            sound={sound()}
            touch={props.phone || props.tablet}
            compact={props.phone}
            color={color()}
            transport={props.transport}
            editing={editor.editing}
            controls={(value) => (controls = value)}
          />
        )}
      </Show>
      <Show when={thumbNotes()}>
        {(shown) => (
          <div class={styles.thumbBar}>
            <StudioNoteSelectionTools
              editing={editor}
              notes={shown().notes}
              writable={props.writable}
              compact
              kit={kit()}
            />
          </div>
        )}
      </Show>
      <div class={styles.status}>
        <span class={styles.statusWords} data-studio-note-status="">
          {notice() || status()}
        </span>
        <span class={styles.notice} role="status">
          {notice()}
        </span>
        <div class={styles.zoom}>
          <button
            type="button"
            class={common.iconButton}
            aria-label="Zoom out of the notes"
            aria-keyshortcuts="-"
            title="Zoom out (-)"
            onClick={() => controls?.zoom(-1)}
          >
            <ZoomOut size={17} />
          </button>
          <button
            type="button"
            class={common.iconButton}
            aria-label="Zoom in on the notes"
            aria-keyshortcuts="="
            title="Zoom in (=)"
            onClick={() => controls?.zoom(1)}
          >
            <ZoomIn size={17} />
          </button>
          <button
            type="button"
            class={common.iconButton}
            aria-label="Show the whole clip"
            aria-keyshortcuts="Z"
            title="Show the whole clip (Z)"
            onClick={() => controls?.fit()}
          >
            <FitWidth size={17} />
          </button>
        </div>
      </div>
    </section>
  )
}

/** What the clip's render is doing, after the lane's words: running, shown once it takes a moment, or failed; nothing while idle. */
function StudioNoteRenderState(props: { state: StudioMidiRenderState }) {
  const failed = () => props.state === 'failed'
  return (
    <Show when={props.state !== 'idle'}>
      <span
        class={failed() ? styles.renderFailed : styles.rendering}
        title={failed() ? NOTE_RENDER_FAILED : undefined}
        data-studio-note-render={props.state}
      >
        {failed() ? " \u00b7 Couldn't render" : ' \u00b7 Rendering\u2026'}
      </span>
    </Show>
  )
}

/** Undo and Redo, the Studio's: each edit the editor made is one step. */
function HistoryButtons(props: {
  history: StudioNoteHistory
  writable: boolean
}) {
  return (
    <>
      <button
        type="button"
        class={common.iconButton}
        aria-label="Undo"
        aria-keyshortcuts="Control+Z Meta+Z"
        title="Undo (Ctrl+Z)"
        disabled={!props.writable || !props.history.canUndo()}
        onClick={() => props.history.undo()}
      >
        <RotateCcw size={17} />
      </button>
      <button
        type="button"
        class={common.iconButton}
        aria-label="Redo"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!props.writable || !props.history.canRedo()}
        onClick={() => props.history.redo()}
      >
        <RotateCw size={17} />
      </button>
    </>
  )
}
