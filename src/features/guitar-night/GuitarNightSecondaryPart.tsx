// ============================================================
// The other part, in the corner
// ============================================================
//
// Asked for 2026-08-19: "we can also try to do similar thing but in the
// fretboard/highway views, where you see 1 other in some corner, smaller...
// And then you can maybe swap between the two easily, by tapping."
//
// So it is a small tab strip of one other part, on the same playhead as the
// stage behind it, and tapping it reads that part instead. The window logic is
// the stage's own — a second implementation would drift a beat from the first
// and the drift would look like a timing bug.

import type { Accessor, Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import styles from './GuitarNightApp.module.css'
import type { TabWindowEntry } from './GuitarNightStage'
import { buildStageTabWindowIndex, tabWindowEntries } from './GuitarNightStage'
import type { SheetLane } from './sheet/sheet-model'

/**
 * A shorter window than the main stage. The corner has less room, and this part
 * is glanced at rather than read, so it shows where the line is going rather
 * than every note on the way.
 */
export const SECONDARY_PART_WINDOW_BEATS = 6

export interface GuitarNightSecondaryPartProps {
  lane: Accessor<SheetLane>
  playheadBeat: Accessor<number>
  /** Tapping the strip reads this part instead. Absent leaves it a display. */
  onSwap?: (trackId: string) => void
}

export const GuitarNightSecondaryPart: Component<
  GuitarNightSecondaryPartProps
> = (props) => {
  const windowIndex = createMemo(() =>
    buildStageTabWindowIndex(props.lane().notes as readonly GuitarNote[]),
  )
  const entries = createMemo(() =>
    tabWindowEntries(
      windowIndex(),
      props.playheadBeat(),
      SECONDARY_PART_WINDOW_BEATS,
    ),
  )
  const byString = createMemo(() => {
    const rows: TabWindowEntry[][] = props.lane().tuning.labels.map(() => [])
    for (const entry of entries()) {
      const row = rows[entry.note.stringIndex]
      if (row !== undefined) row.push(entry)
    }
    return rows
  })

  const summary = createMemo(() => {
    const active = entries().filter((entry) => entry.isActive).length
    return active === 0
      ? `${props.lane().trackName}, resting`
      : `${props.lane().trackName}, ${active === 1 ? '1 note' : `${active} notes`} sounding`
  })

  const strip = (
    <div class={styles.secondaryPartStrip} aria-hidden="true">
      <i class={styles.secondaryPartPlayhead} />
      <For each={props.lane().tuning.labels}>
        {(label, stringIndex) => (
          <div class={styles.secondaryPartString}>
            <span>{label}</span>
            <i />
            <div>
              <For each={byString()[stringIndex()] ?? []}>
                {(entry) => (
                  <b
                    classList={{
                      [styles.secondaryPartNoteActive ?? '']: entry.isActive,
                      [styles.secondaryPartNotePast ?? '']: entry.isPast,
                    }}
                    style={{ left: `${entry.offsetPercent}%` }}
                  >
                    {entry.note.fret}
                  </b>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  )

  return (
    <div class={styles.secondaryPart} data-testid="guitar-night-secondary-part">
      <Show
        when={props.onSwap !== undefined}
        fallback={
          <div
            class={styles.secondaryPartBody}
            role="img"
            aria-label={summary()}
          >
            <strong>{props.lane().trackName}</strong>
            {strip}
          </div>
        }
      >
        <button
          type="button"
          class={styles.secondaryPartBody}
          aria-label={`Read ${props.lane().trackName} instead`}
          title={`Read ${props.lane().trackName} instead`}
          onClick={() => props.onSwap?.(props.lane().trackId)}
        >
          <strong>{props.lane().trackName}</strong>
          {strip}
        </button>
      </Show>
    </div>
  )
}
