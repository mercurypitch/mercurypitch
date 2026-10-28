// ============================================================
// What the room tells the console parts it draws for the drills: where
// the question is, how it was judged, and where a drill's own choice of
// answering (tap or sing) goes now that it lives under "?".
// ============================================================

import { createContext, useContext } from 'solid-js'
import type { ModeToggleProps } from '@/features/ear-lab/EarStage'
import type { RoomBeat } from '@/features/ear-lab/stage-room'

export interface RoomState {
  beat: () => RoomBeat
  /** The verdict while it is on the stage. */
  verdict: () => 'right' | 'wrong' | null
  sounding: () => boolean
  /** The run is on: the pinned row is the lamp and Next. */
  running: () => boolean
  /** The sealed protocol's own room (Calibration from the bench). */
  ritual: () => boolean
  /** A calibration asked for from a lead pad: "before you start" first. */
  askCalibration: (begin: () => void) => void
  /** A drill's tap-or-sing choice, shown under "?" instead of the console. */
  offerAnswerMode: (toggle: ModeToggleProps<string>) => void
  /** A tap on a rhythm drill's pad. */
  tapped: () => void
}

const fallback: RoomState = {
  beat: () => 'idle',
  verdict: () => null,
  sounding: () => false,
  running: () => false,
  ritual: () => false,
  askCalibration: (begin) => begin(),
  offerAnswerMode: () => undefined,
  tapped: () => undefined,
}

export const RoomContext = createContext<RoomState>(fallback)

export function useRoom(): RoomState {
  return useContext(RoomContext)
}

/** A pad's name as it is said: "Minor second", "flat 3, Me". */
export function spokenLabel(label: string, sub?: string): string {
  const spell = (text: string): string =>
    text
      .replace(/\b2nd\b/gu, 'second')
      .replace(/\b3rd\b/gu, 'third')
      .replace(/\b4th\b/gu, 'fourth')
      .replace(/\b5th\b/gu, 'fifth')
      .replace(/\b6th\b/gu, 'sixth')
      .replace(/\b7th\b/gu, 'seventh')
      .replace(/♭/gu, 'flat ')
      .replace(/♯/gu, 'sharp ')
      .trim()
  if (sub === undefined || sub === '') return spell(label)
  // A short mark over its name in words ("m2" over "Minor 2nd", "7"
  // over "Dominant 7th") is said by the name alone.
  if (sub.length > label.length + 2 && /[a-z]{4,}/iu.test(sub)) {
    return spell(sub)
  }
  return `${spell(label)}, ${spell(sub)}`
}
