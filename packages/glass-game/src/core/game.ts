// Glass adventure coordinator — pure movement, encounter ownership and durable route progress.

import type { BreakableDefinition, EncounterPhase, GameEvent, GameSnapshot, GlassGame, LevelDefinition, PlatformDefinition, } from '../contracts'
import type { CourseCollider } from './collision'
import { containsBody, FLAT_COURSE_COLLIDER } from './collision'
import { crossesExitPortal, deriveExitPortalGeometry } from './exit-portal'
import type { HoldJudge } from './hold'
import { createHoldJudge } from './hold'
import { createMovement, MOVEMENT, releaseMovement, stepMovement, } from './movement'
import { findCheckpoint, readProgress, requirementsMet } from './progress'
import { getActiveCourseSolids, getActiveSolidIds } from './solid-activation'

const INTERACTION_RADIUS = 0.75
const SHATTER_SECONDS = 1.4

interface ActiveEncounter {
  target: BreakableDefinition
  targetMidi: number
  judge: HoldJudge
}

export function createGlassGame(
  level: LevelDefinition,
  saved?: unknown,
  collider: CourseCollider = FLAT_COURSE_COLLIDER,
): GlassGame {
  const progress = readProgress(level, saved)
  const completed = new Set(progress.completedBreakableIds)
  let checkpointId = progress.checkpointId
  const initial = findCheckpoint(level, checkpointId, completed)
  let player = createMovement(
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

  const platforms = () =>
    getActiveCourseSolids(level, completed).filter(
      (solid): solid is PlatformDefinition => solid.kind !== 'prop',
    )

  const phase = (): EncounterPhase => {
    if (complete) return 'complete'
    if (shattering !== null) return 'shattering'
    if (active !== null)
      return active.judge.charge() > 0 ? 'charging' : 'listening'
    return 'idle'
  }

  const eligible = (target: BreakableDefinition): boolean =>
    !completed.has(target.id) &&
    requirementsMet(target.requiresCompleted, completed) &&
    Math.abs(player.position.y - target.anchor.y) < 0.05 &&
    Math.hypot(
      player.position.x - target.anchor.x,
      player.position.z - target.anchor.z,
    ) <= INTERACTION_RADIUS &&
    player.grounded &&
    platforms().some(
      (p) => p.kind === 'deck' && containsBody(player.position, MOVEMENT, p),
    )

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
    player = createMovement(
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
        const activeSolids = getActiveCourseSolids(level, completed)
        const previousPosition = { ...player.position }
        const step = stepMovement(
          player,
          input,
          MOVEMENT.fixedStep,
          activeSolids,
          collider,
          level.movement,
        )
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
          requirementsMet(level.exit.requiresCompleted, completed) &&
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
      const activeSolidIds = getActiveSolidIds(level, completed)
      return {
        player: {
          position: { ...player.position },
          velocity: { ...player.velocity },
          grounded: player.grounded,
          facingYaw: player.facingYaw,
        },
        breakables: level.breakables.map((target) => ({
          id: target.id,
          charge:
            active?.target.id === target.id
              ? active.judge.charge()
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
        enabledPlatformIds: level.platforms
          .filter((platform) => activeSolidIds.includes(platform.id))
          .map((platform) => platform.id),
        completedBreakableIds: [...completed],
        activeEncounter:
          active === null
            ? null
            : {
                id: active.target.id,
                charge: active.judge.charge(),
                targetMidi: active.targetMidi,
              },
        phase: phase(),
        paused,
        checkpointId,
        nearbyBreakableId: nearby(),
        elapsedSeconds,
        complete,
      }
    },
    beginEncounter(id, targetMidi) {
      if (
        paused ||
        complete ||
        active !== null ||
        shattering !== null ||
        !Number.isFinite(targetMidi) ||
        targetMidi < 0 ||
        targetMidi > 127
      )
        return false
      const target = level.breakables.find((candidate) => candidate.id === id)
      if (target === undefined || !eligible(target)) return false
      releaseMovement(player)
      accumulator = 0
      active = {
        target,
        targetMidi,
        judge: createHoldJudge(target.hold, targetMidi),
      }
      return true
    },
    feedPitch(frame, nowMs) {
      if (paused || active === null || !active.judge.feed(frame, nowMs))
        return []
      const id = active.target.id
      completed.add(id)
      brokenAt.set(id, elapsedSeconds)
      active = null
      shattering = { id, until: elapsedSeconds + SHATTER_SECONDS }
      return [{ type: 'break', id }]
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
        version: 1,
        levelId: level.id,
        checkpointId,
        completedBreakableIds: [...completed],
        finished: complete,
      }
    },
  }
}
