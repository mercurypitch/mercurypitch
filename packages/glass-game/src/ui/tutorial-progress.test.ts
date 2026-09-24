// Tutorial progress regressions — old hold introductions never suppress a new lesson.
import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { hasSeenTutorial, markTutorialSeen } from './tutorial-progress'

function fixture() {
  const data = new Map<string, string>()
  return {
    data,
    host: {
      readPreference: (key: string) => data.get(key) ?? null,
      writePreference: (key: string, value: string) => {
        data.set(key, value)
      },
    },
  }
}

function lesson(id: string, version = 1): LevelDefinition {
  return {
    ...GLASSWORKS,
    id,
    guidance: {
      ...GLASSWORKS.guidance,
      tutorial: {
        id: 'comfortable-pair',
        version,
        pages: [
          {
            title: 'Your own range',
            body: 'Choose two comfortable notes.',
            aside: 'No stretching.',
          },
          {
            title: 'Listen, then answer',
            body: 'Sing them in order.',
            aside: 'Take your time.',
          },
        ],
      },
    },
  }
}

describe('gallery tutorial preferences', () => {
  it('preserves legacy hold dismissals while showing the new pair lesson', () => {
    const { data, host } = fixture()
    data.set('tutorial', 'seen')
    expect(hasSeenTutorial(host, GLASSWORKS)).toBe(true)
    expect(hasSeenTutorial(host, lesson('twins'))).toBe(false)
  })

  it('does not dismiss another gallery or a revised teaching sequence', () => {
    const { host } = fixture()
    markTutorialSeen(host, lesson('twins'))
    expect(hasSeenTutorial(host, lesson('twins'))).toBe(true)
    expect(hasSeenTutorial(host, lesson('next-gallery'))).toBe(false)
    expect(hasSeenTutorial(host, lesson('twins', 2))).toBe(false)
  })
})
