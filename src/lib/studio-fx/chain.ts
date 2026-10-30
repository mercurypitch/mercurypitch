// ============================================================
// Studio FX chain — an ordered insert chain driven by a chain spec
// ============================================================
//
// `input -> effect -> effect -> ... -> output`, built from a ChainSpec and
// kept in step with every new spec handed to `setSpec`. Effects are matched
// by id, so a spec that only changes values reuses the running graphs (a
// reverb keeps its tail, a delay its echoes) and only sends the changed
// values.
//
// Adding, removing or reordering effects means re-patching connections, and
// re-patching a live signal steps the waveform. So a structural change first
// ducks the chain's output (about 40 ms to -58 dB), re-patches while it is
// silent, and opens again; further changes that arrive during the duck are
// folded into the same re-patch. Offline, or before the context runs, the
// chain re-patches at once.
//
// The chain never connects itself to a destination and never starts or stops
// a source: the caller owns transport envelopes, as with every other audio
// surface (see .claude/memory/audio-pop-free-playback.md).
//
// Dynamic EQs next to each other run side by side (effects/dyneq.ts): each
// after the first takes its band from the run's input, so a run of four
// bands adds one compressor lookahead to the chain, not four.
//
// A compressor-based effect (compressor, de-esser, limiter) fades in when it
// is created: DynamicsCompressorNode starts ~17 dB down and settles over
// ~300 ms. Its latency twin does the same, so the fade is smooth and bypass
// never jumps, but a chain should be built before its audio starts. Offline
// renders pre-roll past it (render.ts).

import type { ChainSpec, EffectSpec, ParamValues } from './chain-spec'
import { CHAIN_SPEC_VERSION, normalizeChainSpec, normalizeEffectParams, } from './chain-spec'
import type { EffectEnv, EffectUnit } from './effect-shell'
import { isRealtimeRunning, writeParam } from './effect-shell'
import { createEffectUnit } from './effects'

const DUCK_MS = 40
const DUCK_TIME_CONSTANT = 0.006
const OPEN_TIME_CONSTANT = 0.012

export interface StudioFxChain {
  /** Connect sources here. */
  readonly input: AudioNode
  /** Connect this to a bus or the destination. */
  readonly output: AudioNode
  getSpec(): ChainSpec
  /** Bring the running chain in line with `spec` (untrusted input is fine). */
  setSpec(spec: unknown): void
  setEffectEnabled(id: string, enabled: boolean): void
  setEffectParams(id: string, params: ParamValues): void
  /** Gain reduction of a dynamics effect in dB (negative), else 0. */
  readReductionDb(id: string): number
  /** Settle every new compressor from `at` (effect-shell.ts `settleRelease`). */
  settle(at: number): void
  dispose(): void
}

export interface StudioFxChainOptions {
  /** Timer for the re-patch after a duck; injectable for tests. */
  readonly schedule?: (callback: () => void, delayMs: number) => () => void
  /** Effect graph factory; injectable for tests. */
  readonly createUnit?: (
    ctx: BaseAudioContext,
    spec: EffectSpec,
    env: EffectEnv,
  ) => EffectUnit
}

interface Slot {
  spec: EffectSpec
  readonly unit: EffectUnit
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const handle = setTimeout(callback, delayMs)
  return () => clearTimeout(handle)
}

function paramsEqual(a: ParamValues, b: ParamValues): boolean {
  return Object.keys(a).every((key) => a[key] === b[key])
}

function sameOrder(a: readonly Slot[], b: readonly Slot[]): boolean {
  return a.length === b.length && a.every((slot, i) => slot.unit === b[i].unit)
}

/** Send a reused effect only what changed between two specs. */
function syncUnit(unit: EffectUnit, from: EffectSpec, to: EffectSpec): void {
  if (from.enabled !== to.enabled) unit.setEnabled(to.enabled)
  if (!paramsEqual(from.params, to.params)) unit.setParams(to.params)
}

