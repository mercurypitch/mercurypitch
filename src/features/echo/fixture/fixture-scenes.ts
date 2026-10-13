// ============================================================
// Echo's fixtures: the storyboard's frames, pinned (generated)
// ============================================================
//
// Written by scripts/sync-echo-art.mjs from the A0 pins
// (echo-storyboard-pins.json) and fixture choices (fixture-choices.json),
// each screen's pins taken to the plate through that screen's own
// alignment (echo-geometry.json). Dev builds only: the fixture page
// (EchoFixture.tsx) is reached from the native entry behind
// import.meta.env.DEV, so no build a phone runs carries this. Do not edit
// by hand; re-run the script.

import type { StarSize } from '../echo-geometry'

export type FixtureTint = 'base' | 'violet' | 'cyan' | 'bright'

export interface FixtureScene {
  /** The storyboard screen it matches. */
  readonly screen: number
  /** The world plate, or the result's lit town. */
  readonly plate: 'world' | 'result'
  /** The state's cloud layer over the plate, or none. */
  readonly clouds: 'mid-take' | null
  readonly celebration: boolean
  readonly merc: 'sing' | 'listen' | 'celebrate'
  readonly rings: readonly {
    readonly u: number
    readonly v: number
    readonly rW: number
    readonly style: 'waiting' | 'active' | 'missed'
  }[]
  readonly stars: readonly {
    readonly u: number
    readonly v: number
    readonly widthW: number
    readonly size: StarSize
    readonly tint: FixtureTint
  }[]
  readonly lines: readonly {
    readonly a: readonly [number, number]
    readonly b: readonly [number, number]
    readonly style: 'phrase' | 'finished' | 'result'
  }[]
  readonly ribbon: {
    readonly points: readonly (readonly [number, number])[]
    readonly scale: number
  } | null
}

export const FIXTURE_SCENES: Readonly<
  Record<'intro' | 'mid-take' | 'result', FixtureScene>
