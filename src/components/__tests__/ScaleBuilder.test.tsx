// ============================================================
// ScaleBuilder Tests — handleOpen state reset
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { ScaleBuilder } from '../ScaleBuilder'

const STORAGE_KEY = 'pitchperfect_active_custom_scale'

describe('ScaleBuilder — handleOpen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads the active custom scale on open', () => {
    localStorage.setItem(STORAGE_KEY, 'custom:My Blues:C,D#,F,F#,G,A#')

    render(() => <ScaleBuilder isOpen={true} onClose={() => {}} />)

    const input = screen.getByLabelText('Scale Name:') as HTMLInputElement
    expect(input.value).toBe('My Blues')
    expect(screen.getByText('Selected Notes (6)')).toBeTruthy()
  })

  it('resets to defaults on reopen when no custom scale is active (previously left stale)', () => {
    localStorage.setItem(STORAGE_KEY, 'custom:My Blues:C,D#,F,F#,G,A#')

    const [isOpen, setIsOpen] = createSignal(true)
    render(() => <ScaleBuilder isOpen={isOpen()} onClose={() => {}} />)

    // Confirm the custom scale loaded first.
    expect(screen.getByText('Selected Notes (6)')).toBeTruthy()

    // Close, switch to a built-in scale, then reopen — this used to leave
    // the previous custom scale's name/notes showing instead of resetting.
    setIsOpen(false)
    localStorage.setItem(STORAGE_KEY, 'major')
    setIsOpen(true)

    const input = screen.getByLabelText('Scale Name:') as HTMLInputElement
    expect(input.value).toBe('My Scale')
    expect(screen.getByText('Selected Notes (0)')).toBeTruthy()
  })
})
