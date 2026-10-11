// ============================================================
// Long note's level — Beginner, Singer or Pro, picked in the room
// ============================================================
//
// A pill in the stage's top-left corner, across from "?", names the
// level; a tap opens a sheet with the three, each saying what it asks of a
// held note here. The level is one setting for every premium exercise
// (exercise-level.ts); Long note reads it as the room around the note and
// the steadiness the lantern's top asks for (LANTERN_LEVELS). The room
// shows the pill where it shows "?": at the start and at a result, never
// while a take listens or the demo plays.

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CheckSmall, ChevronDown, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import type { ExerciseLevel } from '@/lib/exercise-level'
import { EXERCISE_LEVELS, exerciseLevel, exerciseLevelName, setExerciseLevel, } from '@/lib/exercise-level'
import styles from './LongNoteLevel.module.css'

/** What each level asks of a held note in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  beginner:
    'More room around the note. A wobble or a natural vibrato still fills the top.',
  singer: 'A light vibrato fills the top. A wider one fills part of it.',
  pro: 'Less room around the note. Only a near-straight tone fills the top.',
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
        <ChevronDown size={14} />
      </button>
      <Sheet isOpen={open()} close={() => setOpen(false)} ariaLabel="Level">
        <div class={styles.head}>
          <div>
            <h2 class={styles.title}>Level</h2>
            <p class={styles.sub}>One level for every exercise.</p>
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
