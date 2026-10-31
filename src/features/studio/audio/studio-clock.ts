// ============================================================
// Studio clock — the one web lease every song opened in a Studio visit plays on
// ============================================================
//
// The page builds a new workspace for each song it opens (StudioPage keys it
// by project), and each workspace's transport used to make its own clock:
// closed with the song, made again inside the next song's first Play, which
// then built its graph in the press. The page makes the clock instead, and
// lends it to each song in turn. The clock still comes into being only
// inside a press that plays (web-audio-lease.ts), but once a press has made
// it, every song opened after builds its graph before its first Play
// (prebuilt-run.ts).
//
// It closes when the Studio closes, once the song that was open has let it
// go: a song lets go after its last fade, so leaving the Studio mid-song
// still fades out. The native app lends a clock of its own and takes none
// of this (useStudioTransport).
import { createContext, useContext } from 'solid-js'
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { StudioWebLease } from './web-audio-lease'
import { createStudioWebLease } from './web-audio-lease'

/** One song's claim on the page's clock. */
export interface StudioClockHold {
  readonly lease: AudioContextLease
  /** The song has gone silent; safe to call twice. */
  release(): void
}

export interface StudioClock {
  /** Lend the clock to a song until it releases it. */
  hold(): StudioClockHold
  /** The Studio closed: the clock closes once no song holds it. */
  close(): void
}

export function createStudioClock(
  lease: StudioWebLease = createStudioWebLease(),
): StudioClock {
  let holds = 0
  let closing = false
  const closeWhenFree = () => {
    if (closing && holds === 0) void lease.close()
  }
  return {
    hold() {
      holds++
      let released = false
      return {
        lease,
        release() {
          if (released) return
          released = true
          holds--
          closeWhenFree()
        },
      }
    },
    close() {
      if (closing) return
      closing = true
      closeWhenFree()
    },
  }
}

/** The Studio page's clock, or null where none is lent (the native app, a bare workspace). */
export const StudioClockContext = createContext<StudioClock | null>(null)

export function useStudioClock(): StudioClock | null {
  return useContext(StudioClockContext)
}
