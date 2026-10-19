// ============================================================
// Lesson names — one page-wide choice of sharps, flats or both
// ============================================================
//
// A black key reads as its sharp (C♯), its flat (D♭) or both, the sharp
// above the flat. The choice belongs to the whole page: every toggle on it
// writes the one store and shows its state, and every copy of every toy,
// every label and every accessible name reads it and redraws when it
// changes. It opens on Sharps on every visit, as the app's pitch line does,
// and is never stored.
//
// The store is generic (`createModeStore`), so a page can keep another
// page-wide choice the same way: Letters, Numbers or Do-re-mi.

import type { Spelled } from './notes'
import { flatOf, isBlack, sharpOf, spellOn, wordName } from './notes'

export interface ModeStore<M extends string> {
  readonly mode: M
  readonly modes: readonly M[]
  /** Ignores a mode the store does not offer. */
  set(mode: M): void
  /** Calls `fn` now and after every change; returns the unsubscribe. */
  subscribe(fn: (mode: M) => void): () => void
}

export function createModeStore<M extends string>(
  modes: readonly M[],
  initial: M,
): ModeStore<M> {
  let mode = initial
  const listeners = new Set<(m: M) => void>()
  return {
    get mode() {
      return mode
    },
    modes,
    set(next) {
      if (next === mode || !modes.includes(next)) return
      mode = next
      listeners.forEach((fn) => fn(mode))
    },
    subscribe(fn) {
      listeners.add(fn)
      fn(mode)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

/**
 * A segmented control for `store`: each button inside `root` whose `attr`
 * names a mode writes the store, and every one shows the store's state with
 * aria-pressed, whichever control changed it. Returns the unsubscribe.
 */
export function bindModeToggle<M extends string>(
  root: ParentNode,
  store: ModeStore<M>,
  attr = 'data-mode',
): () => void {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>(`button[${attr}]`),
  )
  const modeOf = (b: HTMLButtonElement): M | null => {
    const m = b.getAttribute(attr)
    return store.modes.find((x) => x === m) ?? null
  }
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const m = modeOf(b)
      if (m !== null) store.set(m)
    })
  }
  return store.subscribe((mode) => {
    for (const b of buttons)
      b.setAttribute('aria-pressed', String(modeOf(b) === mode))
  })
}

export type Spelling = 'sharps' | 'flats' | 'both'

/** The page's one choice of names for the black keys; Sharps on every visit. */
export const Names: ModeStore<Spelling> = createModeStore<Spelling>(
  ['sharps', 'flats', 'both'],
  'sharps',
)

/**
 * The names a key carries under `spelling`: a white key its letter, a black
 * key its sharp, its flat, or both with the sharp first (drawn above).
 */
export function namesFor(
  midi: number,
  spelling: Spelling = Names.mode,
): Spelled[] {
  if (!isBlack(midi)) return [sharpOf(midi)]
  if (spelling === 'sharps') return [sharpOf(midi)]
  if (spelling === 'flats') return [flatOf(midi)]
  return [sharpOf(midi), flatOf(midi)]
}

/** A key's accessible name: "C sharp 4", or in Both "C sharp 4, also D flat 4". */
export function spokenNames(
  midi: number,
  spelling: Spelling = Names.mode,
): string {
  return namesFor(midi, spelling)
    .map((s) => wordName(s))
    .join(', also ')
}

const RARE: Readonly<Record<number, Spelled['letter']>> = {
  0: 'B',
  4: 'F',
  5: 'E',
  11: 'C',
}

/**
 * The rare second name of a white key: B♯ on C, F♭ on E, E♯ on F and C♭ on
 * B (Lesson 2's "Show the rare ones"); null for any other note.
 */
export function rareName(midi: number): Spelled | null {
  const letter = RARE[((midi % 12) + 12) % 12]
  return letter === undefined ? null : spellOn(midi, letter)
}
