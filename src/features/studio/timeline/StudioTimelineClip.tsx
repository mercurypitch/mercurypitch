// Studio clip surface — stable focus, viewport-bounded waveforms in the lane's hue and separate pointer handles; a MIDI clip in glass, its notes drawn over its waveform.
//
// Every clip of the song hears every scroll step, so what a step changes is
// a memo of plain arithmetic, and a clip whose drawn span stays the same
// changes nothing. The drawn span snaps outward to a 512 px grid: a clip that
// runs off the edge of the view redraws once per 512 px of scrolling, not on
// every step.
//
// A MIDI clip opens its notes on a double-click with a mouse, and on a
// double tap counted by hand with a finger or a pen (double-tap.ts): its
// own dblclick is left to the mouse, so two taps never open it twice. An
// audio clip's double-click still opens its details.
import { createMemo, Show } from 'solid-js'
import { studioNotePreview } from '@/lib/studio/midi/preview'
import { studioClipTickWindow } from '@/lib/studio/midi/time'
import { studioClipPass } from '@/lib/studio/model/clip-passes'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import type { StudioClipNotes } from './clip-notes'
import { STUDIO_AUDIO_EXTENSION } from './clip-take-name'
import { createStudioDoubleTap } from './double-tap'
import type { StudioGestureKind } from './gesture-draft'
import midiStyles from './StudioMidiClip.module.css'
import styles from './StudioTimeline.module.css'
import { StudioWaveform } from './StudioWaveform'
import { clipEndFrame, formatStudioTime, frameToPixel, pixelToFrame, } from './timeline-geometry'
import type { StudioPointerEditor } from './useStudioPointer'
import type { StudioWaveformResource } from './waveform-resource'

/** The drawn span's grid, in CSS pixels: a scroll redraws a clip once per this much. */
export const STUDIO_WAVE_SPAN_GRID = 512

/** The part of a clip to draw, from its own left edge: the view's part, widened to the grid. */
export function studioWaveSpan(
  clipWidth: number,
  viewFrom: number,
  viewTo: number,
): { from: number; to: number } | null {
  const from = Math.max(0, viewFrom)
  const to = Math.min(clipWidth, viewTo)
  if (to <= from) return null
  return {
    from: Math.floor(from / STUDIO_WAVE_SPAN_GRID) * STUDIO_WAVE_SPAN_GRID,
    to: Math.min(
      clipWidth,
      Math.ceil(to / STUDIO_WAVE_SPAN_GRID) * STUDIO_WAVE_SPAN_GRID,
    ),
  }
}

interface StudioTimelineClipProps {
  clip: StudioClip
  keyboardPreview?: StudioClip | null
  asset?: StudioAsset
  trackName: string
  selected: boolean
  writable: boolean
  phone: boolean
  tablet: boolean
  scale: number
  scroll: number
  contentWidth: number
  /** The lane's colour: its waveform reads the drawn colour again when it changes. */
  color?: string
  pointer: StudioPointerEditor
  resource: StudioWaveformResource
  /** A MIDI clip's notes, drawn in its canvas; absent for an audio clip. */
  notes?: StudioClipNotes
  /** The note editor shows this clip's notes. */
  editing?: boolean
  onSelect(): void
  onDetails(): void
  /** Open a MIDI clip's notes in the editor. */
  onOpenNotes?(): void
}

/** One count of taps for every clip: a tap on another clip starts again. */
const doubleTap = createStudioDoubleTap()

/** The words in a MIDI clip's chip, for the sound its lane plays. */
export function studioMidiChipWords(notes: StudioClipNotes): string {
  return notes.sound === 'drums' ? 'MIDI · KIT' : 'MIDI · PIANO'
}

