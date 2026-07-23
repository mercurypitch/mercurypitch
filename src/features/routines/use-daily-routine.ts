import { createMemo, createSignal } from 'solid-js'
import { pickApplyPhrase } from '@/data/apply-melodies'
import { dailyRoutines, getRoutineById } from '@/data/routine-templates'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CALL_RESPONSE, EXERCISE_DYNAMIC_SWELL, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_PITCH_PURSUIT, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_STACCATO, EXERCISE_WARMUP, } from '@/features/exercises/types'
import { activePathExercises, activePathWarmup, } from '@/features/path/path-progress'
import { generateWeaknessReport } from '@/features/practice-intelligence/weakness-analyzer'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { createPersistedSignal } from '@/lib/storage'
import { setActiveTab, startExercise } from '@/stores/ui-store'
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

/** 0-based day-of-year — the deterministic seed for today's generated session. */
export function dayOfYear(d = new Date()): number {
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 0)
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.floor((midnight - startOfYear) / 86_400_000)
}

// The daily session's rotating pieces (deterministic by day-of-year so
// "today" is stable across reloads and shared between the sidebar + Home).
const WARMUP_PATTERNS = [
  'ascending-scale',
  'lip-trill',
  'sirens',
  'five-tone-descending',
]
const GROW_POOL: ExerciseType[] = [
  EXERCISE_INTERVAL_TRAINER,
  EXERCISE_SCALE_RUNNER,
  EXERCISE_ARPEGGIO_JUMPER,
  EXERCISE_PITCH_PURSUIT,
  EXERCISE_STACCATO,
  EXERCISE_DYNAMIC_SWELL,
]
const DEFAULT_REVIEW_EXERCISE: ExerciseType = EXERCISE_LONG_NOTE

/** Guided-path theming: bias the session toward the active week. */
export interface SessionTheme {
  /** The week's bound exercises — the grow slot draws from these. */
  pool: ExerciseType[]
  /** Warm-up pattern override (null/undefined = default rotation). */
  warmupPattern?: string | null
}

/**
 * Build today's generated session: warm-up → review a weak spot → grow a
 * skill → apply on a real (public-domain) phrase. Pure and deterministic given
 * `dayIndex`; `weakType` steers the review slot when practice history has one;
 * `theme` (the guided path's active week) steers the grow slot + warm-up.
 */
export function buildDailySession(
  dayIndex: number,
  weakType?: ExerciseType,
  theme?: SessionTheme,
): RoutineTemplate {
  const warmup: RoutineSegment = {
    type: 'warmup',
    durationSec: 60,
    config: {
      pattern:
        theme?.warmupPattern ??
        WARMUP_PATTERNS[dayIndex % WARMUP_PATTERNS.length],
    },
  }

  const reviewType = weakType ?? DEFAULT_REVIEW_EXERCISE
  const review: RoutineSegment = {
    type: 'exercise',
    durationSec: 150,
    config: { exercise: reviewType },
  }

  // Grow a different skill than the one being reviewed — drawn from the
  // path's themed pool when a week is active, else the default rotation.
  const growPool =
    theme !== undefined && theme.pool.length > 0 ? theme.pool : GROW_POOL
  let growType = growPool[dayIndex % growPool.length]!
  if (growType === reviewType && growPool.length > 1) {
    growType = growPool[(dayIndex + 1) % growPool.length]!
  }
  const grow: RoutineSegment = {
    type: 'exercise',
    durationSec: 150,
    config: { exercise: growType },
  }

  const phrase = pickApplyPhrase(dayIndex)
  const applyExercise: ExerciseType =
    dayIndex % 2 === 0 ? EXERCISE_CALL_RESPONSE : EXERCISE_SIGHT_SINGING
  const apply: RoutineSegment = {
    type: 'exercise',
    durationSec: 120,
    config: { exercise: applyExercise, notes: phrase.notes },
  }

  return {
    id: 'daily-session',
    name: "Today's Session",
    description: `Warm up, sharpen a weak spot, grow a skill, then sing ${phrase.name}.`,
    segments: [warmup, review, grow, apply],
  }
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
 * Launch a routine segment the way the Home session card does: exercise
 * segments start their drill, warm-up/cool-down run the guided warmup with
 * the segment's pattern, and challenge-prep jumps to the Challenges tab.
 * Shared by the Home card and the guided path's week card.
 */
export function launchRoutineSegment(seg: RoutineSegment): void {
  if (seg.type === 'challenge-prep') {
    setActiveTab(TAB_CHALLENGES)
    return
  }
  if (seg.type === 'warmup' || seg.type === 'cooldown') {
    startExercise(EXERCISE_WARMUP, {
      pattern: seg.config.pattern ?? seg.config.mode,
    })
    return
  }
  if (seg.config.exercise) {
    startExercise(seg.config.exercise, { notes: seg.config.notes ?? [] })
  }
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
    // 'auto' (the default) builds today's generated 4-slot session; the
    // handcrafted templates stay reachable via 'surprise' or an explicit id.
    let base: RoutineTemplate
    if (prefs.focus === 'auto') {
      const report = generateWeaknessReport()
      // When The Ascent is running, today's session leans into the active
      // week's theme (grow pool + warm-up pattern).
      const pool = activePathExercises()
      const theme: SessionTheme | undefined =
        pool !== null ? { pool, warmupPattern: activePathWarmup() } : undefined
      base = buildDailySession(
        dayOfYear(),
        report.weakExercises[0]?.type,
        theme,
      )
    } else {
      base = pickTemplate(prefs.focus)
      setRecentTemplateIds((prev) =>
        [base.id, ...prev.filter((id) => id !== base.id)].slice(0, 4),
      )
    }
    const routine = applyLength(base, prefs.length)
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
