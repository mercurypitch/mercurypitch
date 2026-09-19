// Authoring internals — stable ID and authored-reference plumbing shared by compiler stages.

import type { CheckpointDefinition, CompiledRoomPortDefinition, PlatformDefinition, SolidActivation, SolidPropDefinition, } from '../contracts'
import type { AuthoredLevelSource, LevelAuthoringDiagnostic, RoomExhibitMountDefinition, RoomExitDefinition, RoomPlacement, RoomPrefab, } from './contracts'

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export interface CompiledMount extends RoomExhibitMountDefinition {
  platformId: string
}

export interface CompiledRoom {
  placement: RoomPlacement
  prefab: RoomPrefab
  platforms: PlatformDefinition[]
  solids: SolidPropDefinition[]
  checkpoints: CheckpointDefinition[]
  checkpointsByLocal: Map<string, CheckpointDefinition>
  ports: Map<string, CompiledRoomPortDefinition & { sealSolidId: string }>
  mounts: Map<string, CompiledMount>
  exits: Map<string, RoomExitDefinition>
  solidIds: Map<string, string>
  platformIds: Map<string, string>
}

export const sortedById = <T extends { id: string }>(
  items: readonly T[],
): T[] => [...items].sort((left, right) => left.id.localeCompare(right.id))

export function runtimePrefix(source: AuthoredLevelSource): string {
  return `${source.levelId}/${source.layoutId}`
}

export function runtimeRoomId(
  source: AuthoredLevelSource,
  roomId: string,
  kind: string,
  localId: string,
): string {
  return `${runtimePrefix(source)}/${roomId}/${kind}/${localId}`
}

export function diagnostic(
  diagnostics: LevelAuthoringDiagnostic[],
  code: string,
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message })
}

export function splitMemberRef(
  value: string,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): [string, string] | undefined {
  const parts = value.split('.')
  if (
    parts.length !== 2 ||
    !ID_PATTERN.test(parts[0]) ||
    !ID_PATTERN.test(parts[1])
  ) {
    diagnostic(
      diagnostics,
      'invalid-reference',
      path,
      `"${value}" must be a stable "room-id.local-id" reference.`,
    )
    return undefined
  }
  return [parts[0], parts[1]]
}

export function mapEncounterRefs(
  refs: readonly string[] | undefined,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): string[] | undefined {
  if (refs === undefined) return undefined
  const mapped: string[] = []
  for (const ref of refs) {
    const runtimeId = runtimeEncounterIds.get(ref)
    if (runtimeId === undefined)
      diagnostic(
        diagnostics,
        'missing-reference',
        path,
        `Unknown encounter "${ref}".`,
      )
    else mapped.push(runtimeId)
  }
  return mapped
}

export function mapActivation(
  activation: SolidActivation | undefined,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): SolidActivation | undefined {
  if (activation === undefined) return undefined
  return {
    allCompleted: mapEncounterRefs(
      activation.allCompleted,
      runtimeEncounterIds,
      `${path}.allCompleted`,
      diagnostics,
    ),
    noneCompleted: mapEncounterRefs(
      activation.noneCompleted,
      runtimeEncounterIds,
      `${path}.noneCompleted`,
      diagnostics,
    ),
  }
}

export function resolveRoomMember<T>(
  ref: string,
  path: string,
  rooms: ReadonlyMap<string, CompiledRoom>,
  select: (room: CompiledRoom) => ReadonlyMap<string, T>,
  diagnostics: LevelAuthoringDiagnostic[],
): { room: CompiledRoom; value: T } | undefined {
  const member = splitMemberRef(ref, path, diagnostics)
  if (member === undefined) return undefined
  const room = rooms.get(member[0])
  if (room === undefined) {
    diagnostic(
      diagnostics,
      'missing-reference',
      path,
      `Unknown room instance "${member[0]}".`,
    )
    return undefined
  }
  const value = select(room).get(member[1])
  if (value === undefined) {
    diagnostic(
      diagnostics,
      'missing-reference',
      path,
      `Room "${member[0]}" has no member "${member[1]}".`,
    )
    return undefined
  }
  return { room, value }
}
