// Authoring validator tests — malformed local data fails with paths an author can act on.

import { describe, expect, it } from 'vitest'
import { FOUNDATION_AUTHORING_CATALOG } from '../content/foundation-room-kit'
import { FOUNDATION_STRAIGHT_SOURCE } from '../content/foundation-routes'
import { composeLevel } from './compose-level'
import type { AuthoredLevelSource, LevelAuthoringCatalog, LevelAuthoringDiagnostic, RoomPrefab, } from './contracts'
import { LevelAuthoringError } from './contracts'

function diagnosticsFrom(
  source: AuthoredLevelSource,
  catalog: LevelAuthoringCatalog = FOUNDATION_AUTHORING_CATALOG,
): readonly LevelAuthoringDiagnostic[] {
  try {
    composeLevel(source, catalog)
  } catch (error) {
    expect(error).toBeInstanceOf(LevelAuthoringError)
    return (error as LevelAuthoringError).diagnostics
  }
  throw new Error('Expected authored level validation to fail.')
}

function withRoom(room: RoomPrefab): LevelAuthoringCatalog {
  return {
    ...FOUNDATION_AUTHORING_CATALOG,
    rooms: { [room.id]: room },
  }
}

function foundationRoom(): RoomPrefab {
  const room = FOUNDATION_AUTHORING_CATALOG.rooms['foundation-gallery']
  if (room === undefined) throw new Error('Foundation room fixture is missing.')
  return room
}

function replaceFoundationRoom(
  changes: Partial<RoomPrefab>,
): LevelAuthoringCatalog {
  const room = foundationRoom()
  return withRoom({ ...room, ...changes })
}

function codes(
  source: AuthoredLevelSource,
  catalog?: LevelAuthoringCatalog,
): string[] {
  return diagnosticsFrom(source, catalog).map((item) => item.code)
}

