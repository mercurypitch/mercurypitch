// ============================================================
// Recorded drummer playback — exact hit timing beside an untouched guitar take
// ============================================================
//
// The take remains dry audio. This scheduler rebuilds its separately stored
// accompaniment on the room's drums bus, so source/tone changes never rewrite
// the recording and Pause, seek and mute retire drum voices independently.

import { createLazyGuitarRoomDrumPlayer } from '@/features/guitar/backing/guitar-room-drum-player'
import { setGuitarSessionGainTarget } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { GuitarRecordingDrumTrack } from '@/lib/guitar/recording-types'
import { isGuitarNightDrumKitId } from './guitar-night-drum-sound'

const LOOKAHEAD_SECONDS = 0.12
const SCHEDULE_INTERVAL_MS = 25

interface DrumGroup {
  readonly level: number
  readonly hits: GuitarRecordingDrumTrack['hits'][number][]
  readonly output: GainNode
  readonly player: ReturnType<typeof createLazyGuitarRoomDrumPlayer>
}

export interface RecordedDrumTrackPlayerOptions {
  readonly context: AudioContext
  readonly destination: AudioNode
  readonly track: GuitarRecordingDrumTrack
  readonly getPosition: () => number
  readonly createPlayer?: typeof createLazyGuitarRoomDrumPlayer
}

export function createRecordedDrumTrackPlayer(
  options: RecordedDrumTrackPlayerOptions,
) {
  const hits = options.track.hits.filter((hit) =>
    isGuitarNightDrumKitId(hit.kitId),
  )
  const groups = new Map<string, DrumGroup>()
  let interval: ReturnType<typeof setInterval> | null = null
  let cursor = 0
  let muted = false
  let level = 1
  let active = false
  let disposed = false
  let preparation: Promise<boolean> | null = null
  let generation = 0

  const groupKey = (kitId: string, hitLevel: number): string =>
    `${kitId}:${hitLevel.toFixed(4)}`
  const applyGroupLevel = (group: DrumGroup): void => {
    setGuitarSessionGainTarget(
      group.output.gain,
      muted ? 0 : group.level * level,
      options.context.currentTime,
    )
  }
  const stopClock = (): void => {
    if (interval !== null) clearInterval(interval)
    interval = null
  }
  const lowerBound = (seconds: number): number => {
    let low = 0
    let high = hits.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (hits[middle]!.offsetSeconds < seconds) low = middle + 1
      else high = middle
    }
    return low
  }
  const prepare = (): Promise<boolean> => {
    if (preparation !== null) return preparation
    preparation = (async () => {
      const createPlayer =
        options.createPlayer ?? createLazyGuitarRoomDrumPlayer
      for (const hit of hits) {
        const kitId = isGuitarNightDrumKitId(hit.kitId)
          ? hit.kitId
          : 'mercury-synth'
        const key = groupKey(kitId, hit.level)
        let group = groups.get(key)
        if (group === undefined) {
          const output = options.context.createGain()
          output.gain.value = muted ? 0 : hit.level * level
          output.connect(options.destination)
          group = {
            level: hit.level,
            hits: [],
            output,
            player: createPlayer({
              getAudioContext: () => options.context,
              getOutput: () => output,
              kitId,
            }),
          }
          groups.set(key, group)
        }
        group.hits.push(hit)
      }
      const ready = await Promise.all(
        [...groups.values()].map(async (group) => {
          try {
            const activated = await group.player.activate()
            if (activated)
              await group.player
                .prewarm?.(
                  group.hits.map((hit) => ({
                    gmKey: hit.gmKey,
                    velocity: hit.velocity,
                  })),
                )
                .catch(() => undefined)
            return activated
          } catch {
            // Accompaniment is optional: a failed sample pack must never block
            // the user's preserved guitar take from playing.
            return false
          }
        }),
      )
      return ready.some(Boolean)
    })()
    return preparation
  }
  const schedule = (): void => {
    if (!active || disposed) return
    const position = options.getPosition()
    const horizon = position + LOOKAHEAD_SECONDS
    while (cursor < hits.length && hits[cursor]!.offsetSeconds <= horizon) {
      const hit = hits[cursor++]!
      if (hit.offsetSeconds < position - 0.03) continue
      if (!isGuitarNightDrumKitId(hit.kitId)) continue
      const group = groups.get(groupKey(hit.kitId, hit.level))
      if (group === undefined) continue
      group.player.trigger({
        gmKey: hit.gmKey,
        velocity: hit.velocity,
        atContextTime:
          options.context.currentTime +
          Math.max(0.01, hit.offsetSeconds - position),
        lane: 'authored',
        sourceId: `recorded-drum:${cursor - 1}`,
      })
    }
  }
  const silence = (): void => {
    generation += 1
    stopClock()
    active = false
    for (const group of groups.values()) group.player.panic('authored')
  }

  return {
    prepare,
    async play(startSeconds: number): Promise<boolean> {
      const operation = ++generation
      let ready = false
      try {
        ready = await prepare()
      } catch {
        ready = false
      }
      if (disposed || hits.length === 0 || !ready) return false
      if (disposed || operation !== generation) return false
      cursor = lowerBound(Math.max(0, startSeconds - 0.03))
      active = true
      schedule()
      stopClock()
      interval = setInterval(schedule, SCHEDULE_INTERVAL_MS)
      return true
    },
    pause: silence,
    stop() {
      silence()
      cursor = 0
    },
    seek(seconds: number) {
      const resume = active
      silence()
      cursor = lowerBound(Math.max(0, seconds - 0.03))
      if (resume) {
        active = true
        schedule()
        interval = setInterval(schedule, SCHEDULE_INTERVAL_MS)
      }
    },
    setMuted(next: boolean) {
      muted = next
      for (const group of groups.values()) applyGroupLevel(group)
    },
    setLevel(next: number) {
      level = Math.min(2, Math.max(0, Number.isFinite(next) ? next : 1))
      for (const group of groups.values()) applyGroupLevel(group)
    },
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      silence()
      await Promise.all(
        [...groups.values()].map(async (group) => {
          await group.player.dispose()
          group.output.disconnect()
        }),
      )
      groups.clear()
    },
  }
}

export type RecordedDrumTrackPlayer = ReturnType<
  typeof createRecordedDrumTrackPlayer
>
