// Studio clip details — numeric alternatives to move, trim and source-anchored fades.
import styles from '@/features/studio/StudioPage.module.css'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { StudioNumberField } from './StudioNumberField'

interface StudioClipDetailsProps {
  clip: StudioClip
  asset: StudioAsset
  writable: boolean
  onCommand(command: StudioCommand): boolean
}

// Preserve the exact displayed source bounds even for a one-frame clip.
const seconds = (frames: number) => frames / 48_000
const frames = (value: number) => Math.round(value * 48_000)

export function StudioClipDetails(props: StudioClipDetailsProps) {
  const duration = () => props.clip.sourceOutFrame - props.clip.sourceInFrame
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
        {props.asset.originalName ?? 'Audio clip'}
      </p>
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
          Math.max(0, props.clip.sourceInFrame - props.clip.startFrame),
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
        max={seconds(props.asset.normalizedFrameCount)}
        disabled={!props.writable}
        onCommit={(value) =>
          props.onCommand({
            type: 'trim-tail',
            clipId: props.clip.id,
            sourceOutFrame: frames(value),
          })
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
    </div>
  )
}
