// ============================================================
// Reward authoring — validate finite level rewards and bind them to runtime encounter IDs.
// ============================================================

import type { LevelRewardDefinition } from '../contracts'
import type { AuthoredLevelSource, LevelAuthoringDiagnostic } from './contracts'
import { diagnostic, ID_PATTERN } from './internal'

function validRewardId(
  value: string,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): boolean {
  if (ID_PATTERN.test(value)) return true
  diagnostic(
    diagnostics,
    'invalid-reward-id',
    path,
    `Reward ID "${value}" must use lowercase letters, numbers and hyphens.`,
  )
  return false
}

function runtimeEncounter(
  localId: string,
  path: string,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  diagnostics: LevelAuthoringDiagnostic[],
): string | undefined {
  const runtimeId = runtimeEncounterIds.get(localId)
  if (runtimeId !== undefined) return runtimeId
  diagnostic(
    diagnostics,
    'missing-reference',
    path,
    `Unknown encounter "${localId}".`,
  )
  return undefined
}

/** Reward validation is kept separate from room composition and challenge judging. */
export function compileRewards(
  source: AuthoredLevelSource,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  optionalEncounterIds: ReadonlySet<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): LevelRewardDefinition | undefined {
  const authored = source.rewards
  if (authored === undefined) return undefined
  if (!Number.isInteger(authored.revision) || authored.revision < 1)
    diagnostic(
      diagnostics,
      'invalid-reward-policy',
      'rewards.revision',
      'Reward revision must be a positive integer.',
    )

  const rewardIds = new Set<string>()
  const discoveryEncounters = new Set<string>()
  const discoveries = authored.discoveries.flatMap((discovery, index) => {
    const path = `rewards.discoveries.${index}`
    const encounterId = runtimeEncounter(
      discovery.encounterId,
      `${path}.encounterId`,
      runtimeEncounterIds,
      diagnostics,
    )
    if (!optionalEncounterIds.has(discovery.encounterId))
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        `${path}.encounterId`,
        'Discovery rewards must belong to an optional exhibit.',
      )
    if (discoveryEncounters.has(discovery.encounterId))
      diagnostic(
        diagnostics,
        'duplicate-reward',
        `${path}.encounterId`,
        `Encounter "${discovery.encounterId}" has more than one discovery reward.`,
      )
    discoveryEncounters.add(discovery.encounterId)
    if (discovery.coinIds.length === 0)
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        `${path}.coinIds`,
        'A discovery must author at least one finite coin.',
      )
    const coinIds = discovery.coinIds.filter((coinId, coinIndex) => {
      const valid = validRewardId(
        coinId,
        `${path}.coinIds.${coinIndex}`,
        diagnostics,
      )
      if (rewardIds.has(coinId))
        diagnostic(
          diagnostics,
          'duplicate-reward',
          `${path}.coinIds.${coinIndex}`,
          `Reward ID "${coinId}" is already authored in this level.`,
        )
      rewardIds.add(coinId)
      return valid
    })
    return encounterId === undefined ? [] : [{ encounterId, coinIds }]
  })

  const gradedEncounters = new Set<string>()
  const grading = authored.grading.flatMap((policy, index) => {
    const path = `rewards.grading.${index}`
    const encounterId = runtimeEncounter(
      policy.encounterId,
      `${path}.encounterId`,
      runtimeEncounterIds,
      diagnostics,
    )
    if (optionalEncounterIds.has(policy.encounterId))
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        `${path}.encounterId`,
        'Optional exhibits cannot affect the level singing-quality result.',
      )
    if (gradedEncounters.has(policy.encounterId))
      diagnostic(
        diagnostics,
        'duplicate-reward',
        `${path}.encounterId`,
        `Encounter "${policy.encounterId}" has more than one grading policy.`,
      )
    gradedEncounters.add(policy.encounterId)
    if (
      !Number.isInteger(policy.policyRevision) ||
      policy.policyRevision < 1 ||
      !Number.isInteger(policy.challengeRevision) ||
      policy.challengeRevision < 1 ||
      ![
        policy.minimumReliableSeconds,
        policy.threeStarMaxMeanCents,
        policy.twoStarMaxMeanCents,
        policy.maximumErrorCents,
      ].every(Number.isFinite) ||
      policy.minimumReliableSeconds <= 0 ||
      policy.threeStarMaxMeanCents <= 0 ||
      policy.twoStarMaxMeanCents <= policy.threeStarMaxMeanCents ||
      policy.maximumErrorCents < policy.twoStarMaxMeanCents
    )
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        path,
        'Pitch grading needs positive revisions and evidence time with 0 < three-star < two-star <= maximum error.',
      )
    return encounterId === undefined ? [] : [{ ...policy, encounterId }]
  })

  let portrait: LevelRewardDefinition['portrait']
  if (authored.portrait !== undefined) {
    const item = authored.portrait
    const trigger = runtimeEncounter(
      item.awardAfterEncounterId,
      'rewards.portrait.awardAfterEncounterId',
      runtimeEncounterIds,
      diagnostics,
    )
    validRewardId(item.portraitId, 'rewards.portrait.portraitId', diagnostics)
    validRewardId(item.legendId, 'rewards.portrait.legendId', diagnostics)
    validRewardId(
      item.imageAssetId,
      'rewards.portrait.imageAssetId',
      diagnostics,
    )
    if (rewardIds.has(item.portraitId))
      diagnostic(
        diagnostics,
        'duplicate-reward',
        'rewards.portrait.portraitId',
        `Reward ID "${item.portraitId}" is already authored in this level.`,
      )
    if (!Number.isInteger(item.collectionIndex) || item.collectionIndex < 1)
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        'rewards.portrait.collectionIndex',
        'Portrait collection index must be a positive integer.',
      )
    if (optionalEncounterIds.has(item.awardAfterEncounterId))
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        'rewards.portrait.awardAfterEncounterId',
        'A level portrait must be awarded by a required encounter.',
      )
    if (!source.exit.requiresCompleted.includes(item.awardAfterEncounterId))
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        'rewards.portrait.awardAfterEncounterId',
        'The portrait trigger must be a final encounter required by the exit.',
      )
    if (item.title.trim().length === 0)
      diagnostic(
        diagnostics,
        'invalid-reward-policy',
        'rewards.portrait.title',
        'Portrait title must not be empty.',
      )
    if (trigger !== undefined)
      portrait = { ...item, awardAfterEncounterId: trigger }
  }

  return {
    revision: authored.revision,
    discoveries,
    grading,
    ...(portrait === undefined ? {} : { portrait }),
  }
}
