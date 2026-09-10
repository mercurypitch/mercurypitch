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
import { addConsoleLog, clearConsoleLogs, consoleLogs, formatConsoleLogs, setShowConsoleLog, showConsoleLog, } from '@/stores/console-store'
import { ConsoleLog, FloatingConsole, setupDeveloperConsole, } from './ConsoleLog'

describe('developer console', () => {
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

  it('survives the walk to another document', () => {
    setShowConsoleLog(true)

    // What a new document does: a fresh read of the persisted flag.
    expect(localStorage.getItem('pitchperfect_developer_console')).toBe('true')
    expect(showConsoleLog()).toBe(true)
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

  it('clears the buffer from the inline log in Settings', () => {
    addConsoleLog('warn', ['stale'])
    render(() => <ConsoleLog />)

    screen.getByTestId('console-log-clear').click()

    expect(consoleLogs()).toHaveLength(0)
  })

  it('copies every message as one pasteable block', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    )
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    addConsoleLog('error', ['first'])
    addConsoleLog('log', ['second'])
    render(() => <ConsoleLog />)

    screen.getByTestId('console-log-copy').click()
    await Promise.resolve()

    const copied = writeText.mock.calls[0]?.[0] ?? ''
    expect(copied).toContain('first')
    expect(copied).toContain('second')
    expect(copied).toContain('[error]')
  })

  it('says so instead of lying when the clipboard is refused', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('NotAllowedError')),
      },
      configurable: true,
    })
    addConsoleLog('log', ['x'])
    render(() => <ConsoleLog />)
    const button = screen.getByTestId('console-log-copy')

    button.click()
    await Promise.resolve()
    await Promise.resolve()

    // An insecure origin refuses the clipboard outright, which is exactly the
    // case a phone on a LAN dev server hits.
    expect(button.textContent).toContain('No clipboard')
  })

  it('formats a message with its level and text', () => {
    addConsoleLog('warn', ['careful', 'now'])

    expect(formatConsoleLogs()).toContain('[warn] careful now')
  })
})
