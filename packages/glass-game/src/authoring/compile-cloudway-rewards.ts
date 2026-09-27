// Cloudway discovery rewards — strict finite tokens for optional route encounters.

import type { BreakableDefinition, LevelRewardDefinition, } from '../contracts.ts'
import { array, exactKeys, fail, positive, record, string, stringArray, } from './cloudway-course-validation.ts'
import { ID_PATTERN } from './internal.ts'

/** Compile the deliberately small reward surface supported by JSON courses. */
export function compileCloudwayDiscoveryRewards(
  raw: unknown,
  encounters: readonly Pick<BreakableDefinition, 'id' | 'optional'>[],
  path: string,
): LevelRewardDefinition | undefined {
  if (raw === undefined) return undefined

  const source = record(raw, path)
  exactKeys(source, path, ['revision', 'discoveries'])
  const revision = positive(source.revision, `${path}.revision`)
  if (!Number.isInteger(revision))
    fail(`${path}.revision`, 'must be an integer.')

  const encounterById = new Map(
    encounters.map((encounter) => [encounter.id, encounter]),
  )
  const rewardedEncounterIds = new Set<string>()
  const coinIds = new Set<string>()
  const discoveries = array(source.discoveries, `${path}.discoveries`).map(
    (rawDiscovery, index) => {
      const discoveryPath = `${path}.discoveries[${index}]`
      const discovery = record(rawDiscovery, discoveryPath)
      exactKeys(discovery, discoveryPath, ['encounterId', 'coinIds'])
      const encounterId = string(
        discovery.encounterId,
        `${discoveryPath}.encounterId`,
      )
      const encounter = encounterById.get(encounterId)
      if (encounter === undefined)
        fail(
          `${discoveryPath}.encounterId`,
          `references unknown encounter "${encounterId}".`,
        )
      if (!encounter.optional)
        fail(
          `${discoveryPath}.encounterId`,
          'must reference an optional encounter.',
        )
      if (rewardedEncounterIds.has(encounterId))
        fail(
          `${discoveryPath}.encounterId`,
          `duplicates rewarded encounter "${encounterId}".`,
        )
      rewardedEncounterIds.add(encounterId)

      const discoveryCoinIds = stringArray(
        discovery.coinIds,
        `${discoveryPath}.coinIds`,
      )
      if (discoveryCoinIds.length === 0)
        fail(`${discoveryPath}.coinIds`, 'must contain at least one coin.')
      for (const [coinIndex, coinId] of discoveryCoinIds.entries()) {
        const coinPath = `${discoveryPath}.coinIds[${coinIndex}]`
        if (!ID_PATTERN.test(coinId))
          fail(coinPath, 'must use lowercase letters, numbers and hyphens.')
        if (coinIds.has(coinId))
          fail(coinPath, `duplicates finite coin "${coinId}".`)
        coinIds.add(coinId)
      }
      return { encounterId, coinIds: discoveryCoinIds }
    },
  )

  return { revision, discoveries, grading: [] }
}
