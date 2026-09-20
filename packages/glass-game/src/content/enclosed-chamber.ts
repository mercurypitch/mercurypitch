// First Light Gallery — a two-hold tutorial from sealed chamber to open sky terrace.

import { composeLevel } from '../authoring/compose-level'
import type { AuthoredLevelSource } from '../authoring/contracts'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_MUSEUM_AUTHORING_CATALOG, } from './enclosed-museum-kit'

export const ENCLOSED_CHAMBER_SOURCE: AuthoredLevelSource = {
  levelId: 'glassworks-chamber',
  layoutId: 'chamber',
  contentRevision: 3,
  title: 'First Light Gallery',
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.7,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'A little room to learn',
    tutorial: {
      pages: [
        {
          title: 'Meet Merc. Make yourself at home.',
          body: 'Move with WASD or the arrows. On a phone, use the thumbstick. Drag to look around; the camera follows as you move. Space or Jump takes a little hop.',
          aside:
            'Keep moving to ease into a run. Follow the gold path to the goblet; the window coupe is an optional discovery.',
        },
        {
          title: 'Your first beautiful mess.',
          body: 'On a glowing circle, choose Sing and allow the microphone. Hum a comfortable note, listen to it, then hold it gently. A successful break opens the next passage.',
          aside:
            'No shouting or rushing. Cancel to rest, or use Find my note again. After the two main exhibits, walk or jump through the shimmering veil.',
        },
      ],
    },
    openingNotice:
      'Find your feet, then follow the gold path to the goblet. Choose Sing on its glowing circle.',
    encounterSuccessNotices: [
      {
        encounterId: 'threshold-goblet',
        notice:
          'The marble screen is open. Follow the gold path around the turn.',
      },
      {
        encounterId: 'passage-decanter',
        notice:
          'The terrace is open. Walk or jump through the shimmering veil to finish.',
      },
      {
        encounterId: 'window-coupe',
        notice: 'A window treasure, opened just for the joy of it.',
      },
    ],
    completionTitle: 'Your first gallery is singing.',
    completionNext:
      'You moved, listened, and made a beautiful mess. The museum is yours to explore.',
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
