// Melody ribbon — passive contour geometry shared by optional practice and core-judged adventure encounters.

import { createMemo, createUniqueId, For, Show } from 'solid-js'
import type { CompiledMelody } from '../core/melody-contour'
import type { MelodyJudgeSnapshot } from '../core/melody-judge'
import styles from './MelodyRibbon.module.css'

const VIEW_WIDTH = 720
const VIEW_HEIGHT = 220
const HORIZONTAL_PADDING = 34
const VERTICAL_PADDING = 28

interface RibbonPoint {
  x: number
  y: number
}

interface RibbonGeometry {
  paths: readonly string[]
  anchors: readonly RibbonPoint[]
  midiToY(midi: number): number
  timeToX(timeSeconds: number): number
}

export interface MelodyRibbonProps {
  contour: CompiledMelody
  judge?: MelodyJudgeSnapshot | null
  pitch?: number | null
  timelineSeconds?: number
  compact?: boolean
  complete?: boolean
}

function ribbonGeometry(contour: CompiledMelody): RibbonGeometry {
  const pitchMiddle = (contour.minimumMidi + contour.maximumMidi) / 2
  const pitchSpan = Math.max(3, contour.maximumMidi - contour.minimumMidi + 2.5)
  const usableWidth = VIEW_WIDTH - HORIZONTAL_PADDING * 2
  const usableHeight = VIEW_HEIGHT - VERTICAL_PADDING * 2
  const timeToX = (timeSeconds: number): number =>
    HORIZONTAL_PADDING +
    (Math.max(0, Math.min(contour.durationSeconds, timeSeconds)) /
      contour.durationSeconds) *
      usableWidth
  const midiToY = (midi: number): number =>
    VIEW_HEIGHT / 2 - ((midi - pitchMiddle) / pitchSpan) * usableHeight
  const paths: string[] = []
  let points: RibbonPoint[] = []
  const finishPath = (): void => {
    if (points.length === 0) return
    paths.push(
      points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(' '),
    )
    points = []
  }
  for (const sample of contour.samples) {
    if (sample.midi === null) {
      finishPath()
      continue
    }
    points.push({ x: timeToX(sample.timeSeconds), y: midiToY(sample.midi) })
  }
  finishPath()
  return {
    paths,
    anchors: contour.anchors.map((anchor) => ({
      x: timeToX(anchor.completedAtSeconds),
      y: midiToY(anchor.midi),
    })),
    midiToY,
    timeToX,
  }
}

export function MelodyRibbon(props: MelodyRibbonProps) {
  const clipId = createUniqueId()
  const geometry = createMemo(() => ribbonGeometry(props.contour))
  const timelineSeconds = () =>
    Math.max(
      0,
      Math.min(props.contour.durationSeconds, props.timelineSeconds ?? 0),
    )
  const progressX = createMemo(() => geometry().timeToX(timelineSeconds()))
  const progressPercent = createMemo(() =>
    Math.round((timelineSeconds() / props.contour.durationSeconds) * 100),
  )
  const livePoint = createMemo(() => {
    if (props.pitch === null || props.pitch === undefined) return null
    return {
      x: geometry().timeToX(timelineSeconds()),
      y: geometry().midiToY(props.pitch),
    }
  })
  const targetPoint = createMemo(() => {
    if (props.judge === null || props.judge === undefined) return null
    return {
      x: geometry().timeToX(timelineSeconds()),
      y: geometry().midiToY(props.judge.targetMidi),
    }
  })

  return (
    <div
      class={styles.ribbonFrame}
      data-compact={props.compact === true}
      data-complete={props.complete === true}
    >
      <svg
        class={styles.ribbon}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label="Melody ribbon. The lit portion shows how far you have travelled."
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x="0"
              y="0"
              width={Math.max(0, progressX())}
              height={VIEW_HEIGHT}
            />
          </clipPath>
        </defs>
        <g class={styles.guideLines} aria-hidden="true">
          <path
            d={`M${HORIZONTAL_PADDING} 70H${VIEW_WIDTH - HORIZONTAL_PADDING}`}
          />
          <path
            d={`M${HORIZONTAL_PADDING} 150H${VIEW_WIDTH - HORIZONTAL_PADDING}`}
          />
        </g>
        <g class={styles.ribbonShadow} aria-hidden="true">
          <For each={geometry().paths}>{(path) => <path d={path} />}</For>
        </g>
        <g
          class={styles.ribbonGlow}
          clip-path={`url(#${clipId})`}
          aria-hidden="true"
        >
          <For each={geometry().paths}>{(path) => <path d={path} />}</For>
        </g>
        <g class={styles.anchorMarks} aria-hidden="true">
          <For each={geometry().anchors}>
            {(point) => <circle cx={point.x} cy={point.y} r="5" />}
          </For>
        </g>
        <Show when={targetPoint()}>
          {(point) => (
            <circle
              class={styles.target}
              cx={point().x}
              cy={point().y}
              r="12"
              aria-hidden="true"
            />
          )}
        </Show>
        <Show when={livePoint()}>
          {(point) => (
            <circle
              class={styles.livePitch}
              cx={point().x}
              cy={point().y}
              r="7"
              aria-hidden="true"
            />
          )}
        </Show>
      </svg>
      <div
        class={styles.progress}
        role="progressbar"
        aria-label="Melody progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent()}
      >
        <span style={{ width: `${progressPercent()}%` }} />
      </div>
    </div>
  )
}
