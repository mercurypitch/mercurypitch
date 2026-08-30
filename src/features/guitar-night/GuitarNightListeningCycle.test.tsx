// Guitar Night Listening cycle tests protect route order and state truth.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { GuitarNightListeningCycle, nextGuitarNightListeningSelection, } from './GuitarNightListeningCycle'
import type { GuitarListeningStatus } from './useGuitarListeningController'

describe('GuitarNightListeningCycle', () => {
  afterEach(cleanup)

  it('cycles Off through every coarse input route and back to Off', () => {
    const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
    const [profile, setProfile] =
      createSignal<GuitarInputProfileKind>('microphone')
    const selections: Array<GuitarInputProfileKind | null> = []

    render(() => (
      <GuitarNightListeningCycle
        status={status}
        profile={profile}
        onSelect={(next) => {
          selections.push(next)
          if (next === null) {
            setStatus('off')
            return
          }
          setProfile(next)
          setStatus('listening')
        }}
      />
    ))

    const button = screen.getByRole('button', {
      name: 'Listening is off. Switch to Room mic',
    })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('data-state', 'off')
    expect(button).toHaveAttribute(
      'title',
      'Listening is off. Switch to Room mic. Hold or right-click to pick a route.',
    )

    fireEvent.click(button)
    expect(button).toHaveAccessibleName(
      'Listening with Room mic. Switch to Direct input',
    )
    fireEvent.click(button)
    expect(button).toHaveAccessibleName(
      'Listening with Direct input. Switch to MIDI',
    )
    fireEvent.click(button)
    expect(button).toHaveAccessibleName(
      'Listening with MIDI. Turn Listening off',
    )
    fireEvent.click(button)
    expect(button).toHaveAccessibleName('Listening is off. Switch to Room mic')

    expect(selections).toEqual(['microphone', 'interface', 'midi', null])
  })

  it('holds a promised change as pending and prevents a racing second click', async () => {
    let resolveSelection!: () => void
    const selection = new Promise<void>((resolve) => {
      resolveSelection = resolve
    })
    const onSelect = vi.fn(() => selection)

    render(() => (
      <GuitarNightListeningCycle
        status={() => 'off'}
        profile={() => 'microphone'}
        onSelect={onSelect}
      />
    ))

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAccessibleName('Switching Listening to Room mic')
    expect(button).toHaveAttribute('data-state', 'microphone')
    expect(button).toHaveAttribute('data-active', 'false')
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)

    resolveSelection()
    await selection
    await Promise.resolve()

    expect(button).toHaveAttribute('aria-disabled', 'false')
    expect(button).toHaveAttribute('aria-busy', 'false')
  })

  it('shows Off without an active glow while an async stop is pending', () => {
    const neverSettles = new Promise<void>(() => undefined)

    render(() => (
      <GuitarNightListeningCycle
        status={() => 'listening'}
        profile={() => 'midi'}
        onSelect={() => neverSettles}
      />
    ))

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(button).toHaveAccessibleName('Turning Listening off')
    expect(button).toHaveAttribute('data-state', 'off')
    expect(button).toHaveAttribute('data-active', 'false')
  })

  it('keeps external connection and calibration work disabled and truthful', () => {
    const [status, setStatus] =
      createSignal<GuitarListeningStatus>('requesting')
    const onSelect = vi.fn()

    render(() => (
      <GuitarNightListeningCycle
        status={status}
        profile={() => 'interface'}
        onSelect={onSelect}
      />
    ))

    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleName('Opening Direct input for Listening')
    expect(button).toHaveAttribute('data-active', 'false')

    button.focus()
    expect(button).toHaveFocus()

    setStatus('calibrating')
    expect(button).toHaveAccessibleName(
      'Calibrating Direct input; Listening controls are unavailable',
    )
    fireEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('reserves the Velvet glow state for an open input', () => {
    const [status, setStatus] = createSignal<GuitarListeningStatus>('listening')

    render(() => (
      <GuitarNightListeningCycle
        status={status}
        profile={() => 'midi'}
        onSelect={vi.fn()}
      />
    ))

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('data-active', 'true')
    expect(button).toHaveAttribute('data-state', 'midi')

    setStatus('error')
    expect(button).toHaveAttribute('data-active', 'false')
    expect(button).toHaveAttribute('data-state', 'off')
    expect(button).toHaveAccessibleName(
      'Listening is off after an input error. Switch to Room mic',
    )
  })

  it('honours an owner lock without changing the selected route', () => {
    const onSelect = vi.fn()
    render(() => (
      <GuitarNightListeningCycle
        status={() => 'listening'}
        profile={() => 'microphone'}
        disabled={() => true}
        onSelect={onSelect}
      />
    ))

    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleName(
      'Listening with Room mic. Input changes are unavailable',
    )
    fireEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('announces the selected route without moving focus', () => {
    const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
    const [profile, setProfile] =
      createSignal<GuitarInputProfileKind>('microphone')

    render(() => (
      <GuitarNightListeningCycle
        status={status}
        profile={profile}
        onSelect={(next) => {
          if (next === null) {
            setStatus('off')
            return
          }
          setProfile(next)
          setStatus('listening')
        }}
      />
    ))

    const button = screen.getByRole('button')
    button.focus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listening is off. Switch to Room mic',
    )

    fireEvent.click(button)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listening with Room mic. Switch to Direct input',
    )
    expect(button).toHaveFocus()
  })

  it('exposes the cycle as a tiny pure state machine for integration tests', () => {
    expect(nextGuitarNightListeningSelection(null)).toBe('microphone')
    expect(nextGuitarNightListeningSelection('microphone')).toBe('interface')
    expect(nextGuitarNightListeningSelection('interface')).toBe('midi')
    expect(nextGuitarNightListeningSelection('midi')).toBeNull()
  })
  describe('route picker', () => {
    function mountPicker() {
      const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
      const [profile, setProfile] =
        createSignal<GuitarInputProfileKind>('microphone')
      const selections: Array<GuitarInputProfileKind | null> = []
      render(() => (
        <GuitarNightListeningCycle
          status={status}
          profile={profile}
          onSelect={(next) => {
            selections.push(next)
            if (next === null) {
              setStatus('off')
              return
            }
            setProfile(next)
            setStatus('listening')
          }}
        />
      ))
      return { selections, status, profile }
    }

    const openViaRightClick = (): void => {
      fireEvent.contextMenu(screen.getByTestId('guitar-night-listening-cycle'))
    }

    /** jsdom drops pointerType from a PointerEvent init, so set it directly. */
    const touch = (type: string, clientX: number, clientY: number): Event => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'pointerType', { value: 'touch' })
      Object.defineProperty(event, 'clientX', { value: clientX })
      Object.defineProperty(event, 'clientY', { value: clientY })
      return event
    }

    it('marks the configured route even while Listening is off', () => {
      // The Session panel writes the same `inputProfile` signal this control
      // reads, and it can be changed with Listening off. Keying the picker on
      // the LIVE route showed no chip as current then, so the two surfaces
      // looked out of sync while reading one value.
      const [status] = createSignal<GuitarListeningStatus>('off')
      const [profile, setProfile] =
        createSignal<GuitarInputProfileKind>('microphone')
      render(() => (
        <GuitarNightListeningCycle
          status={status}
          profile={profile}
          onSelect={() => {}}
        />
      ))

      setProfile('midi')
      expect(
        screen.getByTestId('guitar-night-listening-cycle'),
      ).toHaveAttribute('data-route', 'midi')

      openViaRightClick()
      const chip = screen.getByRole('menuitemradio', {
        name: 'Listen with MIDI (selected)',
      })
      expect(chip).toHaveAttribute('aria-checked', 'true')
      expect(chip).toHaveAttribute('data-current', 'true')
      expect(
        screen.getByRole('menuitemradio', { name: 'Listen with Room mic' }),
      ).toHaveAttribute('aria-checked', 'false')
    })

    it('reaches direct input without ever opening the microphone', () => {
      // The whole point: cycling can only get here through Room mic, which
      // costs a browser consent prompt a plugged-in player never wanted.
      const { selections } = mountPicker()
      openViaRightClick()

      fireEvent.click(
        screen.getByRole('menuitemradio', { name: 'Listen with Direct input' }),
      )
      expect(selections).toEqual(['interface'])
      expect(screen.queryByTestId('guitar-night-listening-picker')).toBeNull()
    })

    it('turns Listening off when the open route is chosen again', () => {
      const { selections } = mountPicker()
      fireEvent.click(screen.getByTestId('guitar-night-listening-cycle'))
      expect(selections).toEqual(['microphone'])

      openViaRightClick()
      fireEvent.click(
        screen.getByRole('menuitemradio', {
          name: 'Turn Listening off (Room mic is on)',
        }),
      )
      expect(selections).toEqual(['microphone', null])
    })

    it('opens on a long press and swallows the click that ends it', () => {
      vi.useFakeTimers()
      try {
        const { selections } = mountPicker()
        const button = screen.getByTestId('guitar-night-listening-cycle')
        button.dispatchEvent(touch('pointerdown', 10, 10))
        vi.advanceTimersByTime(500)
        expect(screen.getByTestId('guitar-night-listening-picker')).toBeTruthy()

        // The finger lifting must not also advance the cycle.
        button.dispatchEvent(touch('pointerup', 10, 10))
        fireEvent.click(button)
        expect(selections).toEqual([])
      } finally {
        vi.useRealTimers()
      }
    })

    it('treats a press that travels as a scroll, not a hold', () => {
      vi.useFakeTimers()
      try {
        mountPicker()
        const button = screen.getByTestId('guitar-night-listening-cycle')
        button.dispatchEvent(touch('pointerdown', 10, 10))
        button.dispatchEvent(touch('pointermove', 10, 44))
        vi.advanceTimersByTime(500)
        expect(screen.queryByTestId('guitar-night-listening-picker')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('closes on Escape and on a press outside', () => {
      mountPicker()
      openViaRightClick()
      fireEvent.keyDown(screen.getByTestId('guitar-night-listening-picker'), {
        key: 'Escape',
      })
      expect(screen.queryByTestId('guitar-night-listening-picker')).toBeNull()

      openViaRightClick()
      fireEvent.pointerDown(
        screen.getByTestId('guitar-night-listening-picker-backdrop'),
      )
      expect(screen.queryByTestId('guitar-night-listening-picker')).toBeNull()
    })

    it('stays shut while input changes are unavailable', () => {
      const [status] = createSignal<GuitarListeningStatus>('off')
      const [profile] = createSignal<GuitarInputProfileKind>('microphone')
      render(() => (
        <GuitarNightListeningCycle
          status={status}
          profile={profile}
          disabled={() => true}
          onSelect={() => undefined}
        />
      ))
      fireEvent.contextMenu(screen.getByTestId('guitar-night-listening-cycle'))
      expect(screen.queryByTestId('guitar-night-listening-picker')).toBeNull()
    })
  })
})
