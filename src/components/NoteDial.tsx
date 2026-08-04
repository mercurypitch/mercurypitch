// ============================================================
// NoteDial — pick a note, on a dial rather than a wall of pills
// ============================================================
//
// Replaces NotePillSelector, which rendered every semitone in the
// singer's range as a pill: thirty-six of them for a tenor, in one flat
// row. That forced a single list onto two independent decisions — which
// pitch class, and which octave — and the row was the least attractive
// control in the app while being one of the most repeated (seventeen
// call sites).
//
// The dial answers pitch class. The RIM answers octave: it was already
// a gauge showing where the selected note sits in the range, and octave
// is the same axis, so the octave boundaries are ticks on that gauge
// rather than a fact restated by a row of chips beside it. The hub says
// what the choice means — the note, its frequency, and the band it
// falls in.
//
// Geometry and hit-testing live in note-dial-model.ts so they can be
// tested without a browser. The prototype's sharps were unclickable
// because the pointer resolved to the nearest NATURAL by angle; that is
// now a unit test rather than something to notice by eye.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { midiToFrequency, noteToMidi } from '@/lib/frequency-to-note'
import { useNotePreview } from '@/lib/use-note-preview'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import { arcPath, dialSeats, HUB_RADIUS, octaveArcPath, octaveArcs, octaveAtPoint, octavesIn, pitchClassAvailable, polarPoint, rangeBand, rangeEnds, rangePosition, resolvePick, seatAtPoint, seatPoint, splitNote, } from './note-dial-model'
import styles from './NoteDial.module.css'

interface NoteDialProps {
  notes: string[]
  selected: string
  onChange: (note: string) => void
  label?: string
  class?: string
  /** Notes to render greyed-out and non-selectable (e.g. the other endpoint). */
  disabledNotes?: string[]
  /** Play a short reference tone when a note is picked (default on). */
  previewSound?: boolean
}

/** Viewbox is unitless; the CSS decides how big the dial actually is. */
const VB = 224
const HUB = VB / 2
/** Leaves room outside the rim for the octave numerals. */
const R = 90
/** The rim, where both the range sweep and the octave segments live. */
const RIM = R * 0.99
/** How far outside the rim the octave numeral sits. */
const OCTAVE_LABEL_OFFSET = 15
/** Twelve o'clock, matching the model's arc convention. */
const TOP = -Math.PI / 2

/**
 * Above this many octaves the segments get too thin to label, and the
 * chip row is the honest fallback. Every shipped vocal preset spans
 * three, so this is headroom for a caller passing its own note list.
 */
const MAX_RIM_OCTAVES = 6

