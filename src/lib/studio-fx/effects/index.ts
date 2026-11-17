// ============================================================
// Studio effect registry — builds the graph for one effect spec
// ============================================================

import type { EffectSpec } from '@/lib/studio-fx/chain-spec'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { keepsOnlyLatency } from '@/lib/studio-fx/fx-profile'
import { createCompressorUnit } from './compressor'
import { createDeesserUnit } from './deesser'
import { createDelayUnit } from './delay'
import { createDynamicEqUnit } from './dyneq'
import { createEqUnit } from './eq'
import { createExciterUnit } from './exciter'
import { createGainUnit } from './gain'
import { createLatencyOnlyUnit } from './latency-only'
import { createLimiterUnit } from './limiter'
import { createReverbUnit } from './reverb'
import { createSaturationUnit } from './saturation'
import { createStereoUnit } from './stereo'
import { createTiltUnit } from './tilt'
import { createTransientUnit } from './transient'

export function createEffectUnit(
  ctx: BaseAudioContext,
  spec: EffectSpec,
  env: EffectEnv,
): EffectUnit {
  if (keepsOnlyLatency(env.profile, spec.kind))
    return createLatencyOnlyUnit(ctx, spec, env)
  switch (spec.kind) {
    case 'gain':
      return createGainUnit(ctx, spec, env)
    case 'eq':
      return createEqUnit(ctx, spec, env)
    case 'tilt':
      return createTiltUnit(ctx, spec, env)
    case 'dyneq':
      return createDynamicEqUnit(ctx, spec, env)
    case 'deesser':
      return createDeesserUnit(ctx, spec, env)
    case 'compressor':
      return createCompressorUnit(ctx, spec, env)
    case 'transient':
      return createTransientUnit(ctx, spec, env)
    case 'saturation':
      return createSaturationUnit(ctx, spec, env)
    case 'exciter':
      return createExciterUnit(ctx, spec, env)
    case 'stereo':
      return createStereoUnit(ctx, spec, env)
    case 'delay':
      return createDelayUnit(ctx, spec, env)
    case 'reverb':
      return createReverbUnit(ctx, spec, env)
    case 'limiter':
      return createLimiterUnit(ctx, spec, env)
  }
}
