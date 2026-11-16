// Studio clip details — numeric alternatives to move, trim and source-anchored fades, and a loop take's passes; a MIDI clip's notes open from here, and save as a MIDI file.
import { createEffect, createSignal, on, Show } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import { studioClipSourceBounds } from '@/lib/studio/model/clip-passes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { FileDown, NoteBars } from '../studio-icons'
import { studioTrimTail } from '../timeline/gesture-draft'
import { StudioClipPasses } from './StudioClipPasses'
import { StudioNumberField } from './StudioNumberField'

interface StudioClipDetailsProps {
  clip: StudioClip
  asset: StudioAsset
  writable: boolean
  onCommand(command: StudioCommand): boolean
  /** Open a MIDI clip's notes in the note editor. */
  onEditNotes?(): void
  /** Save a MIDI clip's notes alone as a MIDI file: whether its download was asked for. */
  onExportMidi?(): boolean
}

// Preserve the exact displayed source bounds even for a one-frame clip.
const seconds = (frames: number) => frames / 48_000
const frames = (value: number) => Math.round(value * 48_000)

export function StudioClipDetails(props: StudioClipDetailsProps) {
  // What became of the last Export MIDI, until another clip is shown.
  const [saved, setSaved] = createSignal<boolean | null>(null)
  createEffect(
    on(
      () => props.clip.id,
      () => setSaved(null),
      { defer: true },
    ),
  )
  const duration = () => props.clip.sourceOutFrame - props.clip.sourceInFrame
  // A loop take's clip trims inside its pass, and a MIDI clip's end past its
  // audio, growing its sequence (clip-passes.ts).
  const bounds = () =>
    studioClipSourceBounds(props.clip, props.asset.normalizedFrameCount)
  const fadeIn = () =>
    Math.max(
      0,
      Math.min(
        duration(),
        (props.clip.fades.in?.toSourceFrame ?? 0) - props.clip.sourceInFrame,
      ),
    )
  const fadeOut = () =>
    props.clip.fades.out
      ? Math.max(
          0,
          Math.min(
            duration(),
            props.clip.sourceOutFrame - props.clip.fades.out.fromSourceFrame,
          ),
        )
      : 0
  const fadeLimit = (kind: 'in' | 'out') =>
    Math.max(
      0,
      Math.min(
        duration(),
        kind === 'in'
          ? (props.clip.fades.out?.fromSourceFrame ??
              props.clip.sourceOutFrame) - props.clip.sourceInFrame
          : props.clip.sourceOutFrame -
              (props.clip.fades.in?.toSourceFrame ?? props.clip.sourceInFrame),
      ),
    )

  function setFade(kind: 'in' | 'out', value: number): boolean {
    const length = frames(value)
    if (!Number.isSafeInteger(length) || length < 0 || length > fadeLimit(kind))
      return false
    const next = { ...props.clip.fades }
    if (length === 0) delete next[kind]
    else
      next[kind] =
        kind === 'in'
          ? {
              fromSourceFrame: props.clip.sourceInFrame,
              toSourceFrame: props.clip.sourceInFrame + length,
            }
          : {
              fromSourceFrame: props.clip.sourceOutFrame - length,
              toSourceFrame: props.clip.sourceOutFrame,
            }
    return props.onCommand({
      type: 'set-fades',
      clipId: props.clip.id,
      fades: next,
    })
  }
  return (
    <div class={styles.detailsFields}>
      <p class={styles.detailsName}>
        {props.asset.originalName ??
          (props.clip.midi === undefined ? 'Audio clip' : 'MIDI clip')}
      </p>
      <Show when={props.clip.midi !== undefined && props.onEditNotes}>
        {(edit) => (
          <>
            <div class={styles.detailsActions}>
              <button
                type="button"
                class={styles.primaryButton}
                aria-keyshortcuts="E"
                data-studio-edit-notes=""
                onClick={() => edit()()}
              >
                <NoteBars size={16} />
                Edit notes
              </button>
              <Show when={props.onExportMidi}>
                {(save) => (
                  <button
                    type="button"
                    class={styles.button}
                    data-studio-export-clip-midi=""
                    onClick={() => setSaved(save()())}
                  >
                    <FileDown size={16} />
                    Export MIDI
                  </button>
                )}
              </Show>
            </div>
            <p class={styles.help}>
              {props.onExportMidi
                ? "Edit notes opens the clip's notes under the lanes; a double-click on the clip, or E, opens them too. Export MIDI saves them as a .mid file."
                : "Opens the clip's notes under the lanes. A double-click on the clip, or E, opens them too."}
            </p>
            <Show when={saved() !== null}>
              <p
                role={saved() === true ? 'status' : 'alert'}
                class={saved() === true ? styles.help : styles.inlineError}
              >
                {saved() === true
                  ? 'Download requested. Your browser handles the file.'
                  : 'The MIDI file could not be made. Try Export MIDI again.'}
              </p>
            </Show>
            <div class={styles.fieldDivider} />
          </>
        )}
      </Show>
      <StudioNumberField
        label="Start"
        unit="s"
        value={seconds(props.clip.startFrame)}
        min={0}
        max={seconds(Number.MAX_SAFE_INTEGER - duration())}
        disabled={!props.writable}
        onCommit={(value) =>
          props.onCommand({
            type: 'move-clip',
            clipId: props.clip.id,
            trackId: props.clip.trackId,
            startFrame: frames(value),
          })
        }
      />
      <StudioNumberField
        label="Trim start"
        unit="s"
        value={seconds(props.clip.sourceInFrame)}
        min={seconds(
          Math.max(
            bounds().first,
            props.clip.sourceInFrame - props.clip.startFrame,
          ),
        )}
        max={seconds(props.clip.sourceOutFrame - 1)}
        disabled={!props.writable}
        onCommit={(value) =>
          props.onCommand({
            type: 'trim-head',
            clipId: props.clip.id,
            sourceInFrame: frames(value),
          })
        }
      />
      <StudioNumberField
        label="Trim end"
        unit="s"
        value={seconds(props.clip.sourceOutFrame)}
        min={seconds(props.clip.sourceInFrame + 1)}
        max={seconds(bounds().end)}
        disabled={!props.writable}
        onCommit={(value) =>
          props.onCommand(studioTrimTail(props.clip, frames(value)))
        }
      />
      <div class={styles.fieldDivider} />
      <StudioNumberField
        label="Fade in"
        unit="s"
        value={seconds(fadeIn())}
        min={0}
        max={seconds(fadeLimit('in'))}
        disabled={!props.writable}
        onCommit={(value) => setFade('in', value)}
      />
      <StudioNumberField
        label="Fade out"
        unit="s"
        value={seconds(fadeOut())}
        min={0}
        max={seconds(fadeLimit('out'))}
        disabled={!props.writable}
        onCommit={(value) => setFade('out', value)}
      />
      <StudioNumberField
        label="Clip gain"
        unit="dB"
        value={props.clip.gainDb}
        min={-60}
        max={24}
        step={0.5}
        disabled={!props.writable}
        onCommit={(value) =>
          props.onCommand({
            type: 'set-clip-gain',
            clipId: props.clip.id,
            gainDb: value,
          })
        }
      />
      <p class={styles.help}>
        Trim values refer to the original take. Your audio stays intact.
      </p>
      <StudioClipPasses {...props} />
    </div>
  )
}
