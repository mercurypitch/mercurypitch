// Continuous course simulation helpers — replay ordinary movement and pitch observations from an unsaved spawn.

import type { GlassGame, MovementInput, PlatformDefinition, Vec3, } from '../../contracts.ts'
import { pointInConvexPolygon } from '../../core/convex-polygon.ts'
import { deriveExitPortalGeometry } from '../../core/exit-portal.ts'
import { createGlassGame } from '../../core/game.ts'
import { resolveMelodyAttempt } from '../../core/melody-attempt.ts'
import { sampleMelodyAtTime } from '../../core/melody-contour.ts'
import { platformBoundsAtRuntime } from '../../core/platform-runtime.ts'
import type { GeneratedCourseResult } from './course-generator.ts'

const REST: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const DT = 1 / 60

export type CourseWitnessAction =
  | { readonly kind: 'begin'; readonly encounterId: string }
  | {
      readonly kind: 'step'
      readonly input: MovementInput
      readonly midi?: number | null
    }

export interface CoursePlaythroughResult {
  readonly completed: boolean
  readonly ticks: number
  readonly respawns: number
  readonly completedEncounters: readonly string[]
  readonly reachedPlatforms: readonly string[]
  readonly mechanics: readonly string[]
  readonly failure?: string
  readonly player: ReturnType<GlassGame['snapshot']>['player']
  readonly recent?: readonly unknown[]
  readonly witness?: readonly CourseWitnessAction[]
}

function routeIds(course: GeneratedCourseResult): string[] {
  const platforms = course.compiledLevel.platforms
  const first = platforms[0]!.id
  const last = platforms[platforms.length - 1]!.id
  const byId = new Map(platforms.map((p) => [p.id, p]))
  const parents = new Map<string, string | null>([[first, null]])
  const costs = new Map<string, number>([[first, 0]])
  const queue = [first]
  while (queue.length > 0) {
    queue.sort((a, b) => costs.get(a)! - costs.get(b)!)
    const current = queue.shift()!
    if (current === last) break
    for (const edge of course.routeConnections) {
      if (edge.platformAId !== current) continue
      const a = byId.get(edge.platformAId)!,
        b = byId.get(edge.platformBId)!
      // A declared chasm measures separation; its ferry links describe the route.
      if (
        edge.distance > 2 &&
        a.behavior?.kind !== 'glide' &&
        b.behavior?.kind !== 'glide'
      )
        continue
      const cost = costs.get(current)! + 1 + Math.max(0, edge.distance - 1) * 10
      if (cost >= (costs.get(edge.platformBId) ?? Infinity)) continue
      costs.set(edge.platformBId, cost)
      parents.set(edge.platformBId, current)
      queue.push(edge.platformBId)
    }
  }
  if (!parents.has(last))
    throw new Error('No authored route to the final platform')
  const route: string[] = []
  for (let id: string | null = last; id !== null; id = parents.get(id)!)
    route.push(id)
  return route.reverse()
}

