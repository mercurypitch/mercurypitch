// @vitest-environment jsdom
// ============================================================
// The console has to be where the bug is
// ============================================================
//
// The danger-zone toggle used to reveal a log that only existed inside the
// Settings panel, which is never the screen the bug is on. These tests pin the
// two things that fixes: the panel follows you to every page, and the flag
// survives the walk — Karaoke Night and each Night entry are separate
// documents, so a non-persisted signal switched itself off at the door.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addConsoleLog, clearConsoleLogs } from '@/stores/console-store'
import { setShowConsoleLog, showConsoleLog, } from '@/stores/developer-console-store'
import { FloatingConsole, setupDeveloperConsole } from './FloatingConsole'

describe('floating developer console', () => {
  beforeEach(() => {
    localStorage.clear()
    clearConsoleLogs()
    setShowConsoleLog(false)
    document.getElementById('mp-developer-console-host')?.remove()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('stays off until the danger-zone toggle asks for it', () => {
    render(() => <FloatingConsole />)

    expect(screen.queryByTestId('floating-console')).toBeNull()
  })

  it('appears over the page once enabled, collapsed rather than covering it', () => {
    setShowConsoleLog(true)
    render(() => <FloatingConsole />)

    expect(screen.getByTestId('floating-console')).toBeTruthy()
    // Collapsed: the button, not the panel. A debug overlay that opens across
    // the screen hides the control you turned it on to watch.
    expect(screen.getByTestId('floating-console-open')).toBeTruthy()
    expect(screen.queryByTestId('console-log-messages')).toBeNull()
  })

  it('opens to the log when the button is pressed', () => {
    setShowConsoleLog(true)
    addConsoleLog('error', ['boom'])
    render(() => <FloatingConsole />)

    screen.getByTestId('floating-console-open').click()

    expect(screen.getByTestId('console-log-messages').textContent).toContain(
      'boom',
    )
  })

  it('folds back to its button from the panel, which the inline log cannot', () => {
    setShowConsoleLog(true)
    render(() => <FloatingConsole />)
    screen.getByTestId('floating-console-open').click()

    screen.getByTestId('console-log-hide').click()

    expect(screen.queryByTestId('console-log-messages')).toBeNull()
    expect(screen.getByTestId('floating-console-open').textContent).toContain(
      'Console',
    )
  })

  it('survives the walk to another document', async () => {
    setShowConsoleLog(true)
    expect(showConsoleLog()).toBe(true)
    expect(localStorage.getItem('pitchperfect_developer_console')).toBe('true')

    // What a new document does: a fresh copy of the store, reading the
    // switch from the key every build has saved it under.
    vi.resetModules()
    const fresh = await import('@/stores/developer-console-store')

    expect(fresh.showConsoleLog()).toBe(true)
  })

  it('mounts its host on <body>, out of reach of a transformed ancestor', () => {
    setShowConsoleLog(true)
    setupDeveloperConsole()

    const host = document.getElementById('mp-developer-console-host')
    expect(host).toBeTruthy()
    expect(host?.parentElement).toBe(document.body)
  })

  it('mounts once per document, however many entries ask', () => {
    setupDeveloperConsole()
    setupDeveloperConsole()

    expect(
      document.querySelectorAll('#mp-developer-console-host'),
    ).toHaveLength(1)
  })
})
