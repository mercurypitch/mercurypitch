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
// The dial answers pitch class; a short row answers octave; the hub says
// what the choice means — the note, its frequency, and where it falls in
// the range this exercise offers, which is the actual question someone
// opens this control to settle.
//
// Geometry and hit-testing live in note-dial-model.ts so they can be
// tested without a browser. The prototype's sharps were unclickable
// because the pointer resolved to the nearest NATURAL by angle; that is
// now a unit test rather than something to notice by eye.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { midiToFrequency, noteToMidi } from '@/lib/frequency-to-note'
import { useNotePreview } from '@/lib/use-note-preview'
import { dialSeats, octavesIn, pitchClassAvailable, rangeBand, rangePosition, resolvePick, seatAtPoint, seatPoint, splitNote, } from './note-dial-model'
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
const VB = 200
const HUB = VB / 2
const R = VB / 2 - 10

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

  const commit = (note: string | null): void => {
    if (note === null || note === props.selected) return
    props.onChange(note)
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
    // not offered, so the octave row never dead-ends.
    commit(
      selectable().includes(candidate)
        ? candidate
        : (selectable().find((n) => splitNote(n)?.octave === octave) ?? null),
    )
  }

  /** Pointer → seat, in unit-dial space relative to the hub. */
  const seatFromEvent = (event: PointerEvent): void => {
    const svg = event.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    const x = ((event.clientX - rect.left) / rect.width) * VB
    const y = ((event.clientY - rect.top) / rect.height) * VB
    const seat = seatAtPoint((x - HUB) / R, (y - HUB) / R, seats)
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
          onPointerDown={seatFromEvent}
          onKeyDown={onKeyDown}
        >
          <circle class={styles.rim} cx={HUB} cy={HUB} r={R} />

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

          <circle class={styles.hub} cx={HUB} cy={HUB} r={R * 0.34} />
          <text class={styles.hubNote} x={HUB} y={HUB - 4}>
            {props.selected}
          </text>
          <Show when={hz()}>
            {(f) => (
              <text class={styles.hubHz} x={HUB} y={HUB + 14}>
                {f().toFixed(1)} Hz
              </text>
            )}
          </Show>
        </svg>

        <div class={styles.side}>
          <Show when={octaves().length > 1}>
            <div class={styles.octaves} role="group" aria-label="Octave">
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
          </Show>
          <p class={styles.readout}>
            <span class={styles.band}>{rangeBand(position())}</span> in this
            range
          </p>
          <div class={styles.meter} aria-hidden="true">
            <i style={{ width: `${(position() * 100).toFixed(1)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
