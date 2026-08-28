// ============================================================
// desk-render — the mixing desk's source and its faulted renders.
//
// Everything the desk plays is rendered offline first: the house
// loop once (drums on the kit voices, guitar and bass on the
// Karplus-Strong strummer, four bars at 100), or the user's own song
// once (vocal and instrumental summed over an excerpt), then each
// trial's slice through the fault under test — a peaking boost, a
// low shelf, a compressor breathing, the stereo folded. Renders are
// loudness-matched where the drill compares two, so the louder one
// is never the answer. OfflineAudioContext is injectable for tests.
// ============================================================

import { triggerDrumVoice } from '@/lib/drum-voices'
import type { FaultSpec } from '@/lib/ear/desk'
import { degreeChordMidis } from '@/lib/ear/progressions'
import { createStrummer } from './guitar-chords'

export type OfflineFactory = (
  channels: number,
  length: number,
  sampleRate: number,
) => OfflineAudioContext

const defaultOffline: OfflineFactory = (channels, length, sampleRate) =>
  new OfflineAudioContext(channels, length, sampleRate)

export const HOUSE_BPM = 100
export const HOUSE_BARS = 4
/** A — low enough for the bass root to sit under the chords. */
export const HOUSE_ROOT_MIDI = 45
export const HOUSE_DEGREES: readonly number[] = [1, 5, 6, 4]

export function houseLoopSeconds(): number {
  return (HOUSE_BARS * 4 * 60) / HOUSE_BPM
}

/** Four bars of I–V–vi–IV with a straight kit under it. */
export async function renderHouseLoop(
  sampleRate = 44_100,
  offline: OfflineFactory = defaultOffline,
): Promise<AudioBuffer> {
  const seconds = houseLoopSeconds()
  const ctx = offline(2, Math.ceil(seconds * sampleRate), sampleRate)
  const beat = 60 / HOUSE_BPM
  const kit = ctx.createGain()
  kit.gain.value = 0.85
  kit.connect(ctx.destination)
  const strummer = createStrummer(ctx, 0.55)
  for (let bar = 0; bar < HOUSE_BARS; bar++) {
    const barAt = bar * 4 * beat
    const chord = degreeChordMidis(
      HOUSE_ROOT_MIDI,
      HOUSE_DEGREES[bar % HOUSE_DEGREES.length],
    )
    strummer.strum(chord, barAt + 0.01, beat * 1.9, 1)
    strummer.strum(chord, barAt + 2 * beat, beat * 1.9, 1)
    for (let step = 0; step < 8; step++) {
      const at = barAt + (step * beat) / 2
      triggerDrumVoice(
        step === 7 && bar % 2 === 1 ? 'hh-open' : 'hh-closed',
        ctx,
        at,
        0.32,
        kit,
      )
      if (step === 0 || step === 4) triggerDrumVoice('kick', ctx, at, 0.9, kit)
      if (step === 2 || step === 6) triggerDrumVoice('snare', ctx, at, 0.7, kit)
    }
  }
  return ctx.startRendering()
}

/** Where an excerpt of a song starts: a third of the way in, so the
 *  intro is skipped, unless the song is shorter than the excerpt. */
export function songExcerptStart(durationS: number, lengthS: number): number {
  if (durationS <= lengthS) return 0
  return Math.min(durationS * 0.3, durationS - lengthS)
}

/** The user's song as one mix: vocal and instrumental summed. */
export async function renderSongMix(
  vocal: AudioBuffer,
  instrumental: AudioBuffer,
  startS: number,
  lengthS: number,
  offline: OfflineFactory = defaultOffline,
): Promise<AudioBuffer> {
  const rate = instrumental.sampleRate
  const ctx = offline(2, Math.ceil(lengthS * rate), rate)
  for (const buffer of [vocal, instrumental]) {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0, startS, lengthS)
  }
  return ctx.startRendering()
}

export interface FaultChain {
  input: AudioNode
  output: AudioNode
}

/** The processing a fault stands for, as a chain between two nodes. */
export function faultChain(
  ctx: BaseAudioContext,
  fault: FaultSpec | null,
): FaultChain {
  if (fault === null) {
    const through = ctx.createGain()
    return { input: through, output: through }
  }
  switch (fault.kind) {
    case 'peak': {
      const filter = ctx.createBiquadFilter()
      filter.type = 'peaking'
      filter.frequency.value = fault.hz
      filter.Q.value = fault.q
      filter.gain.value = fault.db
      return { input: filter, output: filter }
    }
    case 'shelf': {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowshelf'
      filter.frequency.value = fault.hz
      filter.gain.value = fault.db
      return { input: filter, output: filter }
    }
    case 'pump': {
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -32
      compressor.knee.value = 2
      compressor.ratio.value = 12
      compressor.attack.value = 0.002
      compressor.release.value = 0.3
      const makeup = ctx.createGain()
      makeup.gain.value = 2.2
      compressor.connect(makeup)
      return { input: compressor, output: makeup }
    }
    case 'narrow': {
      // Both channels carry the sum: the width folds to the middle.
      const splitter = ctx.createChannelSplitter(2)
      const merger = ctx.createChannelMerger(2)
      const left = ctx.createGain()
      const right = ctx.createGain()
      left.gain.value = 0.5
      right.gain.value = 0.5
      splitter.connect(left, 0)
      splitter.connect(right, 1)
      left.connect(merger, 0, 0)
      right.connect(merger, 0, 0)
      left.connect(merger, 0, 1)
      right.connect(merger, 0, 1)
      return { input: splitter, output: merger }
    }
  }
}

const EDGE_S = 0.015

/** A slice of the source through a fault (or straight), faded at
 *  both edges. */
export async function renderFault(
  source: AudioBuffer,
  startS: number,
  lengthS: number,
  fault: FaultSpec | null,
  offline: OfflineFactory = defaultOffline,
): Promise<AudioBuffer> {
  const rate = source.sampleRate
  const ctx = offline(2, Math.ceil(lengthS * rate), rate)
  const player = ctx.createBufferSource()
  player.buffer = source
  const chain = faultChain(ctx, fault)
  const edge = ctx.createGain()
  edge.gain.setValueAtTime(0, 0)
  edge.gain.linearRampToValueAtTime(1, EDGE_S)
  edge.gain.setValueAtTime(1, Math.max(EDGE_S, lengthS - EDGE_S))
  edge.gain.linearRampToValueAtTime(0, lengthS)
  player.connect(chain.input)
  chain.output.connect(edge)
  edge.connect(ctx.destination)
  player.start(0, startS, lengthS)
  return ctx.startRendering()
}

export function rmsOf(buffer: AudioBuffer): number {
  let sum = 0
  let count = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
    count += data.length
  }
  return count === 0 ? 0 : Math.sqrt(sum / count)
}

export function scaleBuffer(buffer: AudioBuffer, factor: number): void {
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) data[i] *= factor
  }
}

/** Bring `target` to the reference's RMS, in place — a boost must not
 *  be the louder one. */
export function matchLoudness(
  reference: AudioBuffer,
  target: AudioBuffer,
): void {
  const want = rmsOf(reference)
  const have = rmsOf(target)
  if (want === 0 || have === 0) return
  scaleBuffer(target, want / have)
}

/** A slice start inside the source, leaving room for the slice. */
export function randomSliceStart(
  durationS: number,
  lengthS: number,
  random: () => number = Math.random,
): number {
  const room = durationS - lengthS
  if (room <= 0) return 0
  return Math.round(random() * room * 100) / 100
}
