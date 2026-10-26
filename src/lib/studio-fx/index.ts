// ============================================================
// Studio FX — insert effect chains for Studio tracks and the master bus
// ============================================================
//
// For a beginner, nothing needs choosing: `autoMixChain(role, clip)` measures
// the clip and returns the industry-standard chain for its role (lead or
// backing vocals, acoustic or electric guitar, bass, piano, keys, a drum bus,
// a backing track), and `renderMasteredMix` masters the bounced song to a
// target loudness. Five macros (space, tone, punch, warmth, width) and a few
// named flavours change the character of every chain at once. Underneath, any
// chain is a plain spec:
//
//   const chain = createStudioFxChain(ctx, autoMixChain('voice', take))
//   source.connect(chain.input)
//   chain.output.connect(trackBus)
//   chain.setSpec(roleChain('voice', { measuredLufs, macros: { ...m, space: 40 } }))
//
// `renderThroughChain` bounces a buffer through the same spec offline, and
// `measureChainLatencyFrames` reports how far a chain delays its track, so a
// multitrack engine can keep tracks with different chains aligned.

export type { AutoMixedTrack, RoleChainOptions } from './auto-mix'
export {
  autoMixChain,
  autoMixTrack,
  balanceTrimDb,
  levelMatchGainDb,
  REFERENCE_LUFS,
  roleChain,
} from './auto-mix'
export type { StudioFxChain, StudioFxChainOptions } from './chain'
export { createStudioFxChain } from './chain'
export type {
  ChainSpec,
  EffectSpec,
  EffectSpecOf,
  ParamValues,
} from './chain-spec'
export {
  CHAIN_SPEC_VERSION,
  createEffectSpec,
  defaultEffectParams,
  EMPTY_CHAIN,
  insertEffect,
  MAX_CHAIN_EFFECTS,
  moveEffect,
  normalizeChainSpec,
  normalizeEffectParams,
  removeEffect,
  updateEffect,
} from './chain-spec'
export type {
  EffectDefinition,
  EffectKind,
  EffectParams,
  ParamDescriptor,
  ParamUnit,
} from './effect-definitions'
export {
  EFFECT_DEFINITIONS,
  EFFECT_KINDS,
  isEffectKind,
  paramDescriptors,
} from './effect-definitions'
export type { LoudnessMeasurement, SampledAudio } from './loudness'
export { integratedLoudness, measureLoudness } from './loudness'
export type {
  LoudnessPreset,
  MasteredMix,
  MasterOptions,
  MasterSound,
} from './master'
export {
  DEFAULT_TARGET_LUFS,
  LOUDNESS_PRESETS,
  MASTER_CEILING_DB,
  masterBusChain,
  masterChain,
  masterGainDb,
  renderMasteredMix,
} from './master'
export type { MixdownTrack } from './mixdown'
export {
  alignmentOffsets,
  measureTrackLatencies,
  renderMixdown,
} from './mixdown'
export type { MacroKey, MixFlavour, MixMacros } from './mix-macros'
export {
  applyMixMacros,
  findFlavour,
  MACRO_KEYS,
  MACRO_LABELS,
  MIX_FLAVOURS,
  NEUTRAL_MACROS,
  normalizeMacros,
  trackMacros,
} from './mix-macros'
export type { StudioFxPreset } from './presets'
export {
  MASTER_BUS_CHAIN,
  MASTER_CHAIN_PRESET,
  STUDIO_FX_PRESETS,
} from './presets'
export type { RenderThroughChainOptions } from './render'
export {
  estimateTailSeconds,
  measureChainLatencyFrames,
  renderThroughChain,
} from './render'
export type { EffectDraft, RoleTemplateOptions, TrackRole } from './role-chains'
export {
  isTrackRole,
  normalizeTrackRole,
  ROLE_BALANCE_DB,
  ROLE_LABELS,
  roleTemplate,
  tempoMs,
  TRACK_ROLES,
} from './role-chains'
