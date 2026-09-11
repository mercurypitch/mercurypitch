// ============================================================
// The transport: the four controls, and what the lock does to them
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderShell } from './render-for-test'
import { Transport } from './Transport'

const platform = vi.hoisted(() => ({
  hapticTap: vi.fn(async () => undefined),
  hapticSuccess: vi.fn(async () => undefined),
  hapticWarning: vi.fn(async () => undefined),
}))
vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
  vi.clearAllMocks()
})

function mount(
  options: {
    playing?: boolean
    locked?: boolean
    counting?: boolean
    beat?: number
  } = {},
) {
  const onStop = vi.fn()
  const onToggle = vi.fn()
  const onToggleLock = vi.fn()
  const rendered = renderShell(() => (
    <Transport
      elapsedMs={() => 65_000}
      playing={() => options.playing ?? true}
      locked={() => options.locked ?? false}
      countingIn={() => options.counting ?? false}
      countInBeat={() => options.beat ?? 0}
      onStop={onStop}
      onToggle={onToggle}
      onToggleLock={onToggleLock}
    />
  ))
  unmount = rendered.unmount
  const button = (label: string) =>
    rendered.container.querySelector<HTMLButtonElement>(
      `[aria-label="${label}"]`,
    )
  return { ...rendered, onStop, onToggle, onToggleLock, button }
}

describe('Transport', () => {
  it('shows the elapsed time and nothing that looks like a total', () => {
    const { container } = mount()

    const time = container.querySelector('[data-testid="shell-transport-time"]')
    expect(time?.textContent).toBe('1:05')
    expect(container.textContent).not.toContain('/')
  })

  it('names the primary for what the next press will do', () => {
    expect(mount({ playing: true }).button('Pause')).not.toBeNull()
    unmount?.()
    unmount = null
    expect(mount({ playing: false }).button('Play')).not.toBeNull()
  })

  it('reports Stop, the primary and the lock to their owners', () => {
    const { button, onStop, onToggle, onToggleLock } = mount()

    button('Stop')?.click()
    button('Pause')?.click()
    button('Lock controls')?.click()

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggleLock).toHaveBeenCalledTimes(1)
    expect(platform.hapticTap).toHaveBeenCalledTimes(3)
  })

  it('refuses Stop and the primary while locked, and says so', () => {
    const { button, onStop, onToggle, onToggleLock } = mount({ locked: true })

    button('Stop')?.click()
    button('Pause')?.click()

    expect(onStop).not.toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
    expect(button('Lock controls')?.getAttribute('aria-pressed')).toBe('true')

    // The lock itself is the one control a locked transport still answers.
    button('Lock controls')?.click()
    expect(onToggleLock).toHaveBeenCalledTimes(1)
  })

  it('keeps a locked Stop in the accessibility tree, named and unavailable', () => {
    // `disabled` would take it out of the tree entirely, so a screen-reader
    // user sweeping the transport would find Stop simply gone.
    const { button } = mount({ locked: true })

    const stop = button('Stop')
    expect(stop).not.toBeNull()
    expect(stop?.hasAttribute('disabled')).toBe(false)
    expect(stop?.getAttribute('aria-disabled')).toBe('true')
  })

  it('shows the count-in on the primary, and says which beat', () => {
    const { container, button } = mount({ counting: true, beat: 3 })

    expect(
      container.querySelector('[data-testid="shell-count-in"]')?.textContent,
    ).toBe('3')
    expect(button('Counting in, beat 3')).not.toBeNull()
  })
})
