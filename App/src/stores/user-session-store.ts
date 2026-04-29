import { createSignal } from 'solid-js'
import type { PlaybackSession } from '@/types'
import { melodyStore } from './melody-store'

// FIXME: There is no UserSession type anymore, there is only one 'PlaybackSession', this code
// should be refactored/moved to session-store.ts, we can also rename that file (session-store.ts) as well to
// playback-session.ts; when refactored this file can be removed!
export const [userSession, setUserSession] =
  createSignal<PlaybackSession | null>(null)
export const [selectedMelodyIds, setSelectedMelodyIds] = createSignal<string[]>(
  [],
)

export function setActiveUserSession(session: PlaybackSession): void {
  setUserSession(session)
  setSelectedMelodyIds([])
  melodyStore.setActiveSessionId(session?.id ?? null)
}

export function getUserSession(): PlaybackSession | null {
  return userSession()
}

export function getSelectedMelodyIds(): string[] {
  return selectedMelodyIds()
}

export function toggleMelodySelection(melodyId: string): void {
  setSelectedMelodyIds((prev) =>
    prev.includes(melodyId)
      ? prev.filter((id) => id !== melodyId)
      : [...prev, melodyId],
  )
}

export function selectAllMelodies(): void {
  const session = userSession()
  if (session && session.items.length > 0) {
    const melodyIds = session.items
      .filter((item) => item.melodyId !== null && item.melodyId !== undefined)
      .map((item) => item.melodyId!)
    setSelectedMelodyIds(melodyIds)
  }
}

export function clearMelodySelection(): void {
  setSelectedMelodyIds([])
}

export function loadSession(session: PlaybackSession) {
  setActiveUserSession(session)
}
