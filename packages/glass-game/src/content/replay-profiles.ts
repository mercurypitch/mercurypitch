// Museum replay goals — short authored mastery visits in the existing three learning galleries.

import type { LevelDefinition } from '../contracts'
import type { ReplayProfile } from '../core/replay-profile'

const GLASSWORKS_PROFILES: readonly ReplayProfile[] = [
  {
    id: 'first-visit',
    revision: 1,
    tier: 1,
    title: 'First visit',
    description:
      'Hold your comfortable note for two seconds. The final portrait asks for a little longer.',
    encounters: {
      'vestibule-goblet': { holdSeconds: 2 },
      'garden-decanter': { holdSeconds: 2 },
      'archive-carafe': { holdSeconds: 2 },
      'portrait-finale': { holdSeconds: 2.5 },
    },
  },
  {
    id: 'two-star',
    revision: 1,
    tier: 2,
    title: 'Two-star challenge',
    description:
      'Steady three-second notes, then one five-second portrait. Breathe freely between exhibits.',
    encounters: {
      'vestibule-goblet': { holdSeconds: 3 },
      'garden-decanter': { holdSeconds: 3 },
      'archive-carafe': { holdSeconds: 3 },
      'portrait-finale': { holdSeconds: 5 },
    },
  },
  {
    id: 'three-star',
    revision: 1,
    tier: 3,
    title: 'Three-star challenge',
    description:
      'Centre each note more carefully. Short holds lead to one seven-second portrait.',
    encounters: {
      'vestibule-goblet': { holdSeconds: 3, toleranceCents: 80 },
      'garden-decanter': { holdSeconds: 3, toleranceCents: 80 },
      'archive-carafe': { holdSeconds: 3, toleranceCents: 80 },
      'portrait-finale': { holdSeconds: 7, toleranceCents: 80 },
    },
  },
]

const TWIN_PROFILES: readonly ReplayProfile[] = [
  {
    id: 'first-visit',
    revision: 1,
    tier: 1,
    title: 'First visit',
    description:
      'Find a comfortable lower and higher note, then answer with the pair at your own pace.',
    encounters: {
      'lower-urn': {},
      'upper-decanter': {},
      'bridge-pair': {},
      'portrait-pair': {},
    },
  },
  {
    id: 'two-star',
    revision: 1,
    tier: 2,
    title: 'Two-star challenge',
    description:
      'Let each lower and higher note settle for two seconds. Take your time between notes.',
    encounters: {
      'lower-urn': { holdSeconds: 2 },
      'upper-decanter': { holdSeconds: 2 },
      'bridge-pair': { holdSeconds: 2 },
      'portrait-pair': { holdSeconds: 2 },
    },
  },
  {
    id: 'three-star',
    revision: 1,
    tier: 3,
    title: 'Three-star challenge',
    description:
      'Land closer to the centre of each note and hold the finale pair for three seconds each.',
    encounters: {
      'lower-urn': { holdSeconds: 2, toleranceCents: 65 },
      'upper-decanter': { holdSeconds: 2, toleranceCents: 65 },
      'bridge-pair': { holdSeconds: 2, toleranceCents: 65 },
      'portrait-pair': { holdSeconds: 3, toleranceCents: 65 },
    },
  },
]

const CONSERVATORY_PROFILES: readonly ReplayProfile[] = [
  {
    id: 'first-visit',
    revision: 1,
    tier: 1,
    title: 'First visit',
    description:
      'Settle on your note, make two gentle waves, then come home to the centre.',
    encounters: {
      'entrance-goblet': {},
      'fern-wave': {},
      'orchid-wave': {},
      'keeper-finale': {},
    },
  },
  {
    id: 'two-star',
    revision: 1,
    tier: 2,
    title: 'Two-star challenge',
    description:
      'Find a steady centre, then make three unhurried waves and return to it.',
    encounters: {
      'entrance-goblet': { holdSeconds: 2 },
      'fern-wave': { waveCycles: 3, waveSeconds: 1.8 },
      'orchid-wave': { waveCycles: 3, waveSeconds: 1.8 },
      'keeper-finale': { waveCycles: 3, waveSeconds: 1.8 },
    },
  },
  {
    id: 'three-star',
    revision: 1,
    tier: 3,
    title: 'Three-star challenge',
    description:
      'Settle more precisely, then guide three clear waves through each exhibit and return home.',
    encounters: {
      'entrance-goblet': { holdSeconds: 2, toleranceCents: 70 },
      'fern-wave': {
        holdSeconds: 1.2,
        toleranceCents: 70,
        waveCycles: 3,
        waveSeconds: 2.2,
      },
      'orchid-wave': {
        holdSeconds: 1.2,
        toleranceCents: 70,
        waveCycles: 3,
        waveSeconds: 2.2,
      },
      'keeper-finale': {
        holdSeconds: 1.2,
        toleranceCents: 70,
        waveCycles: 3,
        waveSeconds: 2.2,
      },
    },
  },
]

export const MUSEUM_REPLAY_PROFILES: Readonly<
  Record<string, readonly ReplayProfile[]>
> = {
  'glassworks-journey': GLASSWORKS_PROFILES,
  'glassworks-twin-galleries': TWIN_PROFILES,
  'glassworks-resonance-conservatory': CONSERVATORY_PROFILES,
}

export function replayProfilesForLevel(
  level: LevelDefinition,
): readonly ReplayProfile[] {
  return MUSEUM_REPLAY_PROFILES[level.authored?.levelId ?? level.id] ?? []
}
