// Browser host — storage, microphone and audio adapters for either product shell.
import { micManager } from '@irchiinnuss/pitch-engine'
import { exhibitShatterProfile } from '../content/shatter-sounds'
import type { GlassGameHost } from '../host'
import { createBrowserGlassSound } from './glass-sound'
import { createBrowserMelodyReference } from './melody-reference'
import { createBrowserMemoryPlayback } from './memory-playback'
import { createBrowserMercNarration } from './merc-narration'
import { createBrowserMicrophoneInput } from './microphone-input'
import { createBrowserMuseumAudio } from './museum-audio'
import { createBrowserMemoryStore } from './musical-memory-store'
import { createShatterBufferCache } from './shatter-buffer-cache'
import { createBrowserVoice, prepareBrowserVoiceGesture } from './voice-session'

export interface BrowserHostOptions {
  assetUrl(id: string): string
  storagePrefix: string
  /** Reuse a product's existing input preference when opening Glassworks directly. */
  microphonePreferenceKey?: string
  onExit(): void
  subscribeForeground?: GlassGameHost['subscribeForeground']
}
export function createBrowserGlassHost(
  options: BrowserHostOptions,
): GlassGameHost {
  const shatterCache = createShatterBufferCache()
  const microphone = createBrowserMicrophoneInput(
    options.microphonePreferenceKey ??
      `${options.storagePrefix}:microphone-device`,
  )
  const read = (key: string): string | null => {
    try {
      return localStorage.getItem(`${options.storagePrefix}:${key}`)
    } catch {
      return null
    }
  }
  const write = (key: string, value: string): void => {
    try {
      localStorage.setItem(`${options.storagePrefix}:${key}`, value)
    } catch {
      /* Current visit still works without persistent storage. */
    }
    if (key === 'museum-audio:v1')
      for (const update of shatterCache.volumeChanges) update()
  }
  return {
    assetUrl: options.assetUrl,
    prepareVoiceGesture: prepareBrowserVoiceGesture,
    createVoice: () => createBrowserVoice(microphone.forStart()),
    microphoneInput: microphone.input,
    takeOverMicrophone: () => micManager.takeOverFromOtherTab(),
    releaseUnusedMicrophoneTakeover: () => micManager.releaseTakeoverIfUnused(),
    createSound: (target) =>
      createBrowserGlassSound({
        assetUrl: options.assetUrl,
        cache: shatterCache,
        profile: exhibitShatterProfile(target),
        identity: target?.id,
        volume: () => {
          try {
            const value = JSON.parse(read('museum-audio:v1') ?? 'null')
            if (value?.muted === true) return 0
            return Number.isFinite(value?.ambienceVolume)
              ? Math.max(0, Math.min(1, value.ambienceVolume))
              : 0.65
          } catch {
            return 0.65
          }
        },
      }),
    createMelodyReference: createBrowserMelodyReference,
    memories: createBrowserMemoryStore(options.storagePrefix),
    createMemoryPlayback: createBrowserMemoryPlayback,
    createMusic: () =>
      createBrowserMuseumAudio({
        assetUrl: options.assetUrl,
        readPreference: read,
        writePreference: write,
      }),
    createNarration: () =>
      createBrowserMercNarration({
        assetUrl: options.assetUrl,
        readPreference: read,
        writePreference: write,
      }),
    loadProgress(levelId) {
      try {
        return JSON.parse(read(`progress:${levelId}`) ?? 'null') as unknown
      } catch {
        return null
      }
    },
    saveProgress(progress) {
      write(`progress:${progress.levelId}`, JSON.stringify(progress))
    },
    readPreference: read,
    writePreference: write,
    subscribeForeground:
      options.subscribeForeground ??
      ((listener) => {
        const changed = (): void =>
          listener(document.visibilityState !== 'hidden')
        const hide = (): void => listener(false)
        document.addEventListener('visibilitychange', changed)
        window.addEventListener('pagehide', hide)
        window.addEventListener('pageshow', changed)
        changed()
        return () => {
          document.removeEventListener('visibilitychange', changed)
          window.removeEventListener('pagehide', hide)
          window.removeEventListener('pageshow', changed)
        }
      }),
    onExit: options.onExit,
  }
}
