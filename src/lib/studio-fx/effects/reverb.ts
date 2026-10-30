// ============================================================
// Studio reverb — synthetic room with click-free impulse changes
// ============================================================
//
// pre-delay -> low cut -> convolver -> high cut. The impulse response is
// generated (reverb-impulse.ts) from decay and damping, so changing either
// means a new buffer — and assigning a buffer to a running ConvolverNode cuts
// its tail dead. So there are two convolvers: a new impulse loads into the
// silent one, the two cross-fade, and the old one is detached once it is
// inaudible. A change that arrives mid-fade waits for the fade to finish and
// then jumps straight to the latest setting, so dragging the decay slider
// produces a handful of swaps, not one per pixel.
//
// Offline (or before audio starts) there is nothing to click, and the
// impulse is simply set.
//
// `duck` keys the return from the dry signal (ducker.ts): the space steps
// back while a word sounds and blooms in the gaps, as fx-lab's vocal reverb
// does. At 0 the return is not ducked at all.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { equalPowerMix } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createEffectShell, highCutFrequency, lowCutFrequency, writeParam, } from '@/lib/studio-fx/effect-shell'
import { generateReverbImpulse } from '@/lib/studio-fx/reverb-impulse'
import { createDucker } from './ducker'

const MAX_PRE_DELAY_SECONDS = 0.25
const SWAP_TIME_CONSTANT = 0.04
/** Six time constants: the outgoing convolver is below -50 dB by then. */
const SWAP_SECONDS = SWAP_TIME_CONSTANT * 6
/** Twelve: below -100 dB, so its impulse can go without a step. */
const RELEASE_SECONDS = SWAP_TIME_CONSTANT * 12
const CACHE_LIMIT = 8

const impulseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()
const impulseOwners = new WeakMap<BaseAudioContext, number>()

/** Cached impulses belong to live units, not the lifetime of a borrowed context. */
function retainImpulseCache(ctx: BaseAudioContext): () => void {
  impulseOwners.set(ctx, (impulseOwners.get(ctx) ?? 0) + 1)
  return () => {
    const remaining = (impulseOwners.get(ctx) ?? 1) - 1
    if (remaining > 0) impulseOwners.set(ctx, remaining)
    else {
      impulseOwners.delete(ctx)
      impulseCache.delete(ctx)
    }
  }
}

interface ImpulseSetting {
  readonly decayS: number
  readonly damping: number
}

function impulseKey(setting: ImpulseSetting): string {
  return `${setting.decayS.toFixed(2)}|${setting.damping.toFixed(2)}`
}

function impulseBuffer(
  ctx: BaseAudioContext,
  setting: ImpulseSetting,
): AudioBuffer {
  const key = impulseKey(setting)
  let cache = impulseCache.get(ctx)
  if (cache === undefined) {
    cache = new Map()
    impulseCache.set(ctx, cache)
  }
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const [left, right] = generateReverbImpulse({
    sampleRate: ctx.sampleRate,
    decaySeconds: setting.decayS,
    damping: setting.damping / 100,
  })
  const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate)
  buffer.copyToChannel(left, 0)
  buffer.copyToChannel(right, 1)
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, buffer)
  return buffer
}

interface ConvolverSlot {
  readonly convolver: ConvolverNode
  readonly gain: GainNode
  attached: boolean
}

interface ImpulseSwitcherOptions {
  readonly ctx: BaseAudioContext
  readonly env: EffectEnv
  readonly feed: AudioNode
  readonly slots: readonly [ConvolverSlot, ConvolverSlot]
}

