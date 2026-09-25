// Glass adventure coordinator — pure movement, encounter ownership and durable route progress.

import type { BreakableDefinition, EncounterPhase, GameEvent, GameSnapshot, GlassGame, LevelDefinition, PitchAccuracyGradingPolicy, PlatformDefinition, } from '../contracts'
import { deriveBreakOutcome } from './break-outcome'
import type { ChallengeJudge } from './challenge'
import { createChallengeJudge } from './challenge'
import type { CourseCollider } from './collision'
import { containsBody, findSupport, FLAT_COURSE_COLLIDER, intentionalGapDefinitionError, } from './collision'
import { blockExitPortalCrossing, crossesExitPortal, deriveExitPortalGeometry, } from './exit-portal'
import { createMovement, MOVEMENT, releaseMovement, stepMovement, } from './movement'
import { createPlatformRuntime } from './platform-runtime'
import { findCheckpoint, getRequiredRouteBreakableIds, readProgress, requirementsMet, } from './progress'
import type { SingingQualityAttempt } from './rewards'
import { applyEncounterRewards, createSingingQualityAttempt, emptyRewardProgress, readRewardProgress, summarizeRewards, ungradedQualityResult, } from './rewards'
import { SHATTER_LIFECYCLE_SECONDS } from './shatter-presentation'
import { getActiveCourseSolids } from './solid-activation'

const INTERACTION_RADIUS = 1.1
const EXIT_GUIDANCE_RADIUS = 1.35

interface ActiveEncounter {
  target: BreakableDefinition
  judge: ChallengeJudge
  qualityPolicy?: PitchAccuracyGradingPolicy
  qualityAttempt?: SingingQualityAttempt
}

