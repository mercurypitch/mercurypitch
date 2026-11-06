// ============================================================
// Studio instrument picker — the lane's instrument in Track details: automatic, or chosen from a searchable grid by family
// ============================================================
//
// The instrument is the lane's picture, apart from its role, which picks the
// sound. Automatic draws what the lane's name and role say; a choice is saved
// with the song (set-track-instrument) until the singer goes back to
// automatic. The grid stays folded under the current choice until asked for,
// so Track details keeps its length on a phone.
import { createMemo, createSignal, createUniqueId, For, Show } from 'solid-js'
import { ChevronDown } from '@/components/icons'
import type { InstrumentGlyphId } from '@/lib/studio/instruments/glyph-catalog'
import { INSTRUMENT_FAMILIES, INSTRUMENT_GLYPHS, instrumentGlyph, isInstrumentGlyph, } from '@/lib/studio/instruments/glyph-catalog'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioTrack } from '@/lib/studio/model/types'
import { InstrumentChip } from './InstrumentGlyph'
import styles from './StudioInstrumentPicker.module.css'

interface StudioInstrumentPickerProps {
  track: StudioTrack
  writable: boolean
  onCommand(command: StudioCommand): boolean
}

const searchText = new Map(
  INSTRUMENT_GLYPHS.map((glyph) => {
    const family = INSTRUMENT_FAMILIES.find((f) => f.id === glyph.family)!
    const also = 'also' in glyph ? glyph.also : ''
    return [
      glyph.id,
      `${glyph.label} ${also} ${family.name} ${glyph.id}`.toLowerCase(),
    ]
  }),
)

export function StudioInstrumentPicker(props: StudioInstrumentPickerProps) {
  const listId = createUniqueId()
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const lane = () => studioLaneInstrument(props.track)
  const automatic = () =>
    instrumentGlyph(
      studioLaneInstrument({ name: props.track.name, role: props.track.role })
        .glyph,
    ).label
  const chosen = () =>
    isInstrumentGlyph(props.track.instrument) ? props.track.instrument : null
  const families = createMemo(() => {
    const words = query().trim().toLowerCase().split(/\s+/).filter(Boolean)
    return INSTRUMENT_FAMILIES.map((family) => ({
      family,
      glyphs: INSTRUMENT_GLYPHS.filter(
        (glyph) =>
          glyph.family === family.id &&
          words.every((word) => searchText.get(glyph.id)!.includes(word)),
      ),
    })).filter((group) => group.glyphs.length > 0)
  })

  function choose(instrument: InstrumentGlyphId | null): void {
    if (
      instrument === chosen() ||
      props.onCommand({
        type: 'set-track-instrument',
        trackId: props.track.id,
        instrument,
      })
    ) {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div class={styles.picker}>
      <span class={styles.label} id={`${listId}-label`}>
        Instrument
      </span>
      <button
        type="button"
        class={styles.current}
        aria-expanded={open()}
        aria-controls={listId}
        aria-labelledby={`${listId}-label ${listId}-current`}
        onClick={() => setOpen(!open())}
      >
        <InstrumentChip glyph={lane().glyph} family={lane().family} size={32} />
        <span class={styles.currentText} id={`${listId}-current`}>
          <strong>{instrumentGlyph(lane().glyph).label}</strong>
          <small>
            {chosen() === null ? 'Automatic' : 'Chosen for this track'}
          </small>
        </span>
        <ChevronDown size={16} />
      </button>
      <Show when={open()}>
        <div class={styles.panel} id={listId}>
          <input
            class={styles.search}
            type="search"
            aria-label="Find an instrument"
            placeholder="Find an instrument"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <button
            type="button"
            class={styles.automatic}
            aria-pressed={chosen() === null}
            disabled={!props.writable}
            onClick={() => choose(null)}
          >
            Automatic: {automatic()}
            <small>From the track’s name and part</small>
          </button>
          <For each={families()}>
            {(group) => (
              <section class={styles.family}>
                <h4>{group.family.name}</h4>
                <div class={styles.grid}>
                  <For each={group.glyphs}>
                    {(glyph) => (
                      <button
                        type="button"
                        class={styles.choice}
                        aria-pressed={chosen() === glyph.id}
                        disabled={!props.writable}
                        data-instrument-choice={glyph.id}
                        onClick={() => choose(glyph.id)}
                      >
                        <InstrumentChip
                          glyph={glyph.id}
                          family={group.family.id}
                          size={40}
                        />
                        <span>{glyph.label}</span>
                      </button>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
          <Show when={families().length === 0}>
            <p class={styles.none} role="status">
              No instrument matches “{query().trim()}”.
            </p>
          </Show>
        </div>
      </Show>
    </div>
  )
}
