// Studio clip toolbar — the selected clip's name and commands, floating at the timeline's foot like zoom,
// or stacked as icons in the dock beside the arrangement while the desk is open. The dock has room for
// its seven icons only (dockColumns, StudioTimeline.tsx), so Range and a loop take's pass list stay on
// the floating bar: with the desk open, a range is drawn on the ruler instead. So does Comp, which
// opens a loop take's passes under its lane (StudioCompLanes.tsx). The floating bar folds to icons
// when its names would run into zoom (clip-bar-fold.ts).
import { createEffect, For, onCleanup, onMount, Show } from 'solid-js'
import { Copy, Split, Trash2 } from '@/components/icons'
import { studioClipPass } from '@/lib/studio/model/clip-passes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip } from '@/lib/studio/model/types'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import { studioTakeRunning } from '../record/take-running'
import { CompPasses, InfoCircle, RangeBrackets } from '../studio-icons'
import { fitClipBar, watchClipBarRoom } from './clip-bar-fold'
import { STUDIO_COMP_HELD_TITLE, studioCompClipId, studioCompHeld, toggleStudioComp, } from './comp-editor'
import compStyles from './StudioCompLanes.module.css'
import styles from './StudioTimeline.module.css'
import { clipEndFrame } from './timeline-geometry'

interface StudioClipToolbarProps {
  clip: StudioClip
  playheadFrame: number
  /** The frame heard this moment: a split while the song plays cuts there. */
  frameNow?(): number
  writable: boolean
  /** The selected clip's track name and hue, so the bar says what it acts on. */
  label: string
  color?: string
  /** Offsets inside the timeline: past the lane headers, above the scrollbar. */
  left: number
  bottom: number
  /** In the dock beside the arrangement: icons only, the name kept for assistive tech. */
  docked?: boolean
  onCommand(command: StudioCommand): boolean
  /** Set the ruler's range to this clip, for Repeat and Punch. */
  onRange?(range: StudioFrameRange): void
  onDetails(): void
  onRemove(): void
}

/** A loop take's passes: which one the clip plays, picked from a list; a comp plays several. */
function PassPicker(props: {
  clip: StudioClip
  writable: boolean
  onCommand(command: StudioCommand): boolean
}) {
  const pass = () => studioClipPass(props.clip)
  return (
    <Show when={pass()}>
      {(shown) => (
        <label class={styles.toolbarPass} title="The pass this clip plays">
          <span class={styles.toolbarText}>Pass</span>
          <select
            aria-label="Pass this clip plays"
            data-studio-pass-picker=""
            disabled={!props.writable}
            value={props.clip.comp ? 'comp' : shown().number - 1}
            onChange={(event) =>
              props.onCommand({
                type: 'choose-pass',
                clipId: props.clip.id,
                pass: Number(event.currentTarget.value),
              })
            }
          >
            <Show when={props.clip.comp}>
              <option value="comp" disabled>
                Comped
              </option>
            </Show>
            <For each={Array.from({ length: shown().count }, (_, i) => i)}>
              {(index) => (
                <option value={index}>
                  {`${index + 1} of ${shown().count}`}
                </option>
              )}
            </For>
          </select>
        </label>
      )}
    </Show>
  )
}

export function StudioClipToolbar(props: StudioClipToolbarProps) {
  const canSplit = () =>
    props.playheadFrame > props.clip.startFrame &&
    props.playheadFrame < clipEndFrame(props.clip)
  let bar: HTMLDivElement | undefined
  // Another clip, lane name or pass list changes the bar's width.
  createEffect(() => {
    void props.clip
    void props.label
    if (bar && props.docked !== true) fitClipBar(bar)
  })
  onMount(() => {
    if (bar && props.docked !== true) onCleanup(watchClipBarRoom(bar))
  })
  return (
    <div
      ref={bar}
      class={styles.toolbar}
      classList={{ [styles.toolbarDocked]: props.docked === true }}
      role="toolbar"
      aria-label="Selected clip"
      aria-orientation={props.docked === true ? 'vertical' : undefined}
      style={
        props.docked === true
          ? { '--studio-track': props.color }
          : {
              left: `${props.left}px`,
              bottom: `${props.bottom}px`,
              '--studio-track': props.color,
            }
      }
    >
      <span class={styles.toolbarLabel}>
        <span class={styles.toolbarText}>{props.label}</span>
      </span>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        disabled={!props.writable || !canSplit()}
        title={
          canSplit()
            ? 'Split at playhead (S)'
            : 'Move the playhead over the clip'
        }
        onClick={() =>
          props.onCommand({
            type: 'split-clip',
            clipId: props.clip.id,
            atFrame: props.frameNow?.() ?? props.playheadFrame,
            newClipId: globalThis.crypto.randomUUID(),
          })
        }
      >
        <Split size={15} />
        <span class={styles.toolbarText}>Split</span>
      </button>
      <button
        type="button"
        disabled={!props.writable}
        title="Duplicate after this clip"
        onClick={() =>
          props.onCommand({
            type: 'duplicate-clip',
            clipId: props.clip.id,
            newClipId: globalThis.crypto.randomUUID(),
            newTrackId: globalThis.crypto.randomUUID(),
          })
        }
      >
        <Copy size={15} />
        <span class={styles.toolbarText}>Duplicate</span>
      </button>
      <Show when={props.docked !== true && props.onRange}>
        {(setRange) => (
          <button
            type="button"
            title={
              studioTakeRunning()
                ? 'Stop the take to change the range'
                : 'Set the range to this clip, for Repeat and Punch'
            }
            disabled={studioTakeRunning()}
            onClick={() =>
              setRange()({
                startFrame: props.clip.startFrame,
                endFrame: clipEndFrame(props.clip),
              })
            }
          >
            <RangeBrackets size={15} />
            <span class={styles.toolbarText}>Range</span>
          </button>
        )}
      </Show>
      <Show when={props.docked !== true}>
        <PassPicker
          clip={props.clip}
          writable={props.writable}
          onCommand={(command) => props.onCommand(command)}
        />
      </Show>
      <Show when={props.docked !== true && props.clip.passes}>
        <button
          type="button"
          class={compStyles.toggle}
          data-tour="studio.comp"
          data-studio-comp-toggle=""
          aria-pressed={studioCompClipId() === props.clip.id}
          disabled={!props.writable || studioCompHeld()}
          title={
            studioCompHeld()
              ? STUDIO_COMP_HELD_TITLE
              : studioCompClipId() === props.clip.id
                ? 'Close the passes'
                : 'Pick the best stretch of each pass'
          }
          onClick={() => toggleStudioComp(props.clip.id)}
        >
          <CompPasses size={15} />
          <span class={styles.toolbarText}>Comp</span>
        </button>
      </Show>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        disabled={!props.writable}
        title="Delete clip. Undo brings it back."
        onClick={() => {
          if (props.onCommand({ type: 'remove-clip', clipId: props.clip.id }))
            props.onRemove()
        }}
      >
        <Trash2 />
        <span class={styles.toolbarText}>Delete</span>
      </button>
      <span class={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        title="Exact start, trim, fades and gain"
        onClick={() => props.onDetails()}
      >
        <InfoCircle size={15} />
        <span class={styles.toolbarText}>Details</span>
      </button>
    </div>
  )
}
