// ============================================================
// Now playing — one sound at a time, on a page that asks for it
// ============================================================
//
// A page that promises one sound at a time (Lesson 6's WEB-SPEC, Audio)
// gives every source the same owner. Before a source sounds, it claims the
// owner with its own stop, and the owner stops the sound before it, when
// that is another source's, with that source's own stop: its timers, its
// lit button, its play head and its promise all reset as they do when it
// is stopped where it stands. `Sound.stopAll()` would silence the voices
// and leave all of that behind. A source that takes over from itself (a
// pair played again) restarts itself, so the owner leaves it alone; a
// source that ends, by itself or by its own stop, lets go, so a later
// claim never runs its stop twice. A page opts in by handing `NowPlaying`
// to what it mounts; no other lesson does yet.

export interface SoundOwner {
  /** Before a source sounds: stops the sound before it, when that is another source's, and records this one. */
  claim(stop: () => void): void
  /** A source that has ended lets go, so a later claim does not stop it again. */
  release(stop: () => void): void
}

export function createSoundOwner(): SoundOwner {
  let owner: (() => void) | null = null
  return {
    claim(stop) {
      const before = owner
      owner = stop
      if (before !== null && before !== stop) before()
    },
    release(stop) {
      if (owner === stop) owner = null
    },
  }
}

/** The page's one owner. */
export const NowPlaying: SoundOwner = createSoundOwner()
