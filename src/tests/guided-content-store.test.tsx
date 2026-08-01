import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getPublishedGuidedExercise: vi.fn(),
  listGuidedPathAssignments: vi.fn(),
  listPublishedGuidedExercises: vi.fn(),
}))
const ui = vi.hoisted(() => ({
  openSingingZen: vi.fn(),
  startExercise: vi.fn(),
}))
const progress = vi.hoisted(() => ({
  ringFill: vi.fn(() => 0),
  startAscent: vi.fn(),
}))

vi.mock('@/features/zen/guided-exercise-service', () => api)
vi.mock('@/stores/ui-store', () => ui)
vi.mock('@/features/path/path-progress', () => progress)
vi.mock('@/features/routines/use-daily-routine', () => ({
  launchRoutineSegment: vi.fn(),
  useDailyRoutine: () => ({
    startOrResume: vi.fn(),
    currentSegment: () => null,
    totalDurationSec: () => 480,
  }),
}))

import { ASCENT_ID, ASCENT_WEEKS, PATH_THEME_LABEL, } from '@/features/path/path-content'
import { PathWeekGuide } from '@/features/path/PathWeekGuide'
import { getZenExercise, restoreSeedZenExercises, zenExerciseCatalog, } from '@/features/zen/exercise-catalog'
import { ascentGuidedAssignments, ascentGuidedAssignmentsForWeek, guidedContentLoadState, refreshGuidedContent, resetGuidedContent, } from '@/features/zen/guided-content-store'
import type { GuidedPathAssignment } from '@/features/zen/guided-exercise-service'
import type { ZenExerciseDefinition } from '@/features/zen/types'

function assignment(
  overrides: Partial<GuidedPathAssignment> = {},
): GuidedPathAssignment {
  return {
    id: 'assignment-1',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:00:00.000Z',
    pathId: ASCENT_ID,
    weekNumber: 1,
    dayNumber: 0,
    slotNumber: 1,
    exerciseId: 'ng-five-tone',
    exerciseVersion: 1,
    ...overrides,
  }
}

function version(
  exerciseId: string,
  exerciseVersion: number,
  title: string,
): ZenExerciseDefinition {
  const seed = getZenExercise(exerciseId)
  if (seed === null) throw new Error(`Missing seed ${exerciseId}`)
  return { ...seed, version: exerciseVersion, title }
}

beforeEach(() => {
  vi.clearAllMocks()
  progress.ringFill.mockReturnValue(0)
  restoreSeedZenExercises()
  resetGuidedContent()
})

