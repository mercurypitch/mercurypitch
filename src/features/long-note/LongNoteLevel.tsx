// ============================================================
// Long note's level — Learning, Singer or Professional, picked in the room
// ============================================================
//
// A pill in the stage's top-left corner, across from "?", names the
// level; a tap opens a sheet with the three, each saying what it asks of a
// held note here. The level is the accuracy tier from Settings
// (exercise-level.ts): picking one here picks it for every exercise, mic
// preset and score mode included, as Settings does, and the sheet says so.
// Long note reads it as the room around the note and the steadiness the
// lantern's top asks for (LANTERN_LEVELS). The room shows the pill where it
// shows "?": at the start and at a result, never while a take listens or
// the demo plays.

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CheckSmall, ChevronDown, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { EXERCISE_LEVELS, exerciseLevel, exerciseLevelName, setExerciseLevel, } from '@/stores/exercise-level'
import styles from './LongNoteLevel.module.css'

/** What each level asks of a held note in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'More room around the note. A wobble or a natural vibrato still fills the top.',
  singer: 'A light vibrato fills the top. A wider one fills part of it.',
  professional:
    'Less room around the note. Only a near-straight tone fills the top.',
}

export interface LongNoteLevelProps {
  /** The stage's class for the pill, placed by the room. */
  class: string
}

export const LongNoteLevel: Component<LongNoteLevelProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const pick = (level: ExerciseLevel): void => {
    setExerciseLevel(level)
    setOpen(false)
  }
  return (
    <>
      <button
        type="button"
        class={`${styles.pill} ${props.class}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Level: ${exerciseLevelName(exerciseLevel())}`}
        data-testid="long-note-level"
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
                data-testid="long-note-level-option"
                data-level={level}
              >
                <span class={styles.levelText}>
                  <span class={styles.levelName}>
                    {exerciseLevelName(level)}
                  </span>
                  <span class={styles.levelLine}>{LEVEL_LINES[level]}</span>
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
    </>
  )
}
