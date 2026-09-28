// @vitest-environment jsdom
// ============================================================
// The inline log: what Settings and the crash card show
// ============================================================
//
// The log a phone's bug report is copied out of. Its floating twin, and the
// switch that shows it, are FloatingConsole.test.tsx: this one ships in every
// build, the store binary included, and must work without either.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addConsoleLog, clearConsoleLogs, consoleLogs, formatConsoleLogs, } from '@/stores/console-store'
import { ConsoleLog } from './ConsoleLog'

describe('developer console log', () => {
  beforeEach(() => {
    localStorage.clear()
    clearConsoleLogs()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('clears the buffer from the inline log in Settings', () => {
    addConsoleLog('warn', ['stale'])
    render(() => <ConsoleLog />)

    screen.getByTestId('console-log-clear').click()

    expect(consoleLogs()).toHaveLength(0)
  })

  it('offers no hide button where there is no panel to fold', () => {
    render(() => <ConsoleLog />)

    expect(screen.queryByTestId('console-log-hide')).toBeNull()
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