export function createGlassGame(
  level: LevelDefinition,
  saved?: unknown,
  collider: CourseCollider = FLAT_COURSE_COLLIDER,
): GlassGame {
  for (const gap of level.intentionalGaps ?? []) {
    const error = intentionalGapDefinitionError(gap)
    if (error !== undefined)
      throw new Error(`Invalid intentional gap "${gap.id}": ${error}.`)
  }
  const behavioralPlatformIds = new Set(
    level.platforms
      .filter((platform) => platform.behavior !== undefined)
      .map((platform) => platform.id),
  )
  for (const solid of level.solids ?? [])
    if (
      solid.platformId !== undefined &&
      behavioralPlatformIds.has(solid.platformId)
    )
      throw new Error(
        `Invalid solid "${solid.id}": platformId cannot reference behavioral platform "${solid.platformId}" until transform parenting is supported.`,
      )
  const progress = readProgress(level, saved)
  const completed = new Set(progress.completedBreakableIds)
  let rewardProgress =
    progress.rewards ?? readRewardProgress(level, undefined, completed)
  let checkpointId = progress.checkpointId
  const initial = findCheckpoint(level, checkpointId, completed)
  const platformRuntime = createPlatformRuntime(level.platforms)
  let activeBaseSolidsCache = getActiveCourseSolids(level, completed)
  let activePlatformIdsCache = new Set(
    activeBaseSolidsCache
      .filter((solid): solid is PlatformDefinition => solid.kind !== 'prop')
      .map((platform) => platform.id),
  )
  const activeBaseSolids = () => activeBaseSolidsCache
  const refreshActiveBaseSolids = (): void => {
    activeBaseSolidsCache = getActiveCourseSolids(level, completed)
    activePlatformIdsCache = new Set(
      activeBaseSolidsCache
        .filter((solid): solid is PlatformDefinition => solid.kind !== 'prop')
        .map((platform) => platform.id),
    )
  }
  const activePlatformIds = (): ReadonlySet<string> => activePlatformIdsCache
  const activeCourseSolids = () =>
    platformRuntime.materialize(activeBaseSolids())
  const movementAt = (
    position: GameSnapshot['player']['position'],
    yaw: number,
  ) => {
    const state = createMovement(position, yaw)
    const support = findSupport(state.position, MOVEMENT, activeCourseSolids())
    state.grounded = support !== null
    state.supportSolidId = support?.id ?? null
    state.supportPlatformId =
      support === null || support.kind === 'prop' ? null : support.id
    return state
  }
  let player = movementAt(
    initial?.position ?? level.spawn.position,
    initial?.facingYaw ?? level.spawn.facingYaw,
  )
  let active: ActiveEncounter | null = null
  let shattering: { id: string; until: number } | null = null
  let paused = false
  let complete = progress.finished === true
  let elapsedSeconds = 0
  let accumulator = 0
  const brokenAt = new Map<string, number>()
  const exitPortal = deriveExitPortalGeometry(level.exit)
  const requiredRouteIds = getRequiredRouteBreakableIds(level)

  const platforms = () =>
    activeCourseSolids().filter(
      (solid): solid is PlatformDefinition => solid.kind !== 'prop',
    )

  const phase = (): EncounterPhase => {
    if (complete) return 'complete'
    if (shattering !== null) return 'shattering'
    if (active !== null)
      return active.judge.snapshot().charge > 0 ? 'charging' : 'listening'
    return 'idle'
  }

  const withinSafeInteractionArea = (target: BreakableDefinition): boolean =>
    !completed.has(target.id) &&
    Math.abs(player.position.y - target.anchor.y) < 0.05 &&
    Math.hypot(
      player.position.x - target.anchor.x,
      player.position.z - target.anchor.z,
    ) <= INTERACTION_RADIUS &&
    player.grounded &&
    platforms().some(
      (p) => p.kind === 'deck' && containsBody(player.position, MOVEMENT, p),
    )

  const eligible = (target: BreakableDefinition): boolean =>
    withinSafeInteractionArea(target) &&
    requirementsMet(target.requiresCompleted, completed)

  const nearby = (): string | null => {
    if (paused || complete || active !== null || shattering !== null)
      return null
    let chosen: BreakableDefinition | undefined
    let distance = Infinity
    for (const target of level.breakables) {
      if (!eligible(target)) continue
      const nextDistance = Math.hypot(
        player.position.x - target.anchor.x,
        player.position.z - target.anchor.z,
      )
      if (nextDistance < distance) {
        chosen = target
        distance = nextDistance
      }
    }
    return chosen?.id ?? null
  }

  const nearbyLocked = (): string | null => {
    if (paused || complete || active !== null || shattering !== null)
      return null
    let chosen: BreakableDefinition | undefined
    let distance = Infinity
    for (const target of level.breakables) {
      if (
        !withinSafeInteractionArea(target) ||
        requirementsMet(target.requiresCompleted, completed)
      )
        continue
      const nextDistance = Math.hypot(
        player.position.x - target.anchor.x,
        player.position.z - target.anchor.z,
      )
      if (nextDistance < distance) {
        chosen = target
        distance = nextDistance
      }
    }
    return chosen?.id ?? null
  }

  const nextRequired = (): string | null => {
    if (complete) return null
    for (const id of requiredRouteIds) {
      if (completed.has(id)) continue
      const target = level.breakables.find((candidate) => candidate.id === id)
      if (
        target !== undefined &&
        requirementsMet(target.requiresCompleted, completed)
      )
        return id
    }
    return null
  }

  const nearLockedExit = (): boolean => {
    if (complete || requirementsMet(requiredRouteIds, completed)) return false
    const normalDistance = Math.abs(
      player.position[exitPortal.normalAxis] -
        exitPortal.center[exitPortal.normalAxis],
    )
    const lateral = player.position[exitPortal.lateralAxis]
    const verticallyNear =
      player.position.y < exitPortal.top &&
      player.position.y + MOVEMENT.height > exitPortal.bottom - 0.1
    return (
      normalDistance <= EXIT_GUIDANCE_RADIUS &&
      lateral >= exitPortal.minLateral - EXIT_GUIDANCE_RADIUS &&
      lateral <= exitPortal.maxLateral + EXIT_GUIDANCE_RADIUS &&
      verticallyNear
    )
  }

  const cancel = (): void => {
    if (active === null) return
    active = null
    releaseMovement(player)
    accumulator = 0
  }

  const respawn = (
    preferred: string | undefined,
    events: GameEvent[],
  ): void => {
    const checkpoint =
      findCheckpoint(level, preferred ?? checkpointId, completed) ??
      findCheckpoint(level, checkpointId, completed)
    if (checkpoint !== undefined) checkpointId = checkpoint.id
    platformRuntime.reset()
    player = movementAt(
      checkpoint?.position ?? level.spawn.position,
      checkpoint?.facingYaw ?? level.spawn.facingYaw,
    )
    releaseMovement(player)
    active = null
    accumulator = 0
    events.push({ type: 'respawn', checkpointId })
  }

  return {
    step(input, delta, nowMs) {
      const events: GameEvent[] = []
      if (paused || complete || !Number.isFinite(delta) || delta <= 0)
        return events
      elapsedSeconds += delta
      if (shattering !== null) {
        if (elapsedSeconds >= shattering.until) {
          shattering = null
          releaseMovement(player)
        }
        return events
      }
      if (active !== null) {
        if (nowMs === undefined) active.judge.tick(delta)
        else active.judge.advanceTo(nowMs)
        return events
      }

      accumulator += Math.min(delta, 0.25)
      let steps = 0
      while (
        accumulator + 1e-10 >= MOVEMENT.fixedStep &&
        steps < MOVEMENT.maximumSteps
      ) {
        accumulator = Math.max(0, accumulator - MOVEMENT.fixedStep)
        steps++
        const activeBase = activeBaseSolids()
        const enabledPlatforms = activePlatformIds()
        platformRuntime.advance(MOVEMENT.fixedStep, enabledPlatforms)
        const activeSolids = platformRuntime.materialize(activeBase)
        const previousPosition = { ...player.position }
        const previousSupportId = player.supportPlatformId
        const step = stepMovement(
          player,
          input,
          MOVEMENT.fixedStep,
          activeSolids,
          collider,
          level.movement,
          {
            supportDelta: platformRuntime.supportDelta(previousSupportId),
            surface: platformRuntime.surface(previousSupportId),
            intentionalGaps: level.intentionalGaps,
            platformMotions: platformRuntime.motions(enabledPlatforms),
          },
        )
        const exitOpen = requirementsMet(requiredRouteIds, completed)
        if (!exitOpen) {
          const blockedPosition = blockExitPortalCrossing(
            previousPosition,
            player.position,
            exitPortal,
            MOVEMENT,
          )
          if (blockedPosition !== null) {
            player.position = blockedPosition
            player.velocity[exitPortal.normalAxis] = 0
          }
        }
        if (step.crushed) {
          respawn(undefined, events)
          break
        }
        if (step.support !== null && step.support.kind !== 'prop')
          platformRuntime.armCrackle(step.support.id)
        if (step.jumped) events.push({ type: 'jumped' })
        if (step.landed) events.push({ type: 'landed' })
        if (
          step.support?.kind === 'catch' ||
          player.position.y < level.fallBelow
        ) {
          respawn(
            step.support?.kind === 'catch'
              ? step.support.catchCheckpointId
              : undefined,
            events,
          )
          break
        }
        if (player.grounded) {
          let closestCheckpoint = checkpointId
          let checkpointDistance = Infinity
          for (const checkpoint of level.checkpoints) {
            if (!requirementsMet(checkpoint.requiresCompleted, completed))
              continue
            const distance = Math.hypot(
              player.position.x - checkpoint.position.x,
              player.position.z - checkpoint.position.z,
            )
            if (
              Math.abs(player.position.y - checkpoint.position.y) < 0.05 &&
              distance <= checkpoint.radius &&
              distance < checkpointDistance
            ) {
              closestCheckpoint = checkpoint.id
              checkpointDistance = distance
            }
          }
          if (closestCheckpoint !== checkpointId) {
            checkpointId = closestCheckpoint
            events.push({ type: 'checkpoint', id: checkpointId })
          }
        }
        if (
          exitOpen &&
          crossesExitPortal(
            previousPosition,
            player.position,
            exitPortal,
            MOVEMENT,
          )
        ) {
          complete = true
          releaseMovement(player)
          events.push({ type: 'complete' })
          break
        }
      }
      if (accumulator >= MOVEMENT.fixedStep) accumulator %= MOVEMENT.fixedStep
      return events
    },
    snapshot(): GameSnapshot {
      const activeSolidIds = activeCourseSolids().map((solid) => solid.id)
      return {
        player: {
          position: { ...player.position },
          velocity: { ...player.velocity },
          grounded: player.grounded,
          supportPlatformId: player.supportPlatformId,
          facingYaw: player.facingYaw,
        },
        platformStates: platformRuntime.snapshots(),
        breakables: level.breakables.map((target) => ({
          id: target.id,
          charge:
            active?.target.id === target.id
              ? active.judge.snapshot().charge
              : completed.has(target.id)
                ? 1
                : 0,
          phase:
            shattering?.id === target.id
              ? 'shattering'
              : completed.has(target.id)
                ? 'complete'
                : active?.target.id === target.id
                  ? phase()
                  : 'idle',
          brokenAt: brokenAt.get(target.id) ?? null,
        })),
        activeSolidIds,
        enabledPlatformIds: activeBaseSolids()
          .filter((solid): solid is PlatformDefinition => solid.kind !== 'prop')
          .map((platform) => platform.id),
        completedBreakableIds: [...completed],
        activeEncounter:
          active === null
            ? null
            : { id: active.target.id, ...active.judge.snapshot() },
        phase: phase(),
        paused,
        checkpointId,
        nearbyBreakableId: nearby(),
        nextRequiredBreakableId: nextRequired(),
        nearbyLockedBreakableId: nearbyLocked(),
        nearLockedExit: nearLockedExit(),
        elapsedSeconds,
        complete,
        rewardSummary: summarizeRewards(level, rewardProgress),
      }
    },
    beginEncounter(id, targets) {
      if (paused || complete || active !== null || shattering !== null)
        return false
      const target = level.breakables.find((candidate) => candidate.id === id)
      if (target === undefined || !eligible(target)) return false
      const challenge = createChallengeJudge(target.challenge, targets)
      if (!challenge.ok) return false
      releaseMovement(player)
      accumulator = 0
      active = {
        target,
        judge: challenge.judge,
        ...(() => {
          const qualityPolicy = level.rewards?.grading.find(
            (policy) => policy.encounterId === target.id,
          )
          return qualityPolicy === undefined
            ? {}
            : {
                qualityPolicy,
                qualityAttempt: createSingingQualityAttempt(
                  level,
                  target.challenge,
                  qualityPolicy,
                ),
              }
        })(),
      }
      return true
    },
    feedPitch(frame, nowMs) {
      if (paused || active === null) return []
      const encounter = active
      const id = encounter.target.id
      encounter.qualityAttempt?.observe(
        frame,
        nowMs,
        encounter.judge.snapshot(),
      )
      const challengeEvents = encounter.judge.feed(frame, nowMs)
      const events: GameEvent[] = []
      for (const event of challengeEvents) {
        if (
          event.type === 'step-complete' &&
          encounter.judge.snapshot().stepCount > 1
        )
          events.push({
            type: 'challenge-step',
            id,
            completedSteps: event.completedSteps,
            stepCount: encounter.judge.snapshot().stepCount,
          })
        else if (event.type === 'reset') {
          encounter.qualityAttempt?.reset()
          events.push({
            type: 'challenge-reset',
            id,
            reason: event.reason,
          })
        }
      }
      if (!challengeEvents.some((event) => event.type === 'complete'))
        return events
      const qualityResult =
        encounter.qualityPolicy === undefined
          ? undefined
          : (encounter.qualityAttempt?.finish() ??
            ungradedQualityResult(level, encounter.qualityPolicy))
      const completedBefore = new Set(completed)
      completed.add(id)
      const outcome = deriveBreakOutcome(level, completedBefore, completed)
      refreshActiveBaseSolids()
      rewardProgress = applyEncounterRewards(
        level,
        rewardProgress,
        id,
        qualityResult,
      )
      brokenAt.set(id, elapsedSeconds)
      active = null
      shattering = {
        id,
        until: elapsedSeconds + SHATTER_LIFECYCLE_SECONDS,
      }
      events.push({ type: 'break', id, outcome })
      return events
    },
    cancelEncounter: cancel,
    setPaused(value) {
      if (paused === value) return
      paused = value
      cancel()
      // A backgrounded break resumes as settled art; completed progress is retained.
      shattering = null
      releaseMovement(player, true)
      accumulator = 0
    },
    saveProgress() {
      return {
        version: 2,
        levelId: level.id,
        checkpointId,
        completedBreakableIds: [...completed],
        finished: complete,
        rewards:
          level.rewards === undefined
            ? emptyRewardProgress()
            : readRewardProgress(level, rewardProgress, completed),
      }
    },
  }
}
