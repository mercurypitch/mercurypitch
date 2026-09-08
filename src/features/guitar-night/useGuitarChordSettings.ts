// Device-local chord preferences keep live preview opt-in and post-stop proposals independently controllable.
import { createPersistedSignal } from '@/lib/storage'

export function useGuitarChordSettings() {
  const [live, setLive] = createPersistedSignal(
    'guitar-live-chords-v1',
    false,
    { validator: (value): value is boolean => typeof value === 'boolean' },
  )
  const [afterStop, setAfterStop] = createPersistedSignal(
    'guitar-chords-after-stop-v1',
    true,
    { validator: (value): value is boolean => typeof value === 'boolean' },
  )
  return { live, setLive, afterStop, setAfterStop }
}

export type GuitarChordSettings = ReturnType<typeof useGuitarChordSettings>
