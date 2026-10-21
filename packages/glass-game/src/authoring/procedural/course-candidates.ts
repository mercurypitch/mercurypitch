// Procedural traversal candidates — melody contours select reusable course acts.

import { createArcedViaductChunk, createAuroraGlideChunk, createCascadingDropChunk, createCrackingSpiralChunk, createCrystalCrossroadsChunk, createDiagonalGlideChunk, createFrostGlissadeChunk, createFrostRaftTransferChunk, createHexCascadeChunk, createScrollBridgeChunk, createSkyElevatorGlideChunk, createSlalomZigzagChunk, createSplitForkChunk, createTerracedAscentChunk, createTwinGlideCrossingChunk, createViaductSCurveChunk, } from './chunk-library.ts'
import type { ProceduralChunk } from './contracts.ts'

type CrystalPreset = 'aurora-heart' | 'resonance-veins' | 'frost-roots'

export function buildActCandidates(options: {
  readonly stepIndex: number
  readonly melodyAnchors: readonly { readonly offsetSemitones: number }[]
  readonly crystalPreset: CrystalPreset
  readonly secondaryCrystalPreset: CrystalPreset
  readonly hexWarningTime: number
}): readonly {
  readonly traversal: readonly ProceduralChunk[]
  readonly preferredTurns: readonly ('none' | 'east' | 'west')[]
}[] {
  const {
    stepIndex,
    melodyAnchors,
    crystalPreset,
    secondaryCrystalPreset,
    hexWarningTime,
  } = options
  const totalTransitions = melodyAnchors.length - 1
  const prevSemitones = melodyAnchors[stepIndex - 1]!.offsetSemitones
  const currSemitones = melodyAnchors[stepIndex]!.offsetSemitones
  const semitoneDelta = currSemitones - prevSemitones
  const elevationScale = Math.max(
    0.8,
    Math.min(1.5, Math.abs(semitoneDelta) / 2),
  )
  const tagA = `s${stepIndex}a`
  const tagB = `s${stepIndex}b`
  const tagC = `s${stepIndex}c`
  const preset = stepIndex % 2 === 1 ? crystalPreset : secondaryCrystalPreset

  // Final act (Ketsu): always includes a living-crystal/crossroads or fork + a moving 3D ferry
  if (stepIndex === totalTransitions) {
    return [
      {
        traversal: [
          createCrystalCrossroadsChunk(tagA, preset, hexWarningTime),
          createSkyElevatorGlideChunk(tagB, 0.56),
          createCascadingDropChunk(tagC, 'west', hexWarningTime),
        ],
        preferredTurns: ['none', 'east', 'west'],
      },
      {
        traversal: [
          createCrystalCrossroadsChunk(tagA, preset, hexWarningTime),
          createArcedViaductChunk(tagB, 'west', hexWarningTime, 0.36),
          createDiagonalGlideChunk(tagC, 'left-to-right'),
        ],
        preferredTurns: ['east', 'west', 'none'],
      },
      {
        traversal: [
          createSlalomZigzagChunk(tagA, 'frost'),
          createScrollBridgeChunk(tagB, preset),
          createArcedViaductChunk(tagC, 'east', hexWarningTime, 0.36),
          createDiagonalGlideChunk(`s${stepIndex}d`, 'right-to-left'),
        ],
        preferredTurns: ['west', 'east', 'none'],
      },
      {
        traversal: [
          createTerracedAscentChunk(tagA, hexWarningTime),
          createSplitForkChunk(tagB),
          createSkyElevatorGlideChunk(tagC, 0.56),
        ],
        preferredTurns: ['east', 'none', 'west'],
      },
      {
        traversal: [
          createScrollBridgeChunk(tagA, preset),
          createCascadingDropChunk(tagB, 'west', hexWarningTime),
          createSkyElevatorGlideChunk(tagC, 0.56),
          createSlalomZigzagChunk(`s${stepIndex}d`, 'frost'),
        ],
        preferredTurns: ['none', 'east', 'west'],
      },
      {
        traversal: [
          createViaductSCurveChunk(tagA),
          createTerracedAscentChunk(tagB, hexWarningTime),
          createDiagonalGlideChunk(tagC, 'left-to-right'),
        ],
        preferredTurns: ['west', 'none', 'east'],
      },
      {
        traversal: [
          createSplitForkChunk(tagA),
          createCrystalCrossroadsChunk(tagB, preset, hexWarningTime),
          createDiagonalGlideChunk(tagC, 'right-to-left'),
        ],
        preferredTurns: ['west', 'east', 'none'],
      },
      {
        traversal: [
          createTerracedAscentChunk(tagA, hexWarningTime),
          createScrollBridgeChunk(tagB, preset),
          createArcedViaductChunk(tagC, 'west', hexWarningTime, 0.36),
          createAuroraGlideChunk(`s${stepIndex}d`),
        ],
        preferredTurns: ['east', 'none', 'west'],
      },
      {
        traversal: [
          createFrostRaftTransferChunk(tagA, hexWarningTime),
          createCrackingSpiralChunk(tagB, 'east', hexWarningTime, 0.48),
          createScrollBridgeChunk(tagC, preset),
        ],
        preferredTurns: ['none', 'west', 'east'],
      },
      {
        traversal: [
          createTwinGlideCrossingChunk(tagA, hexWarningTime),
          createCrackingSpiralChunk(tagB, 'west', hexWarningTime, 0.48),
        ],
        preferredTurns: ['none', 'east', 'west'],
      },
    ]
  }

  // Opening or ascending act (Ki / Sho): pitch rises -> physical elevation rises
  if (semitoneDelta >= 0) {
    const climbDelta = Number((0.36 * elevationScale).toFixed(2))
    return [
      {
        traversal: [
          createTerracedAscentChunk(tagA, hexWarningTime),
          createArcedViaductChunk(tagB, 'east', hexWarningTime, climbDelta),
        ],
        preferredTurns: ['none', 'east', 'west'],
      },
      {
        traversal: [
          createArcedViaductChunk(tagA, 'east', hexWarningTime, climbDelta),
          createSlalomZigzagChunk(tagB, 'hybrid', hexWarningTime),
        ],
        preferredTurns: ['none', 'west', 'east'],
      },
      {
        traversal: [
          createViaductSCurveChunk(tagA),
          createTerracedAscentChunk(tagB, hexWarningTime),
        ],
        preferredTurns: ['west', 'east', 'none'],
      },
      {
        traversal: [
          createSlalomZigzagChunk(tagA, 'hybrid', hexWarningTime),
          createScrollBridgeChunk(tagB, preset),
        ],
        preferredTurns: ['east', 'west', 'none'],
      },
      {
        traversal: [createCrystalCrossroadsChunk(tagA, preset, hexWarningTime)],
        preferredTurns: ['east', 'west', 'none'],
      },
      {
        traversal: [
          createArcedViaductChunk(tagA, 'west', hexWarningTime, climbDelta),
          createScrollBridgeChunk(tagB, preset),
        ],
        preferredTurns: ['east', 'none', 'west'],
      },
      {
        traversal: [
          createFrostGlissadeChunk(tagA),
          createTerracedAscentChunk(tagB, hexWarningTime),
        ],
        preferredTurns: ['east', 'west', 'none'],
      },
      {
        traversal: [
          createSkyElevatorGlideChunk(tagA, 0.56),
          createCascadingDropChunk(tagB, 'east', hexWarningTime),
        ],
        preferredTurns: ['none', 'west', 'east'],
      },
      {
        traversal: [
          createCrackingSpiralChunk(tagA, 'east', hexWarningTime, climbDelta),
          createFrostRaftTransferChunk(tagB, hexWarningTime),
        ],
        preferredTurns: ['none', 'west', 'east'],
      },
      {
        traversal: [
          createTwinGlideCrossingChunk(tagA, hexWarningTime),
          createArcedViaductChunk(tagB, 'west', hexWarningTime, climbDelta),
        ],
        preferredTurns: ['none', 'east', 'west'],
      },
    ]
  }

  // Intermediate descending act (Ten): melody steps downward -> cascading drops & relief bridges
  return [
    {
      traversal: [
        createCascadingDropChunk(tagA, 'east', hexWarningTime),
        createScrollBridgeChunk(tagB, preset),
      ],
      preferredTurns: ['none', 'west', 'east'],
    },
    {
      traversal: [
        createCascadingDropChunk(tagA, 'west', hexWarningTime),
        createHexCascadeChunk(tagB, hexWarningTime),
      ],
      preferredTurns: ['none', 'east', 'west'],
    },
    {
      traversal: [
        createArcedViaductChunk(tagA, 'east', hexWarningTime, -0.3),
        createFrostGlissadeChunk(tagB),
      ],
      preferredTurns: ['west', 'none', 'east'],
    },
    {
      traversal: [
        createArcedViaductChunk(tagA, 'west', hexWarningTime, -0.3),
        createCrystalCrossroadsChunk(tagB, preset, hexWarningTime),
      ],
      preferredTurns: ['east', 'none', 'west'],
    },
    {
      traversal: [
        createCrackingSpiralChunk(tagA, 'east', hexWarningTime, -0.36),
        createTwinGlideCrossingChunk(tagB, hexWarningTime),
      ],
      preferredTurns: ['none', 'west', 'east'],
    },
  ]
}
