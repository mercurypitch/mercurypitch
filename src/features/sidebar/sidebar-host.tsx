// ── Sidebar host context ─────────────────────────────────────────────
// The few things a sidebar panel genuinely needs from App and cannot
// read from a store: octave transposition, the scale-builder modal, mic
// auto-calibration, and the live note-list feed. Everything else a panel
// wants it reads from stores directly — that is the registry's rule, and
// this context is deliberately small so it stays that way.

import type { Component, JSX } from 'solid-js'
import { createContext, useContext } from 'solid-js'
import type { MelodyItem, NoteResult } from '@/types'

export interface SidebarHost {
  onOctaveShift: (delta: number) => void
  onOpenScaleBuilder: () => void
  onAutoCalibrate?: () => void | Promise<void>
  /** Live feed for the Singing note list. */
  noteList: {
    melody: () => MelodyItem[]
    currentNoteIndex: () => number
    noteResults: () => NoteResult[]
    isPlaying: () => boolean
  }
}

const SidebarHostContext = createContext<SidebarHost>()

export const SidebarHostProvider: Component<{
  host: SidebarHost
  children: JSX.Element
}> = (props) => (
  // The host is deliberately a stable, non-reactive bundle: every member
  // is itself an accessor or a stable App callback, so panels read live
  // values through it without the object identity ever needing to change.
  // eslint-disable-next-line solid/reactivity
  <SidebarHostContext.Provider value={props.host}>
    {props.children}
  </SidebarHostContext.Provider>
)

export function useSidebarHost(): SidebarHost {
  const host = useContext(SidebarHostContext)
  if (host === undefined) {
    throw new Error('useSidebarHost: panels only render inside AppSidebar')
  }
  return host
}
