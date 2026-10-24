// ============================================================
// Microphone holder — the listener and the microphone, held only around a take
// ============================================================
//
// A page that listens for a take (Lesson 7's siren) loads the listener
// (kit/listen.ts) only inside the tap that asked for it, and holds the
// microphone under its own consumer id with the app's one owner of the
// device. The import below is dynamic and the rest of this file imports
// types only, so a page that imports the holder statically still keeps the
// listener, the pitch detector and the readers out of its first paint.
//
// The module stays loaded once a take has loaded it; the microphone does
// not: `release` lets it go after the manager's short linger, and
// `release(true)` at once, for a hidden tab or a page going away.

import type * as ListenKit from './listen'
import type { Listener } from './listen'

export type ListenModule = typeof ListenKit

/** The microphone and the listener module, held only around a take. */
export class MicHold {
  mod: ListenModule | null = null
  listener: Listener | null = null

  /** `consumer` is the page's id with the microphone's owner, `lesson-07`. */
  constructor(private readonly consumer: string) {}

  /** Loads the listener and holds the microphone, inside the tap that asked; false if either fails. */
  async open(context: AudioContext | null): Promise<boolean> {
    if (context === null) return false
    try {
      this.mod ??= await import('./listen')
      if (this.listener === null || !this.listener.holding)
        this.listener = await this.mod.listen(this.consumer, context)
      return true
    } catch {
      return false
    }
  }

  release(now = false): void {
    if (now) this.listener?.releaseNow()
    else this.listener?.release()
    this.listener = null
  }
}
