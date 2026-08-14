import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_HOME, TAB_KARAOKE, TAB_SETTINGS } from '@/features/tabs/constants'
import { activeTab, hideLibrary, isLibraryModalOpen, setActiveTab, } from '@/stores/ui-store'
import { matchVoiceCommand } from './command-grammar'
import type { NavigationVoiceDeps } from './navigation-commands'
import { createNavigationVoiceCommands } from './navigation-commands'

// The real uvr-store drags the whole separation stack into the test
// environment; the navigation commands only need the session list.
const uvrMock = vi.hoisted(() => ({
  sessions: [] as Array<{
    sessionId: string
    status: string
    originalFile?: { name: string; size: number; mimeType: string }
  }>,
}))
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => uvrMock.sessions,
}))

function fire(
  utterance: string,
  deps?: NavigationVoiceDeps,
): string | undefined {
  const commands = createNavigationVoiceCommands(deps)
  const match = matchVoiceCommand(utterance, commands)
  if (match === null) return undefined
  const result = match.command.run({ n: match.n })
  if (typeof result === 'string') return result
  if (typeof result === 'object') return result.message
  return match.command.label
}

beforeEach(() => {
  setActiveTab(TAB_HOME)
  hideLibrary()
  uvrMock.sessions = []
  window.location.hash = ''
})

describe('navigation voice commands', () => {
  it('switches tabs through setActiveTab', () => {
    fire('go to karaoke')
    expect(activeTab()).toBe(TAB_KARAOKE)
    fire('open settings')
    expect(activeTab()).toBe(TAB_SETTINGS)
    fire('switch to home')
    expect(activeTab()).toBe(TAB_HOME)
    fire('go to karaoke')
    fire('go home')
    expect(activeTab()).toBe(TAB_HOME)
  })

  it('goes quiet while an immersive surface suspends shortcuts', () => {
    const commands = createNavigationVoiceCommands({ suspended: () => true })
    expect(matchVoiceCommand('go to karaoke', commands)).toBeNull()
  })

  it('plays a random song straight from the song library, no playlist needed', () => {
    uvrMock.sessions = [
      {
        sessionId: 'abc',
        status: 'completed',
        originalFile: { name: 'MySong.mp3', size: 1, mimeType: 'audio/mpeg' },
      },
      { sessionId: 'not-ready', status: 'processing' },
    ]
    expect(fire('play a random song')).toBe('Random song: MySong')
    expect(activeTab()).toBe(TAB_KARAOKE)
    expect(window.location.hash).toContain('abc')
    expect(window.location.hash).toContain('mixer')
  })

  it('reports an empty song library', () => {
    expect(fire('play random song')).toBe('No songs in your library yet')
  })

  it('opens and closes the library, reporting a library that is not open', () => {
    expect(fire('close the library')).toBe('Library is not open')
    expect(fire('open the library')).toBe('Library open')
    expect(isLibraryModalOpen()).toBe(true)
    expect(fire('close library')).toBe('Library closed')
    expect(isLibraryModalOpen()).toBe(false)
  })
})
