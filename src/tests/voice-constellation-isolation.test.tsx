import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { useVoiceConstellationIsolation } from '@/features/voice-constellation/useVoiceConstellationIsolation'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('useVoiceConstellationIsolation', () => {
  it('isolates immediately and restores page state and opener on close', async () => {
    const app = document.createElement('div')
    app.id = 'app'
    const opener = document.createElement('button')
    opener.textContent = 'Explore constellation'
    app.append(opener)
    document.body.append(app)
    opener.focus()

    let setOpen: Setter<boolean> | undefined
    const Fixture = () => {
      const [open, setOpenSignal] = createSignal(false)
      setOpen = setOpenSignal
      useVoiceConstellationIsolation(open)
      return null
    }

    render(() => <Fixture />, { container: app })
    setOpen?.(true)

    await waitFor(() => expect(app.inert).toBe(true))
    expect(document.body.style.overflow).toBe('hidden')

    setOpen?.(false)

    await waitFor(() => expect(app.inert).toBe(false))
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
