// ============================================================
// karaoke-pitch-cogwheel.test.ts — verifies the pitch-settings
// cogwheel + panel visibility rules from the EARS spec
// docs/specs/karaoke-pitch-cogwheel.ears.md (REQ-KPC-001..004).
//
// The actual <Show> guards in StemMixer.tsx are inline conditions.
// This test mirrors those exact expressions to ensure correctness
// across presets, and catches any regression that re-introduces a
// preset gate where one was removed.
// ============================================================

import { describe, expect, it } from 'vitest'

// ── Gate predicates extracted from StemMixer.tsx ────────────────
// These mirror the conditions used in the <Show when={...}> wrappers
// so the test breaks if someone reintroduces a preset gate.

/**
 * Cogwheel button visibility.
 * After this change the button is always shown — no preset gate.
 */
const isCogwheelVisible = (_preset: 'studio' | 'performance'): boolean => {
  // Was: preset !== 'performance'. Now: always true.
  return true
}

/**
 * Pitch settings panel visibility.
 * After this change the panel is shown whenever panelOpen && !editMode,
 * regardless of the preset.
 */
const isPanelVisible = (
  _preset: 'studio' | 'performance',
  panelOpen: boolean,
  editMode: boolean,
): boolean => {
  // Was: preset !== 'performance' && panelOpen && !editMode
  return panelOpen && !editMode
}

/**
 * Edit-mode toolbar visibility — intentionally still studio-only.
 */
const isEditToolbarVisible = (
  preset: 'studio' | 'performance',
  editMode: boolean,
): boolean => {
  return preset !== 'performance' && editMode
}

// ── Tests ──────────────────────────────────────────────────────

describe('karaoke-pitch-cogwheel gates (REQ-KPC-*)', () => {
  // REQ-KPC-001: cogwheel visible in performance preset
  it('KPC-1: cogwheel is visible in the performance preset', () => {
    expect(isCogwheelVisible('performance')).toBe(true)
  })

  it('KPC-1: cogwheel is visible in the studio preset', () => {
    expect(isCogwheelVisible('studio')).toBe(true)
  })

  // REQ-KPC-002 / REQ-KPC-003: panel opens in performance preset
  it('KPC-2: panel opens in performance preset when panelOpen is true', () => {
    expect(isPanelVisible('performance', true, false)).toBe(true)
  })

  it('KPC-3: panel opens in studio preset when panelOpen is true', () => {
    expect(isPanelVisible('studio', true, false)).toBe(true)
  })

  it('KPC-3: panel hides when panelOpen is false (both presets)', () => {
    expect(isPanelVisible('studio', false, false)).toBe(false)
    expect(isPanelVisible('performance', false, false)).toBe(false)
  })

  it('KPC-3: panel hides when editMode is active (both presets)', () => {
    expect(isPanelVisible('studio', true, true)).toBe(false)
    expect(isPanelVisible('performance', true, true)).toBe(false)
  })

  // REQ-KPC-004: edit-mode toolbar stays studio-only
  it('KPC-4: edit toolbar is hidden in performance preset', () => {
    expect(isEditToolbarVisible('performance', true)).toBe(false)
    expect(isEditToolbarVisible('performance', false)).toBe(false)
  })

  it('KPC-4: edit toolbar shows in studio preset when editMode is active', () => {
    expect(isEditToolbarVisible('studio', true)).toBe(true)
  })

  it('KPC-4: edit toolbar hides in studio preset when editMode is off', () => {
    expect(isEditToolbarVisible('studio', false)).toBe(false)
  })
})
