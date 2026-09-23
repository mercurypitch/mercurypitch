// Browser host — storage, microphone and audio adapters for either product shell.
import type { GlassGameHost } from '../host'
import { createBrowserGlassSound } from './glass-sound'
import { createBrowserMelodyReference } from './melody-reference'
import { createBrowserMemoryPlayback } from './memory-playback'
import { createBrowserMercNarration } from './merc-narration'
import { createBrowserMuseumAudio } from './museum-audio'
import { createBrowserMemoryStore } from './musical-memory-store'
import { createBrowserVoice } from './voice-session'

export interface BrowserHostOptions {
  assetUrl(id: string): string
  storagePrefix: string
  onExit(): void
  subscribeForeground?: GlassGameHost['subscribeForeground']
}
export function createBrowserGlassHost(
  options: BrowserHostOptions,
): GlassGameHost {
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
  }
  return {
    assetUrl: options.assetUrl,
    createVoice: createBrowserVoice,
    createSound: createBrowserGlassSound,
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
