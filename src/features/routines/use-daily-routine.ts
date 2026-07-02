import { createMemo, createSignal } from 'solid-js'
import { dailyRoutines, getRoutineById } from '@/data/routine-templates'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_WARMUP } from '@/features/exercises/types'
import { generateWeaknessReport } from '@/features/practice-intelligence/weakness-analyzer'
import { createPersistedSignal } from '@/lib/storage'
import type { RoutineSegment, RoutineTemplate } from './types'

const STORAGE_KEY = 'mp_daily_routine'
const PREFS_KEY = 'mp_daily_routine_prefs'
const RECENT_KEY = 'mp_daily_routine_recent'

interface PersistedRoutine {
  templateId: string
  date: string
  completedSegments: number[]
  /**
   * The resolved routine, stored whole: generated routines can be
   * length-scaled (and shared routines aren't in the registry at all), so
   * the id alone can't reproduce them across reloads.
   */
  template?: RoutineTemplate
}

export type RoutineLength = 'short' | 'standard' | 'long'
export type RoutineFocus = 'auto' | 'surprise' | string // or a template id

export interface RoutinePrefs {
  length: RoutineLength
  focus: RoutineFocus
}

export const [routinePrefs, setRoutinePrefs] =
  createPersistedSignal<RoutinePrefs>(PREFS_KEY, {
    length: 'standard',
    focus: 'auto',
  })

/** Recently generated template ids (most recent first) — rotation memory. */
const [recentTemplateIds, setRecentTemplateIds] = createPersistedSignal<
  string[]
>(RECENT_KEY, [])

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Shared persisted signal so auto-advance can update it from outside the hook
const [routineData, setRoutineData] =
  createPersistedSignal<PersistedRoutine | null>(STORAGE_KEY, null)

/** The template a persisted routine refers to (stored copy wins). */
function resolveTemplate(p: PersistedRoutine): RoutineTemplate | null {
  return p.template ?? getRoutineById(p.templateId) ?? null
}

/**
 * Pick today's base template from the user's focus preference.
 *
 * 'auto' targets the weakest area from practice history (weak exercise →
 * the template drilling it; weak intervals → interval work; weak pitches →
 * range work) and falls back to rotating through templates the user hasn't
 * seen recently. 'surprise' is the rotation alone. Anything else is a
 * template id.
 */
function pickTemplate(focus: RoutineFocus): RoutineTemplate {
  if (focus !== 'auto' && focus !== 'surprise') {
    const specific = getRoutineById(focus)
    if (specific) return specific
  }

  if (focus === 'auto') {
    const report = generateWeaknessReport()
    const weakType = report.weakExercises[0]?.type
    if (weakType !== undefined) {
      const drilling = dailyRoutines.find((r) =>
        r.segments.some(
          (s) => s.type === 'exercise' && s.config.exercise === weakType,
        ),
      )
      if (drilling) return drilling
    }
    if (report.weakIntervals.length > 0) {
      const t = getRoutineById('interval-focus')
      if (t) return t
    }
    if (report.weakPitches.length > 0) {
      const t = getRoutineById('range-focus')
      if (t) return t
    }
  }

  // Rotation: prefer templates not generated recently.
  const recent = recentTemplateIds()
  const fresh = dailyRoutines.filter((r) => !recent.includes(r.id))
  const pool = fresh.length > 0 ? fresh : dailyRoutines
  return pool[Math.floor(Math.random() * pool.length)]
}

const LENGTH_FACTOR: Record<RoutineLength, number> = {
  short: 0.6,
  standard: 1,
  long: 1.4,
}

/** Scale a template to the preferred session length. */
function applyLength(
  template: RoutineTemplate,
  length: RoutineLength,
): RoutineTemplate {
  if (length === 'standard') return template
  const factor = LENGTH_FACTOR[length]
  const segments = template.segments
    // A short session keeps the core work and drops the challenge detour.
    .filter((s) => length !== 'short' || s.type !== 'challenge-prep')
    .map((s) => ({
      ...s,
      durationSec: Math.max(30, Math.round((s.durationSec * factor) / 15) * 15),
    }))
  return { ...template, segments }
}

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
    template: routine,
  })
  return hadProgress
}

/**
 * Auto-advance the daily routine if the completed exercise matches the
 * current segment. Call this after recording an exercise result.
 */
export function autoAdvanceRoutineSegment(
  exerciseType: ExerciseType,
  metrics?: Record<string, number>,
): void {
  const data = routineData()
  if (!data || data.date !== todayStr()) return

  const template = resolveTemplate(data)
  if (!template) return

  const currentIdx = data.completedSegments.length
  if (currentIdx >= template.segments.length) return

  const currentSeg = template.segments[currentIdx]!

  // Auto-advance when the completed exercise matches the current segment:
  // exercise segments match by type; warmup/cooldown segments complete when
  // the guided warmup exercise finishes (it runs those segments' patterns).
  // The warmup must have run ALL its steps — ending it after two seconds
  // (stop always records a partial result) shouldn't tick the segment off.
  const fullWarmupRun =
    exerciseType === EXERCISE_WARMUP &&
    (metrics?.stepsCompleted ?? 0) >= (metrics?.totalSteps ?? Infinity)
  const matches =
    (currentSeg.type === 'exercise' &&
      currentSeg.config.exercise === exerciseType) ||
    ((currentSeg.type === 'warmup' || currentSeg.type === 'cooldown') &&
      fullWarmupRun)
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
        resolveTemplate(p) ??
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
    const prefs = routinePrefs()
    const base = pickTemplate(prefs.focus)
    const routine = applyLength(base, prefs.length)
    setRecentTemplateIds((prev) =>
      [base.id, ...prev.filter((id) => id !== base.id)].slice(0, 4),
    )
    setPersisted({
      templateId: routine.id,
      date: todayStr(),
      completedSegments: [],
      template: routine,
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
