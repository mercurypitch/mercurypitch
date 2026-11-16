// ============================================================
// Studio new lane — New lane's three choices, an Audio lane for takes or a Piano or Drums lane with an empty clip to draw in; and the row under the lanes that holds them, where a dragged clip is dropped for a lane of its own
// ============================================================
//
// A computer and a tablet offer them in the row under the lanes. A phone
// has no room for that row, and adds its lanes from Add takes, where the
// same three choices stand (StudioSourcePicker.tsx). Each choice wears its
// instrument's glyph in its family's ink, as the lane it makes will
// (InstrumentGlyph.tsx): beside its word in a computer's narrow header
// column, and as a chip over its word for a finger.
import { For, Show } from 'solid-js'
import type { InstrumentFamilyId, InstrumentGlyphId, } from '@/lib/studio/instruments/glyph-catalog'
import { instrumentFamily } from '@/lib/studio/instruments/glyph-catalog'
import { InstrumentChip, InstrumentGlyph } from '../instruments/InstrumentGlyph'
import styles from './StudioNewLane.module.css'
import timeline from './StudioTimeline.module.css'
import type { StudioNewLaneKind } from './types'

interface NewLaneChoice {
  readonly kind: StudioNewLaneKind
  readonly label: string
  readonly glyph: InstrumentGlyphId
  readonly family: InstrumentFamilyId
  readonly title: string
}

/** New lane's choices, in the order offered. */
export const STUDIO_NEW_LANE_CHOICES: readonly NewLaneChoice[] = [
  {
    kind: 'audio',
    label: 'Audio',
    glyph: 'audio',
    family: 'fx',
    title: 'An empty lane for takes',
  },
  {
    kind: 'piano',
    label: 'Piano',
    glyph: 'grand-piano',
    family: 'keys',
    title: 'A piano lane with an empty clip to draw notes in',
  },
  {
    kind: 'drums',
    label: 'Drums',
    glyph: 'drums',
    family: 'drums',
    title: 'A drum lane with an empty clip to draw hits in',
  },
]

/** The three choices, each a button named "New audio lane" and so on; without `onNewLane`, off. */
export function StudioNewLaneChoices(props: {
  onNewLane?: (kind: StudioNewLaneKind) => void
  /** Finger-sized: each choice its chip over its word. */
  touch?: boolean
}) {
  return (
    <div
      class={styles.choices}
      classList={{ [styles.touch]: props.touch === true }}
      role="group"
      aria-label="New lane"
    >
      <For each={STUDIO_NEW_LANE_CHOICES}>
        {(choice) => (
          <button
            type="button"
            class={styles.choice}
            aria-label={`New ${choice.label.toLowerCase()} lane`}
            title={choice.title}
            disabled={props.onNewLane === undefined}
            data-studio-new-lane-kind={choice.kind}
            onClick={() => props.onNewLane?.(choice.kind)}
          >
            <Show
              when={props.touch === true}
              fallback={
                <span
                  class={styles.glyph}
                  style={{
                    '--chip-hue': `var(--studio-hue-${instrumentFamily(choice.family).hue})`,
                  }}
                >
                  <InstrumentGlyph glyph={choice.glyph} size={16} />
                </span>
              }
            >
              <InstrumentChip
                glyph={choice.glyph}
                family={choice.family}
                size={24}
              />
            </Show>
            <span class={styles.word}>{choice.label}</span>
          </button>
        )}
      </For>
    </div>
  )
}

/** The row under the lanes: New lane's choices in the header column, and where a dragged clip is dropped for a lane of its own. */
export function StudioNewLane(props: {
  onNewLane?: (kind: StudioNewLaneKind) => void
  /** A clip is being dragged: the row is where it gets a lane of its own. */
  dragging: boolean
  tablet: boolean
}) {
  return (
    <div class={timeline.newLane} data-studio-new-lane="">
      <div class={styles.header}>
        <span class={styles.caption} aria-hidden="true">
          New lane
        </span>
        <StudioNewLaneChoices
          onNewLane={props.onNewLane}
          touch={props.tablet}
        />
      </div>
      <span class={timeline.newLaneDrop}>
        <span>
          {props.dragging
            ? 'Drop here to start a new lane'
            : 'Drag a clip here to give it its own lane'}
        </span>
      </span>
    </div>
  )
}