export const NoteDial: Component<NoteDialProps> = (props) => {
  const preview = useNotePreview(() => props.previewSound !== false)
  const seats = dialSeats()

  const selectable = createMemo(() => {
    const off = new Set(props.disabledNotes ?? [])
    return props.notes.filter((n) => !off.has(n))
  })

  const current = createMemo(() => splitNote(props.selected))
  const octaves = createMemo(() => octavesIn(selectable()))
  const position = createMemo(() =>
    rangePosition(props.selected, selectable(), noteToMidi),
  )

  /** Empty when there is one octave, or too many to label on the rim. */
  const arcs = createMemo(() =>
    octaves().length > MAX_RIM_OCTAVES
      ? []
      : octaveArcs(selectable(), noteToMidi),
  )
  /** The chip row only appears when the rim cannot carry the job. */
  const showChips = createMemo(
    () => octaves().length > 1 && arcs().length === 0,
  )

  const commit = (note: string | null): void => {
    if (note === null) return
    // Re-picking the note you are already on is not a no-op. Half the point
    // of the dial is hearing what you are aiming at, so the tap still plays
    // it — there is just no selection change to report upward.
    if (note !== props.selected) props.onChange(note)
    preview(note)
  }

  const pickClass = (pitchClass: string): void => {
    commit(resolvePick(pitchClass, props.selected, selectable()))
  }

  const pickOctave = (octave: number): void => {
    const pc = current()?.pitchClass
    if (pc === undefined) return
    const candidate = `${pc}${octave}`
    // Fall back to the nearest class in that octave when the exact one is
    // not offered, so an octave target never dead-ends.
    commit(
      selectable().includes(candidate)
        ? candidate
        : (selectable().find((n) => splitNote(n)?.octave === octave) ?? null),
    )
  }

  /**
   * Pointer → octave segment or seat, in unit-dial space.
   *
   * The ring starts outside the outermost seat, so the two hit-tests
   * never have to arbitrate between each other.
   */
  const onPointerDown = (event: PointerEvent): void => {
    const svg = event.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    const x = ((event.clientX - rect.left) / rect.width) * VB
    const y = ((event.clientY - rect.top) / rect.height) * VB
    const ux = (x - HUB) / R
    const uy = (y - HUB) / R

    const arc = octaveAtPoint(ux, uy, arcs())
    if (arc !== null) {
      pickOctave(arc.octave)
      return
    }
    const seat = seatAtPoint(ux, uy, seats)
    if (seat !== null && pitchClassAvailable(seat.pitchClass, selectable())) {
      pickClass(seat.pitchClass)
    }
  }

  const step = (semitones: number): void => {
    const midi = noteToMidi(props.selected)
    if (Number.isNaN(midi)) return
    const ordered = [...selectable()].sort(
      (a, b) => noteToMidi(a) - noteToMidi(b),
    )
    const target = midi + semitones
    // Nearest offered note in the direction travelled.
    const found = ordered.find((n) =>
      semitones > 0 ? noteToMidi(n) >= target : noteToMidi(n) <= target,
    )
    commit(
      semitones > 0
        ? (found ?? null)
        : ([...ordered].reverse().find((n) => noteToMidi(n) <= target) ?? null),
    )
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const by: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowUp: 12,
      ArrowDown: -12,
    }
    const semitones = by[event.key]
    if (semitones === undefined) return
    event.preventDefault()
    step(semitones)
  }

  const hz = createMemo(() => {
    const midi = noteToMidi(props.selected)
    return Number.isNaN(midi) ? null : midiToFrequency(midi)
  })

  const ends = createMemo(() => rangeEnds(selectable(), noteToMidi))
  /** "tenor", "mezzo-soprano" — the preset the notes actually came from. */
  const voiceType = createMemo(() =>
    VOCAL_RANGES[vocalRangePreset()].label.toLowerCase(),
  )
  const sweep = createMemo(() => arcPath(position(), HUB, HUB, RIM))
  /** The head of the sweep — where the selected note actually sits. */
  const marker = createMemo(() => {
    const p = polarPoint(TOP + position() * Math.PI * 2, RIM)
    return { x: HUB + p.x, y: HUB + p.y }
  })

  return (
    <div class={`${styles.dial} ${props.class ?? ''}`}>
      <Show when={props.label != null}>
        <span class={styles.label}>{props.label}</span>
      </Show>

      <div class={styles.body}>
        <svg
          class={styles.face}
          viewBox={`0 0 ${VB} ${VB}`}
          role="group"
          tabindex="0"
          aria-label={`${props.label ?? 'Note'}: ${props.selected}. Left and right arrows change note, up and down change octave.`}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        >
          {/* One plain rim when there is a single octave; otherwise the rim
              IS the octave control, divided in proportion to how much of
              the range each octave holds. */}
          <Show
            when={arcs().length > 0}
            fallback={<circle class={styles.rim} cx={HUB} cy={HUB} r={RIM} />}
          >
            <g aria-hidden="true">
              <For each={arcs()}>
                {(arc) => {
                  const on = () => current()?.octave === arc.octave
                  const label = polarPoint(arc.mid, RIM + OCTAVE_LABEL_OFFSET)
                  return (
                    <>
                      <path
                        classList={{
                          [styles.octaveArc]: true,
                          [styles.octaveArcOn]: on(),
                        }}
                        d={octaveArcPath(arc, HUB, HUB, RIM)}
                      />
                      <text
                        classList={{
                          [styles.octaveLabel]: true,
                          [styles.octaveLabelOn]: on(),
                        }}
                        x={HUB + label.x}
                        y={HUB + label.y}
                      >
                        {arc.octave}
                      </text>
                    </>
                  )
                }}
              </For>
            </g>
          </Show>

          {/* The gauge: 12 o'clock is the bottom of the range and it fills
              clockwise to the selected note, over the octave divisions. */}
          <Show when={sweep() !== ''}>
            <path class={styles.sweep} d={sweep()} />
          </Show>
          <circle
            class={styles.marker}
            cx={marker().x}
            cy={marker().y}
            r={4.2}
          />

          <For each={seats}>
            {(seat) => {
              const p = seatPoint(seat)
              const cx = HUB + p.x * R
              const cy = HUB + p.y * R
              const available = () =>
                pitchClassAvailable(seat.pitchClass, selectable())
              const on = () => current()?.pitchClass === seat.pitchClass
              return (
                <g
                  classList={{
                    [styles.seat]: true,
                    [styles.seatOff]: !available(),
                  }}
                >
                  <circle
                    classList={{
                      [styles.seatRing]: true,
                      [styles.seatSharp]: seat.sharp,
                      [styles.seatOn]: on(),
                    }}
                    cx={cx}
                    cy={cy}
                    r={seat.sharp ? 11 : 14}
                  />
                  <text
                    classList={{
                      [styles.seatLabel]: true,
                      [styles.seatLabelSharp]: seat.sharp,
                      [styles.seatLabelOn]: on(),
                    }}
                    x={cx}
                    y={cy}
                  >
                    {seat.pitchClass}
                  </text>
                </g>
              )
            }}
          </For>

          <circle class={styles.hub} cx={HUB} cy={HUB} r={R * HUB_RADIUS} />
          <text class={styles.hubNote} x={HUB} y={HUB - 7}>
            {props.selected}
          </text>
          <Show when={hz()}>
            {(f) => (
              <text class={styles.hubHz} x={HUB} y={HUB + 14}>
                {f().toFixed(1)} Hz
              </text>
            )}
          </Show>
          <text class={styles.hubBand} x={HUB} y={HUB + 28}>
            {rangeBand(position()).toUpperCase()}
          </text>
        </svg>

        {/* A path is nothing to a screen reader, so the octave segments are
            decoration and this is the real control. Sighted pointer users
            get the rim; everyone else gets a native radio group. */}
        <Show when={arcs().length > 0}>
          <fieldset class={styles.srOnly}>
            <legend>Octave</legend>
            <For each={octaves()}>
              {(octave) => (
                <label>
                  <input
                    type="radio"
                    name={`octave-${props.label ?? 'note'}`}
                    checked={current()?.octave === octave}
                    onChange={() => pickOctave(octave)}
                  />
                  Octave {octave}
                </label>
              )}
            </For>
          </fieldset>
        </Show>

        <Show when={showChips()}>
          <section class={styles.section}>
            <h4 class={styles.sectionLabel}>Octave</h4>
            <div
              class={styles.octaves}
              role="group"
              aria-label="Octave"
              data-testid="octave-chips"
            >
              <For each={octaves()}>
                {(octave) => (
                  <button
                    type="button"
                    class={styles.octave}
                    aria-pressed={current()?.octave === octave}
                    onClick={() => pickOctave(octave)}
                  >
                    {octave}
                  </button>
                )}
              </For>
            </div>
          </section>
        </Show>

        <p class={styles.readout}>
          <b class={styles.readoutNote}>{props.selected}</b>
          <Show when={ends()} fallback={<> is the only note on offer.</>}>
            {(e) => (
              <>
                {' '}
                — {Math.round(position() * 100)}% up your {voiceType()} range (
                {e().low}&ndash;{e().high}).
              </>
            )}
          </Show>
        </p>
      </div>
    </div>
  )
}
