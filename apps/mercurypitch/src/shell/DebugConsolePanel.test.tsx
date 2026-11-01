// The Developer screen's Debug console switch, read the way a tester uses it
// before recording the screen: off takes the console and its dot off every
// page, the log keeps filling underneath, and on brings the panel back.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortableConsoleOnScreen } from '@/components/PortableConsole'
import { initPortableConsoleVisibility, installPortableConsole, portableConsoleEntries, portableConsoleOnScreen, recordPortableConsole, resetPortableConsoleForTests, } from '@/lib/portable-console'
import { DebugConsolePanel } from './DebugConsolePanel'

const ON_SCREEN_KEY = 'mp:portableConsole:onScreen'

beforeEach(() => {
  resetPortableConsoleForTests()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  resetPortableConsoleForTests()
  vi.restoreAllMocks()
  localStorage.clear()
})

function open() {
  render(() => (
    <>
      <PortableConsoleOnScreen />
      <DebugConsolePanel />
    </>
  ))
  return screen.getByTestId('dev-debug-console-on-screen')
}

const consoleDrawn = (): boolean =>
  screen.queryByTestId('portable-console') !== null ||
  screen.queryByTestId('portable-console-handle') !== null

describe('the Debug console switch', () => {
  it('starts on, with the console drawn', () => {
    const toggle = open()

    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(consoleDrawn()).toBe(true)
  })

  it('takes the console and its dot off the screen, and keeps logging', () => {
    const toggle = open()
    fireEvent.click(toggle)
    recordPortableConsole('log', ['heard while off'])

    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(consoleDrawn()).toBe(false)
    expect(portableConsoleEntries().map((entry) => entry.text)).toContain(
      'heard while off',
    )
  })

  it('brings the console back when it is turned on again', () => {
    const toggle = open()
    fireEvent.click(toggle)
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(consoleDrawn()).toBe(true)
  })

  it('is remembered across launches', () => {
    fireEvent.click(open())
    expect(localStorage.getItem(ON_SCREEN_KEY)).toBe('0')

    resetPortableConsoleForTests()
    initPortableConsoleVisibility('')
    expect(portableConsoleOnScreen()).toBe(false)
  })
})

describe('the routine logs switch', () => {
  it('starts off: the routine lines are left out, the reports and the trouble kept', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    installPortableConsole()
    render(() => <DebugConsolePanel />)
    const toggle = screen.getByTestId('dev-debug-console-routine')

    console.log('scheduling auto-play')
    console.info('[first-note] read "Song": 6 entries')
    console.warn('recognition ended, quiet')

    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(portableConsoleEntries().map((entry) => entry.level)).toEqual([
      'info',
      'warn',
    ])
  })

  it('keeps every line once turned on, and says so', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installPortableConsole()
    render(() => <DebugConsolePanel />)
    const toggle = screen.getByTestId('dev-debug-console-routine')

    fireEvent.click(toggle)
    console.log('scheduling auto-play')

    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(portableConsoleEntries().map((entry) => entry.text)).toEqual([
      'scheduling auto-play',
    ])
    expect(localStorage.getItem('mp:portableConsole:routine')).toBe('1')
  })
})
