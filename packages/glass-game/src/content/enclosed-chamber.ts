// Enclosed chamber — a two-hold museum route from sealed gallery to open sky terrace.

import { composeLevel } from '../authoring/compose-level'
import type { AuthoredLevelSource } from '../authoring/contracts'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_MUSEUM_AUTHORING_CATALOG, } from './enclosed-museum-kit'

export const ENCLOSED_CHAMBER_SOURCE: AuthoredLevelSource = {
  levelId: 'glassworks-chamber',
  layoutId: 'chamber',
  contentRevision: 1,
  title: 'The Enclosed Gallery',
  guidance: {
    subtitle: 'The first enclosed gallery',
    openingNotice: 'Follow the gold inlay to the threshold goblet.',
    encounterSuccessNotices: [
      {
        encounterId: 'threshold-goblet',
        notice:
          'The marble screen is open. Follow the gold path around the turn.',
      },
      {
        encounterId: 'passage-decanter',
        notice: 'The terrace is open. Step into the sky.',
      },
      {
        encounterId: 'window-coupe',
        notice: 'A window treasure, opened just for the joy of it.',
      },
    ],
    completionTitle: 'The chamber is singing.',
    completionNext: 'Take a moment. You made this gallery sing.',
  },
  rooms: [
    {
      id: 'chamber',
      prefabId: 'enclosed-chamber',
      translate: { x: 0, y: 0, z: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'museum',
    },
    {
      id: 'entry',
      prefabId: 'enclosed-entry',
      translate: { x: 7.471119914054871, y: 0, z: 0 },
      yawQuarterTurns: 1,
      audioSceneId: 'gallery',
    },
    {
      id: 'corner',
      prefabId: 'enclosed-corner',
      translate: { x: 12.096037511825562, y: 0, z: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
    {
      id: 'reveal',
      prefabId: 'enclosed-reveal',
      translate: { x: 12.096037511825562, y: 0, z: 4.624917597770692 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
    {
      id: 'terrace',
      prefabId: 'enclosed-terrace',
      translate: { x: 12.096037511825562, y: 0, z: 9.249835195541383 },
      yawQuarterTurns: 0,
      audioSceneId: 'garden',
    },
    {
      id: 'terrace-panorama',
      prefabId: 'enclosed-terrace-panorama',
      translate: { x: 12.096037511825562, y: 0, z: 9.249835195541383 },
      yawQuarterTurns: 0,
    },
  ],
  exhibits: [
    {
      id: 'threshold-goblet',
      roomId: 'chamber',
      mountId: 'threshold-display',
      prefabId: 'enclosed-threshold-goblet',
      label: 'Threshold goblet',
      optional: false,
    },
    {
      id: 'window-coupe',
      roomId: 'chamber',
      mountId: 'window-display',
      prefabId: 'enclosed-window-coupe',
      label: 'Window coupe',
      optional: true,
    },
    {
      id: 'passage-decanter',
      roomId: 'reveal',
      mountId: 'reveal-display',
      prefabId: 'enclosed-passage-decanter',
      label: 'Passage decanter',
      optional: false,
      requiresCompleted: ['threshold-goblet'],
    },
  ],
  connections: [
    { from: 'chamber.east', to: 'entry.south' },
    { from: 'entry.north', to: 'corner.west' },
    { from: 'corner.north', to: 'reveal.south' },
    { from: 'reveal.north', to: 'terrace.south' },
  ],
  solidActivations: [
    {
      solid: 'chamber.east-center-body',
      activation: { noneCompleted: ['threshold-goblet'] },
      requiredForRoute: true,
    },
    {
      solid: 'reveal.north-gate-body',
      activation: { noneCompleted: ['passage-decanter'] },
      requiredForRoute: true,
    },
  ],
  spawnCheckpoint: 'chamber.arrival',
  exit: {
    zone: 'terrace.exit',
    requiresCompleted: ['passage-decanter'],
  },
  fallBelow: -1.6,
  worldBounds: {
    minX: -ENCLOSED_CHAMBER_HALF - 0.6,
    maxX: 19.2,
    minY: -1.6,
    maxY: 10.5,
    minZ: -ENCLOSED_CHAMBER_HALF - 0.6,
    maxZ: 16.3,
  },
  lightBounds: {
    minX: -ENCLOSED_CHAMBER_HALF - 0.2,
    maxX: 16.3,
    minY: 0,
    maxY: 8,
    minZ: -ENCLOSED_CHAMBER_HALF - 0.2,
    maxZ: 15.5,
  },
}

export const GLASS_ENCLOSED_CHAMBER = composeLevel(
  ENCLOSED_CHAMBER_SOURCE,
  ENCLOSED_MUSEUM_AUTHORING_CATALOG,
)
