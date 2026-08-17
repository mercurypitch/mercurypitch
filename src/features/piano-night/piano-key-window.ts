// ============================================================
// Piano key window — one geometry for the keys and for what falls onto them
// ============================================================
//
// The keybed and the fall stage occupy exactly the same horizontal box, so a
// note's x and its key's x have to come from the same arithmetic. They did
// not: the keyboard laid keys out by WHITE-KEY index and narrowed to a
// two-octave window on a phone, while the fall stage mapped MIDI linearly
// across all 88 keys and knew nothing about the window. On a desktop the two
// agreed to within half a percent and looked right. On a phone the keyboard
// showed fifteen white keys across the full width while the notes were still
// divided by 87 semitones, so a C4 note landed over B3 — and stepping the
// octave arrows moved the keys while every falling note stayed put, which is
// what a player would report as "the notes are in the wrong place".
//
// Everything here is pure. The window is a value, the geometry is a function
// of it, and both sides of the stage read the same two.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'

/** The lowest and highest keys of a physical 88-key piano. */
export const PIANO_FIRST_MIDI = 21
export const PIANO_LAST_MIDI = 108

/** Lowest note of each touch window, in order. */
export const MOBILE_RANGE_STARTS = [36, 48, 60, 72] as const
/** How much of the keyboard one touch window spans, in semitones. */
export const MOBILE_RANGE_SEMITONES = 24

/** Compact = a phone, a short landscape phone, or a coarse-pointer tablet. */
export const COMPACT_KEYBOARD_MEDIA_QUERY =
  '(max-width: 680px), (max-width: 900px) and (max-height: 500px), (max-width: 1180px) and (hover: none) and (pointer: coarse)'

/** The span of keys on screen, inclusive at both ends. */
export interface PianoKeyWindow {
  startMidi: number
  endMidi: number
}

/** The whole instrument — what a desktop shows. */
export const FULL_KEY_WINDOW: PianoKeyWindow = {
  startMidi: PIANO_FIRST_MIDI,
  endMidi: PIANO_LAST_MIDI,
}

export interface PianoKey {
  midi: number
  /**
   * For a white key, its index among all white keys. For a black key, the
   * index of the white key it sits in front of — which is also the boundary
   * it straddles, and why black keys are centred on it.
   */
  whiteIndex: number
  black: boolean
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

function buildKeys(): readonly PianoKey[] {
  const keys: PianoKey[] = []
  let whiteIndex = 0
  for (let midi = PIANO_FIRST_MIDI; midi <= PIANO_LAST_MIDI; midi += 1) {
    const black = BLACK_PITCH_CLASSES.has(midi % 12)
    keys.push({ midi, whiteIndex, black })
    if (!black) whiteIndex += 1
  }
  return keys
}

/** Every key of the instrument, low to high. */
export const PIANO_KEYS: readonly PianoKey[] = buildKeys()

const WHITE_KEYS: readonly PianoKey[] = PIANO_KEYS.filter((key) => !key.black)

/** The window a touch range index selects. */
export function mobileKeyWindow(rangeIndex: number): PianoKeyWindow {
  const clamped = Math.min(
    MOBILE_RANGE_STARTS.length - 1,
    Math.max(0, Math.trunc(rangeIndex)),
  )
  const startMidi = MOBILE_RANGE_STARTS[clamped]
  return { startMidi, endMidi: startMidi + MOBILE_RANGE_SEMITONES }
}

export function isInKeyWindow(midi: number, window: PianoKeyWindow): boolean {
  return midi >= window.startMidi && midi <= window.endMidi
}

/** The white keys the window puts on screen — the flex row's real children. */
function visibleWhiteKeys(window: PianoKeyWindow): readonly PianoKey[] {
  return WHITE_KEYS.filter((key) => isInKeyWindow(key.midi, window))
}

/**
 * Where a key's centre sits, as a percentage of the stage width.
 *
 * White keys are flex children of equal width, so key `n` of `count` spans
 * `[n / count, (n + 1) / count]` and its centre is half a key further in.
 * Black keys are absolutely positioned on the boundary between two whites and
 * pulled back by half their own width, so their centre IS that boundary.
 * Returns null outside the window, where there is no key to line up with.
 */
export function keyCenterPercent(
  midi: number,
  window: PianoKeyWindow,
): number | null {
  if (!isInKeyWindow(midi, window)) return null
  const key = PIANO_KEYS.find((candidate) => candidate.midi === midi)
  if (key === undefined) return null
  const whites = visibleWhiteKeys(window)
  const firstWhite = whites[0]?.whiteIndex ?? 0
  const count = Math.max(1, whites.length)
  const offset = key.whiteIndex - firstWhite + (key.black ? 0 : 0.5)
  return (offset / count) * 100
}

export interface PianoKeyWindowController {
  /** True while the compact touch keyboard is the one on screen. */
  compact: Accessor<boolean>
  /** Which touch range is selected. Meaningless while not compact. */
  rangeIndex: Accessor<number>
  /** What is actually on screen right now. */
  window: Accessor<PianoKeyWindow>
  /** Whether the range can move that way. */
  canStep(direction: -1 | 1): boolean
  step(direction: -1 | 1): void
}

/**
 * The window as reactive state, owned once and read by both the keybed and
 * the fall stage. Two components deriving it separately is the bug this
 * module exists to prevent.
 */
export function createPianoKeyWindowController(): PianoKeyWindowController {
  const [compact, setCompact] = createSignal(false)
  const [rangeIndex, setRangeIndex] = createSignal(1)

  onMount(() => {
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(COMPACT_KEYBOARD_MEDIA_QUERY)
        : null
    const sync = (): void => {
      setCompact(media?.matches ?? false)
    }
    sync()
    media?.addEventListener?.('change', sync)
    onCleanup(() => media?.removeEventListener?.('change', sync))
  })

  const currentWindow = createMemo<PianoKeyWindow>(() =>
    compact() ? mobileKeyWindow(rangeIndex()) : FULL_KEY_WINDOW,
  )

  const canStep = (direction: -1 | 1): boolean => {
    const next = rangeIndex() + direction
    return next >= 0 && next <= MOBILE_RANGE_STARTS.length - 1
  }

  return {
    compact,
    rangeIndex,
    window: currentWindow,
    canStep,
    step: (direction) => {
      if (!canStep(direction)) return
      setRangeIndex((current) => current + direction)
    },
  }
}
