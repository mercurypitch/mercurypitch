// Existing gallery collections — finite discoveries and original portraits, independent of replay difficulty.
import type { AuthoredLevelRewards } from '../authoring/contracts'

export const TWIN_GALLERY_REWARDS: AuthoredLevelRewards = {
  revision: 1,
  discoveries: [
    { encounterId: 'lower-coupe', coinIds: ['amber-side-coupe'] },
    { encounterId: 'upper-goblet', coinIds: ['celadon-side-goblet'] },
    { encounterId: 'court-echo', coinIds: ['opaline-court-echo'] },
  ],
  grading: [
    {
      kind: 'pitch-accuracy-v1',
      encounterId: 'portrait-pair',
      policyRevision: 1,
      challengeRevision: 1,
      minimumReliableSeconds: 1.2,
      threeStarMaxMeanCents: 35,
      twoStarMaxMeanCents: 75,
      maximumErrorCents: 600,
    },
  ],
  portrait: {
    portraitId: 'twin-galleries-interval',
    legendId: 'the-interval-between',
    title: 'The Interval Between',
    collectionIndex: 2,
    imageAssetId: 'painting-interval-v6',
    awardAfterEncounterId: 'portrait-pair',
    representationStatus: 'approved',
  },
}

export const CONSERVATORY_REWARDS: AuthoredLevelRewards = {
  revision: 1,
  discoveries: [
    { encounterId: 'court-coupe', coinIds: ['listening-court-coupe'] },
    { encounterId: 'orchid-echo', coinIds: ['orchid-echo'] },
    { encounterId: 'sky-echo', coinIds: ['sky-wave'] },
  ],
  // A pitch wave deliberately leaves the centre; steady-note accuracy must not grade it.
  grading: [],
  portrait: {
    portraitId: 'conservatory-wave-keeper',
    legendId: 'keeper-of-gentle-waves',
    title: 'The Keeper of Gentle Waves',
    collectionIndex: 3,
    imageAssetId: 'painting-wave-keeper-v7',
    awardAfterEncounterId: 'keeper-finale',
    representationStatus: 'approved',
  },
}
