// ============================================================
// Studio EQ — six-band channel-strip equaliser
// ============================================================
//
// Low cut, low shelf, two peaking mids, high shelf, high cut, in series.
// The low cut is a fourth-order Butterworth (24 dB/octave, as in fx-lab's
// vocal front end), steep enough to take rumble and handling noise without
// thinning the body just above it; the high cut is 12 dB/octave.
//
// Biquads add no latency, so the bypass path is a plain wire. At its defaults
// (cuts parked at 20 Hz and 20 kHz, where they switch out, every gain 0 dB)
// the EQ is exactly flat.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createButterworth4, createEffectShell, highCutFrequency, lowCutFrequency, writeParam, } from '@/lib/studio-fx/effect-shell'

function createBand(
  ctx: BaseAudioContext,
  type: 'lowshelf' | 'peaking' | 'highshelf',
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter()
  filter.type = type
  return filter
}

export function createEqUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'eq'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const lowCut = createButterworth4(ctx, 'highpass')
  const lowShelf = createBand(ctx, 'lowshelf')
  const lowMid = createBand(ctx, 'peaking')
  const highMid = createBand(ctx, 'peaking')
  const highShelf = createBand(ctx, 'highshelf')
  const highCut = createButterworth(ctx, 'lowpass')
  const bands = [...lowCut, lowShelf, lowMid, highMid, highShelf, highCut]
  connectSeries([shell.input, ...bands, shell.wet])
  shell.input.connect(shell.dry)

  const apply = (p: EffectParams<'eq'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    for (const stage of lowCut) {
      write(stage.frequency, lowCutFrequency(p.lowCutHz))
    }
    write(lowShelf.frequency, p.lowShelfHz)
    write(lowShelf.gain, p.lowShelfDb)
    write(lowMid.frequency, p.lowMidHz)
    write(lowMid.gain, p.lowMidDb)
    write(lowMid.Q, p.lowMidQ)
    write(highMid.frequency, p.highMidHz)
    write(highMid.gain, p.highMidDb)
    write(highMid.Q, p.highMidQ)
    write(highShelf.frequency, p.highShelfHz)
    write(highShelf.gain, p.highShelfDb)
    write(highCut.frequency, highCutFrequency(p.highCutHz, ctx.sampleRate))
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'eq',
    env,
    shell,
    nodes: bands,
    apply: (params, glide) => apply(params as EffectParams<'eq'>, glide),
  })
}
