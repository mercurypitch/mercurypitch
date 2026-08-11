// Camera presets provide calm, host-selectable framing without changing renderer state.
// ============================================================

import type { CameraState } from './camera'

export type TabCameraPresetId =
  | 'flow'
  | 'player-neck'
  | 'full-neck'
  | 'phrase-focus'

export interface TabCameraPresetChoice {
  id: TabCameraPresetId
  label: string
  description: string
}

export const TAB_CAMERA_PRESET_CHOICES: readonly TabCameraPresetChoice[] = [
  {
    id: 'flow',
    label: 'Runway',
    description: 'A calm runway with the next phrase in view.',
  },
  {
    id: 'player-neck',
    label: 'Player angle',
    description: 'Closer to the strings and arrival line.',
  },
  {
    id: 'full-neck',
    label: 'Overview',
    description: 'A wider overview for position work.',
  },
  {
    id: 'phrase-focus',
    label: 'Phrase follow',
    description: 'Gently follows the next authored position.',
  },
]

interface TabCameraPresetContext {
  narrow: boolean
  /** A bounded world-space offset derived from the next authored event. */
  phraseFocusX?: number
}

const WIDE: Record<Exclude<TabCameraPresetId, 'phrase-focus'>, CameraState> = {
  flow: {
    yaw: 0,
    pitch: 0.55,
    radius: 21,
    target: [0, -2, -12],
  },
  'player-neck': {
    yaw: 0.12,
    pitch: 0.38,
    radius: 16.5,
    target: [0, -0.4, -7],
  },
  'full-neck': {
    yaw: 0,
    pitch: 0.92,
    radius: 29,
    target: [0, 0.7, -8],
  },
}

const NARROW: Record<
  Exclude<TabCameraPresetId, 'phrase-focus'>,
  CameraState
> = {
  flow: {
    yaw: 0,
    pitch: 0.75,
    radius: 32,
    target: [0, 2, -12],
  },
  'player-neck': {
    yaw: 0.08,
    pitch: 0.58,
    radius: 27,
    target: [0, 1.4, -8],
  },
  'full-neck': {
    yaw: 0,
    pitch: 1.06,
    radius: 38,
    target: [0, 3, -9],
  },
}

/** Resolve a fresh camera object so hosts may safely add responsive focus. */
export function tabCameraPreset(
  id: TabCameraPresetId,
  context: TabCameraPresetContext,
): CameraState {
  const collection = context.narrow ? NARROW : WIDE
  const base = id === 'phrase-focus' ? collection.flow : collection[id]
  const focusX =
    id === 'phrase-focus'
      ? Math.max(-2.6, Math.min(2.6, context.phraseFocusX ?? 0))
      : 0

  return {
    ...base,
    target: [focusX, base.target[1], base.target[2]],
  }
}
