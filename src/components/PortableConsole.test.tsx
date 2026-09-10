// ============================================================
// PortableConsole
// ============================================================
// The panel is the half of this that works on a phone nobody can plug in. It
// has to stay out of the way while the app is being USED, show the newest line
// without being opened, and hand the whole capture over in one tap — including
// on a browser that refuses the clipboard.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initPortableConsoleVisibility, portableConsoleVisible, recordPortableConsole, resetPortableConsoleForTests, } from '@/lib/portable-console'
import { PortableConsole } from './PortableConsole'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetPortableConsoleForTests()
})

afterEach(() => {
  cleanup()
  resetPortableConsoleForTests()
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

function open(): void {
  fireEvent.click(screen.getByRole('button', { expanded: false }))
}

describe('PortableConsole', () => {
  it('shows the newest line without being opened', () => {
    render(() => <PortableConsole />)

    recordPortableConsole('warn', ['recognition ended, quiet'])

    const panel = screen.getByTestId('portable-console')
    expect(panel.textContent).toContain('recognition ended, quiet')
    // Collapsed is one line: the app underneath is what is being tested.
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('starts with the lines recorded before it mounted', () => {
    // Capture is installed at the top of every entry and the panel renders
    // later. An empty panel over a live capture reads as "nothing happened".
    recordPortableConsole('log', ['boot'])
    recordPortableConsole('log', ['worker ready'])

    render(() => <PortableConsole />)

    expect(screen.getByTestId('portable-console').textContent).toContain(
      'worker ready',
    )
  })

  it('says so when the console has been quiet', () => {
    render(() => <PortableConsole />)

    expect(screen.getByTestId('portable-console').textContent).toContain(
      'console is quiet',
    )
  })

  it('opens to the whole capture', () => {
    recordPortableConsole('log', ['first'])
    recordPortableConsole('error', ['last'])
    render(() => <PortableConsole />)

    open()

    const panel = screen.getByTestId('portable-console')
    expect(panel.textContent).toContain('first')
    expect(panel.textContent).toContain('last')
  })

  it('narrows to the lines being hunted', () => {
    recordPortableConsole('log', ['pitch 440'])
    recordPortableConsole('log', ['stale-replace'])
    render(() => <PortableConsole />)
    open()

    fireEvent.input(screen.getByLabelText('Filter console lines'), {
      target: { value: 'stale' },
    })

    const panel = screen.getByTestId('portable-console')
    expect(panel.textContent).toContain('stale-replace')
    expect(panel.textContent).not.toContain('pitch 440')
  })

  it('filters by level too, which is how the errors get found', () => {
    recordPortableConsole('log', ['ordinary'])
    recordPortableConsole('error', ['the interesting one'])
    render(() => <PortableConsole />)
    open()

    fireEvent.input(screen.getByLabelText('Filter console lines'), {
      target: { value: 'error' },
    })

    const panel = screen.getByTestId('portable-console')
    expect(panel.textContent).toContain('the interesting one')
    expect(panel.textContent).not.toContain('ordinary')
  })

  it('copies the capture with the device named', async () => {
    const writeText = vi.fn(async (_text: string) => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    recordPortableConsole('log', ['worth keeping'])
    render(() => <PortableConsole />)
    open()

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledTimes(1)
    const pasted = writeText.mock.calls[0][0]
    expect(pasted).toContain('MercuryPitch portable console')
    expect(pasted).toContain('worth keeping')
  })

  it('selects the log when the clipboard is refused', async () => {
    // iOS refuses the clipboard often enough that throwing here would lose the
    // one capture someone spent ten minutes reproducing.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
    recordPortableConsole('log', ['worth keeping'])
    render(() => <PortableConsole />)
    open()

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await Promise.resolve()

    expect(window.getSelection()?.rangeCount).toBe(1)
  })

  it('empties on request', () => {
    recordPortableConsole('log', ['noise'])
    render(() => <PortableConsole />)
    open()

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(screen.getByTestId('portable-console').textContent).toContain(
      'console is quiet',
    )
  })

  it('flips to the other edge, because neither one is safe', () => {
    // It covered the voice pill along the bottom; moved to the top it covered
    // the header pill instead. One tap has to move it either way.
    render(() => <PortableConsole />)
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))

    expect(screen.getByRole('button', { name: 'Move down' })).toBeTruthy()
  })

  it('goes away for good when hidden, and stays away next page', () => {
    render(() => <PortableConsole />)
    open()

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))

    expect(screen.queryByTestId('portable-console')).toBeNull()
    // Karaoke Night is a separate document; an overlay that came back on every
    // page load would be worse than no overlay at all.
    expect(portableConsoleVisible()).toBe(false)
  })

  it('is not there for anyone who turned it off', () => {
    initPortableConsoleVisibility('?console=0')

    render(() => <PortableConsole />)

    expect(screen.queryByTestId('portable-console')).toBeNull()
  })
})
