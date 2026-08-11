// ============================================================
// Piano key horizon — fixed 88-key stage with a playable phone window
// ============================================================
//
// Desktop preserves the full physical horizon. Phones keep the same DOM
// instrument but expose a two-octave touch window with explicit range steps.

import type { Accessor, JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount } from 'solid-js'
import { ChevronLeft } from '@/components/icons'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import styles from './PianoNightApp.module.css'

interface KeyboardKey {
  midi: number
  whiteIndex: number
}

interface PianoKeyHorizonProps {
  activeMidis: Accessor<ReadonlySet<number>>
  onPointerDown: (event: PointerEvent, midi: number) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerRelease: (event: PointerEvent) => void
  onKeyboardActivate: (midi: number) => void
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

function buildKeyboard(): {
  white: readonly KeyboardKey[]
  black: readonly KeyboardKey[]
} {
  const white: KeyboardKey[] = []
  const black: KeyboardKey[] = []
  let whiteIndex = 0
  for (let midi = 21; midi <= 108; midi += 1) {
    if (BLACK_PITCH_CLASSES.has(midi % 12)) {
      black.push({ midi, whiteIndex })
    } else {
      white.push({ midi, whiteIndex })
      whiteIndex += 1
    }
  }
  return { white, black }
}

const KEYBOARD = buildKeyboard()
const ORDERED_KEYS = [...KEYBOARD.white, ...KEYBOARD.black].sort(
  (left, right) => left.midi - right.midi,
)
const MOBILE_RANGE_STARTS = [36, 48, 60, 72] as const
const COMPACT_KEYBOARD_MEDIA_QUERY =
  '(max-width: 680px), (max-width: 900px) and (max-height: 500px)'

export function PianoKeyHorizon(props: PianoKeyHorizonProps): JSX.Element {
  const [mobile, setMobile] = createSignal(false)
  const [rangeIndex, setRangeIndex] = createSignal(1)
  const [focusedMidi, setFocusedMidi] = createSignal(60)
  let keyboardElement: HTMLDivElement | undefined

  const rangeStart = (): number => MOBILE_RANGE_STARTS[rangeIndex()]
  const rangeEnd = (): number => rangeStart() + 24
  const inRange = (midi: number): boolean =>
    !mobile() || (midi >= rangeStart() && midi <= rangeEnd())
  const visibleWhiteKeys = (): readonly KeyboardKey[] =>
    KEYBOARD.white.filter((key) => inRange(key.midi))
  const keyLeft = (key: KeyboardKey): string => {
    if (!mobile()) return `${(key.whiteIndex / 52) * 100}%`
    const firstWhite = visibleWhiteKeys()[0]?.whiteIndex ?? 0
    const whiteCount = Math.max(1, visibleWhiteKeys().length)
    return `${((key.whiteIndex - firstWhite) / whiteCount) * 100}%`
  }

  const visibleMidis = (): readonly number[] =>
    ORDERED_KEYS.filter((key) => inRange(key.midi)).map((key) => key.midi)

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

  onMount(() => {
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(COMPACT_KEYBOARD_MEDIA_QUERY)
        : null
    const sync = (): void => {
      const nextMobile = media?.matches ?? false
      if (
        nextMobile &&
        (focusedMidi() < rangeStart() || focusedMidi() > rangeEnd())
      ) {
        const nextMidi = rangeStart() + 12
        const keyboardHadFocus =
          keyboardElement?.contains(document.activeElement) === true
        setFocusedMidi(nextMidi)
        if (keyboardHadFocus) focusKey(nextMidi)
      }
      setMobile(nextMobile)
    }
    sync()
    media?.addEventListener?.('change', sync)
    onCleanup(() => media?.removeEventListener?.('change', sync))
  })

  const stepRange = (direction: -1 | 1): void => {
    setRangeIndex((current) => {
      const next = Math.min(
        MOBILE_RANGE_STARTS.length - 1,
        Math.max(0, current + direction),
      )
      setFocusedMidi(MOBILE_RANGE_STARTS[next] + 12)
      return next
    })
  }

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
          <For each={KEYBOARD.white}>
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
          <For each={KEYBOARD.black}>
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
          onClick={() => stepRange(-1)}
          disabled={rangeIndex() === 0}
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
          onClick={() => stepRange(1)}
          disabled={rangeIndex() === MOBILE_RANGE_STARTS.length - 1}
          aria-label="Move touch keyboard up one octave"
        >
          <ChevronLeft />
        </button>
      </div>
    </div>
  )
}