> = {
  intro: {
    screen: 1,
    plate: 'world',
    clouds: null,
    celebration: false,
    merc: 'sing',
    rings: [
      { u: 0.1867, v: 0.3937, rW: 0.05108, style: 'waiting' },
      { u: 0.4989, v: 0.3055, rW: 0.05108, style: 'waiting' },
      { u: 0.8378, v: 0.3794, rW: 0.05108, style: 'waiting' },
    ],
    stars: [],
    lines: [],
    ribbon: null,
  },
  'mid-take': {
    screen: 2,
    plate: 'world',
    clouds: 'mid-take',
    celebration: false,
    merc: 'listen',
    rings: [{ u: 0.8486, v: 0.408, rW: 0.06225, style: 'active' }],
    stars: [
      {
        u: 0.0868,
        v: 0.172,
        widthW: 0.03083,
        size: 'finished',
        tint: 'bright',
      },
      {
        u: 0.2047,
        v: 0.2039,
        widthW: 0.04793,
        size: 'finished',
        tint: 'bright',
      },
      {
        u: 0.0698,
        v: 0.2326,
        widthW: 0.05123,
        size: 'finished',
        tint: 'violet',
      },
      {
        u: 0.8922,
        v: 0.2057,
        widthW: 0.04062,
        size: 'finished',
        tint: 'bright',
      },
      {
        u: 0.7636,
        v: 0.2268,
        widthW: 0.02899,
        size: 'finished',
        tint: 'bright',
      },
      { u: 0.9224, v: 0.2703, widthW: 0.03971, size: 'finished', tint: 'base' },
      { u: 0.1606, v: 0.4283, widthW: 0.17351, size: 'phrase', tint: 'base' },
      { u: 0.5033, v: 0.3131, widthW: 0.19801, size: 'phrase', tint: 'bright' },
    ],
    lines: [
      { a: [0.0874, 0.1741], b: [0.2059, 0.2048], style: 'finished' },
      { a: [0.0874, 0.1741], b: [0.0711, 0.2337], style: 'finished' },
      { a: [0.8925, 0.2067], b: [0.7681, 0.2299], style: 'finished' },
      { a: [0.8925, 0.2067], b: [0.9208, 0.2722], style: 'finished' },
      { a: [0.7681, 0.2299], b: [0.9208, 0.2722], style: 'finished' },
      { a: [0.1576, 0.4266], b: [0.4982, 0.3105], style: 'phrase' },
    ],
    ribbon: {
      points: [
        [0.6033, 0.3219],
        [0.6076, 0.3236],
        [0.6105, 0.3246],
        [0.6141, 0.3259],
        [0.6178, 0.3273],
        [0.6214, 0.3286],
        [0.625, 0.3303],
        [0.6286, 0.3323],
        [0.6322, 0.3343],
        [0.6359, 0.3366],
        [0.6395, 0.339],
        [0.6431, 0.3413],
        [0.6467, 0.3436],
        [0.6504, 0.3463],
        [0.654, 0.349],
        [0.6576, 0.3517],
        [0.6612, 0.3547],
        [0.6649, 0.3574],
        [0.6685, 0.3597],
        [0.6721, 0.362],
        [0.6757, 0.3644],
        [0.6793, 0.3664],
        [0.683, 0.3684],
        [0.6866, 0.3704],
        [0.6902, 0.3721],
        [0.6938, 0.3737],
        [0.6975, 0.3754],
        [0.7011, 0.3771],
        [0.7047, 0.3788],
        [0.7083, 0.3804],
        [0.712, 0.3821],
        [0.7156, 0.3834],
        [0.7192, 0.3848],
        [0.7228, 0.3861],
        [0.7264, 0.3871],
        [0.7301, 0.3881],
        [0.7337, 0.3891],
        [0.7373, 0.3901],
        [0.7409, 0.3908],
        [0.7446, 0.3915],
        [0.7482, 0.3921],
        [0.7511, 0.3928],
        [0.7554, 0.3938],
      ],
      scale: 1.0101,
    },
  },
  result: {
    screen: 4,
    plate: 'result',
    clouds: null,
    celebration: true,
    merc: 'celebrate',
    rings: [{ u: 0.5766, v: 0.4111, rW: 0.03378, style: 'missed' }],
    stars: [
      { u: 0.3243, v: 0.2953, widthW: 0.08172, size: 'result', tint: 'base' },
      { u: 0.5973, v: 0.2952, widthW: 0.08199, size: 'result', tint: 'bright' },
      { u: 0.124, v: 0.304, widthW: 0.0801, size: 'result', tint: 'base' },
      { u: 0.7823, v: 0.3206, widthW: 0.07313, size: 'result', tint: 'base' },
      { u: 0.2315, v: 0.3611, widthW: 0.07158, size: 'result', tint: 'bright' },
      { u: 0.6785, v: 0.3634, widthW: 0.06481, size: 'result', tint: 'cyan' },
      { u: 0.4488, v: 0.3752, widthW: 0.07182, size: 'result', tint: 'cyan' },
      { u: 0.3193, v: 0.4124, widthW: 0.07646, size: 'result', tint: 'violet' },
      { u: 0.0729, v: 0.4386, widthW: 0.07814, size: 'result', tint: 'violet' },
      { u: 0.7419, v: 0.4503, widthW: 0.06873, size: 'result', tint: 'cyan' },
      { u: 0.2695, v: 0.4779, widthW: 0.06921, size: 'result', tint: 'base' },
      { u: 0.5547, v: 0.4862, widthW: 0.08041, size: 'result', tint: 'bright' },
      { u: 0.125, v: 0.4906, widthW: 0.05038, size: 'result', tint: 'violet' },
      { u: 0.7435, v: 0.5216, widthW: 0.08069, size: 'result', tint: 'bright' },
    ],
    lines: [
      { a: [0.3234, 0.2958], b: [0.1218, 0.3039], style: 'result' },
      { a: [0.3234, 0.2958], b: [0.2299, 0.3613], style: 'result' },
      { a: [0.5963, 0.2956], b: [0.7818, 0.3214], style: 'result' },
      { a: [0.5963, 0.2956], b: [0.6787, 0.364], style: 'result' },
      { a: [0.1218, 0.3039], b: [0.2299, 0.3613], style: 'result' },
      { a: [0.7818, 0.3214], b: [0.6787, 0.364], style: 'result' },
      { a: [0.4471, 0.3753], b: [0.3204, 0.414], style: 'result' },
      { a: [0.0714, 0.4388], b: [0.2695, 0.4787], style: 'result' },
      { a: [0.0714, 0.4388], b: [0.1246, 0.4911], style: 'result' },
      { a: [0.7423, 0.4513], b: [0.5536, 0.4867], style: 'result' },
      { a: [0.7423, 0.4513], b: [0.7422, 0.522], style: 'result' },
      { a: [0.2695, 0.4787], b: [0.1246, 0.4911], style: 'result' },
      { a: [0.5536, 0.4867], b: [0.7422, 0.522], style: 'result' },
    ],
    ribbon: null,
  },
}
