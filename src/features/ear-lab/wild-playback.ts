// ============================================================
// wild-playback — the Field Book's stimulus: a chord that plants
// the song's key, then a slice of the song itself.
//
// One hook per drill. The plant is the song's tonic triad on the
// engine's tone (major or minor as read), so the degree question is
// asked in the key the song is actually in; the excerpt is the
// stems through wild-player at the room's level. cancel() silences
// both and clears any timers the drill scheduled against the slice.
// ============================================================

import { useEngines } from '@/contexts/EngineContext'
import { WILD_TIMING } from '@/lib/ear/timing'
import type { WildKey } from '@/lib/ear/wild'
import { midiToFreq } from '@/lib/scale-data'
import { useEarRoom } from './ear-room-context'
import type { ExcerptHandle, ExcerptLayer } from './wild-player'
import { playExcerpt } from './wild-player'

export interface WildPlayback {
  /** Arm a new stimulus: clears the cancelled flag. */
  begin: () => void
  cancelled: () => boolean
  plant: (key: WildKey) => Promise<void>
  excerpt: (
    layers: readonly ExcerptLayer[],
    startS: number,
    endS: number,
  ) => Promise<void>
  /** A timer tied to the stimulus — dropped by cancel(). */
  after: (ms: number, fn: () => void) => void
  cancel: () => void
}

/** The plant's root: the tonic in the octave below middle C. */
export function plantMidis(key: WildKey): number[] {
  const root = 48 + key.tonicPc
  return [root, root + (key.mode === 'major' ? 4 : 3), root + 7, root + 12]
}

export function useWildPlayback(): WildPlayback {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  let handle: ExcerptHandle | null = null
  let cancelled = false
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))
  const level = () => room.volume() * audioEngine.getVolume()

  return {
    begin: () => {
      cancelled = false
    },
    cancelled: () => cancelled,
    plant: async (key) => {
      await audioEngine.init()
      await audioEngine.resume()
      if (cancelled) return
      await Promise.all(
        plantMidis(key).map((midi) =>
          audioEngine.playTone(midiToFreq(midi), WILD_TIMING.plantMs),
        ),
      )
      await wait(WILD_TIMING.plantMs + WILD_TIMING.plantGapMs)
    },
    excerpt: async (layers, startS, endS) => {
      if (cancelled) return
      const ctx = audioEngine.getAudioContext()
      if (!ctx) return
      handle = playExcerpt(ctx, layers, startS, endS, level())
      await handle.done
      handle = null
      await wait(WILD_TIMING.tailMs)
    },
    after: (ms, fn) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        if (!cancelled) fn()
      }, ms)
      timers.add(timer)
    },
    cancel: () => {
      cancelled = true
      handle?.cancel()
      handle = null
      audioEngine.stopTone(60)
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    },
  }
}
