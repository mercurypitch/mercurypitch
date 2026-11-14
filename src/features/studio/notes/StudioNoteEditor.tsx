// ============================================================
// Studio note editor — a MIDI clip's notes, big: a drawer under the lanes on a computer and a tablet that resizes and fills the arrangement, the whole screen on a phone
// ============================================================
//
// Loaded on its first open (StudioNoteEditorHost.tsx), so no page pays for
// it before then. It opens on the clip the editor state names
// (note-editor-state.ts), takes the focus, and gives it back to the clip
// when it closes. Escape and Done close it; =, - and Z zoom the roll as they
// zoom the lanes. The drawer's top edge drags to another height, kept on
// this device, and Expand fills the arrangement. The header names the lane
// and the clip and holds a place for the editing tools
// (data-studio-note-tools); the roll (StudioNoteRoll.tsx) draws the notes.
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Maximize2, Minimize2 } from '@/components/icons'
import { isTypingTarget } from '@/lib/space-playback'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import { studioClipTickWindow, studioSongBeats } from '@/lib/studio/midi/time'
import { studioSequence } from '@/lib/studio/model/sequences'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'
import { studioMidiSound, studioMidiSoundWords, } from '../record/midi/studio-midi-sound'
import { FitWidth, ZoomIn, ZoomOut } from '../studio-icons'
import common from '../StudioPage.module.css'
import { studioClipTakeName } from '../timeline/StudioTimelineClip'
import { studioTrackColor, studioTrackHue } from '../timeline/track-hues'
import type { StudioNoteEditorState } from './note-editor-state'
import { studioNoteStatusWords } from './note-editor-words'
import styles from './StudioNoteEditor.module.css'
import type { StudioNoteRollControls, StudioNoteRollTransport, } from './StudioNoteRoll'
import { StudioNoteRoll } from './StudioNoteRoll'

export interface StudioNoteEditorProps {
  state: StudioNoteEditorState
  clip: StudioClip
  project: StudioProject
  assets: readonly StudioAsset[]
  phone: boolean
  tablet: boolean
  transport: StudioNoteRollTransport
}

/** The drawer's least height, and how much of the arrangement it takes on its own. */
export const STUDIO_NOTE_EDITOR_MIN_HEIGHT = 220
const AUTO_SHARE = 0.56
const AUTO_MOST = 560
/** The ruler and one lane stay in view over a drawer at its tallest. */
const LANES_LEFT = 36 + 64
const RESIZE_STEP = 16

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
  const automatic = () => Math.min(AUTO_MOST, Math.round(room() * AUTO_SHARE))
  const height = () => {
    const wanted = dragged() ?? props.state.height() ?? automatic()
    return Math.round(
      Math.max(STUDIO_NOTE_EDITOR_MIN_HEIGHT, Math.min(tallest(), wanted)),
    )
  }

  function close(): void {
    props.state.close()
  }

  function keyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || isTypingTarget(event.target)) return
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
            <p class={styles.sound}>{soundWords()}</p>
          </div>
        </div>
        <span class={styles.chip}>
          {sound() === 'drums' ? 'MIDI · KIT' : 'MIDI · PIANO'}
        </span>
        <div class={styles.tools} data-studio-note-tools="" />
        <div class={styles.actions}>
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
            controls={(value) => (controls = value)}
          />
        )}
      </Show>
      <div class={styles.status}>
        <span class={styles.statusWords} data-studio-note-status="">
          {status()}
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
