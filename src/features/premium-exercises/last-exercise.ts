// ============================================================
// The last exercise opened, for the Sing screen's exercise row
// ============================================================
//
// Opening is the choice: an exercise writes its id the moment it opens
// (LongNoteScreen), whether or not a run follows. The exercise history
// keeps only finished runs, so a singer who opened Long note and never
// held a note to a result would otherwise find no way back to it.
//
// Before the first open since this shipped, the newest premium run in the
// exercise history stands in, so a singer who already held a note finds
// their row. The web drill's `long-note` is a different exercise and
// never counts.
//
// On this device only. The `mp_` prefix keeps the key out of the settings
// sync (settings-service.ts syncs `pitchperfect_` keys), like the Karaoke
// room's last song and the Long note demo flag.
//
// Built on first read, not on import, like the Sing room's own settings
// (sing-room-settings.ts): nothing at this module's top level touches
// storage.

import type { Signal } from 'solid-js'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { createPersistedSignal } from '@/lib/storage'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { isPremiumExerciseId } from './ids'

export const LAST_EXERCISE_KEY = 'mp_last_exercise'

let record: Signal<string> | undefined

/**
 * The stored id, '' for none. Not a `null` default: the default reader
 * would JSON.parse the bare id, fail, and read none. An id this build does
 * not know reads as '' too.
 */
function stored(): Signal<string> {
  record ??= createPersistedSignal<string>(LAST_EXERCISE_KEY, '', {
    validator: (value): value is string =>
      value === '' || isPremiumExerciseId(value),
  })
  return record
}

/**
 * The record if it names a known exercise, else the newest run of one.
 * `ranNewestFirst` is the history's exercise types, newest first.
 */
export function chooseLastExercise<Id extends string>(
  recorded: string,
  ranNewestFirst: readonly string[],
  known: (value: unknown) => value is Id,
): Id | null {
  if (known(recorded)) return recorded
  return ranNewestFirst.find(known) ?? null
}

/** The exercise the Sing screen's row offers to open again, or null. */
export function lastExercise(): PremiumExerciseId | null {
  return chooseLastExercise(
    stored()[0](),
    exerciseHistory().map((entry) => entry.type),
    isPremiumExerciseId,
  )
}

export function rememberLastExercise(id: PremiumExerciseId): void {
  stored()[1](id)
}

/** Drop the record read so far: the next read takes storage as it is now. */
export function resetLastExerciseForTests(): void {
  record = undefined
}