/** Owns which convolver is live and moves between them without a cut. */
function createImpulseSwitcher(options: ImpulseSwitcherOptions) {
  const { ctx, env, feed, slots } = options
  let active = 0
  let activeKey = ''
  let fadeEndsAt = Number.NEGATIVE_INFINITY
  let pending: ImpulseSetting | null = null
  let retryScheduled = false
  let swaps = 0
  const timers = new Set<() => void>()

  const later = (callback: () => void, seconds: number): void => {
    const cancel = env.schedule(
      () => {
        timers.delete(cancel)
        callback()
      },
      Math.ceil(seconds * 1000) + 5,
    )
    timers.add(cancel)
  }
  const attach = (slot: ConvolverSlot): void => {
    if (slot.attached) return
    feed.connect(slot.convolver)
    slot.attached = true
  }
  const detach = (slot: ConvolverSlot): void => {
    if (!slot.attached) return
    feed.disconnect(slot.convolver)
    slot.attached = false
  }
  /**
   * A slot that has faded out also lets its impulse go: a loaded convolver
   * is the most memory a reverb holds, and the next swap loads a new one.
   */
  const release = (slot: ConvolverSlot): void => {
    detach(slot)
    if (slot.convolver.buffer !== null) slot.convolver.buffer = null
  }

  const swapTo = (setting: ImpulseSetting): void => {
    const outgoing = active
    const incoming = 1 - active
    const now = ctx.currentTime
    attach(slots[incoming])
    slots[incoming].convolver.buffer = impulseBuffer(ctx, setting)
    writeParam(slots[incoming].gain.gain, 1, ctx, true, SWAP_TIME_CONSTANT)
    writeParam(slots[outgoing].gain.gain, 0, ctx, true, SWAP_TIME_CONSTANT)
    active = incoming
    activeKey = impulseKey(setting)
    fadeEndsAt = now + SWAP_SECONDS
    later(() => {
      if (active !== outgoing) detach(slots[outgoing])
    }, SWAP_SECONDS)
    // A later swap fades a slot of its own and lets that one go itself.
    const swap = ++swaps
    later(() => {
      if (swap === swaps) release(slots[outgoing])
    }, RELEASE_SECONDS)
  }

  const setNow = (setting: ImpulseSetting): void => {
    attach(slots[active])
    slots[active].convolver.buffer = impulseBuffer(ctx, setting)
    writeParam(slots[active].gain.gain, 1, ctx, false)
    writeParam(slots[1 - active].gain.gain, 0, ctx, false)
    release(slots[1 - active])
    activeKey = impulseKey(setting)
  }

  const request = (setting: ImpulseSetting, glide: boolean): void => {
    pending = null
    if (!glide) {
      setNow(setting)
      return
    }
    if (impulseKey(setting) === activeKey) return
    const wait = fadeEndsAt - ctx.currentTime
    if (wait > 0) {
      pending = setting
      if (!retryScheduled) {
        retryScheduled = true
        later(() => {
          retryScheduled = false
          const next = pending
          if (next !== null) request(next, env.isLive())
        }, wait)
      }
      return
    }
    swapTo(setting)
  }

  return {
    request,
    dispose(): void {
      for (const cancel of timers) cancel()
      timers.clear()
      pending = null
      retryScheduled = false
    },
  }
}

function createSlot(ctx: BaseAudioContext): ConvolverSlot {
  const convolver = ctx.createConvolver()
  convolver.normalize = true
  const gain = ctx.createGain()
  convolver.connect(gain)
  return { convolver, gain, attached: false }
}

export function createReverbUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'reverb'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(
    ctx,
    spec.enabled,
    equalPowerMix(spec.params.mix / 100),
  )
  const preDelay = ctx.createDelay(MAX_PRE_DELAY_SECONDS)
  const lowCut = createButterworth(ctx, 'highpass')
  const highCut = createButterworth(ctx, 'lowpass')
  const slots: [ConvolverSlot, ConvolverSlot] = [
    createSlot(ctx),
    createSlot(ctx),
  ]
  const ducker = createDucker(ctx)
  connectSeries([shell.input, preDelay, lowCut])
  for (const slot of slots) slot.gain.connect(highCut)
  connectSeries([highCut, ducker.ducked, shell.wet])
  shell.input.connect(ducker.key)
  shell.input.connect(shell.dry)
  const switcher = createImpulseSwitcher({ ctx, env, feed: lowCut, slots })

  const apply = (p: EffectParams<'reverb'>, glide: boolean): void => {
    writeParam(preDelay.delayTime, p.preDelayMs / 1000, ctx, glide)
    writeParam(lowCut.frequency, lowCutFrequency(p.lowCutHz), ctx, glide)
    writeParam(
      highCut.frequency,
      highCutFrequency(p.highCutHz, ctx.sampleRate),
      ctx,
      glide,
    )
    switcher.request({ decayS: p.decayS, damping: p.damping }, glide)
    ducker.setDepth(p.duck / 100, glide)
    shell.setBalance(equalPowerMix(p.mix / 100), glide)
  }
  apply(spec.params, false)
  const releaseImpulseCache = retainImpulseCache(ctx)

  return assembleUnit({
    kind: 'reverb',
    env,
    shell,
    nodes: [
      preDelay,
      lowCut,
      highCut,
      ...slots.flatMap((slot) => [slot.convolver, slot.gain]),
      ...ducker.nodes,
    ],
    apply: (params, glide) => apply(params as EffectParams<'reverb'>, glide),
    onDispose: () => {
      switcher.dispose()
      for (const slot of slots) slot.convolver.buffer = null
      releaseImpulseCache()
    },
  })
}
