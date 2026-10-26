// Studio FX validation — verify saved chains without silently dropping effects or parameters.
import type { ChainSpec, ParamValues } from '@/lib/studio-fx/chain-spec'
import { CHAIN_SPEC_VERSION, MAX_CHAIN_EFFECTS, } from '@/lib/studio-fx/chain-spec'
import { EFFECT_KINDS, paramDescriptors, } from '@/lib/studio-fx/effect-definitions'
import type { MixMacros } from '@/lib/studio-fx/mix-macros'
import { MACRO_KEYS } from '@/lib/studio-fx/mix-macros'
import { arrayValue, boolValue, enumValue, idValue, numberValue, record, requireValue, uniqueValue, } from './validation-values'

export function validateStudioMacros(raw: unknown, path = 'macros'): MixMacros {
  const values = record(raw, path, MACRO_KEYS)
  for (const key of MACRO_KEYS)
    numberValue(values[key], `${path}.${key}`, -100, 100)
  return structuredClone(raw) as MixMacros
}

export function validateStudioMasterEq(
  raw: unknown,
  path: string,
): ParamValues {
  const descriptors = paramDescriptors('eq')
  const values = record(
    raw,
    path,
    descriptors.map((p) => p.key),
  )
  for (const descriptor of descriptors) {
    numberValue(
      values[descriptor.key],
      `${path}.${descriptor.key}`,
      descriptor.min,
      descriptor.max,
    )
  }
  return structuredClone(raw) as ParamValues
}

export function validateStudioChain(raw: unknown, path = 'chain'): ChainSpec {
  const chain = record(raw, path, ['version', 'effects'])
  enumValue(chain.version, [CHAIN_SPEC_VERSION], `${path}.version`)
  const effects = arrayValue(chain.effects, `${path}.effects`)
  requireValue(
    effects.length <= MAX_CHAIN_EFFECTS,
    `${path}.effects`,
    'Too many effects',
  )
  const ids = new Set<string | number>()
  effects.forEach((rawEffect, index) => {
    const at = `${path}.effects[${index}]`
    const effect = record(rawEffect, at, ['id', 'kind', 'enabled', 'params'])
    const id = idValue(effect.id, `${at}.id`)
    requireValue(
      id.length <= 64,
      `${at}.id`,
      'Effect identifier exceeds 64 characters',
    )
    uniqueValue(id, ids, `${at}.id`)
    const kind = enumValue(effect.kind, EFFECT_KINDS, `${at}.kind`)
    boolValue(effect.enabled, `${at}.enabled`)
    const descriptors = paramDescriptors(kind)
    const params = record(
      effect.params,
      `${at}.params`,
      descriptors.map((p) => p.key),
    )
    for (const descriptor of descriptors)
      numberValue(
        params[descriptor.key],
        `${at}.params.${descriptor.key}`,
        descriptor.min,
        descriptor.max,
      )
    if (id === 'level-match' || id === 'balance') {
      requireValue(
        kind === 'gain' && params.gainDb === 0,
        at,
        'Preparation and balance gains belong outside the lane chain',
      )
    }
  })
  return structuredClone(raw) as ChainSpec
}
