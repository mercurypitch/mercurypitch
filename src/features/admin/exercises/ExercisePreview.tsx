import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import type { ZenExerciseDefinition } from '@/features/zen/types'
import type { ZenCanvasRenderModel } from '@/features/zen/zen-canvas-renderer'
import { exerciseLoopDuration, fitZenViewport, resolveZenTargets, } from '@/features/zen/zen-model'
import { ZenPitchCanvas } from '@/features/zen/ZenPitchCanvas'
import { midiToNote } from '@/lib/scale-data'
import styles from './ExerciseEditor.module.css'

export interface ExercisePreviewProps {
  value: ZenExerciseDefinition
}

export const ExercisePreview: Component<ExercisePreviewProps> = (props) => {
  const targets = createMemo(() =>
    resolveZenTargets(props.value, props.value.defaultRootMidi),
  )

  const durationSec = createMemo(() => exerciseLoopDuration(props.value))

  const model = createMemo<ZenCanvasRenderModel>(() => {
    const resolved = targets()
    const viewport =
      resolved.length === 0
        ? {
            minMidi: Math.max(0, props.value.defaultRootMidi - 12),
            maxMidi: Math.min(127, props.value.defaultRootMidi + 12),
          }
        : fitZenViewport(
            resolved.flatMap((target) => [target.startMidi, target.endMidi]),
          )
    const duration = durationSec()
    return {
      durationSec: duration,
      elapsedSec:
        props.value.defaultProgressCue === 'playhead' ? duration * 0.42 : 0,
      viewport,
      targets: resolved,
      targetVisibility: props.value.defaultTargetVisibility,
      showPlayhead: props.value.defaultProgressCue === 'playhead',
      points: [],
    }
  })

  const summary = createMemo(() => {
    const root = midiToNote(props.value.defaultRootMidi)
    return `${props.value.title || 'Untitled exercise'} preview. ${
      props.value.targets.length
    } pitch target${
      props.value.targets.length === 1 ? '' : 's'
    }, root ${root.name}${root.octave}, ${durationSec().toFixed(1)} seconds.`
  })

  return (
    <section class={styles.preview} aria-labelledby="exercise-preview-heading">
      <div class={styles.previewHeading}>
        <div>
          <p>Runtime canvas</p>
          <h3 id="exercise-preview-heading">
            {props.value.title || 'Untitled exercise'}
          </h3>
        </div>
        <dl>
          <div>
            <dt>Tempo</dt>
            <dd>{props.value.bpm} BPM</dd>
          </div>
          <div>
            <dt>Loop</dt>
            <dd>{durationSec().toFixed(1)} sec</dd>
          </div>
          <div>
            <dt>Targets</dt>
            <dd>{props.value.defaultTargetVisibility}</dd>
          </div>
        </dl>
      </div>

      <Show when={props.value.defaultTargetVisibility === 'off'}>
        <p class={styles.previewNotice}>
          Target notes are hidden by default. The production canvas is
          intentionally showing the same empty target state singers will see.
        </p>
      </Show>

      <div class={styles.previewCanvas}>
        <ZenPitchCanvas model={model} summary={summary} />
      </div>

      <div class={styles.previewGuide}>
        <div>
          <span>Goal</span>
          <p>{props.value.goal || 'Add a clear practice goal.'}</p>
        </div>
        <div>
          <span>How to sing it</span>
          <p>
            {props.value.instructions ||
              'Add the coaching instruction shown before practice.'}
          </p>
        </div>
        <Show when={props.value.pronunciationHint}>
          <div>
            <span>Pronunciation</span>
            <p>{props.value.pronunciationHint}</p>
          </div>
        </Show>
      </div>
    </section>
  )
}
