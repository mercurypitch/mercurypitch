// Replay profiles — resolve authored lesson goals without changing movement or capture quality.

import type { ChallengeDefinition, LevelDefinition, PitchStepDefinition, } from '../contracts'

export type LevelStarTier = 1 | 2 | 3

export interface EncounterReplayOverride {
  holdSeconds?: number
  toleranceCents?: number
  waveCycles?: number
  waveSeconds?: number
}

export interface ReplayProfile {
  id: string
  revision: number
  tier: LevelStarTier
  title: string
  description: string
  /** Every required encounter is explicit, keyed by full or unique authored local ID. */
  encounters: Readonly<Record<string, EncounterReplayOverride>>
}

export interface ReplayIdentity {
  levelId: string
  contentRevision: number
  profileId: string
  profileRevision: number
  /** Prevent an unversioned authoring edit from inheriting incompatible progress. */
  challengeSignature: string
}

export interface ResolvedReplay {
  level: LevelDefinition
  profile: ReplayProfile
  identity: ReplayIdentity
}

function positive(value: number | undefined, maximum: number): boolean {
  return (
    value === undefined ||
    (Number.isFinite(value) && value > 0 && value <= maximum)
  )
}

function resolveChallenge(
  challenge: ChallengeDefinition,
  patch: EncounterReplayOverride,
): ChallengeDefinition {
  if (
    !positive(patch.holdSeconds, 10) ||
    !positive(patch.toleranceCents, 250) ||
    !positive(patch.waveSeconds, 12) ||
    !positive(patch.waveCycles, 4) ||
    (patch.waveCycles !== undefined && !Number.isInteger(patch.waveCycles))
  )
    throw new Error(
      'Replay lesson values must be finite and within the authored practice bounds.',
    )
  if (
    challenge.kind !== 'settle-wave' &&
    (patch.waveCycles !== undefined || patch.waveSeconds !== undefined)
  )
    throw new Error('Wave goals require a pitch-wave exhibit.')
  const step = (value: PitchStepDefinition): PitchStepDefinition => ({
    ...value,
    hold: {
      ...value.hold,
      ...(patch.holdSeconds === undefined
        ? {}
        : { requiredSeconds: patch.holdSeconds }),
      ...(patch.toleranceCents === undefined
        ? {}
        : { toleranceCents: patch.toleranceCents }),
    },
  })
  switch (challenge.kind) {
    case 'hold':
      return { ...challenge, step: step(challenge.step) }
    case 'ordered-pair':
      return {
        ...challenge,
        steps: [step(challenge.steps[0]), step(challenge.steps[1])],
      }
    case 'settle-wave':
      return {
        ...challenge,
        step: step(challenge.step),
        wave: {
          ...challenge.wave,
          ...(patch.waveCycles === undefined
            ? {}
            : { requiredCycles: patch.waveCycles }),
          ...(patch.waveSeconds === undefined
            ? {}
            : { minimumWaveSeconds: patch.waveSeconds }),
        },
      }
  }
}

export function replayIdentityKey(identity: ReplayIdentity): string {
  return `${identity.levelId}:${identity.contentRevision}:${identity.profileId}:${identity.profileRevision}`
}

export function sameReplayIdentity(
  left: ReplayIdentity,
  right: ReplayIdentity,
): boolean {
  return (
    replayIdentityKey(left) === replayIdentityKey(right) &&
    left.challengeSignature === right.challengeSignature
  )
}

export function resolveReplayProfile(
  level: LevelDefinition,
  profile: ReplayProfile,
): ResolvedReplay {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.id) ||
    !Number.isSafeInteger(profile.revision) ||
    profile.revision < 1 ||
    ![1, 2, 3].includes(profile.tier)
  )
    throw new Error(
      'Replay profiles need a stable ID, positive revision and one to three stars.',
    )
  const overrides = new Map<string, EncounterReplayOverride>()
  for (const [id, patch] of Object.entries(profile.encounters)) {
    const matching = level.breakables.filter(
      (item) => item.id === id || item.id.endsWith(`/encounter/${id}`),
    )
    if (matching.length !== 1 || overrides.has(matching[0]!.id))
      throw new Error(
        `Replay profile refers to unknown, repeated or ambiguous exhibit ${id}.`,
      )
    overrides.set(matching[0]!.id, patch)
  }
  for (const item of level.breakables)
    if (!item.optional && !overrides.has(item.id))
      throw new Error(`Replay profile is missing required exhibit ${item.id}.`)
  const breakables = level.breakables.map((item) => {
    const patch = overrides.get(item.id)
    return patch === undefined
      ? item
      : { ...item, challenge: resolveChallenge(item.challenge, patch) }
  })
  const resolved = { ...level, breakables }
  return {
    level: resolved,
    profile,
    identity: {
      levelId: level.id,
      contentRevision: level.authored?.contentRevision ?? 1,
      profileId: profile.id,
      profileRevision: profile.revision,
      challengeSignature: JSON.stringify(
        breakables.map((item) => [
          item.id,
          item.optional === true,
          item.challenge,
        ]),
      ),
    },
  }
}
