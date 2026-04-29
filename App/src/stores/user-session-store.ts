import { createSignal } from 'solid-js'
import type { Session } from '@/types'
import { melodyStore } from './melody-store'

export const [userSession, setUserSession] = createSignal<Session | null>(null)
export const [selectedMelodyIds, setSelectedMelodyIds] = createSignal<string[]>([])

export function setActiveUserSession(session: Session | null): void {
  setUserSession(session)
  setSelectedMelodyIds([])
  melodyStore.setActiveSessionId(session?.id ?? null)
}

export function getUserSession(): Session | null {
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

export function loadSession(session: Session) {
  setActiveUserSession(session)
}
