// ============================================================
// The exercise picker: every premium exercise, one card each
// ============================================================
//
// A kit Sheet the Sing room owns, as it owns its song and take sheets. The
// head is the Karaoke library's (a title and a 44 px close); the cards are
// its rows grown to two lines, so a card can say what the exercise is. They
// sit under the library's group headings, one per catalogue group (Pitch,
// Warm-ups), each list named by its heading for a screen reader.
//
// The last exercise opened is marked, not moved: catalogue order stays put,
// so a card is where it was the last time. Beside its name a card names the
// level the exercises are at (the accuracy tier, exercise-level.ts), picked
// in the exercise or in Settings. A card's third line says one thing a
// singer cannot see from its name: that Merc sings it first (only when its
// demo will play by itself), or the best on the note it opens on, or (the
// Warm-up) "Warmed up today" and this week's dots.
//
// A tap closes the sheet and hands the id to the room, which winds down
// whatever is running before the exercise opens over it.

import type { Component } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Volume2 } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { WeekDots } from '@/components/room-kit/WeekDots'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import type { WeekDot } from '@/lib/warm-up-days'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import type { LegendCardWords } from '@/stores/native-shell-store'
import type { CatalogueGroup, PremiumExercise } from './catalogue'
import { catalogueGroups } from './catalogue'
import { LegendGlyph } from './glyphs'
import { lastExercise } from './last-exercise'
import styles from './premium-exercises.module.css'

export interface ExercisePickerProps {
  isOpen: boolean
  close: () => void
  /** A card: the sheet has closed, open this exercise. */
  onPick: (id: PremiumExerciseId) => void
  /**
   * The running Legend's card, over the exercises under a heading of its
   * own (NATIVE_LEAGUES): the shell's words, or null while none is open.
   */
  legend?: LegendCardWords | null
  /** Its card: the sheet has closed, open the Legend. */
  onLegend?: () => void
}

const CloseGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

/**
 * "Best 9.4 s on A3" for a best on a note, "Best 18 of 20" for a best at
 * the card's level; null with no best (or no note to have it on).
 */
function bestLine(exercise: PremiumExercise): string | null {
  const best = exercise.progress()
  if (best === null || !exercise.bestOnNote) return best
  const note = exercise.note()
  return note === null ? null : `${best} on ${note}`
}

const Card: Component<{
  exercise: PremiumExercise
  onPick: (id: PremiumExerciseId) => void
}> = (props) => {
  const current = (): boolean => lastExercise() === props.exercise.id
  const week = (): readonly WeekDot[] | null => props.exercise.week?.() ?? null
  return (
    <li class={styles.cardItem}>
      <button
        type="button"
        class={styles.card}
        classList={{ [styles.cardCurrent]: current() }}
        aria-current={current() ? 'true' : undefined}
        onClick={() => props.onPick(props.exercise.id)}
        data-testid="sing-exercise-card"
        data-exercise={props.exercise.id}
      >
        <span class={styles.cardArt} aria-hidden="true">
          <Dynamic component={props.exercise.Glyph} />
        </span>
        <span class={styles.cardText}>
          <span class={styles.cardHead}>
            <span class={styles.cardTitle}>{props.exercise.name}</span>
            <span class={styles.cardLevel} data-testid="sing-exercise-level">
              {exerciseLevelName(exerciseLevel())}
            </span>
          </span>
          <span class={styles.cardLine}>{props.exercise.line}</span>
          <Show
            when={props.exercise.demoAutoPlays()}
            fallback={
              <Show when={bestLine(props.exercise) !== null || week()}>
                <span class={styles.cardMeta} data-testid="sing-exercise-meta">
                  {bestLine(props.exercise)}
                  <Show when={week()}>
                    {(dots) => (
                      <WeekDots dots={dots()} testId="sing-exercise-week" />
                    )}
                  </Show>
                </span>
              </Show>
            }
          >
            <span class={styles.cardMeta} data-testid="sing-exercise-meta">
              <Volume2 />
              Merc sings it first
            </span>
          </Show>
        </span>
      </button>
    </li>
  )
}

/**
 * The running Legend, above the exercises: a card like theirs, its art lit
 * as the Legend room is, with when it closes where an exercise names its
 * level. The shell words it (native-shell-store.ts, `legend`).
 */
const LegendCard: Component<{
  words: LegendCardWords
  onOpen: () => void
}> = (props) => {
  const headingId = `exercise-group-${createUniqueId()}`
  return (
    <section
      class={styles.group}
      data-testid="sing-exercise-group"
      data-group="legend"
    >
      <h3 id={headingId} class={styles.groupTitle}>
        Legend
      </h3>
      <ul class={styles.cards} aria-labelledby={headingId}>
        <li class={styles.cardItem}>
          <button
            type="button"
            class={`${styles.card} ${styles.cardLegend}`}
            onClick={() => props.onOpen()}
            data-testid="sing-legend-card"
          >
            <span class={styles.cardArt} aria-hidden="true">
              <LegendGlyph />
            </span>
            <span class={styles.cardText}>
              <span class={styles.cardHead}>
                <span class={styles.cardTitle}>{props.words.title}</span>
                <span class={styles.cardLevel}>{props.words.when}</span>
              </span>
              <span class={styles.cardLine}>{props.words.line}</span>
              <Show when={props.words.best}>
                {(best) => <span class={styles.cardMeta}>{best()}</span>}
              </Show>
            </span>
          </button>
        </li>
      </ul>
    </section>
  )
}

/** A heading and its cards; the list is named by the heading. */
const Group: Component<{
  group: CatalogueGroup
  onPick: (id: PremiumExerciseId) => void
}> = (props) => {
  const headingId = `exercise-group-${createUniqueId()}`
  return (
    <section
      class={styles.group}
      data-testid="sing-exercise-group"
      data-group={props.group.id}
    >
      <h3 id={headingId} class={styles.groupTitle}>
        {props.group.title}
      </h3>
      <ul class={styles.cards} aria-labelledby={headingId}>
        <For each={props.group.exercises}>
          {(exercise) => <Card exercise={exercise} onPick={props.onPick} />}
        </For>
      </ul>
    </section>
  )
}

export const ExercisePicker: Component<ExercisePickerProps> = (props) => {
  const pick = (id: PremiumExerciseId): void => {
    props.close()
    props.onPick(id)
  }

  return (
    <Sheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="Exercises"
      snap="content"
    >
      <div class={styles.picker} data-testid="sing-exercise-picker">
        <div class={styles.sheetHead}>
          <h2 class={styles.sheetTitle}>Exercises</h2>
          <button
            type="button"
            class={styles.sheetClose}
            aria-label="Close"
            onClick={() => props.close()}
            data-testid="sing-exercise-close"
          >
            <CloseGlyph />
          </button>
        </div>
        <Show when={props.onLegend === undefined ? null : props.legend}>
          {(words) => (
            <LegendCard
              words={words()}
              onOpen={() => {
                props.close()
                props.onLegend?.()
              }}
            />
          )}
        </Show>
        <For each={catalogueGroups()}>
          {(group) => <Group group={group} onPick={pick} />}
        </For>
      </div>
    </Sheet>
  )
}