/** A bounded positive witness attempt; failure means this controller found no route. */
export function playGeneratedCourse(
  course: GeneratedCourseResult,
  maximumTicks = 60_000,
  recordWitness = false,
): CoursePlaythroughResult {
  const level = course.compiledLevel
  const game = createGlassGame(level)
  const attempt = resolveMelodyAttempt(level, {
    attemptId: 'continuous-course',
    comfortableMidi: 57,
  })
  game.configureMelodyAttempt({
    attemptId: attempt.identity.attemptId,
    comfortableMidi: 57,
  })
  let current = game.snapshot()
  let runtimeById = new Map(current.platformStates?.map((p) => [p.id, p]))
  const route = routeIds(course)
  const platforms = new Map(level.platforms.map((p) => [p.id, p]))
  const reached: string[] = []
  let ticks = 0,
    respawns = 0,
    sequence = 0
  let failure: string | undefined
  const recent: unknown[] = []
  const witness: CourseWitnessAction[] | undefined = recordWitness
    ? []
    : undefined
  let pendingMidi: number | null | undefined
  const step = (input: MovementInput = REST) => {
    if (++ticks > maximumTicks) throw new Error('total-tick-budget')
    const events = game.step(input, DT, ticks * DT * 1000)
    current = game.snapshot()
    runtimeById = new Map(current.platformStates?.map((p) => [p.id, p]))
    witness?.push({
      kind: 'step',
      input: { ...input },
      ...(pendingMidi !== undefined ? { midi: pendingMidi } : {}),
    })
    pendingMidi = undefined
    if (ticks % 20 === 0) {
      const s = current
      recent.push({
        ticks,
        input,
        player: s.player,
        support: s.platformStates?.find(
          (p) => p.id === s.player.supportPlatformId,
        ),
      })
      if (recent.length > 12) recent.shift()
    }
    respawns += events.filter((event) => event.type === 'respawn').length
    if (respawns > 0) throw new Error('respawn')
  }
  const bounds = (p: PlatformDefinition) =>
    platformBoundsAtRuntime(p, runtimeById.get(p.id))
  const center = (p: PlatformDefinition): Vec3 => {
    const b = bounds(p)
    const target = {
      x: (b.minX + b.maxX) / 2,
      y: b.maxY,
      z: (b.minZ + b.maxZ) / 2,
    }
    const plinthIds = level.breakables.flatMap((e) =>
      e.mount?.kind === 'plinth' ? [e.mount.solidId] : [],
    )
    const props = (level.solids ?? []).filter(
      (solid) => plinthIds.includes(solid.id) || solid.id.startsWith('plinth:'),
    )
    if (
      props.some(
        (solid) =>
          Math.hypot(
            (solid.shape === 'cylinder'
              ? solid.x
              : (solid.minX + solid.maxX) / 2) - target.x,
            (solid.shape === 'cylinder'
              ? solid.z
              : (solid.minZ + solid.maxZ) / 2) - target.z,
          ) < 1.1,
      )
    ) {
      if (b.maxX - b.minX > 2.5) target.x += 0.85
      else if (b.maxZ - b.minZ > 2.5) target.z += 0.85
    }
    return target
  }
  const sing = () => {
    const snapshot = current
    const id = snapshot.nextRequiredBreakableId
    if (
      id === undefined ||
      id === null ||
      snapshot.nearbyBreakableId !== id ||
      !snapshot.player.grounded
    )
      return
    const encounter = level.breakables.find((e) => e.id === id)!
    if (!game.beginEncounter(id)) throw new Error(`begin:${id}`)
    witness?.push({ kind: 'begin', encounterId: id })
    const challenge = encounter.challenge
    const anchor =
      challenge.kind === 'melody-anchor'
        ? attempt.melody.anchors.find((a) => a.id === challenge.anchorId)
        : undefined
    for (
      let n = 0;
      n < Math.ceil((attempt.melody.durationSeconds + 4) / DT);
      n++
    ) {
      const midi =
        anchor?.midi ??
        sampleMelodyAtTime(
          attempt.melody,
          Math.min(attempt.melody.durationSeconds - 1e-8, n * DT),
        ).midi
      sequence++
      pendingMidi = midi
      game.feedPitch(
        {
          sequence,
          captureSeconds: (ticks + 1) * DT,
          capturedAtMs: (ticks + 1) * DT * 1000,
          midi,
          confidence: midi === null ? 0 : 0.98,
        },
        (ticks + 1) * DT * 1000,
      )
      step()
      if (current.completedBreakableIds.includes(id)) break
    }
    if (!current.completedBreakableIds.includes(id))
      throw new Error(`sing:${id}`)
    for (let n = 0; n < 600 && current.phase === 'shattering'; n++) step()
  }
  const edgeDistance = (
    p: PlatformDefinition,
    point: Vec3,
    dx: number,
    dz: number,
  ) => {
    const runtime = runtimeById.get(p.id)
    const b = bounds(p)
    const inside = (distance: number) => {
      const x = point.x + dx * distance,
        z = point.z + dz * distance
      if (p.supportPolygon && p.behavior?.kind !== 'scroll')
        return pointInConvexPolygon(
          { x: x - (runtime?.offset.x ?? 0), z: z - (runtime?.offset.z ?? 0) },
          p.supportPolygon,
        )
      return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ
    }
    let low = 0,
      high = 6
    for (let i = 0; i < 16; i++) {
      const middle = (low + high) / 2
      if (inside(middle)) low = middle
      else high = middle
    }
    return low
  }
  try {
    for (const id of route) {
      const targetPlatform = platforms.get(id)!
      let arrived = false
      for (let hopTicks = 0; hopTicks < 1_800; hopTicks++) {
        sing()
        const s = current,
          p = s.player
        let target = center(targetPlatform)
        let waiting = false
        const support = platforms.get(p.supportPlatformId ?? '')
        if (
          support &&
          support.id !== id &&
          (support.behavior?.kind === 'glide' ||
            targetPlatform.behavior?.kind === 'glide')
        ) {
          const b = bounds(targetPlatform),
            a = bounds(support)
          const gap = Math.hypot(
            Math.max(0, b.minX - a.maxX, a.minX - b.maxX),
            Math.max(0, b.minZ - a.maxZ, a.minZ - b.maxZ),
          )
          if (gap > 0.8 || Math.abs(b.maxY - a.maxY) > 0.2) {
            target = center(support)
            waiting = true
          }
        }
        if (support && support.id !== id) {
          const scroll =
            support.behavior?.kind === 'scroll'
              ? support
              : targetPlatform.behavior?.kind === 'scroll'
                ? targetPlatform
                : undefined
          const state = s.platformStates?.find((p) => p.id === scroll?.id)
          if (scroll && state?.phase !== 'extended') {
            target = center(support)
            waiting = true
          }
        }
        const dx = target.x - p.position.x,
          dz = target.z - p.position.z
        const distance = Math.hypot(dx, dz)
        if (p.grounded && p.supportPlatformId === id && distance < 0.24) {
          arrived = true
          break
        }
        const ux = dx / Math.max(distance, 0.001),
          uz = dz / Math.max(distance, 0.001)
        const edge = support ? edgeDistance(support, p.position, ux, uz) : 0
        let jumpDown = false
        if (
          support &&
          support.id !== id &&
          p.grounded &&
          !waiting &&
          edge < 0.22
        ) {
          const b = bounds(targetPlatform),
            a = bounds(support)
          const gap = Math.hypot(
            Math.max(0, b.minX - a.maxX, a.minX - b.maxX),
            Math.max(0, b.minZ - a.maxZ, a.minZ - b.maxZ),
          )
          jumpDown = gap > 0.03 || b.maxY - a.maxY > 0.08
        }
        const magnitude =
          support?.id === id || waiting ? Math.min(1, distance * 2.5) : 1
        step({ moveX: ux * magnitude, moveZ: uz * magnitude, jumpDown })
      }
      if (!arrived) throw new Error(`platform-timeout:${id}`)
      reached.push(id)
    }
    sing()
    const portal = deriveExitPortalGeometry(level.exit)
    const direction =
      Math.sign(
        portal.center[portal.normalAxis] -
          current.player.position[portal.normalAxis],
      ) || 1
    for (let n = 0; n < 600 && !current.complete; n++) {
      const p = current.player.position
      const x =
          portal.center.x +
          (portal.normalAxis === 'x' ? direction * 0.2 : 0) -
          p.x,
        z =
          portal.center.z +
          (portal.normalAxis === 'z' ? direction * 0.2 : 0) -
          p.z
      const distance = Math.hypot(x, z)
      step({
        moveX: x / Math.max(distance, 0.5),
        moveZ: z / Math.max(distance, 0.5),
        jumpDown: false,
      })
    }
    if (!current.complete) throw new Error('exit-timeout')
  } catch (error) {
    failure = String(error)
  }
  const mechanics = [
    ...new Set(
      reached.flatMap((id) => {
        const p = platforms.get(id)!
        return [p.behavior?.kind, p.surface?.kind].filter(
          (kind) => kind !== undefined,
        )
      }),
    ),
  ].sort()
  return {
    completed: current.complete,
    ticks,
    respawns,
    completedEncounters: current.completedBreakableIds,
    reachedPlatforms: reached,
    mechanics,
    failure,
    player: current.player,
    ...(failure !== undefined ? { recent } : {}),
    ...(witness ? { witness } : {}),
  }
}

