// ============================================================
// Portal skin bridge — caller tokens resample on every open
// ============================================================

import { render, screen, waitFor } from '@solidjs/testing-library'
import type { Setter } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import { createPortalSkinBridge } from './portal-skin'

describe('createPortalSkinBridge', () => {
  it('resamples the caller skin when a portal reopens without styling body', async () => {
    let setOpen!: Setter<boolean>

    const Harness = () => {
      const [open, updateOpen] = createSignal(false)
      const bridge = createPortalSkinBridge(open)
      setOpen = updateOpen

      return (
        <div
          data-testid="skin-source"
          style={{ '--portal-test-ink': '#1f2328', 'color-scheme': 'light' }}
        >
          <span ref={bridge.anchorRef} />
          <Show when={open()}>
            <Portal>
              <div data-testid="skin-portal" style={bridge.style()} />
            </Portal>
          </Show>
        </div>
      )
    }

    render(() => <Harness />)

    setOpen(true)
    await waitFor(() => {
      const portal = screen.getByTestId('skin-portal')
      expect(portal.style.getPropertyValue('--portal-test-ink')).toBe('#1f2328')
      expect(portal.style.colorScheme).toBe('light')
    })

    setOpen(false)
    await waitFor(() => {
      expect(screen.queryByTestId('skin-portal')).toBeNull()
    })
    const source = screen.getByTestId('skin-source')
    source.style.setProperty('--portal-test-ink', '#e6edf3')
    source.style.colorScheme = 'dark'
    setOpen(true)

    await waitFor(() => {
      const portal = screen.getByTestId('skin-portal')
      expect(portal.style.getPropertyValue('--portal-test-ink')).toBe('#e6edf3')
      expect(portal.style.colorScheme).toBe('dark')
    })
    expect(document.body.style.getPropertyValue('--portal-test-ink')).toBe('')
    expect(document.body.style.colorScheme).toBe('')
  })
})
