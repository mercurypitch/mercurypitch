// Room connections — verify matched cardinal ports and compile one saved-state gate proxy.

import type { CompiledRoomPortDefinition, SolidPropDefinition, } from '../contracts'
import type { AuthoredLevelSource, LevelAuthoringDiagnostic, PortConnection, } from './contracts'
import type { CompiledRoom } from './internal'
import { diagnostic, resolveRoomMember, runtimePrefix } from './internal'
import { recordRecipe, validId } from './validation'

const EPSILON = 1e-6

function portDirection(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) }
}

function validateConnectionPorts(
  connection: PortConnection,
  from: CompiledRoomPortDefinition,
  to: CompiledRoomPortDefinition,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const distance = Math.hypot(
    from.position.x - to.position.x,
    from.position.y - to.position.y,
    from.position.z - to.position.z,
  )
  if (distance > EPSILON)
    diagnostic(
      diagnostics,
      'mismatched-port',
      path,
      `Connected ports are ${distance.toFixed(3)}m apart; their coordinates must match.`,
    )
  if (
    Math.abs(from.width - to.width) > EPSILON ||
    Math.abs(from.height - to.height) > EPSILON
  )
    diagnostic(
      diagnostics,
      'mismatched-port',
      path,
      `Connected port dimensions differ (${from.width}x${from.height} versus ${to.width}x${to.height}).`,
    )
  const fromDirection = portDirection(from.facingYaw)
  const toDirection = portDirection(to.facingYaw)
  if (
    Math.hypot(
      fromDirection.x + toDirection.x,
      fromDirection.z + toDirection.z,
    ) > EPSILON
  )
    diagnostic(
      diagnostics,
      'mismatched-port',
      path,
      'Connected ports must face in opposite cardinal directions.',
    )
  if (connection.from === connection.to)
    diagnostic(
      diagnostics,
      'invalid-connection',
      path,
      'A port cannot connect to itself.',
    )
}

function gateSolid(
  source: AuthoredLevelSource,
  connection: PortConnection,
  port: CompiledRoomPortDefinition,
  runtimeEncounterId: string,
): SolidPropDefinition | undefined {
  if (!connection.gate) return undefined
  const thickness = 0.12
  const direction = portDirection(port.facingYaw)
  const alongX = Math.abs(direction.z) > 0.5
  return {
    id: `${runtimePrefix(source)}/connection/gate/${connection.gate.id}`,
    kind: 'prop',
    shape: 'box',
    minX: port.position.x - (alongX ? port.width / 2 : thickness / 2),
    maxX: port.position.x + (alongX ? port.width / 2 : thickness / 2),
    minZ: port.position.z - (alongX ? thickness / 2 : port.width / 2),
    maxZ: port.position.z + (alongX ? thickness / 2 : port.width / 2),
    top: port.position.y + port.height,
    thickness: port.height,
    activation: { noneCompleted: [runtimeEncounterId] },
    presentation: {
      role: 'gate',
      material: connection.gate.material,
      assetRecipeId: connection.gate.assetRecipeId,
    },
  }
}

export function compileConnections(
  source: AuthoredLevelSource,
  rooms: ReadonlyMap<string, CompiledRoom>,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  optionalEncounterIds: ReadonlySet<string>,
  availableRecipes: ReadonlySet<string>,
  usedRecipes: Set<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): { removedSealIds: Set<string>; solids: SolidPropDefinition[] } {
  const removedSealIds = new Set<string>()
  const solids: SolidPropDefinition[] = []
  const connectedPorts = new Set<string>()
  const connections = [...source.connections].sort((left, right) =>
    `${left.from}->${left.to}`.localeCompare(`${right.from}->${right.to}`),
  )
  for (const [index, connection] of connections.entries()) {
    const path = `connections.${index}`
    const from = resolveRoomMember(
      connection.from,
      `${path}.from`,
      rooms,
      (room) => room.ports,
      diagnostics,
    )
    const to = resolveRoomMember(
      connection.to,
      `${path}.to`,
      rooms,
      (room) => room.ports,
      diagnostics,
    )
    if (!from || !to) continue
    validateConnectionPorts(connection, from.value, to.value, path, diagnostics)
    for (const ref of [connection.from, connection.to]) {
      if (connectedPorts.has(ref))
        diagnostic(
          diagnostics,
          'duplicate-connection',
          path,
          `Port "${ref}" participates in more than one connection.`,
        )
      connectedPorts.add(ref)
    }
    removedSealIds.add(from.value.sealSolidId)
    removedSealIds.add(to.value.sealSolidId)
    if (connection.gate === undefined) continue
    validId(connection.gate.id, `${path}.gate.id`, diagnostics)
    const runtimeEncounterId = runtimeEncounterIds.get(
      connection.gate.opensAfter,
    )
    if (runtimeEncounterId === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.gate.opensAfter`,
        `Unknown encounter "${connection.gate.opensAfter}".`,
      )
      continue
    }
    if (
      connection.optional !== true &&
      optionalEncounterIds.has(connection.gate.opensAfter)
    )
      diagnostic(
        diagnostics,
        'optional-required',
        `${path}.gate.opensAfter`,
        `Required connection gate cannot depend on optional encounter "${connection.gate.opensAfter}".`,
      )
    recordRecipe(
      connection.gate.assetRecipeId,
      `${path}.gate.assetRecipeId`,
      availableRecipes,
      usedRecipes,
      diagnostics,
    )
    solids.push(gateSolid(source, connection, from.value, runtimeEncounterId)!)
  }
  return { removedSealIds, solids }
}
