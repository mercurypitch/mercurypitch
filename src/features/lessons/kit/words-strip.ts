// ============================================================
// Words strip — a lesson's few words, each with its figure and its button
// ============================================================
//
// Lesson 1's strip of figure, word, definition and button (its "three
// words"), promoted so Lesson 7's four words reuse it: each
// `[data-word-play]` button plays or shows its word, lit (`is-on`) while it
// runs, and a press of a word already running is ignored. A page that
// promises one sound at a time (Lesson 7) passes its owner
// (kit/now-playing.ts): a word then claims it as it starts, a newer sound
// anywhere on the page stops it, and its play learns so through
// `stopped()`. Without an owner a word plays to its end, as on Lesson 1.

import { clamp, qa } from './dom'
import type { SoundOwner } from './now-playing'
import { Sound } from './sound'

/** Runs `fn(u, now)` every frame for `dur` seconds, u from 0 to 1. */
export function animate(
  dur: number,
  fn: (u: number, now: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const frame = (now: number): void => {
      const u = clamp((now - t0) / (dur * 1000), 0, 1)
      fn(u, now)
      if (u < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

/**
 * A word's play, its visuals running even when `audible` is false; resolves
 * when it ends. `stopped()` turns true once a newer sound has taken over:
 * the play then lets go of its figure and resolves.
 */
export type WordPlay = (
  word: string,
  audible: boolean,
  stopped: () => boolean,
) => Promise<void>

export interface WordsStripOptions {
  /** One sound at a time: the page's owner (Lesson 7). */
  readonly owner?: SoundOwner
  /** Stops a word's sound at once, when the owner hands the page to another. */
  readonly stop?: (word: string) => void
}

/** Binds every `[data-word-play]` button inside `root` to `play`. */
export function bindWordPlays(
  root: ParentNode,
  play: WordPlay,
  o: WordsStripOptions = {},
): void {
  const busy: Record<string, boolean> = {}
  for (const b of qa<HTMLButtonElement>('[data-word-play]', root)) {
    b.addEventListener('click', () => {
      void (async () => {
        const w = b.dataset.wordPlay ?? ''
        if (busy[w]) return
        busy[w] = true
        b.classList.add('is-on')
        let stopped = false
        const end = (): void => {
          busy[w] = false
          b.classList.remove('is-on')
        }
        const stop = (): void => {
          if (stopped) return
          stopped = true
          o.stop?.(w)
          end()
        }
        o.owner?.claim(stop)
        const audible = Sound.canPlay()
        await play(w, audible, () => stopped)
        if (stopped) return
        o.owner?.release(stop)
        end()
      })()
    })
  }
}
