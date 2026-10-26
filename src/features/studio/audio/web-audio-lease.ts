// Studio web lease — preload the shared engine object, then activate its context inside the gesture.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { AudioEngine } from '@/lib/audio-engine'
import { activateAudioPlayback } from '@/lib/audio-unlock'

type StudioAudioEngine = Pick<
  AudioEngine,
  'init' | 'resume' | 'getAudioContext'
>

export function createStudioWebLease(
  loading: Promise<StudioAudioEngine>,
  ready: (ready: boolean) => void,
  activate: (
    engine: StudioAudioEngine,
  ) => Promise<void> = activateAudioPlayback,
): AudioContextLease {
  let engine: StudioAudioEngine | null = null
  void loading.then(
    (value) => {
      engine = value
      ready(true)
    },
    () => ready(false),
  )
  return {
    ensure: () => engine?.getAudioContext() ?? null,
    unlock() {
      // Do not await the engine here. A real user event follows the preload
      // microtask; an earlier synthetic call must ask for a fresh gesture.
      if (!engine) return Promise.resolve(false)
      const activation = activate(engine)
      return activation.then(
        () => engine?.getAudioContext()?.state === 'running',
      )
    },
  }
}
