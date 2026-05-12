import type { JSX } from 'solid-js'
import { createContext, useContext } from 'solid-js'

export interface PlaybackContextValue {
  playSessionSequence: (melodyIds: string[]) => void
  loadAndPlayMelodyForSession: (melodyId: string) => void
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null)

export function PlaybackProvider(props: {
  children: JSX.Element
  playSessionSequence: (melodyIds: string[]) => void
  loadAndPlayMelodyForSession: (melodyId: string) => void
}) {
  return (
    <PlaybackContext.Provider
      value={{
        playSessionSequence: () => props.playSessionSequence,
        loadAndPlayMelodyForSession: () => props.loadAndPlayMelodyForSession,
      }}
    >
      {props.children}
    </PlaybackContext.Provider>
  )
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}
