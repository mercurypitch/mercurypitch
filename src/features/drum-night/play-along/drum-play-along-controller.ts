// ============================================================
// Drum play-along controller — arrangement truth, live mix, one scheduler
// ============================================================
//
// This headless controller is the App integration seam. It never owns a
// clock or AudioContext: it projects the ready session, schedules only pitched
// backing, and reports the effective Drums/Backing mix for the existing drum
// scheduler and route-owned kit to apply.

import type { DrumTransport } from '../runtime/drum-transport'
import type { DrumSessionDocument } from '../session/drum-session'
import * as drumArrangement from './drum-arrangement'
import type { DrumArrangementBackingPlayerPort } from './drum-arrangement-player'
import * as drumArrangementScheduler from './drum-arrangement-scheduler'

type DrumArrangement = drumArrangement.DrumArrangement
type DrumArrangementBusId = drumArrangement.DrumArrangementBusId
type DrumArrangementScheduler =
  drumArrangementScheduler.DrumArrangementScheduler
type DrumArrangementSchedulerSnapshot =
  drumArrangementScheduler.DrumArrangementSchedulerSnapshot

export const DEFAULT_DRUM_ARRANGEMENT_BACKING_LEVEL = 0.78

export interface DrumPlayAlongBusState {
  readonly id: DrumArrangementBusId
  readonly label: 'Backing' | 'Drums'
  readonly available: boolean
  readonly trackCount: number
  readonly eventCount: number
  readonly muted: boolean
  readonly solo: boolean
  /** User position in the 0–1 perceptual slider domain. */
  readonly level: number
  /** Position after availability, mute, and solo routing are applied. */
  readonly effectiveLevel: number
}

export interface DrumPlayAlongTrackState {
  readonly id: string
  readonly label: string
  readonly instrumentName: string
  readonly playbackLabel: string
  readonly approximatesSource: true
  readonly noteCount: number
  readonly muted: boolean
  readonly solo: boolean
  readonly level: number
  readonly effectiveLevel: number
}

export interface DrumPlayAlongSnapshot {
  readonly arrangement: DrumArrangement | null
  readonly drums: DrumPlayAlongBusState
  readonly backing: DrumPlayAlongBusState
  readonly backingTracks: readonly DrumPlayAlongTrackState[]
  readonly scheduler: DrumArrangementSchedulerSnapshot
}

export interface DrumPlayAlongControllerOptions {
  readonly transport: DrumTransport
  readonly player: DrumArrangementBackingPlayerPort
  readonly performanceTimestampToContextTime: (
    timestampMs: number,
  ) => number | null
  readonly lookaheadMs?: number
  /** Apply the effective authored-drum guide level on the existing kit path. */
  readonly onDrumsLevelChange?: (position: number) => void
}

export interface DrumPlayAlongController {
  snapshot(): DrumPlayAlongSnapshot
  subscribe(listener: () => void): () => void
  /** Projection is inert and leaves transport/session authority with the App. */
  setSession(document: DrumSessionDocument | null): void
  /** Must be called from the same user-owned activation path as the route kit. */
  activate(): Promise<boolean>
  setBusMuted(bus: DrumArrangementBusId, muted: boolean): void
  setBusSolo(bus: DrumArrangementBusId, solo: boolean): void
  setBusLevel(bus: DrumArrangementBusId, position: number): void
  setTrackMuted(trackId: string, muted: boolean): void
  setTrackSolo(trackId: string, solo: boolean): void
  setTrackLevel(trackId: string, position: number): void
  schedule(lookaheadMs?: number): void
  clear(): void
  dispose(): Promise<void>
}

interface MutableBusState {
  muted: boolean
  solo: boolean
  level: number
}

interface MutableTrackState {
  readonly id: string
  readonly label: string
  readonly instrumentName: string
  readonly playbackLabel: string
  readonly noteCount: number
  muted: boolean
  solo: boolean
  level: number
}

