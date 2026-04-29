import { createSignal } from 'solid-js'

export const [isRecording, setIsRecording] = createSignal<boolean>(false)
export const [silenceFrames, setSilenceFrames] = createSignal<number>(0)
export const [currentNoteMidi, setCurrentNoteMidi] = createSignal<number>(-1)
export const [currentNoteStartBeat, setCurrentNoteStartBeat] = createSignal<number>(-1)

export function resetRecordingState() {
  setIsRecording(false)
  setSilenceFrames(0)
  setCurrentNoteMidi(-1)
  setCurrentNoteStartBeat(-1)
}

// In a full implementation, `finalizeRecording` logic from App.tsx 
// would be moved here, interacting with melodyStore to save the recorded melody.