describe('published guided content runtime', () => {
  it('installs a current catalogue and publishes fully resolved pinned assignments in day and slot order', async () => {
    const currentNg = version('ng-five-tone', 4, 'Current NG')
    const pinnedNg = version('ng-five-tone', 2, 'Pinned NG')
    const pinnedScale = version(
      'major-scale-ascending',
      3,
      'Pinned Major Scale',
    )
    const assignments = [
      assignment({
        id: 'late-slot',
        dayNumber: 2,
        slotNumber: 2,
        exerciseVersion: 2,
      }),
      assignment({
        id: 'week-library',
        dayNumber: 0,
        slotNumber: 3,
        exerciseId: 'major-scale-ascending',
        exerciseVersion: 3,
      }),
      assignment({
        id: 'early-slot',
        dayNumber: 2,
        slotNumber: 1,
        exerciseVersion: 2,
      }),
    ]

    api.listPublishedGuidedExercises.mockResolvedValue([currentNg])
    api.listGuidedPathAssignments.mockResolvedValue({
      ok: true,
      data: assignments,
    })
    api.getPublishedGuidedExercise.mockImplementation(
      async (exerciseId: string, exerciseVersion: number) =>
        exerciseId === pinnedNg.id && exerciseVersion === pinnedNg.version
          ? pinnedNg
          : exerciseId === pinnedScale.id &&
              exerciseVersion === pinnedScale.version
            ? pinnedScale
            : null,
    )

    const result = await refreshGuidedContent()

    expect(result).toEqual({
      catalogueUpdated: true,
      assignmentsUpdated: true,
      complete: true,
    })
    expect(guidedContentLoadState()).toBe('ready')
    expect(getZenExercise('ng-five-tone')?.title).toBe('Current NG')
    expect(getZenExercise('ng-five-tone', 2)?.title).toBe('Pinned NG')
    expect(ascentGuidedAssignmentsForWeek(1).map((item) => item.id)).toEqual([
      'week-library',
      'early-slot',
      'late-slot',
    ])
    expect(api.getPublishedGuidedExercise).toHaveBeenCalledTimes(2)
  })

  it('keeps the bundled catalogue and static path fallback for empty publications', async () => {
    const seeds = zenExerciseCatalog()
    api.listPublishedGuidedExercises.mockResolvedValue([])
    api.listGuidedPathAssignments.mockResolvedValue({ ok: true, data: [] })

    const result = await refreshGuidedContent()

    expect(result.complete).toBe(true)
    expect(result.catalogueUpdated).toBe(true)
    expect(zenExerciseCatalog()).toEqual(seeds)
    expect(ascentGuidedAssignments()).toEqual([])
  })

  it('restores bundled seeds when a later complete refresh has no publications', async () => {
    const seeds = zenExerciseCatalog()
    const currentNg = version('ng-five-tone', 4, 'Current NG')
    api.listPublishedGuidedExercises.mockResolvedValueOnce([currentNg])
    api.listGuidedPathAssignments.mockResolvedValue({ ok: true, data: [] })

    await refreshGuidedContent()
    expect(getZenExercise('ng-five-tone')?.title).toBe('Current NG')

    api.listPublishedGuidedExercises.mockResolvedValueOnce([])
    const result = await refreshGuidedContent(true)

    expect(result).toEqual({
      catalogueUpdated: true,
      assignmentsUpdated: true,
      complete: true,
    })
    expect(getZenExercise('ng-five-tone')?.title).not.toBe('Current NG')
    expect(zenExerciseCatalog()).toEqual(seeds)
  })

  it('rejects malformed assignment ranges before fetching pinned content', async () => {
    const seeds = zenExerciseCatalog()
    api.listPublishedGuidedExercises.mockResolvedValue(null)
    api.listGuidedPathAssignments.mockResolvedValue({
      ok: true,
      data: [assignment({ weekNumber: 8 })],
    })

    const result = await refreshGuidedContent()

    expect(result.complete).toBe(false)
    expect(guidedContentLoadState()).toBe('fallback')
    expect(api.getPublishedGuidedExercise).not.toHaveBeenCalled()
    expect(zenExerciseCatalog()).toBe(seeds)
    expect(ascentGuidedAssignments()).toEqual([])
  })

  it('withholds the whole assignment set when one exact version cannot be resolved', async () => {
    const currentNg = version('ng-five-tone', 5, 'Current NG')
    const pinnedNg = version('ng-five-tone', 2, 'Pinned NG')
    const assignments = [
      assignment({ id: 'resolved', exerciseVersion: 2 }),
      assignment({
        id: 'missing',
        slotNumber: 2,
        exerciseId: 'major-scale-ascending',
        exerciseVersion: 7,
      }),
    ]

    api.listPublishedGuidedExercises.mockResolvedValue([currentNg])
    api.listGuidedPathAssignments.mockResolvedValue({
      ok: true,
      data: assignments,
    })
    api.getPublishedGuidedExercise.mockImplementation(
      async (exerciseId: string, exerciseVersion: number) =>
        exerciseId === pinnedNg.id && exerciseVersion === pinnedNg.version
          ? pinnedNg
          : null,
    )

    const result = await refreshGuidedContent()

    expect(result.catalogueUpdated).toBe(true)
    expect(result.assignmentsUpdated).toBe(false)
    expect(result.complete).toBe(false)
    expect(ascentGuidedAssignments()).toEqual([])
  })

  it('deduplicates concurrent and completed refresh calls until forced', async () => {
    api.listPublishedGuidedExercises.mockResolvedValue([])
    api.listGuidedPathAssignments.mockResolvedValue({ ok: true, data: [] })

    const first = refreshGuidedContent()
    const second = refreshGuidedContent()
    await Promise.all([first, second])
    await refreshGuidedContent()

    expect(api.listPublishedGuidedExercises).toHaveBeenCalledTimes(1)
    expect(api.listGuidedPathAssignments).toHaveBeenCalledTimes(1)

    await refreshGuidedContent(true)

    expect(api.listPublishedGuidedExercises).toHaveBeenCalledTimes(2)
    expect(api.listGuidedPathAssignments).toHaveBeenCalledTimes(2)
  })
})