describe('authoring validation', () => {
  it('rejects malformed holds and duplicate ordered-pair targets on placements', () => {
    const [first, ...rest] = FOUNDATION_STRAIGHT_SOURCE.exhibits
    if (first.challenge.kind !== 'hold')
      throw new Error('Expected a held-note authoring fixture.')
    const originalHold = first.challenge.step.hold
    const malformedHold = diagnosticsFrom({
      ...FOUNDATION_STRAIGHT_SOURCE,
      exhibits: [
        {
          ...first,
          challenge: {
            kind: 'hold',
            step: {
              target: 'comfortable',
              hold: {
                requiredSeconds: 0,
                toleranceCents: 100,
                confidenceFloor: 0.5,
                dropoutGraceSeconds: 0.1,
                decayPerSecond: 0.2,
                maximumSampleGapSeconds: 0.1,
                maximumSampleAgeMs: 150,
              },
            },
          },
        },
        ...rest,
      ],
    })
    expect(malformedHold).toContainEqual(
      expect.objectContaining({
        code: 'invalid-hold',
        path: 'exhibits.arrival-goblet.challenge.step.hold',
      }),
    )

    const duplicatePair = diagnosticsFrom({
      ...FOUNDATION_STRAIGHT_SOURCE,
      exhibits: [
        {
          ...first,
          challenge: {
            kind: 'ordered-pair',
            steps: [
              { target: 'low', hold: originalHold },
              { target: 'low', hold: originalHold },
            ],
            wrongOrder: 'reset',
          },
        },
        ...rest,
      ],
    })
    expect(duplicatePair).toContainEqual(
      expect.objectContaining({
        code: 'invalid-challenge',
        path: 'exhibits.arrival-goblet.challenge.steps',
      }),
    )
  })

  it('rejects unknown floor art recipes and palettes', () => {
    const [arrival, ...rooms] = FOUNDATION_STRAIGHT_SOURCE.rooms
    const diagnostics = diagnosticsFrom({
      ...FOUNDATION_STRAIGHT_SOURCE,
      rooms: [
        {
          ...arrival,
          floorArt: {
            recipeId: 'random-floor' as 'quiet-marble',
            palette: 'neon' as 'neutral',
          },
        },
        ...rooms,
      ],
    })

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-presentation',
          path: 'rooms.arrival.floorArt.recipeId',
        }),
        expect.objectContaining({
          code: 'invalid-presentation',
          path: 'rooms.arrival.floorArt.palette',
        }),
      ]),
    )
  })

  it('accepts bounded level movement tuning and rejects unsafe budgets', () => {
    const movement = {
      walkSpeed: 1.55,
      runSpeed: 2.7,
      runDelaySeconds: 0.6,
      runRampSeconds: 0.8,
    }
    const configured = composeLevel(
      { ...FOUNDATION_STRAIGHT_SOURCE, movement },
      FOUNDATION_AUTHORING_CATALOG,
    )
    expect(configured.movement).toEqual(movement)
    expect(
      composeLevel(FOUNDATION_STRAIGHT_SOURCE, FOUNDATION_AUTHORING_CATALOG)
        .movement,
    ).toBeUndefined()

    for (const invalid of [
      { ...movement, walkSpeed: 0 },
      { ...movement, runSpeed: 1 },
      { ...movement, runSpeed: 6.01 },
      { ...movement, runDelaySeconds: -0.01 },
      { ...movement, runDelaySeconds: 5.01 },
      { ...movement, runRampSeconds: 0 },
      { ...movement, runRampSeconds: Number.NaN },
      { ...movement, runRampSeconds: 5.01 },
    ]) {
      const diagnostics = diagnosticsFrom({
        ...FOUNDATION_STRAIGHT_SOURCE,
        movement: invalid,
      })
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'invalid-movement',
          path: 'movement',
        }),
      )
    }
  })

  it('rejects unsupported room rotations and scales without compiling non-finite geometry', () => {
    const room = FOUNDATION_STRAIGHT_SOURCE.rooms[0]
    const malformed = [
      { ...room, yawQuarterTurns: 4 },
      { ...room, scale: { x: 2, y: 1, z: 2 } },
      { ...room, rotation: { x: 0, y: Math.PI / 4, z: 0 } },
      { ...room, translate: { x: Number.NaN, y: 0, z: 0 } },
    ]

    for (const placement of malformed) {
      const source = {
        ...FOUNDATION_STRAIGHT_SOURCE,
        rooms: [placement, FOUNDATION_STRAIGHT_SOURCE.rooms[1]],
      } as AuthoredLevelSource

      const diagnostics = diagnosticsFrom(source)

      expect(
        diagnostics.some((item) => item.code === 'unsupported-transform'),
      ).toBe(true)
      expect(diagnostics.every((item) => !item.message.includes('NaN'))).toBe(
        true,
      )
    }
  })

  it('reports missing references and dependency cycles without recursing through the cycle', () => {
    const [arrival, gallery, optional] = FOUNDATION_STRAIGHT_SOURCE.exhibits
    const cyclic: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      exhibits: [
        { ...arrival, requiresCompleted: ['gallery-decanter', 'missing-id'] },
        { ...gallery, requiresCompleted: ['arrival-goblet'] },
        optional,
      ],
    }

    const diagnostics = diagnosticsFrom(cyclic)

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-reference',
          path: 'exhibits.arrival-goblet.requiresCompleted',
        }),
        expect.objectContaining({ code: 'dependency-cycle' }),
      ]),
    )
  })

  it('rejects unknown checkpoint placement overrides and encounter prerequisites', () => {
    const [arrival, ...rooms] = FOUNDATION_STRAIGHT_SOURCE.rooms
    const malformed: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      rooms: [
        {
          ...arrival,
          checkpointRequiresCompleted: {
            entry: ['missing-encounter'],
            missing: ['arrival-goblet'],
          },
        },
        ...rooms,
      ],
    }

    expect(diagnosticsFrom(malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-reference',
          path: 'rooms.arrival.checkpointRequiresCompleted.missing',
        }),
        expect.objectContaining({
          code: 'missing-reference',
          path: 'rooms.arrival.checkpoints.entry.requiresCompleted',
          message: expect.stringContaining('missing-encounter'),
        }),
      ]),
    )
  })

  it('allows an optional encounter to depend on required work but rejects the reverse transitively', () => {
    expect(() =>
      composeLevel(FOUNDATION_STRAIGHT_SOURCE, FOUNDATION_AUTHORING_CATALOG),
    ).not.toThrow()
    const [arrival, gallery, optional] = FOUNDATION_STRAIGHT_SOURCE.exhibits
    const requiredThroughOptional: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      exhibits: [
        arrival,
        { ...gallery, requiresCompleted: ['gallery-optional'] },
        { ...optional, requiresCompleted: ['arrival-goblet'] },
      ],
    }

    const diagnostics = diagnosticsFrom(requiredThroughOptional)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'optional-required',
        path: 'exhibits.gallery-decanter.requiresCompleted',
      }),
    )
  })

  it('requires the exit dependency closure to cover every required encounter', () => {
    const incomplete: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      exit: {
        ...FOUNDATION_STRAIGHT_SOURCE.exit,
        requiresCompleted: ['arrival-goblet'],
      },
    }

    const diagnostics = diagnosticsFrom(incomplete)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'incomplete-exit-requirements',
        path: 'exit.requiresCompleted',
        message: expect.stringContaining('gallery-decanter'),
      }),
    )
    expect(() =>
      composeLevel(FOUNDATION_STRAIGHT_SOURCE, FOUNDATION_AUTHORING_CATALOG),
    ).not.toThrow()
  })

  it('requires cardinal local port facings before deriving an axis-aligned gate', () => {
    const room = foundationRoom()
    const catalog = replaceFoundationRoom({
      ports: room.ports.map((port) => ({
        ...port,
        facingYaw: port.facingYaw + Math.PI / 4,
      })),
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'invalid-port' }),
    )
  })

  it('rejects connections with mismatched coordinates, openings or orientations', () => {
    const room = foundationRoom()
    const shiftedSource: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      rooms: [
        FOUNDATION_STRAIGHT_SOURCE.rooms[0],
        {
          ...FOUNDATION_STRAIGHT_SOURCE.rooms[1],
          translate: { x: 0.1, y: 0, z: 6 },
        },
      ],
    }
    const wideRoom: RoomPrefab = {
      ...room,
      id: 'wide-gallery',
      ports: room.ports.map((port) =>
        port.id === 'south' ? { ...port, width: port.width + 0.2 } : port,
      ),
    }
    const reversedRoom: RoomPrefab = {
      ...room,
      id: 'reversed-gallery',
      ports: room.ports.map((port) =>
        port.id === 'south' ? { ...port, facingYaw: Math.PI } : port,
      ),
    }
    const sourceWithPrefab = (prefabId: string): AuthoredLevelSource => ({
      ...FOUNDATION_STRAIGHT_SOURCE,
      rooms: [
        FOUNDATION_STRAIGHT_SOURCE.rooms[0],
        { ...FOUNDATION_STRAIGHT_SOURCE.rooms[1], prefabId },
      ],
    })
    const catalogWith = (roomVariant: RoomPrefab): LevelAuthoringCatalog => ({
      ...FOUNDATION_AUTHORING_CATALOG,
      rooms: {
        'foundation-gallery': room,
        [roomVariant.id]: roomVariant,
      },
    })

    const cases = [
      diagnosticsFrom(shiftedSource),
      diagnosticsFrom(sourceWithPrefab(wideRoom.id), catalogWith(wideRoom)),
      diagnosticsFrom(
        sourceWithPrefab(reversedRoom.id),
        catalogWith(reversedRoom),
      ),
    ]

    for (const diagnostics of cases)
      expect(diagnostics).toContainEqual(
        expect.objectContaining({ code: 'mismatched-port' }),
      )
  })

  it('diagnoses an unknown local catch checkpoint instead of silently dropping it', () => {
    const room = foundationRoom()
    const catalog = replaceFoundationRoom({
      platforms: room.platforms.map((platform) => ({
        ...platform,
        catchCheckpointId: 'missing-checkpoint',
      })),
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'missing-reference',
        path: expect.stringContaining('catchCheckpointId'),
      }),
    )
  })

  it('rejects two exhibit placements that occupy the same room mount', () => {
    const exhibits = FOUNDATION_STRAIGHT_SOURCE.exhibits.map((exhibit) =>
      exhibit.id === 'gallery-optional'
        ? { ...exhibit, mountId: 'right-display' }
        : exhibit,
    )
    const source: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      exhibits,
    }

    const diagnostics = diagnosticsFrom(source)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'duplicate-mount',
        path: 'exhibits.gallery-optional.mountId',
      }),
    )
  })

  it('rejects non-finite mount facing and unordered exit bounds', () => {
    const room = foundationRoom()
    const mountCatalog = replaceFoundationRoom({
      exhibitMounts: room.exhibitMounts.map((mount, index) =>
        index === 0 ? { ...mount, facingYaw: Number.NaN } : mount,
      ),
    })
    const exitCatalog = replaceFoundationRoom({
      exits: room.exits.map((exit) => ({
        ...exit,
        minX: exit.maxX,
      })),
    })

    expect(codes(FOUNDATION_STRAIGHT_SOURCE, mountCatalog)).toContain(
      'invalid-anchor',
    )
    expect(codes(FOUNDATION_STRAIGHT_SOURCE, exitCatalog)).toContain(
      'invalid-bounds',
    )
  })

  it('rejects checkpoints and listening pads that rely on an inactive floor', () => {
    const room = foundationRoom()
    const catalog = replaceFoundationRoom({
      platforms: room.platforms.map((platform) => ({
        ...platform,
        activation: { allCompleted: ['arrival-goblet'] },
      })),
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-anchor',
          path: 'spawnCheckpoint',
        }),
        expect.objectContaining({
          code: 'unsupported-anchor',
          path: expect.stringContaining('checkpoint'),
        }),
        expect.objectContaining({
          code: 'unsupported-anchor',
          path: expect.stringContaining('anchor'),
        }),
      ]),
    )
  })

  it('forbids disappearing platforms while allowing completion-removed gates', () => {
    const room = foundationRoom()
    const catalog = replaceFoundationRoom({
      platforms: room.platforms.map((platform) => ({
        ...platform,
        activation: { noneCompleted: ['arrival-goblet'] },
      })),
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)
    const valid = composeLevel(
      FOUNDATION_STRAIGHT_SOURCE,
      FOUNDATION_AUTHORING_CATALOG,
    )
    const gate = valid.solids?.find((solid) =>
      solid.id.endsWith('/connection/gate/arrival-gate'),
    )

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'non-monotonic-platform' }),
    )
    expect(gate?.activation?.noneCompleted).toEqual([
      'glass-foundation/straight/arrival/encounter/arrival-goblet',
    ])
  })

  it('rejects unknown, repeated and multiply owned visual collision proxies', () => {
    const room = foundationRoom()
    const catalog = replaceFoundationRoom({
      solids: room.solids.map((solid) =>
        solid.id === 'east-north-wall'
          ? { ...solid, presentation: undefined }
          : solid,
      ),
      visuals: [
        {
          id: 'first-wall-art',
          recipeId: 'deck',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
          coversSolidIds: ['north-west-wall', 'north-west-wall', 'missing'],
        },
        {
          id: 'second-wall-art',
          recipeId: 'deck',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
          coversSolidIds: ['north-west-wall'],
        },
        {
          id: 'missing-fallback-art',
          recipeId: 'deck',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
          coversSolidIds: ['east-north-wall'],
        },
      ],
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-reference',
          path: expect.stringContaining('coversSolidIds'),
        }),
        expect.objectContaining({
          code: 'duplicate-reference',
          path: expect.stringContaining('coversSolidIds'),
        }),
        expect.objectContaining({
          code: 'invalid-presentation',
          message: expect.stringContaining('visible fallback proxy'),
        }),
      ]),
    )
  })

  it('rejects a visual proxy removed by a compiled room connection', () => {
    const catalog = replaceFoundationRoom({
      visuals: [
        {
          id: 'north-seal-art',
          recipeId: 'deck',
          position: { x: 0, y: 0, z: 3 },
          yaw: 0,
          coversSolidIds: ['north-seal'],
        },
      ],
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'missing-reference',
        path: expect.stringContaining('presentation.visuals'),
        message: expect.stringContaining('absent from the compiled level'),
      }),
    )
  })

  it('rejects one visual spanning solids with different activation rules', () => {
    const catalog = replaceFoundationRoom({
      visuals: [
        {
          id: 'mixed-wall-art',
          recipeId: 'deck',
          position: { x: 0, y: 0, z: 3 },
          yaw: 0,
          coversSolidIds: ['north-west-wall', 'north-east-wall'],
        },
      ],
    })
    const source: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      solidActivations: [
        {
          solid: 'arrival.north-west-wall',
          activation: { noneCompleted: ['arrival-goblet'] },
        },
      ],
    }

    const diagnostics = diagnosticsFrom(source, catalog)

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'mismatched-visual-activation',
        path: expect.stringContaining('coveredSolidIds'),
      }),
    )
  })

  it('rejects malformed decorations and collision owned by another room visual', () => {
    const room = foundationRoom()
    const catalog = replaceFoundationRoom({
      visuals: [
        {
          id: 'wall-art',
          recipeId: 'deck',
          position: { x: 0, y: 0, z: 0 },
          yaw: 0,
          coversSolidIds: ['north-west-wall'],
        },
      ],
      decorations: [
        {
          id: 'bad-planter',
          recipeId: 'missing-decoration',
          position: { x: Number.NaN, y: 0, z: 0 },
          yaw: 0,
          scale: 0,
          coversSolidIds: ['north-west-wall'],
        },
        {
          id: 'sealed-art',
          recipeId: 'deck',
          position: { x: 0, y: 1, z: 0 },
          yaw: 0,
          coversSolidIds: [room.ports[0].sealSolidId],
        },
      ],
    })

    const diagnostics = diagnosticsFrom(FOUNDATION_STRAIGHT_SOURCE, catalog)

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-transform',
          path: expect.stringContaining('decorations.bad-planter'),
        }),
        expect.objectContaining({
          code: 'missing-asset-recipe',
          path: expect.stringContaining('decorations.bad-planter.recipeId'),
        }),
        expect.objectContaining({
          code: 'duplicate-reference',
          message: expect.stringContaining('already covered by visual'),
        }),
        expect.objectContaining({
          code: 'invalid-presentation',
          message: expect.stringContaining('Connection seal'),
        }),
      ]),
    )
  })

  it('maps guidance only from unique known authored encounters', () => {
    const source: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      guidance: {
        encounterSuccessNotices: [
          { encounterId: 'arrival-goblet', notice: 'Open.' },
          { encounterId: 'arrival-goblet', notice: 'Again.' },
          { encounterId: 'missing', notice: 'Never.' },
        ],
      },
    }

    const diagnostics = diagnosticsFrom(source)

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-reference' }),
        expect.objectContaining({
          code: 'missing-reference',
          path: expect.stringContaining('guidance.encounterSuccessNotices'),
        }),
      ]),
    )
  })

  it('rejects blank authored teaching copy before a tutorial can hide its instructions', () => {
    const source: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      guidance: {
        tutorial: {
          pages: [
            { title: 'Move', body: '   ', aside: 'Jump is optional.' },
            {
              title: 'Sing',
              body: 'Hold a comfortable note.',
              aside: 'Rest any time.',
            },
          ],
        },
      },
    }
    expect(diagnosticsFrom(source)).toContainEqual(
      expect.objectContaining({
        code: 'invalid-guidance',
        path: 'guidance.tutorial.pages.0.body',
      }),
    )
  })

  it('rejects blank tutorial IDs and non-positive tutorial versions', () => {
    const source: AuthoredLevelSource = {
      ...FOUNDATION_STRAIGHT_SOURCE,
      guidance: {
        tutorial: {
          id: ' ',
          version: 0,
          pages: [
            { title: 'Move', body: 'Walk forward.', aside: 'Take your time.' },
            {
              title: 'Sing',
              body: 'Hold a comfortable note.',
              aside: 'Rest any time.',
            },
          ],
        },
      },
    }
    expect(diagnosticsFrom(source)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-guidance',
          path: 'guidance.tutorial.id',
        }),
        expect.objectContaining({
          code: 'invalid-guidance',
          path: 'guidance.tutorial.version',
        }),
      ]),
    )
  })
})
