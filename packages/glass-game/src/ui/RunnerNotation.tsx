// ============================================================
// Song runner notation — responsive SVG drawn from shared runner geometry.
// ============================================================

import { createMemo, createUniqueId, For, Show } from 'solid-js'
import type { RunnerTargetSnapshot } from '../runner/contracts'
import type { RunnerNotationNote } from '../runner/notation'
import { layoutRunnerNotation } from '../runner/notation'
import { RunnerPitchReadout } from './RunnerPitchReadout'
import styles from './SongRunnerView.module.css'

interface RunnerNotationProps {
  notes: readonly RunnerNotationNote[]
  activeNoteIndex: number | null
  instruction: string
  target: RunnerTargetSnapshot | null
}

export function RunnerNotation(props: RunnerNotationProps) {
  const clipPrefix = createUniqueId()
  const layout = createMemo(() =>
    layoutRunnerNotation(props.notes, {
      activeNoteIndex: props.activeNoteIndex,
    }),
  )
  const summary = createMemo(() =>
    layout()
      .notes.map((note) => note.label)
      .join(', '),
  )

  return (
    <section
      class={styles.notationPanel}
      classList={{ [styles.withPitchReadout]: props.target !== null }}
      aria-label="Current melody"
    >
      <Show
        when={props.target}
        fallback={
          <div class={styles.notationHeading}>
            <strong>{props.instruction}</strong>
          </div>
        }
      >
        {(target) => <RunnerPitchReadout target={target()} />}
      </Show>
      <svg
        class={styles.staff}
        viewBox={`0 0 ${layout().width} ${layout().height}`}
        role="img"
        aria-label={summary() ? `Notes: ${summary()}` : 'Five-line music staff'}
      >
        <g class={styles.staffLines} aria-hidden="true">
          <For each={layout().staff.lineYs}>
            {(y) => (
              <line
                x1={layout().staff.left}
                x2={layout().staff.right}
                y1={y}
                y2={y}
              />
            )}
          </For>
        </g>
        <text
          class={styles.clef}
          x={layout().staff.left + 5}
          y={layout().staff.lineYs[3] + 3}
          aria-hidden="true"
        >
          G
        </text>
        <Show when={layout().staff.octaveLabel}>
          {(label) => (
            <text
              class={styles.octaveClef}
              x={layout().staff.left + 17}
              y={
                layout().staff.octaveShift < 0
                  ? layout().staff.lineYs[4] + 16
                  : layout().staff.lineYs[0] - 5
              }
              text-anchor="middle"
              aria-hidden="true"
            >
              {label()}
            </text>
          )}
        </Show>
        <For each={layout().notes}>
          {(note) => {
            const clipId = `${clipPrefix}-${note.index}`
            const headWidth = 21
            const headHeight = 14
            const fillHeight = headHeight * note.fillProgress
            const stemTop =
              note.stemDirection === 'up' ? note.endY - 35 : note.endY
            const stemBottom =
              note.stemDirection === 'down' ? note.endY + 35 : note.endY
            return (
              <g
                class={styles.note}
                classList={{ [styles.activeNote]: note.active }}
                data-state={note.state}
              >
                <Show
                  when={
                    note.connection === 'glide' &&
                    Math.abs(note.startY - note.endY) > 0.01
                  }
                >
                  <path
                    class={styles.glide}
                    d={`M ${note.startX} ${note.startY} C ${(note.startX + note.endX) / 2} ${note.startY}, ${(note.startX + note.endX) / 2} ${note.endY}, ${note.endX} ${note.endY}`}
                  />
                </Show>
                <For each={note.ledgerLineYs}>
                  {(y) => (
                    <line
                      class={styles.ledger}
                      x1={note.x - 17}
                      x2={note.x + 17}
                      y1={y}
                      y2={y}
                    />
                  )}
                </For>
                <Show when={note.stemDirection !== null}>
                  <line
                    class={styles.stem}
                    x1={note.x + (note.stemDirection === 'up' ? 9 : -9)}
                    x2={note.x + (note.stemDirection === 'up' ? 9 : -9)}
                    y1={stemTop}
                    y2={stemBottom}
                  />
                </Show>
                <Show when={note.flagCount === 1}>
                  <path
                    class={styles.flag}
                    d={
                      note.stemDirection === 'down'
                        ? `M ${note.x - 9} ${stemBottom} q 17 -3 12 -19`
                        : `M ${note.x + 9} ${stemTop} q 17 5 10 20`
                    }
                  />
                </Show>
                <Show when={note.pitch.accidental === 'sharp'}>
                  <text
                    class={styles.accidental}
                    x={note.x - 25}
                    y={note.endY + 5}
                    aria-hidden="true"
                  >
                    #
                  </text>
                </Show>
                <defs>
                  <clipPath id={clipId}>
                    <ellipse
                      cx={note.x}
                      cy={note.endY}
                      rx={headWidth / 2}
                      ry={headHeight / 2}
                      transform={`rotate(-16 ${note.x} ${note.endY})`}
                    />
                  </clipPath>
                </defs>
                <rect
                  class={styles.noteFill}
                  x={note.x - headWidth / 2 - 2}
                  y={note.endY + headHeight / 2 - fillHeight}
                  width={headWidth + 4}
                  height={fillHeight}
                  clip-path={`url(#${clipId})`}
                />
                <ellipse
                  class={styles.noteHead}
                  cx={note.x}
                  cy={note.endY}
                  rx={headWidth / 2}
                  ry={headHeight / 2}
                  transform={`rotate(-16 ${note.x} ${note.endY})`}
                />
                <Show when={note.dotted}>
                  <circle
                    class={styles.dot}
                    cx={note.x + 17}
                    cy={note.endY}
                    r="2.8"
                  />
                </Show>
                <text
                  class={styles.noteLabel}
                  x={note.x}
                  y={layout().labelY}
                  text-anchor="middle"
                >
                  {note.label}
                </text>
              </g>
            )
          }}
        </For>
      </svg>
    </section>
  )
}
