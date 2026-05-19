import { createMemo } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { dailyRoutines, getRandomRoutine } from '@/data/routine-templates'
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

export function useDailyRoutine() {
  const [persisted, setPersisted] = createPersistedSignal<PersistedRoutine | null>(
    STORAGE_KEY,
    null,
  )

  const today = todayStr()
  const isToday = () => persisted()?.date === today

  const template = createMemo<RoutineTemplate | null>(() => {
    const p = persisted()
    if (p && p.date === today) {
      return dailyRoutines.find((r) => r.id === p.templateId) ?? null
    }
    return null
  })

  const currentSegmentIndex = createMemo(() => persisted()?.completedSegments.length ?? 0)
  const completedSegments = createMemo(() => persisted()?.completedSegments ?? [])
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
      date: today,
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

  return {
    template,
    currentSegment,
    currentSegmentIndex,
    completedSegments,
    isComplete,
    progress,
    totalDurationSec,
    remainingDurationSec,
    generate,
    startOrResume,
    completeSegment,
    reset,
  }
}
