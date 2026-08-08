import { beforeEach, describe, expect, it } from 'vitest'
import { TAB_HOME, TAB_KARAOKE, TAB_SETTINGS } from '@/features/tabs/constants'
import { activeTab, hideLibrary, isLibraryModalOpen, setActiveTab, } from '@/stores/ui-store'
import { matchVoiceCommand } from './command-grammar'
import type { NavigationVoiceDeps } from './navigation-commands'
import { createNavigationVoiceCommands } from './navigation-commands'

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
})

describe('navigation voice commands', () => {
  it('switches tabs through setActiveTab', () => {
    fire('go to karaoke')
    expect(activeTab()).toBe(TAB_KARAOKE)
    fire('open settings')
    expect(activeTab()).toBe(TAB_SETTINGS)
    fire('switch to home')
    expect(activeTab()).toBe(TAB_HOME)
  })

  it('goes quiet while an immersive surface suspends shortcuts', () => {
    const commands = createNavigationVoiceCommands({ suspended: () => true })
    expect(matchVoiceCommand('go to karaoke', commands)).toBeNull()
  })

  it('opens and closes the library, reporting a library that is not open', () => {
    expect(fire('close the library')).toBe('Library is not open')
    expect(fire('open the library')).toBe('Library open')
    expect(isLibraryModalOpen()).toBe(true)
    expect(fire('close library')).toBe('Library closed')
    expect(isLibraryModalOpen()).toBe(false)
  })
})