export function createStudioFxChain(
  ctx: BaseAudioContext,
  spec: unknown,
  options: StudioFxChainOptions = {},
): StudioFxChain {
  const env: EffectEnv = {
    isLive: () => isRealtimeRunning(ctx),
    schedule: options.schedule ?? defaultSchedule,
  }
  const createUnit = options.createUnit ?? createEffectUnit
  const input = ctx.createGain()
  const duck = ctx.createGain()
  const output = ctx.createGain()
  duck.connect(output)

  let slots: Slot[] = normalizeChainSpec(spec).effects.map((effect) => ({
    spec: effect,
    unit: createUnit(ctx, effect, env),
  }))
  let wired: EffectUnit[] = []
  let retired: EffectUnit[] = []
  let cancelRepatch: (() => void) | null = null
  let disposed = false

  const patch = (): void => {
    input.disconnect()
    for (const unit of wired) unit.output.disconnect()
    let previous: AudioNode = input
    let runInput: AudioNode | null = null
    for (const { unit } of slots) {
      previous.connect(unit.input)
      if (unit.follow) {
        unit.follow(runInput)
        runInput ??= previous
      } else runInput = null
      previous = unit.output
    }
    previous.connect(duck)
    wired = slots.map((slot) => slot.unit)
    for (const unit of retired) unit.dispose()
    retired = []
  }
  patch()

  const repatch = (): void => {
    if (!env.isLive()) {
      cancelRepatch?.()
      cancelRepatch = null
      writeParam(duck.gain, 1, ctx, false)
      patch()
      return
    }
    if (cancelRepatch !== null) return
    writeParam(duck.gain, 0, ctx, true, DUCK_TIME_CONSTANT)
    cancelRepatch = env.schedule(() => {
      cancelRepatch = null
      if (disposed) return
      patch()
      writeParam(duck.gain, 1, ctx, true, OPEN_TIME_CONSTANT)
    }, DUCK_MS)
  }

  const findSlot = (id: string): Slot | undefined =>
    slots.find((slot) => slot.spec.id === id)

  const setSpec = (next: unknown): void => {
    if (disposed) return
    const reusable = new Map(slots.map((slot) => [slot.spec.id, slot]))
    const nextSlots = normalizeChainSpec(next).effects.map((effect): Slot => {
      const existing = reusable.get(effect.id)
      if (existing === undefined || existing.spec.kind !== effect.kind) {
        return { spec: effect, unit: createUnit(ctx, effect, env) }
      }
      reusable.delete(effect.id)
      syncUnit(existing.unit, existing.spec, effect)
      return { spec: effect, unit: existing.unit }
    })
    retired.push(...[...reusable.values()].map((slot) => slot.unit))
    const changedShape = !sameOrder(slots, nextSlots)
    slots = nextSlots
    if (changedShape) repatch()
  }

  return {
    input,
    output,
    getSpec: () => ({
      version: CHAIN_SPEC_VERSION,
      effects: slots.map((slot) => slot.spec),
    }),
    setSpec,
    setEffectEnabled(id, enabled) {
      const slot = findSlot(id)
      if (slot === undefined || disposed || slot.spec.enabled === enabled)
        return
      slot.spec = { ...slot.spec, enabled }
      slot.unit.setEnabled(enabled)
    },
    setEffectParams(id, params) {
      const slot = findSlot(id)
      if (slot === undefined || disposed) return
      const merged = normalizeEffectParams(slot.spec.kind, {
        ...slot.spec.params,
        ...params,
      })
      if (paramsEqual(slot.spec.params, merged)) return
      slot.spec = { ...slot.spec, params: merged } as EffectSpec
      slot.unit.setParams(merged)
    },
    readReductionDb: (id) => findSlot(id)?.unit.readReductionDb() ?? 0,
    settle(at) {
      for (const { unit } of slots) unit.settle?.(at)
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelRepatch?.()
      cancelRepatch = null
      input.disconnect()
      duck.disconnect()
      output.disconnect()
      for (const { unit } of slots) unit.dispose()
      for (const unit of retired) unit.dispose()
      slots = []
      retired = []
    },
  }
}
