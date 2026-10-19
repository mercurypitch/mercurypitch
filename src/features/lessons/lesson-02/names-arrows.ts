// ============================================================
// Lesson 2 names arrows — Sharp and Flat, and the names they write
// ============================================================
//
// A sharp means one semitone up and a flat one semitone down (FACTS 17), so
// an arrow from a key steps one semitone and writes the name it gives there:
// from C up, C♯ on the black key; from D down, D♭ on the same key; from E
// up, E♯ on F, a white key (FACTS 20). A key the arrows have given two
// names gets one gold ring: one key, two names (FACTS 18). The arrows step
// from a lettered key; from a black key a sharp would give a double sharp,
// which this lesson does not teach, so the page asks for a white key.
//
// "Show the rare ones" adds the four white keys' second names: B♯ on C,
// C♭ on B, E♯ on F and F♭ on E (kit/names.ts `rareName`).

import { rareName } from '@/features/lessons/kit/names'
import type { Spelled } from '@/features/lessons/kit/notes'
import { isBlack, sharpOf, spellOn } from '@/features/lessons/kit/notes'

export type ArrowDir = 'sharp' | 'flat'

/** An arrow's step: from a key to its neighbour, and the name it writes there. */
export interface ArrowStep {
  readonly from: number
  readonly to: number
  readonly dir: ArrowDir
  readonly name: Spelled
}

/** The arrow from a white key (`midi`), or null from a black key. */
export function arrowFrom(midi: number, dir: ArrowDir): ArrowStep | null {
  if (isBlack(midi)) return null
  const to = midi + (dir === 'sharp' ? 1 : -1)
  return { from: midi, to, dir, name: spellOn(to, sharpOf(midi).letter) }
}

const same = (a: Spelled, b: Spelled): boolean =>
  a.letter === b.letter && a.alter === b.alter && a.octave === b.octave

/** The names the arrows have written, by the key they landed on. */
export interface WrittenNames {
  /** Writes an arrow's name on its landing key (once). */
  add(step: ArrowStep): void
  /** The names written on a key, the sharp first. */
  on(midi: number): readonly Spelled[]
  /** True for a key the arrows have given two names: it takes the gold ring. */
  ringed(midi: number): boolean
  clear(): void
}

export function writtenNames(): WrittenNames {
  const map = new Map<number, Spelled[]>()
  return {
    add(step) {
      const names = map.get(step.to) ?? []
      if (!names.some((n) => same(n, step.name))) names.push(step.name)
      names.sort((a, b) => b.alter - a.alter)
      map.set(step.to, names)
    },
    on: (midi) => map.get(midi) ?? [],
    ringed: (midi) => (map.get(midi)?.length ?? 0) >= 2,
    clear: () => map.clear(),
  }
}

/**
 * The second names a white key carries above its letter: what the arrows
 * wrote there, and its rare name while those show, each once.
 */
export function namesAbove(
  midi: number,
  written: WrittenNames,
  rare: boolean,
): Spelled[] {
  const out = [...written.on(midi)]
  const r = rare ? rareName(midi) : null
  if (r !== null && !out.some((n) => same(n, r))) out.push(r)
  return out
}
