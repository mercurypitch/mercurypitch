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
      'Listening is off. Switch to Room mic',
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

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAccessibleName('Switching Listening to Room mic')
    expect(button).toHaveAttribute('data-state', 'microphone')
    expect(button).toHaveAttribute('data-active', 'false')
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)

    resolveSelection()
    await selection
    await Promise.resolve()

    expect(button).not.toBeDisabled()
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
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleName('Opening Direct input for Listening')
    expect(button).toHaveAttribute('data-active', 'false')

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
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleName(
      'Listening with Room mic. Input changes are unavailable',
    )
    fireEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('exposes the cycle as a tiny pure state machine for integration tests', () => {
    expect(nextGuitarNightListeningSelection(null)).toBe('microphone')
    expect(nextGuitarNightListeningSelection('microphone')).toBe('interface')
    expect(nextGuitarNightListeningSelection('interface')).toBe('midi')
    expect(nextGuitarNightListeningSelection('midi')).toBeNull()
  })
})
