import { describe, expect, it } from 'vitest'
import type { DoorLayout } from './alley-geometry'
import { coverFit, easeOut, fullQuad, invert, layoutDoors, lerpQuad, matrix3d, parsePosition, pickDoor, placePanel, project, rectToQuad, tapBand, } from './alley-geometry'
import type { Point, Quad } from './alley-plate'
import { ALLEY_PLATE, DOORS } from './alley-plate'

const at393 = layoutDoors(ALLEY_PLATE, DOORS, 393, 852)
const at430 = layoutDoors(ALLEY_PLATE, DOORS, 430, 932)
const door = (doors: DoorLayout[], key: string): DoorLayout => {
  const found = doors.find((d) => d.key === key)
  if (!found) throw new Error(key)
  return found
}
const numbers = (css: string): number[] =>
  css
    .replace(/^matrix3d\(|\)$/gu, '')
    .split(',')
    .map(Number)

describe('the plate on the screen', () => {
  it('reads object-position keywords as well as percentages', () => {
    expect(parsePosition('72% center')).toEqual([0.72, 0.5])
    expect(parsePosition('right bottom')).toEqual([1, 1])
    expect(parsePosition('30%')).toEqual([0.3, 0.5])
  })

  it('covers a 393 x 852 phone by height, 126 px off the left at 72%', () => {
    const fit = coverFit(ALLEY_PLATE, 393, 852)
    expect(fit.scale).toBeCloseTo(852 / 1536, 9)
    expect(fit.ox).toBeCloseTo((1024 * (852 / 1536) - 393) * 0.72, 9)
    expect(fit.oy).toBeCloseTo(0, 9)
  })
})

describe('the six doors', () => {
  it('lands every quad where the lab measured it at 393 x 852', () => {
    expect(at393.map((d) => [d.key, d.quad])).toEqual([
      [
        'ear',
        [
          [0.5, 401.6],
          [28.8, 392.7],
          [28.8, 512],
          [0.5, 508.1],
        ],
      ],
      [
        'piano',
        [
          [38.2, 388.8],
          [74.2, 377.2],
          [74.2, 523.1],
          [38.2, 517.5],
        ],
      ],
      [
        'drums',
        [
          [85.9, 377.7],
          [130.8, 362.2],
          [130.8, 539.7],
          [85.9, 530.8],
        ],
      ],
      [
        'karaoke',
        [
          [145.2, 354.4],
          [201.3, 326.2],
          [201.3, 565.8],
          [145.2, 551.4],
        ],
      ],
      [
        'sing',
        [
          [226.2, 321.7],
          [280, 296.2],
          [280, 607.4],
          [226.2, 593.5],
        ],
      ],
      [
        'guitar',
        [
          [313.3, 283.4],
          [418.7, 232.4],
          [418.7, 693.4],
          [313.3, 637.9],
        ],
      ],
    ])
  })

  it('keeps the Ear Lab door 28 px wide, flush with the left edge', () => {
    const ear = door(at393, 'ear')
    expect(ear.x0).toBe(0.5)
    expect(ear.x1 - ear.x0).toBeCloseTo(28.3, 5)
  })

  it('recomputes for a 430 x 932 phone instead of assuming 393 x 852', () => {
    expect(at430.map((d) => [d.key, d.quad])).toEqual([
      [
        'ear',
        [
          [0.6, 439.3],
          [31.5, 429.6],
          [31.5, 560],
          [0.6, 555.8],
        ],
      ],
      [
        'piano',
        [
          [41.8, 425.3],
          [81.3, 412.6],
          [81.3, 572.2],
          [41.8, 566.1],
        ],
      ],
      [
        'drums',
        [
          [94, 413.2],
          [143.2, 396.2],
          [143.2, 590.4],
          [94, 580.7],
        ],
      ],
      [
        'karaoke',
        [
          [159, 387.7],
          [220.2, 356.8],
          [220.2, 618.9],
          [159, 603.1],
        ],
      ],
      [
        'sing',
        [
          [247.5, 351.9],
          [306.4, 324],
          [306.4, 664.4],
          [247.5, 649.2],
        ],
      ],
      [
        'guitar',
        [
          [342.8, 310.1],
          [458.1, 254.2],
          [458.1, 758.5],
          [342.8, 697.8],
        ],
      ],
    ])
  })

  it('orders the doors left to right with no two overlapping', () => {
    for (const doors of [at393, at430]) {
      for (let i = 1; i < doors.length; i++) {
        expect(doors[i].x0).toBeGreaterThan(doors[i - 1].x1)
      }
    }
  })
})

