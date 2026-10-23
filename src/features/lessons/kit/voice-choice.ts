// ============================================================
// Voice choice — the Merc a viewer sings with, lower or higher
// ============================================================
//
// A voice lesson asks once which A sits nearer the viewer's voice: lower,
// singing with Merc around A3, or higher, singing with Tavi
// around A4 (Lesson 3 WEB-SPEC, Toys 5). The answer is a convenience kept
// in localStorage under `fyp-voice`, which every later voice lesson reads,
// never a measurement: both choices hold the same notes an octave apart.
// Every control that sets it shows the one state (aria-pressed), and a page
// that has none asks before it needs one. In a private window it lasts for
// the visit (dom.ts `store`).

import { qa, store } from './dom'
import type { Which } from './merc-duo'
import { A3, A4 } from './notes'

export type Voice = 'lower' | 'higher'

const KEY = 'fyp-voice'
const listeners = new Set<(v: Voice | null) => void>()

function read(): Voice | null {
  const v = store.get<unknown>(KEY, null)
  return v === 'lower' || v === 'higher' ? v : null
}

let current: Voice | null = read()

export const VoiceChoice = {
  get voice(): Voice | null {
    return current
  },
  set(v: Voice): void {
    current = v
    store.set(KEY, v)
    listeners.forEach((fn) => fn(v))
  },
  /** Calls `fn` now and after every change; returns the unsubscribe. */
  subscribe(fn: (v: Voice | null) => void): () => void {
    listeners.add(fn)
    fn(current)
    return () => {
      listeners.delete(fn)
    }
  },
}

/** The Merc who sings with a voice: blue for the lower, orange for the higher. */
export const mercOf = (v: Voice): Which => (v === 'lower' ? 'blue' : 'orange')

/** The A a voice sings around: A3 for the lower, A4 for the higher. */
export const homeOf = (v: Voice): number => (v === 'lower' ? A3 : A4)

/**
 * Binds every `[data-voice]` button inside `root` to the choice: a tap sets
 * it, and each shows the current one with aria-pressed. Returns the
 * unsubscribe.
 */
export function bindVoiceButtons(
  root: ParentNode,
  onPick?: (v: Voice) => void,
): () => void {
  const buttons = qa<HTMLButtonElement>('button[data-voice]', root)
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const v = b.dataset.voice
      if (v !== 'lower' && v !== 'higher') return
      VoiceChoice.set(v)
      onPick?.(v)
    })
  }
  return VoiceChoice.subscribe((v) => {
    for (const b of buttons)
      b.setAttribute('aria-pressed', String(b.dataset.voice === v))
  })
}