describe('Ascent week Zen launches', () => {
  it('renders and launches the exact published exercise revision', async () => {
    const pinnedNg = version('ng-five-tone', 6, 'Published NG Lesson')
    api.listPublishedGuidedExercises.mockResolvedValue([])
    api.listGuidedPathAssignments.mockResolvedValue({
      ok: true,
      data: [assignment({ exerciseVersion: 6 })],
    })
    api.getPublishedGuidedExercise.mockResolvedValue(pinnedNg)
    await refreshGuidedContent()

    const week = ASCENT_WEEKS[0]!
    render(() => (
      <PathWeekGuide
        week={week}
        state="available"
        currentOrder={1}
        started={false}
        themeLabel={PATH_THEME_LABEL[week.theme]}
      />
    ))

    const launch = screen.getByRole('button', {
      name: 'Zen · Published NG Lesson',
    })
    fireEvent.click(launch)

    expect(ui.openSingingZen).toHaveBeenCalledWith({
      mode: 'exercise',
      exerciseId: 'ng-five-tone',
      exerciseVersion: 6,
      source: 'path',
    })
  })

  it('shows the week library and current practice day without future days', async () => {
    const library = version('ng-five-tone', 6, 'Week Library Lesson')
    const dayOne = version('ng-five-tone', 7, 'Day One Lesson')
    const dayTwo = version('ng-five-tone', 8, 'Day Two Lesson')
    api.listPublishedGuidedExercises.mockResolvedValue([])
    api.listGuidedPathAssignments.mockResolvedValue({
      ok: true,
      data: [
        assignment({ id: 'library', dayNumber: 0, exerciseVersion: 6 }),
        assignment({ id: 'day-one', dayNumber: 1, exerciseVersion: 7 }),
        assignment({ id: 'day-two', dayNumber: 2, exerciseVersion: 8 }),
      ],
    })
    api.getPublishedGuidedExercise.mockImplementation(
      async (_exerciseId: string, exerciseVersion: number) =>
        [library, dayOne, dayTwo].find(
          (candidate) => candidate.version === exerciseVersion,
        ) ?? null,
    )
    await refreshGuidedContent()

    const week = ASCENT_WEEKS[0]!
    const renderWeek = () => (
      <PathWeekGuide
        week={week}
        state="active"
        currentOrder={1}
        started={true}
        themeLabel={PATH_THEME_LABEL[week.theme]}
      />
    )
    render(renderWeek)

    expect(
      screen.getByRole('button', { name: 'Zen · Week Library Lesson' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Zen · Day One Lesson' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Zen · Day Two Lesson' }),
    ).not.toBeInTheDocument()

    cleanup()
    progress.ringFill.mockReturnValue(1)
    render(renderWeek)

    expect(
      screen.queryByRole('button', { name: 'Zen · Day One Lesson' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Zen · Day Two Lesson' }),
    ).toBeInTheDocument()
  })
})