describe('where a tap goes', () => {
  it('sends x = 8 to the Ear Lab and x = 50 to the Piano, inside the doors', () => {
    expect(pickDoor([8, 450], at393).key).toBe('ear')
    expect(pickDoor([50, 450], at393).key).toBe('piano')
  })

  it('routes a tap outside every quad to the nearest centre', () => {
    // Above the sills, where no quad reaches: nearest centre decides.
    expect(pickDoor([8, 250], at393).key).toBe('ear')
    expect(pickDoor([50, 250], at393).key).toBe('piano')
    // The 9 px gap between Ear Lab and Piano splits between them.
    expect(pickDoor([31, 450], at393).key).toBe('ear')
    expect(pickDoor([36, 450], at393).key).toBe('piano')
    // Same answers on a bigger phone.
    expect(pickDoor([8, 500], at430).key).toBe('ear')
    expect(pickDoor([50, 500], at430).key).toBe('piano')
  })

  it('spans the tap band over every door plus 6 px, clamped to the screen', () => {
    expect(tapBand(at393, 393, 852)).toEqual({ x: 0, y: 226.4, w: 393, h: 473 })
  })

  it('starts the band below the headline block, however tall it is', () => {
    expect(tapBand(at393, 393, 852, 300)).toEqual({
      x: 0,
      y: 300,
      w: 393,
      h: 399.4,
    })
    // A block shorter than the doors' tops changes nothing.
    expect(tapBand(at393, 393, 852, 120).y).toBe(226.4)
    // And one past the sills leaves an empty band, never a negative one.
    expect(tapBand(at393, 393, 852, 900).h).toBe(0)
  })
})

/** A door drawn as an upright rectangle: enough to pin the rule. */
function box(key: string, x0: number, y0: number, x1: number, y1: number) {
  const quad: Quad = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
  return {
    key,
    quad,
    x0,
    x1,
    y0,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    points: '',
  } as DoorLayout
}

describe('the rule pickDoor keeps', () => {
  it('takes the quad the tap is inside over a nearer centre', () => {
    // Tall and narrow beside short and wide: at (9, 10) the short door's
    // centre is nearer, but the tap is inside the tall one.
    const tall = box('ear', 0, 0, 10, 200)
    const short = box('piano', 12, 0, 22, 20)
    expect(pickDoor([9, 10], [short, tall]).key).toBe('ear')
  })

  it('outside every quad, weighs height at 0.16 of width', () => {
    // Straight above A by 60 and diagonally off B: the weight picks A, an
    // unweighted distance would pick B.
    const a = box('ear', -5, -5, 5, 5)
    const b = box('piano', 25, 95, 35, 105)
    expect(pickDoor([0, 60], [b, a]).key).toBe('ear')
  })

  it('does not ignore height', () => {
    // Nearer to B across, far from it down: height has to count.
    const a = box('ear', -2, -2, 2, 2)
    const b = box('piano', 3, 195, 7, 205)
    expect(pickDoor([4, 0], [b, a]).key).toBe('ear')
  })
})

describe('the projective map', () => {
  const sing = door(at393, 'sing')

  it("writes the Sing door's matrix the lab wrote", () => {
    const w = Math.round(sing.x1 - sing.x0)
    const h = Math.round(sing.y1 - sing.y0)
    expect([w, h]).toEqual([54, 311])
    const got = numbers(matrix3d(rectToQuad(w, h, sing.quad)))
    const lab = [
      0.339817, -1.16668, 0, -0.002345, 0, 0.873955, 0, 0, 0, 0, 1, 0, 226.2,
      321.7, 0, 1,
    ]
    got.forEach((n, i) => {
      expect(n).toBeCloseTo(lab[i], 4)
    })
  })

  it("sends an element's corners onto the quad", () => {
    const m = rectToQuad(393, 852, sing.quad)
    const corners: Point[] = [
      [0, 0],
      [393, 0],
      [393, 852],
      [0, 852],
    ]
    corners.forEach((c, i) => {
      const p = project(m, c)
      expect(p[0]).toBeCloseTo(sing.quad[i][0], 6)
      expect(p[1]).toBeCloseTo(sing.quad[i][1], 6)
    })
  })

  it('inverts to the identity, so the open starts without a jump', () => {
    const m = rectToQuad(393, 852, sing.quad)
    const back = invert(m)
    for (const p of [
      [10, 20],
      [300, 700],
      [393, 852],
    ] as Point[]) {
      const q = project(back, project(m, p))
      expect(q[0]).toBeCloseTo(p[0], 6)
      expect(q[1]).toBeCloseTo(p[1], 6)
    }
  })

  it('ends the open on the screen itself', () => {
    const full = fullQuad(393, 852)
    const end: Quad = lerpQuad(sing.quad, full, 1)
    expect(matrix3d(rectToQuad(393, 852, end))).toBe(
      'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    )
    expect(lerpQuad(sing.quad, full, 0)).toEqual(sing.quad)
  })

  it("eases on the kit's curve", () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.85)
  })
})

describe('the card under a door', () => {
  it('centres on the door, clamped 16 px inside the screen', () => {
    expect(placePanel(door(at393, 'ear'), 393, 746, 140).x).toBe(16)
    expect(placePanel(door(at393, 'guitar'), 393, 746, 90).x).toBe(
      393 - 16 - 236,
    )
    expect(placePanel(door(at393, 'karaoke'), 393, 746, 90).x).toBe(
      Math.round(173.3 - 118),
    )
  })

  it('sits under the sill and never on the dock', () => {
    const sing = door(at393, 'sing')
    // Room enough: 14 px under the sill.
    expect(placePanel(sing, 393, 900, 140).y).toBe(Math.round(sing.y1 + 14))
    // Not enough: lifted until it clears the dock by 12 px.
    expect(placePanel(sing, 393, 746, 140).y).toBe(746 - 12 - 140)
  })
})
