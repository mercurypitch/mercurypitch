// ============================================================
// The tab a singer sings a song in
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PracticeScope, UiMode } from './constants'
import { isTabVisible, TAB_KARAOKE, TAB_SINGING } from './constants'
import { songTab } from './song-tab'

/** The scopes the Exercises tab is in, where the Warm-up ends. */
const SCOPES: readonly PracticeScope[] = ['all', 'singing']
const MODES: readonly UiMode[] = ['advanced', 'simple']

describe('where "Sing a song" goes', () => {
  it.each(SCOPES)('is Karaoke in the full app (%s)', (scope) => {
    expect(songTab(scope, 'advanced')).toBe(TAB_KARAOKE)
  })

  it.each(SCOPES)(
    'is the Singing tab in the simple UI, which shows no Karaoke (%s)',
    (scope) => {
      expect(isTabVisible(TAB_KARAOKE, scope, 'simple')).toBe(false)
      expect(songTab(scope, 'simple')).toBe(TAB_SINGING)
    },
  )

  it("is always a tab the singer's app shows", () => {
    const hidden = SCOPES.flatMap((scope) =>
      MODES.filter((mode) => !isTabVisible(songTab(scope, mode), scope, mode)),
    )

    expect(hidden).toEqual([])
  })
})
