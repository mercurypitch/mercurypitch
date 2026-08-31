// ============================================================
// useShareHandlers — Share link dispatch & copy handlers
// ============================================================
//
// Encapsulates decoding and loading of shared melodies, exercises, routines,
// short URLs, and link creation / clipboard copy.
//

import type { Accessor } from 'solid-js'
import type { ExerciseType } from '@/features/exercises/types'
import type { RoutineTemplate } from '@/features/routines/types'
import { loadSharedRoutine } from '@/features/routines/use-daily-routine'
import { TAB_COMPOSE, TAB_EXERCISES } from '@/features/tabs/constants'
import { melodyTotalBeats } from '@/lib/scale-data'
import { copyShareUrl, decodeSharePayload, encodeMelodyForShare, fetchShortPayload, generateMelodyItemsFromCompact, } from '@/lib/share-codec'
import * as melodyStore from '@/stores/melody-store'
import { showNotification } from '@/stores/notifications-store'
import type { ActiveTab } from '@/types'

export interface UseShareHandlersDeps {
  bpm: Accessor<number>
  setBpm: (bpm: number) => void
  keyName: Accessor<string>
  setKeyName: (key: string) => void
  scaleType: Accessor<string>
  setScaleType: (scale: string) => void
  setActiveTab: (tab: ActiveTab) => void
  setSelectedExercise: (exercise: ExerciseType) => void
  setAutoStartExercise: (auto: boolean) => void
}

export interface UseShareHandlersReturn {
  handleShareMelody: (payload: string) => void
  handleShareExercise: (payload: string) => void
  handleShareRoutine: (payload: string) => void
  handleShareFallback: (shareType: string, shareId: string) => void
  handleShareShort: (shortId: string) => void
  handleCopyShareLink: () => void
}

export function useShareHandlers(
  deps: UseShareHandlersDeps,
): UseShareHandlersReturn {
  const handleShareMelody = (payload: string) => {
    const decoded = decodeSharePayload(payload)
    if (!decoded || decoded.t !== 'melody') return
    const data = decoded.d as unknown as Record<string, unknown>
    const name = typeof data.n === 'string' ? data.n : 'Shared Melody'
    const bpmVal = typeof data.b === 'number' ? data.b : 120
    const keyVal = typeof data.k === 'string' ? data.k : undefined
    const scaleVal = typeof data.s === 'string' ? data.s : undefined
    const items = Array.isArray(data.i)
      ? generateMelodyItemsFromCompact(
          data.i as Parameters<typeof generateMelodyItemsFromCompact>[0],
        )
      : []
    if (items.length === 0) {
      showNotification('Shared melody is empty or invalid', 'warning')
      return
    }
    melodyStore.loadImportedMelody(items, name, { bpm: bpmVal })
    melodyStore.setMelodyKind(data.dk === 1 ? 'drums' : 'melody')
    if (bpmVal > 0) deps.setBpm(bpmVal)
    if (keyVal != null && keyVal !== '') deps.setKeyName(keyVal)
    if (scaleVal != null && scaleVal !== '') deps.setScaleType(scaleVal)
    deps.setActiveTab(TAB_COMPOSE)
    showNotification(`Loaded shared melody: ${name}`, 'info')
  }

  const handleShareExercise = (payload: string) => {
    const decoded = decodeSharePayload(payload)
    if (!decoded || decoded.t !== 'exercise') return
    const data = decoded.d as unknown as Record<string, unknown>
    if (typeof data.e !== 'string') {
      showNotification('Shared exercise is invalid', 'warning')
      return
    }
    deps.setActiveTab(TAB_EXERCISES)
    deps.setSelectedExercise(data.e as ExerciseType)
    deps.setAutoStartExercise(true)
    showNotification(`Loaded shared exercise: ${decoded.n ?? data.e}`, 'info')
  }

  const handleShareRoutine = (payload: string) => {
    const decoded = decodeSharePayload(payload)
    if (!decoded || decoded.t !== 'routine') return
    const data = decoded.d as unknown as Record<string, unknown>
    const id = typeof data.id === 'string' ? data.id : ''
    const name = typeof data.n === 'string' ? data.n : 'Shared Routine'
    const description = typeof data.desc === 'string' ? data.desc : ''
    const segs = Array.isArray(data.seg) ? data.seg : []
    if (segs.length === 0) {
      showNotification('Shared routine has no segments', 'warning')
      return
    }
    const routine: RoutineTemplate = {
      id,
      name,
      description,
      segments: segs.map((s: unknown) => {
        const seg = s as Record<string, unknown>
        return {
          type: (typeof seg.k === 'string'
            ? seg.k
            : 'exercise') as RoutineTemplate['segments'][0]['type'],
          durationSec: typeof seg.d === 'number' ? seg.d : 60,
          config: (typeof seg.c === 'object' && seg.c !== null
            ? seg.c
            : {}) as RoutineTemplate['segments'][0]['config'],
        }
      }),
    }
    const hadProgress = loadSharedRoutine(routine)
    deps.setActiveTab(TAB_EXERCISES)
    deps.setAutoStartExercise(true)
    if (hadProgress) {
      showNotification(
        `Loaded shared routine. Your previous progress was replaced.`,
        'warning',
      )
    } else {
      showNotification(`Loaded shared routine: ${decoded.n ?? name}`, 'info')
    }
  }

  const handleShareFallback = (_shareType: string, _shareId: string) => {
    showNotification(
      'This shared link may have expired or was created in an older version.',
      'warning',
    )
  }

  const handleShareShort = (shortId: string) => {
    void (async () => {
      const raw = await fetchShortPayload(shortId)
      if (raw == null || raw === '') {
        showNotification(
          'This shared link has expired or is invalid.',
          'warning',
        )
        return
      }
      const decoded = decodeSharePayload(raw)
      if (!decoded) {
        showNotification(
          'Shared content is corrupted or in an older format.',
          'warning',
        )
        return
      }
      if (decoded.t === 'melody') {
        handleShareMelody(raw)
      } else if (decoded.t === 'exercise') {
        handleShareExercise(raw)
      } else if (decoded.t === 'routine') {
        handleShareRoutine(raw)
      }
    })()
  }

  const handleCopyShareLink = () => {
    const items = melodyStore.getCurrentItems()
    if (items.length === 0) {
      showNotification('No melody to share', 'warning')
      return
    }
    const encoded = encodeMelodyForShare(
      items,
      deps.bpm(),
      deps.keyName(),
      deps.scaleType(),
      melodyTotalBeats(items),
      melodyStore.getCurrentMelody()?.name,
      melodyStore.getCurrentKind(),
    )
    void copyShareUrl(encoded).then((ok) => {
      if (ok) showNotification('Share link copied!', 'info')
      else showNotification('Failed to copy link', 'error')
    })
  }

  return {
    handleShareMelody,
    handleShareExercise,
    handleShareRoutine,
    handleShareFallback,
    handleShareShort,
    handleCopyShareLink,
  }
}
