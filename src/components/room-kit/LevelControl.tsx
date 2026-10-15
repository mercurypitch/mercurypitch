// ============================================================
// The level control: Learning, Singer or Professional, picked in a room
// ============================================================
//
// A pill in the room's side of the bar (RoomBar.tsx) names the level; a
// tap opens a sheet with the three, each saying what it asks of the
// singer in this exercise (the room's own lines). The level is the
// accuracy tier from Settings (exercise-level.ts): picking one here picks
// it for every exercise, mic preset and score mode included, as Settings
// does, and the sheet says so. Each exercise reads it as its own rules
// (level-preset.ts; Long note's LANTERN_LEVELS). A room shows the pill
// beside "?": at the start and at a result, never while a take listens or
// the demo plays.

import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CheckSmall, ChevronDown, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { EXERCISE_LEVELS, exerciseLevel, exerciseLevelName, setExerciseLevel, } from '@/stores/exercise-level'
import styles from './LevelControl.module.css'

export interface LevelControlProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
  /** What each level asks of the singer in this exercise, one line each. */
  lines: Readonly<Record<ExerciseLevel, string>>
  /** The pill's test id; each level in the sheet is `${testId}-option`. */
  testId: string
}

export function LevelControl(props: LevelControlProps): JSX.Element {
  const [open, setOpen] = createSignal(false)
  const pick = (level: ExerciseLevel): void => {
    setExerciseLevel(level)
    setOpen(false)
  }
  // One box for the pill and the sheet's anchor (Sheet.tsx leaves an empty
  // span in place): in the bar's row the anchor would take a gap of its own.
  return (
    <span class={styles.control}>
      <button
        type="button"
        class={
          props.class === undefined
            ? styles.pill
            : `${styles.pill} ${props.class}`
        }
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Level: ${exerciseLevelName(exerciseLevel())}`}
        data-testid={props.testId}
      >
        {exerciseLevelName(exerciseLevel())}
        <ChevronDown size={12} />
      </button>
      <Sheet isOpen={open()} close={() => setOpen(false)} ariaLabel="Level">
        <div class={styles.head}>
          <div>
            <h2 class={styles.title}>Level</h2>
            <p class={styles.sub}>
              This is the Accuracy Tier from Settings, so your other exercises
              use it too.
            </p>
          </div>
          <button
            type="button"
            class={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X />
          </button>
        </div>
        <div class={styles.levels} role="group" aria-label="Levels">
          <For each={EXERCISE_LEVELS}>
            {(level) => (
              <button
                type="button"
                class={styles.level}
                aria-pressed={exerciseLevel() === level}
                onClick={() => pick(level)}
                data-testid={`${props.testId}-option`}
                data-level={level}
              >
                <span class={styles.levelText}>
                  <span class={styles.levelName}>
                    {exerciseLevelName(level)}
                  </span>
                  <span class={styles.levelLine}>{props.lines[level]}</span>
                </span>
                <span class={styles.mark} aria-hidden="true">
                  <Show when={exerciseLevel() === level}>
                    <CheckSmall size={18} />
                  </Show>
                </span>
              </button>
            )}
          </For>
        </div>
      </Sheet>
    </span>
  )
}
