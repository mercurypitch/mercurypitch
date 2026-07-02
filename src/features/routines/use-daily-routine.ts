import { createMemo, createSignal } from 'solid-js'
import { dailyRoutines, getRandomRoutine } from '@/data/routine-templates'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_WARMUP } from '@/features/exercises/types'
import { createPersistedSignal } from '@/lib/storage'
import type { RoutineSegment, RoutineTemplate } from './types'

const STORAGE_KEY = 'mp_daily_routine'

interface PersistedRoutine {
  templateId: string
  date: string
  completedSegments: number[]
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Shared persisted signal so auto-advance can update it from outside the hook
const [routineData, setRoutineData] =
  createPersistedSignal<PersistedRoutine | null>(STORAGE_KEY, null)

// Shared routine loaded from URL (may not be in dailyRoutines registry)
const [_sharedRoutine, _setSharedRoutine] =
  createSignal<RoutineTemplate | null>(null)
export const sharedRoutine = _sharedRoutine

/** Loads a shared routine, overwriting any current routine.
 *  Returns true if an in-progress routine was overwritten. */
export function loadSharedRoutine(routine: RoutineTemplate): boolean {
  const previous = routineData()
  const hadProgress =
    previous != null &&
    previous.date === todayStr() &&
    previous.completedSegments.length > 0
  _setSharedRoutine(routine)
  setRoutineData({
    templateId: routine.id,
    date: todayStr(),
    completedSegments: [],
  })
  return hadProgress
}

/**
 * Auto-advance the daily routine if the completed exercise matches the
 * current segment. Call this after recording an exercise result.
 */
export function autoAdvanceRoutineSegment(exerciseType: ExerciseType): void {
  const data = routineData()
  if (!data || data.date !== todayStr()) return

  const template = dailyRoutines.find((r) => r.id === data.templateId)
  if (!template) return

  const currentIdx = data.completedSegments.length
  if (currentIdx >= template.segments.length) return

  const currentSeg = template.segments[currentIdx]!

  // Auto-advance when the completed exercise matches the current segment:
  // exercise segments match by type; warmup/cooldown segments complete when
  // the guided warmup exercise finishes (it runs those segments' patterns).
  const matches =
    (currentSeg.type === 'exercise' &&
      currentSeg.config.exercise === exerciseType) ||
    ((currentSeg.type === 'warmup' || currentSeg.type === 'cooldown') &&
      exerciseType === EXERCISE_WARMUP)
  if (matches) {
    setRoutineData({
      ...data,
      completedSegments: [...data.completedSegments, currentIdx],
    })
  }
}

export function useDailyRoutine() {
  const [persisted, setPersisted] = [routineData, setRoutineData] as const

  const isToday = () => persisted()?.date === todayStr()

  const template = createMemo<RoutineTemplate | null>(() => {
    const p = persisted()
    if (p && p.date === todayStr()) {
      return (
        dailyRoutines.find((r) => r.id === p.templateId) ??
        (_sharedRoutine()?.id === p.templateId ? _sharedRoutine() : null)
      )
    }
    return null
  })

  const currentSegmentIndex = createMemo(
    () => persisted()?.completedSegments.length ?? 0,
  )
  const completedSegments = createMemo(
    () => persisted()?.completedSegments ?? [],
  )
  const isComplete = createMemo(() => {
    const t = template()
    if (!t) return false
    return (persisted()?.completedSegments.length ?? 0) >= t.segments.length
  })

  const currentSegment = createMemo<RoutineSegment | null>(() => {
    const t = template()
    if (!t) return null
    const idx = currentSegmentIndex()
    return t.segments[idx] ?? null
  })

  const progress = createMemo(() => {
    const t = template()
    if (!t) return 0
    return Math.round((completedSegments().length / t.segments.length) * 100)
  })

  function generate(): RoutineTemplate {
    const routine = getRandomRoutine()
    setPersisted({
      templateId: routine.id,
      date: todayStr(),
      completedSegments: [],
    })
    return routine
  }

  function startOrResume(): RoutineTemplate {
    if (isToday() && template()) {
      return template()!
    }
    return generate()
  }

  function completeSegment(): void {
    const p = persisted()
    const t = template()
    if (!p || !t) return
    const currentIdx = p.completedSegments.length
    if (currentIdx >= t.segments.length) return

    setPersisted({
      ...p,
      completedSegments: [...p.completedSegments, currentIdx],
    })
  }

  function reset(): void {
    setPersisted(null)
  }

  const totalDurationSec = createMemo(() => {
    const t = template()
    if (!t) return 0
    return t.segments.reduce((sum, s) => sum + s.durationSec, 0)
  })

  const remainingDurationSec = createMemo(() => {
    const t = template()
    if (!t) return 0
    return t.segments
      .filter((_, i) => !completedSegments().includes(i))
      .reduce((sum, s) => sum + s.durationSec, 0)
  })

  const segmentStatuses = createMemo(() => {
    const t = template()
    if (!t) return []
    const comp = completedSegments()
    const curr = currentSegmentIndex()
    return t.segments.map((seg, i) => ({
      seg,
      done: comp.includes(i),
      current: i === curr,
    }))
  })

  return {
    template,
    currentSegment,
    currentSegmentIndex,
    completedSegments,
    isComplete,
    progress,
    totalDurationSec,
    remainingDurationSec,
    segmentStatuses,
    generate,
    startOrResume,
    completeSegment,
    reset,
  }
}
