// ============================================================
// Studio live mix — what a moving fader, pan knob or dial sounds like before it saves
// ============================================================
//
// A control that is still moving has not saved anything yet: its value lives
// here until the gesture ends and the control sends its one undoable command.
// Every view of the same lane (the lane header, the desk strip, the phone
// sheet) and of the same macro (the Sound panel slider, the desk dial) reads
// it, so they agree while the hand is still on the control, and the
// workspace hands each value to the transport, which plays it at once.
//
// A control used outside the workspace, as in a unit test, gets a private
// live mix that only it reads.
import { createContext, createSignal, useContext } from 'solid-js'
import type { StudioLaneDraft } from '@/lib/studio/playback/transport'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'

export interface StudioLiveMix {
  /** A lane's moving volume or pan, or undefined when nothing on it moves. */
  lane(trackId: string): StudioLaneDraft | undefined
  /** Null ends the lane's preview; send it after the gesture's own command. */
  setLane(trackId: string, draft: StudioLaneDraft | null): void
  /** A macro's moving value, or undefined when it is not being turned. */
  macro(name: MacroKey): number | undefined
  setMacro(name: MacroKey, value: number | null): void
}

/** Where moving values are heard: the Studio transport. */
export interface StudioLiveMixListener {
  previewLane(trackId: string, draft: StudioLaneDraft | null): void
  previewMacro(name: MacroKey, value: number | null): void
}

export function createStudioLiveMix(
  listener?: StudioLiveMixListener,
): StudioLiveMix {
  const [lanes, setLanes] = createSignal<ReadonlyMap<string, StudioLaneDraft>>(
    new Map(),
  )
  const [macros, setMacros] = createSignal<ReadonlyMap<MacroKey, number>>(
    new Map(),
  )
  return {
    lane: (trackId) => lanes().get(trackId),
    setLane(trackId, draft) {
      const next = new Map(lanes())
      if (draft === null) next.delete(trackId)
      else next.set(trackId, draft)
      setLanes(next)
      listener?.previewLane(trackId, draft)
    },
    macro: (name) => macros().get(name),
    setMacro(name, value) {
      const next = new Map(macros())
      if (value === null) next.delete(name)
      else next.set(name, value)
      setMacros(next)
      listener?.previewMacro(name, value)
    },
  }
}

export const StudioLiveMixContext = createContext<StudioLiveMix>()

/** The workspace's live mix, or a private one for a control on its own. */
export function useStudioLiveMix(): StudioLiveMix {
  return useContext(StudioLiveMixContext) ?? createStudioLiveMix()
}
