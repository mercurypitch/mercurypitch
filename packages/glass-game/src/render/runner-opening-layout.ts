// Runner opening layout — a bounded planted canal promenade outside the playable lanes.
import type { CompiledRunnerCourse } from '../runner/contracts'
import { runnerTrackBounds } from './runner-world-layout'

export const RUNNER_OPENING_LENGTH_METERS = 40
export const RUNNER_OPENING_REPLACED_CHUNKS = 2
export const RUNNER_OPENING_ROUTE_CLEARANCE_METERS = 0.14

export type RunnerOpeningKind =
  | 'canal-bed'
  | 'canal-lip'
  | 'water'
  | 'rail'
  | 'rail-post'
  | 'column'
  | 'foliage'
  | 'flowers'
  | 'ivy'
  | 'canopy'
  | 'arcade'
  | 'plinth'

export interface RunnerOpeningPlacement {
  readonly kind: RunnerOpeningKind
  readonly position: readonly [number, number, number]
  readonly scale: readonly [number, number, number]
  readonly yaw: number
}

/** Decorative banks remain outside collisions, including during the first jump. */
export function createRunnerOpeningLayout(course: CompiledRunnerCourse) {
  const track = runnerTrackBounds(course)
  const floor = course.groundFeetY
  const placements: RunnerOpeningPlacement[] = []
  const add = (
    kind: RunnerOpeningKind,
    x: number,
    y: number,
    distance: number,
    scale: readonly [number, number, number],
    yaw = 0,
  ) => {
    placements.push(
      Object.freeze({
        kind,
        position: [x, floor + y, -distance] as const,
        scale,
        yaw,
      }),
    )
  }
  for (const side of [-1, 1] as const) {
    const edge = side < 0 ? track.left : track.right
    const bank = edge + side * RUNNER_OPENING_ROUTE_CLEARANCE_METERS
    const center = bank + side * 0.6
    // One connected terrace carries the troughs, gardens and architecture.
    // Its upper surface stays below the road and the visible water bed.
    add('plinth', edge + side * 3.9, -0.36, 19, [7.8, 0.36, 42])
    add('canal-bed', center, -0.17, 19, [1.2, 0.3, 42])
    for (const offset of [0.07, 1.13]) {
      add('canal-lip', bank + side * offset, 0.045, 19, [0.14, 0.13, 42])
    }
    // Short sections retain useful frustum bounds without introducing water seams.
    for (let distance = 1; distance < 40; distance += 6) {
      add('water', center, 0.04, distance, [0.92, 1, 6])
      add('rail', bank + side * 0.07, 0.52, distance, [1, 1, 6])
    }
    for (let distance = -2; distance <= 40; distance += 3) {
      add('rail-post', bank + side * 0.07, 0.29, distance, [1, 1, 1])
    }
    for (const distance of [2, 6, 10, 14, 18, 22, 26, 30, 34, 38]) {
      const outer = bank + side * 1.65
      add('plinth', outer, -0.1, distance, [1.18, 0.2, 1.65])
      add(
        distance % 8 === 2 ? 'foliage' : 'flowers',
        outer,
        0.01,
        distance,
        [0.9, 0.9, 0.9],
        side < 0 ? Math.PI : 0,
      )
      add(
        'ivy',
        outer + side * 0.55,
        0.18,
        distance,
        [0.7, 0.7, 0.7],
        side < 0 ? Math.PI / 2 : -Math.PI / 2,
      )
      if (distance % 8 === 2) {
        add(
          'column',
          bank + side * 1.25,
          0.11,
          distance + 1.5,
          [1.05, 1.05, 1.05],
        )
        add(
          'plinth',
          bank + side * 1.25,
          -0.035,
          distance + 1.5,
          [0.7, 0.29, 0.7],
        )
      }
    }
    for (const distance of [22]) {
      const outer = bank + side * 3.6
      add('plinth', outer, -0.12, distance, [3.7, 0.24, 3.7])
      add('canopy', outer, 0, distance, [1.3, 1.3, 1.3], side < 0 ? Math.PI : 0)
      add('plinth', outer + side * 1.8, -0.09, distance - 3.6, [4, 0.18, 4])
      add(
        'arcade',
        outer + side * 1.8,
        0,
        distance - 3.6,
        [1.15, 1.15, 1.15],
        side < 0 ? Math.PI / 2 : -Math.PI / 2,
      )
    }
  }
  return Object.freeze(placements)
}
