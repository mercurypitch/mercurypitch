// ============================================================
// Piano key horizon — fixed 88-key stage with a playable phone window
// ============================================================
//
// Desktop preserves the full physical horizon. Phones keep the same DOM
// instrument but expose a two-octave touch window with explicit range steps.

import type { Accessor, JSX } from 'solid-js'
import { createEffect, createSignal, For } from 'solid-js'
import { ChevronLeft } from '@/components/icons'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PianoKey, PianoKeyWindowController } from './piano-key-window'
import { isInKeyWindow, keyCenterPercent, PIANO_KEYS } from './piano-key-window'
import styles from './PianoNightApp.module.css'

interface PianoKeyHorizonProps {
  /**
   * The visible span, owned outside this component because the fall stage has
   * to draw its notes over exactly these keys.
   */
  keyWindow: PianoKeyWindowController
  activeMidis: Accessor<ReadonlySet<number>>
  onPointerDown: (event: PointerEvent, midi: number) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerRelease: (event: PointerEvent) => void
  onKeyboardActivate: (midi: number) => void
}

const WHITE_KEYS = PIANO_KEYS.filter((key) => !key.black)
const BLACK_KEYS = PIANO_KEYS.filter((key) => key.black)

export function PianoKeyHorizon(props: PianoKeyHorizonProps): JSX.Element {
  const [focusedMidi, setFocusedMidi] = createSignal(60)
  let keyboardElement: HTMLDivElement | undefined

  const window = () => props.keyWindow.window()
  const rangeStart = (): number => window().startMidi
  const rangeEnd = (): number => window().endMidi
  const inRange = (midi: number): boolean => isInKeyWindow(midi, window())
  const keyLeft = (key: PianoKey): string =>
    `${keyCenterPercent(key.midi, window()) ?? 0}%`

  const visibleMidis = (): readonly number[] =>
    PIANO_KEYS.filter((key) => inRange(key.midi)).map((key) => key.midi)

  const focusKey = (midi: number): void => {
    queueMicrotask(() =>
      keyboardElement
        ?.querySelector<HTMLButtonElement>(`[data-midi="${midi}"]`)
        ?.focus(),
    )
  }

  const moveKeyboardFocus = (midi: number, direction: -1 | 1): void => {
    const midis = visibleMidis()
    const index = midis.indexOf(midi)
    const next =
      midis[Math.min(midis.length - 1, Math.max(0, index + direction))]
    if (next === undefined) return
    setFocusedMidi(next)
    focusKey(next)
  }

  const onKeyDown = (event: KeyboardEvent, midi: number): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveKeyboardFocus(midi, -1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveKeyboardFocus(midi, 1)
    }
  }

  // Roving focus has to stay on a key that is on screen. This covers both
  // ways the window can move under it: the media query flipping to the
  // compact keyboard, and the arrows stepping the range.
  createEffect(() => {
    if (inRange(focusedMidi())) return
    const nextMidi = rangeStart() + 12
    const keyboardHadFocus =
      keyboardElement?.contains(document.activeElement) === true
    setFocusedMidi(nextMidi)
    if (keyboardHadFocus) focusKey(nextMidi)
  })

  return (
    <div class={styles.keybed}>
      <div class={styles.feltLine} aria-hidden="true" />
      <div
        ref={keyboardElement}
        class={styles.keyboard}
        role="group"
        aria-label="Playable 88-key piano keyboard"
        aria-describedby="piano-night-keyboard-help"
        data-testid="piano-night-keyboard"
        onPointerMove={(event) => props.onPointerMove(event)}
        onPointerUp={(event) => props.onPointerRelease(event)}
        onPointerCancel={(event) => props.onPointerRelease(event)}
        onLostPointerCapture={(event) => props.onPointerRelease(event)}
      >
        <div class={styles.whiteKeys}>
          <For each={WHITE_KEYS}>
            {(key) => (
              <button
                type="button"
                data-midi={key.midi}
                data-in-range={inRange(key.midi)}
                classList={{
                  [styles.keyActive]: props.activeMidis().has(key.midi),
                }}
                aria-label={`Play ${midiToNoteNameOctave(key.midi)}`}
                aria-pressed={props.activeMidis().has(key.midi)}
                tabindex={focusedMidi() === key.midi ? 0 : -1}
                onFocus={() => setFocusedMidi(key.midi)}
                onKeyDown={(event) => onKeyDown(event, key.midi)}
                onClick={(event) => {
                  if (event.detail === 0) props.onKeyboardActivate(key.midi)
                }}
                onPointerDown={(event) => props.onPointerDown(event, key.midi)}
              />
            )}
          </For>
        </div>
        <div class={styles.blackKeys}>
          <For each={BLACK_KEYS}>
            {(key) => (
              <button
                type="button"
                data-midi={key.midi}
                data-in-range={inRange(key.midi)}
                classList={{
                  [styles.keyActive]: props.activeMidis().has(key.midi),
                }}
                style={{ left: keyLeft(key) }}
                aria-label={`Play ${midiToNoteNameOctave(key.midi)}`}
                aria-pressed={props.activeMidis().has(key.midi)}
                tabindex={focusedMidi() === key.midi ? 0 : -1}
                onFocus={() => setFocusedMidi(key.midi)}
                onKeyDown={(event) => onKeyDown(event, key.midi)}
                onClick={(event) => {
                  if (event.detail === 0) props.onKeyboardActivate(key.midi)
                }}
                onPointerDown={(event) => props.onPointerDown(event, key.midi)}
              />
            )}
          </For>
        </div>
      </div>
      <p id="piano-night-keyboard-help" class={styles.srOnly}>
        Use the arrow keys to move between piano keys and Enter to play the
        focused key.
      </p>
      <div class={styles.keyboardRange} aria-label="Touch keyboard range">
        <button
          type="button"
          onClick={() => props.keyWindow.step(-1)}
          disabled={!props.keyWindow.canStep(-1)}
          aria-label="Move touch keyboard down one octave"
        >
          <ChevronLeft />
        </button>
        <span>
          {midiToNoteNameOctave(rangeStart())}–
          {midiToNoteNameOctave(rangeEnd())}
        </span>
        <button
          type="button"
          onClick={() => props.keyWindow.step(1)}
          disabled={!props.keyWindow.canStep(1)}
          aria-label="Move touch keyboard up one octave"
        >
          <ChevronLeft />
        </button>
      </div>
    </div>
  )
}
