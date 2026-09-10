// ============================================================
// VoiceDiagnosticsPanel
// ============================================================
// The panel is the half of this that works on a phone nobody can plug in.
// It has to stay out of the way while the app is being used, show the ear
// working in real time, and hand the recording over in one tap.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initVoiceDiagnostics, recordVoiceDiagnostic, resetVoiceDiagnosticsForTests, voiceDiagnosticEntries, } from './voice-diagnostics'
import { VoiceDiagnosticsPanel } from './VoiceDiagnosticsPanel'

beforeEach(() => {
  localStorage.clear()
  resetVoiceDiagnosticsForTests()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  resetVoiceDiagnosticsForTests()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('VoiceDiagnosticsPanel', () => {
  it('is not there for anyone who did not ask for it', () => {
    initVoiceDiagnostics('')

    render(() => <VoiceDiagnosticsPanel />)

    // It sits over the app at the bottom of every page. Shipping it to
    // someone who never asked would be the worst kind of debug leftover.
    expect(screen.queryByTestId('voice-diagnostics-panel')).toBeNull()
  })

  it('shows the last thing the ear did, without covering the app', () => {
    initVoiceDiagnostics('?voicelog=1')
    render(() => <VoiceDiagnosticsPanel />)

    recordVoiceDiagnostic('doze', 3, { quiet: 3 })

    // Collapsed: one line, the newest entry. The app underneath is still
    // usable, which is the point of watching voice control at all.
    const panel = screen.getByTestId('voice-diagnostics-panel')
    expect(panel.textContent).toContain('doze')
    expect(panel.textContent).toContain('quiet=3')
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('opens to the whole recording', () => {
    initVoiceDiagnostics('?voicelog=1')
    recordVoiceDiagnostic('spin-up', 1)
    recordVoiceDiagnostic('start', 1)
    recordVoiceDiagnostic('end', 1, { wasQuiet: true })
    render(() => <VoiceDiagnosticsPanel />)

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    const panel = screen.getByTestId('voice-diagnostics-panel')
    expect(panel.textContent).toContain('spin-up')
    expect(panel.textContent).toContain('start')
    expect(panel.textContent).toContain('wasQuiet=true')
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy()
  })

  it('shows what was already recorded before it mounted', () => {
    initVoiceDiagnostics('?voicelog=1')
    // The interesting entries land at startup, well before this mounts. A
    // panel that only listened forward would open on an empty log and read
    // as "nothing happened".
    recordVoiceDiagnostic('start-requested', 0)

    render(() => <VoiceDiagnosticsPanel />)

    expect(screen.getByTestId('voice-diagnostics-panel').textContent).toContain(
      'start-requested',
    )
  })

  it('copies the recording, named so a paste says which device it came from', async () => {
    const writeText = vi.fn(async (_text: string) => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    initVoiceDiagnostics('?voicelog=1')
    recordVoiceDiagnostic('doze', 2, { quiet: 3 })
    render(() => <VoiceDiagnosticsPanel />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledTimes(1)
    const text = String(writeText.mock.calls[0][0])
    expect(text).toContain('MercuryPitch voice diagnostics')
    expect(text).toContain('doze')
  })

  it('survives a browser that refuses the clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
    initVoiceDiagnostics('?voicelog=1')
    recordVoiceDiagnostic('doze', 2)
    render(() => <VoiceDiagnosticsPanel />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    // iOS refuses this often enough that throwing here would lose the one
    // recording someone spent ten minutes reproducing.
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /copy/i })),
    ).not.toThrow()
    await Promise.resolve()
  })

  it('empties on request, so a second attempt starts clean', () => {
    initVoiceDiagnostics('?voicelog=1')
    recordVoiceDiagnostic('doze', 1)
    render(() => <VoiceDiagnosticsPanel />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(voiceDiagnosticEntries()).toHaveLength(0)
  })

  it('takes itself away when told to stop', () => {
    initVoiceDiagnostics('?voicelog=1')
    recordVoiceDiagnostic('doze', 1)
    render(() => <VoiceDiagnosticsPanel />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    fireEvent.click(screen.getByRole('button', { name: /stop/i }))

    // Off means gone, and stays gone on the next page load — the preference
    // is what the panel writes, not just this component's own state.
    expect(screen.queryByTestId('voice-diagnostics-panel')).toBeNull()
    expect(localStorage.getItem('mp:voiceDiagnostics')).toBeNull()
  })
})
