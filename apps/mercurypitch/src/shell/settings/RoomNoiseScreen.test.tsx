// ============================================================
// Room noise: the three rooms, and a setting between them
// ============================================================
//
// S6 7a moves the room-noise preset to the Microphone screen. Quiet, Home and
// Noisy are the named stops of one scale (sensitivity-scale.ts). Choosing one
// sets exactly that stop. A position set by hand between two stops is shown
// as the one in force, so the list never reads as if nothing were chosen.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applySensitivityPosition, applySensitivityPreset, sensitivityPosition, } from '@/stores/settings-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { RoomNoiseScreen } from './RoomNoiseScreen'

let view: RenderedShell | null = null

function choice(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-choice="${id}"]`)
}

function checked(): string[] {
  return [...document.querySelectorAll('[aria-checked="true"]')].map(
    (node) => node.getAttribute('data-choice') ?? '',
  )
}

beforeEach(() => {
  localStorage.clear()
  applySensitivityPreset('home')
})

afterEach(() => {
  view?.unmount()
  view = null
  applySensitivityPreset('home')
})

describe('room noise', () => {
  it('offers the three rooms with the one in force checked', () => {
    view = renderShell(() => <RoomNoiseScreen />)

    expect(choice('quiet')?.textContent).toContain('Quiet')
    expect(choice('noisy')?.textContent).toContain('Noisy')
    expect(checked()).toEqual(['home'])
  })

  it('sets exactly the stop that is chosen', () => {
    view = renderShell(() => <RoomNoiseScreen />)

    choice('noisy')?.click()

    expect(sensitivityPosition()).toBe(100)
    expect(checked()).toEqual(['noisy'])
  })

  it('shows a setting between two rooms as the one in force', () => {
    applySensitivityPosition(75)

    view = renderShell(() => <RoomNoiseScreen />)

    expect(checked()).toEqual(['between'])
    expect(choice('between')?.textContent).toContain('Between Home and Noisy')
  })
})
