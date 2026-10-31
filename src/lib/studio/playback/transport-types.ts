// Studio transport state and options — what the transport publishes on every change, and what it is built from.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { createStudioLaneMeter } from '../metering/live-meter'
import type { StudioMeterSnapshot } from '../metering/stream-meter'
import type { StudioBufferCache } from './buffer-cache'
import type { buildStudioGraph } from './graph'
import type { StudioFreezeLookup } from './lane-freezer'
import type { StudioLatencyReader } from './prepare-plan'
import type { StudioLaneLevel } from './run'

export interface StudioTransportState {
  playing: boolean
  pending: boolean
  playheadFrame: number
  peakL: number
  peakR: number
  error: string | null
  meter: StudioMeterSnapshot | null
  masterReady: boolean
  /** Every built lane's level while the song plays; empty when it does not. */
  lanes: readonly StudioLaneLevel[]
}

export interface StudioTransportOptions {
  lease: AudioContextLease
  readCanonicalAsset(id: string): Promise<Blob>
  changed(state: StudioTransportState): void
  cache?: StudioBufferCache
  measureLatencies?: StudioLatencyReader
  buildGraph?: typeof buildStudioGraph
  createLaneMeter?: typeof createStudioLaneMeter
  /** Lanes rendered ahead (lane-freezer.ts), which runs built from now on play. */
  freezes?: StudioFreezeLookup
}
