import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_HOME, TAB_KARAOKE, TAB_SETTINGS } from '@/features/tabs/constants'
import { activeTab, hideLibrary, isLibraryModalOpen, setActiveTab, } from '@/stores/ui-store'
import { matchVoiceCommand } from './command-grammar'
import type { NavigationVoiceDeps } from './navigation-commands'
import { createNavigationVoiceCommands, createVoiceHelpCommands, } from './navigation-commands'

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

// Karaoke Night registers this set on its own: the tab-navigation set never
// loads on that page, and "what can I say" used to live inside it — so the
// overlay existed there with no way to ask for it.
describe('voice help, registered without the tab set', () => {
  function fireHelp(utterance: string, deps?: NavigationVoiceDeps) {
    const commands = createVoiceHelpCommands(deps)
    const match = matchVoiceCommand(utterance, commands)
    if (match === null) return undefined
    const result = match.command.run({ n: match.n })
    return typeof result === 'string' ? result : match.command.label
  }

  it('answers "what can i say" and opens the overlay', () => {
    let opened = 0
    expect(fireHelp('what can i say', { openVoiceHelp: () => opened++ })).toBe(
      'Voice commands',
    )
    expect(opened).toBe(1)
  })

  it('stays available on a surface with no tabs at all', () => {
    const [help] = createVoiceHelpCommands()
    expect(help.available?.()).toBe(true)
  })

  it('goes quiet while an immersive surface suspends navigation', () => {
    const [help] = createVoiceHelpCommands({ suspended: () => true })
    expect(help.available?.()).toBe(false)
  })
})