export function StudioTimelineClip(props: StudioTimelineClipProps) {
  const ownDraft = createMemo(() => {
    const draft = props.pointer.draft()
    return draft?.clip.id === props.clip.id ? draft : null
  })
  const clip = createMemo(() => {
    const saved = props.clip
    const preview = props.keyboardPreview
    return ownDraft()?.clip ?? (preview?.id === saved.id ? preview : saved)
  })
  const left = createMemo(() => frameToPixel(clip().startFrame, props.scale))
  const right = createMemo(() =>
    frameToPixel(clipEndFrame(clip()), props.scale),
  )
  // The title stays readable at the view's left edge.
  const visibleLeft = createMemo(() => Math.max(left(), props.scroll))
  const span = createMemo(
    () =>
      studioWaveSpan(
        right() - left(),
        props.scroll - left(),
        props.scroll + props.contentWidth - left(),
      ),
    null,
    {
      equals: (before, after) =>
        before?.from === after?.from && before?.to === after?.to,
    },
  )
  const sourceFrame = (pixel: number) =>
    clip().sourceInFrame +
    pixelToFrame(
      pixel,
      props.scale,
      clip().sourceOutFrame - clip().sourceInFrame,
    )
  const title = () => props.asset?.originalName ?? props.trackName
  // A loop take's clip says which of its passes plays: "Take 3, pass 2 of 4",
  // or "Take 3, comp of 4 passes" when it plays stretches of several.
  const passOf = () => {
    const pass = studioClipPass(props.clip)
    if (!pass) return ''
    return props.clip.comp
      ? `, comp of ${pass.count} passes`
      : `, pass ${pass.number} of ${pass.count}`
  }
  const handleSize = () => (props.tablet ? 44 : 28)
  const handles = () =>
    !props.phone &&
    props.selected &&
    props.writable &&
    props.asset !== undefined &&
    (right() - left() >= handleSize() * 2 || ownDraft() !== null)
  const fadePosition = (kind: 'in' | 'out') => {
    const source =
      kind === 'in'
        ? (clip().fades.in?.toSourceFrame ?? clip().sourceInFrame)
        : (clip().fades.out?.fromSourceFrame ?? clip().sourceOutFrame)
    return frameToPixel(
      Math.max(
        0,
        Math.min(
          clip().sourceOutFrame - clip().sourceInFrame,
          source - clip().sourceInFrame,
        ),
      ),
      props.scale,
    )
  }
  const fadeHandles = () =>
    handles() &&
    (fadePosition('out') - fadePosition('in') >= handleSize() ||
      ownDraft()?.kind === 'fade-in' ||
      ownDraft()?.kind === 'fade-out')
  const start = (event: PointerEvent, kind: StudioGestureKind) =>
    props.pointer.start(event, props.clip, kind)
  const handleClick = (event: MouseEvent) => {
    event.stopPropagation()
    if (event.detail === 0) props.onDetails()
  }
  // How the last press on the clip came: a mouse double-clicks, a finger taps.
  let pressedWith = 'mouse'
  const midi = () =>
    props.notes !== undefined && props.onOpenNotes !== undefined
  /** The notes the clip's window plays, as many as its lane draws. */
  const noteCount = createMemo(() => {
    const notes = props.notes
    if (notes === undefined) return 0
    const window = studioClipTickWindow(clip(), notes.sequence)
    return studioNotePreview(notes.sequence, window, notes.sound).notes.length
  })
  const countWords = () => {
    const count = noteCount()
    const noun = props.notes?.sound === 'drums' ? 'hit' : 'note'
    return `${count} ${noun}${count === 1 ? '' : 's'}`
  }
  const press = (event: PointerEvent) => {
    pressedWith = event.pointerType
    start(event, 'move')
  }
  const tapped = (event: MouseEvent) => {
    if (props.pointer.suppressClick(event)) {
      doubleTap.reset()
      return
    }
    props.onSelect()
    if (!midi() || pressedWith === 'mouse' || event.detail === 0) return
    const target = props.clip.id
    const tap = { target, x: event.clientX, y: event.clientY }
    if (doubleTap.tap({ ...tap, time: event.timeStamp })) props.onOpenNotes?.()
  }
  const doubleClicked = () => {
    if (!midi()) props.onDetails()
    else if (pressedWith === 'mouse') props.onOpenNotes?.()
  }
  // The hint stands over the middle of the clip's part in view.
  const hintLeft = () => {
    const from = Math.max(left(), props.scroll)
    const to = Math.min(right(), props.scroll + props.contentWidth)
    return (from + to) / 2 - left()
  }
  // Said on a computer or a tablet, while the clip is not being dragged.
  const atRest = () => !props.phone && ownDraft() === null
  const hinted = () =>
    midi() && props.selected && props.editing !== true && atRest()
  const label = () => {
    const name =
      passOf() === ''
        ? title()
        : title().replace(STUDIO_AUDIO_EXTENSION, '') + passOf()
    const notes = midi() ? `, MIDI, ${countWords()}` : ''
    return `${props.trackName}, ${name}${notes}, ${formatStudioTime(clip().startFrame)} to ${formatStudioTime(clipEndFrame(clip()))}`
  }
  return (
    <div
      class={styles.clipShell}
      classList={{
        [styles.draggingClip]: ownDraft() !== null,
        [styles.invalidClip]: ownDraft()?.valid === false,
        [styles.stackedClip]: props.clip.passes !== undefined,
        [midiStyles.midi]: props.notes !== undefined,
      }}
      style={{
        left: `${left()}px`,
        width: `${Math.max(1, right() - left())}px`,
        transform: ownDraft()
          ? `translateY(${props.pointer.offsetY()}px)`
          : undefined,
      }}
    >
      <button
        type="button"
        class={styles.clip}
        classList={{
          [styles.selectedClip]: props.selected,
          [styles.editableClip]:
            props.selected && props.writable && !props.phone,
        }}
        data-studio-clip={props.clip.id}
        data-clip-id={props.clip.id}
        data-midi-clip={props.notes === undefined ? undefined : ''}
        data-editing={props.editing === true ? '' : undefined}
        aria-label={label()}
        aria-keyshortcuts={midi() ? 'E' : undefined}
        aria-pressed={props.selected}
        onPointerDown={press}
        onClick={tapped}
        onDblClick={doubleClicked}
      >
        <Show when={props.notes !== undefined}>
          <span class={midiStyles.sheen} aria-hidden="true" />
        </Show>
        <span
          class={styles.clipTitle}
          classList={{ [midiStyles.band]: props.notes !== undefined }}
          style={{
            'padding-left': `${Math.max(8, visibleLeft() - left() + 8)}px`,
          }}
        >
          <Show
            when={props.notes}
            fallback={title().replace(STUDIO_AUDIO_EXTENSION, '') + passOf()}
          >
            {(notes) => (
              <>
                <span class={midiStyles.name}>
                  {title().replace(STUDIO_AUDIO_EXTENSION, '') + passOf()}
                </span>
                <span class={midiStyles.tags} data-studio-clip-tags>
                  <span class={midiStyles.chip}>
                    {studioMidiChipWords(notes())}
                  </span>
                  <span class={midiStyles.count}>{countWords()}</span>
                  <Show when={props.editing === true}>
                    <span class={midiStyles.editing}>Editing</span>
                  </Show>
                </span>
              </>
            )}
          </Show>
        </span>
        <Show when={span()}>
          {(drawn) => (
            <span
              class={styles.visibleWave}
              style={{
                left: `${drawn().from}px`,
                width: `${drawn().to - drawn().from}px`,
              }}
            >
              <StudioWaveform
                clip={clip()}
                asset={props.asset}
                resource={props.resource}
                width={drawn().to - drawn().from}
                color={props.color}
                notes={props.notes}
                sourceInFrame={sourceFrame(drawn().from)}
                sourceOutFrame={sourceFrame(drawn().to)}
              />
            </span>
          )}
        </Show>
      </button>
      <Show when={hinted()}>
        <span
          class={midiStyles.hint}
          aria-hidden="true"
          style={{ left: `${hintLeft()}px` }}
        >
          {props.tablet
            ? 'Tap twice to edit notes'
            : 'Double-click to edit notes'}
        </span>
      </Show>
      <Show when={handles()}>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.trimHead}`}
          aria-label="Trim start"
          title="Trim start. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'trim-head')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.trimTail}`}
          aria-label="Trim end"
          title="Trim end. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'trim-tail')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
      </Show>
      <Show when={fadeHandles()}>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.fadeHandle}`}
          style={{ left: `${fadePosition('in')}px` }}
          aria-label="Fade in"
          title="Fade in. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'fade-in')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.fadeHandle}`}
          style={{ left: `${fadePosition('out')}px` }}
          aria-label="Fade out"
          title="Fade out. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'fade-out')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
      </Show>
    </div>
  )
}
