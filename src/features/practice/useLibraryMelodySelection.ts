import type { Accessor } from 'solid-js'
import { createEffect, on } from 'solid-js'
import type { MelodyData } from '@/types'

/**
 * Mirrors deliberate library selections into a mounted practice surface.
 * The initial selection is ignored so remounting a tab does not overwrite the
 * song that its app-lifetime controller already holds.
 */
export function useLibraryMelodySelection(
  currentMelody: Accessor<MelodyData | null>,
  onSelection: (melody: MelodyData) => void,
): void {
  createEffect(
    on(
      () => currentMelody()?.id,
      () => {
        const melody = currentMelody()
        if (melody !== null && melody.items.length > 0) onSelection(melody)
      },
      { defer: true },
    ),
  )
}
