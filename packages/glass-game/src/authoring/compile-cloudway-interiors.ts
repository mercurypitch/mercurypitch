// Crystal authoring — accept bounded light sculptures only on reviewed transmissive scroll decks.
import type { CrystalInteriorPresentationDefinition, PlatformDefinition, } from '../contracts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from '../render/cloudway-laboratory-catalog.ts'
import { array, exactKeys, fail, finite, identifierSet, record, string, } from './cloudway-course-validation.ts'

export function compileCloudwayInteriors(
  raw: unknown,
  platforms: readonly PlatformDefinition[],
  path: string,
): readonly CrystalInteriorPresentationDefinition[] | undefined {
  if (raw === undefined) return undefined
  const entries = array(raw, path)
  if (entries.length > 16)
    fail(path, 'supports at most 16 interior sculptures.')
  const result = entries.map(
    (item, index): CrystalInteriorPresentationDefinition => {
      const p = `${path}[${index}]`
      const value = record(item, p)
      exactKeys(
        value,
        p,
        ['platformId', 'preset', 'seed'],
        ['intensity', 'speed', 'palette'],
      )
      const platformId = string(value.platformId, `${p}.platformId`)
      const platform = platforms.find(
        (candidate) => candidate.id === platformId,
      )
      if (
        platform?.renderId !== CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll ||
        platform.behavior?.kind !== 'scroll'
      )
        fail(`${p}.platformId`, 'must reference a certified gilt scroll deck.')
      const preset = value.preset
      if (
        preset !== 'resonance-veins' &&
        preset !== 'frost-roots' &&
        preset !== 'aurora-heart'
      )
        fail(`${p}.preset`, 'must use a known crystal interior preset.')
      const seed = finite(value.seed, `${p}.seed`)
      if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
        fail(`${p}.seed`, 'must be an unsigned 32-bit integer.')
      const tuning: { intensity?: number; speed?: number } = {}
      for (const key of ['intensity', 'speed'] as const) {
        if (value[key] === undefined) continue
        const setting = finite(value[key], `${p}.${key}`)
        if (setting < 0 || setting > 4)
          fail(`${p}.${key}`, 'must be between 0 and 4.')
        tuning[key] = setting
      }
      let palette: CrystalInteriorPresentationDefinition['palette']
      if (value.palette !== undefined) {
        const colors = record(value.palette, `${p}.palette`)
        exactKeys(colors, `${p}.palette`, ['primary', 'secondary', 'accent'])
        const color = (key: string) => {
          const rgb = finite(colors[key], `${p}.palette.${key}`)
          if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff)
            fail(`${p}.palette.${key}`, 'must be a 24-bit RGB integer.')
          return rgb
        }
        palette = {
          primary: color('primary'),
          secondary: color('secondary'),
          accent: color('accent'),
        }
      }
      return {
        platformId,
        preset,
        seed,
        ...tuning,
        ...(palette ? { palette } : {}),
      }
    },
  )
  identifierSet(
    result.map((entry) => entry.platformId),
    path,
  )
  return result
}
