import { fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppNavTabs } from '@/components/AppNavTabs'
import { TAB_HOME } from '@/features/tabs/constants'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'

/**
 * Group collapse and the adaptive fit pass both want the group label: collapse
 * uses it as its toggle, and the fit pass drops it first when the bar runs out
 * of width. They meet in `collapsible()`, and the invariant that matters is
 * that a group is never left collapsed without the control that reopens it —
 * every tab inside would be off-screen with no way back.
 */
describe('AppNavTabs group collapse', () => {
  const renderBar = () =>
    render(() => (
      <AppNavTabs
        activeTab={() => TAB_HOME}
        handleTabChange={vi.fn()}
        tabLabel={(tab) => tab}
      />
    ))

  const groupEl = (c: HTMLElement, id: string): HTMLElement => {
    const el = c.querySelector<HTMLElement>(`[data-tab-group="${id}"]`)
    if (el === null) throw new Error(`no group ${id}`)
    return el
  }

  const labelOf = (group: HTMLElement): HTMLElement | null =>
    group.querySelector<HTMLElement>('.tab-group-label')

  beforeEach(() => {
    localStorage.clear()
    setPracticeScope('all')
    setUiMode('advanced')
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('offers the group name as a collapse toggle', () => {
    const { container } = renderBar()
    const label = labelOf(groupEl(container, 'you'))

    expect(label?.tagName).toBe('BUTTON')
    expect(label?.getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the standalone Drum Night door inside the Play group', () => {
    const { container } = renderBar()
    const play = groupEl(container, 'play')
    const roomLink = play.querySelector<HTMLAnchorElement>(
      '[data-testid="nav-drum-night"]',
    )

    expect(roomLink?.getAttribute('href')).toBe('/drum-night')
    expect(roomLink?.getAttribute('aria-label')).toBe(
      'Drums — open Drum Night room',
    )
    expect(roomLink?.textContent).toContain('Drums')
  })

  it('collapses the group on click and remembers it', () => {
    const { container } = renderBar()
    const group = groupEl(container, 'you')
    const label = labelOf(group)
    if (label === null) throw new Error('no label')

    fireEvent.click(label)

    expect(label.getAttribute('aria-expanded')).toBe('false')
    expect(group.classList.contains('collapsed')).toBe(true)
    expect(localStorage.getItem('mp.navCollapsedGroups')).toContain('you')

    // And back again — the same control has to reopen it.
    fireEvent.click(label)
    expect(label.getAttribute('aria-expanded')).toBe('true')
    expect(group.classList.contains('collapsed')).toBe(false)
  })

  it('restores a collapsed group from a previous session', () => {
    localStorage.setItem(
      'mp.navCollapsedGroups',
      JSON.stringify({ play: true }),
    )

    const { container } = renderBar()

    expect(groupEl(container, 'play').classList.contains('collapsed')).toBe(
      true,
    )
    expect(groupEl(container, 'you').classList.contains('collapsed')).toBe(
      false,
    )
  })

  it('never marks a group collapsed without the toggle that reopens it', () => {
    localStorage.setItem(
      'mp.navCollapsedGroups',
      JSON.stringify({ you: true, practice: true, play: true, studio: true }),
    )

    const { container } = renderBar()

    for (const group of container.querySelectorAll<HTMLElement>(
      '[data-tab-group]',
    )) {
      if (!group.classList.contains('collapsed')) continue
      expect(group.classList.contains('collapsible')).toBe(true)
      expect(labelOf(group)).not.toBeNull()
    }
  })

  it('drops the collapse affordance entirely in simple mode', () => {
    // Simple mode is a flat, focused bar with no group chrome, so a collapse
    // state carried over from advanced mode must not be applied there.
    localStorage.setItem('mp.navCollapsedGroups', JSON.stringify({ you: true }))
    setUiMode('simple')

    const { container } = renderBar()
    const group = groupEl(container, 'you')

    expect(labelOf(group)).toBeNull()
    expect(group.classList.contains('collapsible')).toBe(false)
    expect(group.classList.contains('collapsed')).toBe(false)
  })
})