/** Independent ordinary API replay; never restores checkpoints or completion state. */
export function replayCourseWitness(
  course: GeneratedCourseResult,
  witness: readonly CourseWitnessAction[],
) {
  if (witness.length > 60_100) throw new Error('Witness exceeds replay budget')
  const game = createGlassGame(course.compiledLevel)
  game.configureMelodyAttempt({
    attemptId: 'continuous-course',
    comfortableMidi: 57,
  })
  let ticks = 0,
    sequence = 0,
    respawns = 0
  for (const action of witness) {
    if (action.kind === 'begin') {
      if (!game.beginEncounter(action.encounterId))
        throw new Error(`Replay encounter unavailable: ${action.encounterId}`)
      continue
    }
    ticks++
    if (action.midi !== undefined) {
      sequence++
      game.feedPitch(
        {
          sequence,
          captureSeconds: ticks * DT,
          capturedAtMs: ticks * DT * 1000,
          midi: action.midi,
          confidence: action.midi === null ? 0 : 0.98,
        },
        ticks * DT * 1000,
      )
    }
    respawns += game
      .step(action.input, DT, ticks * DT * 1000)
      .filter((event) => event.type === 'respawn').length
  }
  return {
    snapshot: game.snapshot(),
    progress: game.saveProgress(),
    ticks,
    respawns,
  }
}