function clampPosition(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** Wire the authored backing consumer to Drum Night's existing route seams. */
export function createDrumPlayAlongController(
  options: DrumPlayAlongControllerOptions,
): DrumPlayAlongController {
  const listeners = new Set<() => void>()
  const scheduler: DrumArrangementScheduler =
    drumArrangementScheduler.createDrumArrangementScheduler({
      transport: options.transport,
      player: options.player,
      performanceTimestampToContextTime:
        options.performanceTimestampToContextTime,
      ...(options.lookaheadMs === undefined
        ? {}
        : { lookaheadMs: options.lookaheadMs }),
    })
  const buses: Record<DrumArrangementBusId, MutableBusState> = {
    drums: { muted: false, solo: false, level: 1 },
    backing: {
      muted: false,
      solo: false,
      level: DEFAULT_DRUM_ARRANGEMENT_BACKING_LEVEL,
    },
  }
  let arrangement: DrumArrangement | null = null
  let tracks: MutableTrackState[] = []
  let activated = false
  let disposed = false

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const anyTrackSolo = (): boolean => tracks.some((track) => track.solo)

  const anySolo = (): boolean =>
    buses.drums.solo || buses.backing.solo || anyTrackSolo()

  const busAllowedBySolo = (bus: DrumArrangementBusId): boolean => {
    if (!anySolo()) return true
    if (buses[bus].solo) return true
    return bus === 'backing' && anyTrackSolo()
  }

  const busEffectiveLevel = (bus: DrumArrangementBusId): number => {
    const truth = arrangement?.[bus]
    const state = buses[bus]
    if (truth?.available !== true || state.muted || !busAllowedBySolo(bus)) {
      return 0
    }
    return state.level
  }

  const trackEffectiveLevel = (track: MutableTrackState): number => {
    const backingLevel = busEffectiveLevel('backing')
    if (backingLevel === 0 || track.muted) return 0
    if (anyTrackSolo() && !track.solo) return 0
    return backingLevel * track.level
  }

  const applyMix = (includeDrums: boolean): void => {
    for (const track of tracks) {
      options.player.setTrackLevel(track.id, trackEffectiveLevel(track))
    }
    if (includeDrums) {
      options.onDrumsLevelChange?.(busEffectiveLevel('drums'))
    }
  }

  const busSnapshot = (bus: DrumArrangementBusId): DrumPlayAlongBusState => {
    const truth = arrangement?.[bus]
    const state = buses[bus]
    return Object.freeze({
      id: bus,
      label: bus === 'drums' ? 'Drums' : 'Backing',
      available: truth?.available ?? false,
      trackCount: truth?.trackCount ?? 0,
      eventCount: truth?.eventCount ?? 0,
      muted: state.muted,
      solo: state.solo,
      level: state.level,
      effectiveLevel: busEffectiveLevel(bus),
    })
  }

  const snapshot = (): DrumPlayAlongSnapshot =>
    Object.freeze({
      arrangement,
      drums: busSnapshot('drums'),
      backing: busSnapshot('backing'),
      backingTracks: Object.freeze(
        tracks.map((track) =>
          Object.freeze({
            id: track.id,
            label: track.label,
            instrumentName: track.instrumentName,
            playbackLabel: track.playbackLabel,
            approximatesSource: true as const,
            noteCount: track.noteCount,
            muted: track.muted,
            solo: track.solo,
            level: track.level,
            effectiveLevel: trackEffectiveLevel(track),
          }),
        ),
      ),
      scheduler: scheduler.snapshot(),
    })

  const mutateBus = (
    bus: DrumArrangementBusId,
    mutate: (state: MutableBusState) => void,
  ): void => {
    if (disposed) return
    mutate(buses[bus])
    applyMix(activated)
    emit()
  }

  const mutateTrack = (
    trackId: string,
    mutate: (state: MutableTrackState) => void,
  ): void => {
    if (disposed) return
    const track = tracks.find((candidate) => candidate.id === trackId)
    if (track === undefined) return
    mutate(track)
    applyMix(activated)
    emit()
  }

  const unsubscribeScheduler = scheduler.subscribe(emit)

  return {
    snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setSession(document) {
      if (disposed) return
      arrangement =
        document === null
          ? null
          : drumArrangement.createDrumArrangement(document)
      tracks =
        arrangement?.backingTracks.map((track) => ({
          id: track.id,
          label: track.label,
          instrumentName: track.instrumentName,
          playbackLabel: track.playback.label,
          noteCount: track.noteCount,
          muted: false,
          solo: false,
          level: 1,
        })) ?? []
      scheduler.setArrangement(arrangement)
      applyMix(activated)
      emit()
    },
    async activate(): Promise<boolean> {
      if (disposed) return false
      if (arrangement?.backing.available !== true) {
        activated = true
        applyMix(true)
        emit()
        return true
      }
      let ready = false
      try {
        ready = (await options.player.activate()) !== false
      } catch {
        ready = false
      }
      if (disposed || !ready) return false
      activated = true
      applyMix(true)
      emit()
      return true
    },
    setBusMuted(bus, muted) {
      mutateBus(bus, (state) => {
        state.muted = muted
      })
    },
    setBusSolo(bus, solo) {
      mutateBus(bus, (state) => {
        state.solo = solo
      })
    },
    setBusLevel(bus, position) {
      mutateBus(bus, (state) => {
        state.level = clampPosition(position)
      })
    },
    setTrackMuted(trackId, muted) {
      mutateTrack(trackId, (state) => {
        state.muted = muted
      })
    },
    setTrackSolo(trackId, solo) {
      mutateTrack(trackId, (state) => {
        state.solo = solo
      })
    },
    setTrackLevel(trackId, position) {
      mutateTrack(trackId, (state) => {
        state.level = clampPosition(position)
      })
    },
    schedule(lookaheadMs) {
      scheduler.schedule(lookaheadMs)
    },
    clear() {
      if (disposed) return
      scheduler.clear()
      emit()
    },
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      unsubscribeScheduler()
      scheduler.dispose()
      listeners.clear()
      await options.player.dispose()
      tracks = []
      arrangement = null
    },
  }
}
