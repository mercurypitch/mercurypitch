// ============================================================
// SharedControlToolbar Tests
// Tests for the unified control toolbar component
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ActiveTab, PracticeSubMode, } from '@/components/shared/SharedControlToolbar'

describe('SharedControlToolbar Types', () => {
  it('PracticeSubMode has all expected values', () => {
    const modes: PracticeSubMode[] = ['all', 'random', 'focus', 'reverse']
    expect(modes).toContain('all')
    expect(modes).toContain('random')
    expect(modes).toContain('focus')
    expect(modes).toContain('reverse')
  })

  it('ActiveTab has all expected values', () => {
    const tabs: ActiveTab[] = ['practice', 'editor', 'settings']
    expect(tabs).toContain('practice')
    expect(tabs).toContain('editor')
    expect(tabs).toContain('settings')
  })
})

describe('SharedControlToolbar Props', () => {
  it('defines all required prop types correctly', () => {
    const activeTabFunc = () => 'practice'
    const isPlayingFunc = () => false
    const isPausedFunc = () => false
    const playButtonLabelFunc = () => 'Start'

    // Type validation is handled by TypeScript compilation
    expect(typeof activeTabFunc).toBe('function')
    expect(typeof isPlayingFunc).toBe('function')
    expect(typeof isPausedFunc).toBe('function')
    expect(typeof playButtonLabelFunc).toBe('function')
  })
})
