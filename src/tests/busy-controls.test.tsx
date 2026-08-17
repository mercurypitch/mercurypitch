// A tap on something slow has to look like it landed.
// ============================================================
//
// Guitar Night, Karaoke Night, Piano Night, the Mirror and Glass are separate
// documents, so opening one is a full page load — several seconds on a slow
// connection during which nothing on screen changed. These pin the two halves
// of the fix: the control admits it heard you, and it stops saying so when
// the wait is genuinely over (including the back button, which restores this
// page exactly as it was left).

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { BusyButton } from '@/components/shared/BusyButton'
import { BusyLink } from '@/components/shared/BusyLink'
import { Spinner } from '@/components/shared/Spinner'

function leftClick(): MouseEvent {
  return new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
}

describe('BusyLink', () => {
  it('says nothing until it is clicked', () => {
    render(() => <BusyLink href="/guitar-night">Guitar Night</BusyLink>)

    const link = screen.getByRole('link', { name: 'Guitar Night' })
    expect(link).not.toHaveAttribute('aria-busy')
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  it('shows a spinner for the click that replaces this page', () => {
    render(() => (
      <BusyLink href="/guitar-night" busyLabel="Opening Guitar Night…">
        Guitar Night
      </BusyLink>
    ))

    const link = screen.getByRole('link', { name: /Guitar Night/ })
    link.dispatchEvent(leftClick())

    expect(link).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Opening Guitar Night…',
    )
  })

  it('stays quiet for a click that opens somewhere else', () => {
    render(() => <BusyLink href="/guitar-night">Guitar Night</BusyLink>)
    const link = screen.getByRole('link', { name: 'Guitar Night' })

    // Cmd-click, ctrl-click and middle-click all leave this page alone, so a
    // spinner armed here would never be cleared by anything.
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true,
      }),
    )
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    )
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 }),
    )

    expect(link).not.toHaveAttribute('aria-busy')
  })

  it('stays quiet for a link that opens a new tab', () => {
    render(() => (
      <BusyLink href="/guitar-night" target="_blank">
        Guitar Night
      </BusyLink>
    ))
    const link = screen.getByRole('link', { name: 'Guitar Night' })

    link.dispatchEvent(leftClick())

    expect(link).not.toHaveAttribute('aria-busy')
  })

  it('still runs the click handler it was given', () => {
    const onClick = vi.fn()
    render(() => (
      <BusyLink href="/mirror" onClick={onClick}>
        Mirror
      </BusyLink>
    ))

    screen.getByRole('link', { name: 'Mirror' }).dispatchEvent(leftClick())

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('stays quiet when the click was already called off', () => {
    render(() => (
      <BusyLink
        href="/guitar-night"
        onClick={(event: MouseEvent) => event.preventDefault()}
      >
        Guitar Night
      </BusyLink>
    ))
    const link = screen.getByRole('link', { name: 'Guitar Night' })

    // A router, an unsaved-changes guard or a disabled state can cancel the
    // navigation from the same click. Nothing is loading, so nothing spins.
    link.dispatchEvent(leftClick())

    expect(link).not.toHaveAttribute('aria-busy')
  })

  it('still runs a handler given in Solid\u2019s bound form', () => {
    const onClick = vi.fn()
    render(() => (
      <BusyLink href="/mirror" onClick={[onClick, 'mirror'] as const}>
        Mirror
      </BusyLink>
    ))
    const link = screen.getByRole('link', { name: 'Mirror' })

    link.dispatchEvent(leftClick())

    // `onClick={[handler, data]}` is a first-class Solid idiom; dropping it
    // would silently swallow the caller's handler.
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick.mock.calls[0][0]).toBe('mirror')
    expect(link).toHaveAttribute('aria-busy', 'true')
  })

  it('gives up spinning when the page comes back from the back button', async () => {
    render(() => <BusyLink href="/mirror">Mirror</BusyLink>)
    const link = screen.getByRole('link', { name: 'Mirror' })
    link.dispatchEvent(leftClick())
    expect(link).toHaveAttribute('aria-busy', 'true')

    // Safari restores this document from the back/forward cache with its DOM
    // intact — without this the user returns to a button still spinning for
    // a navigation that finished and was walked back from.
    window.dispatchEvent(new Event('pageshow'))

    await waitFor(() => expect(link).not.toHaveAttribute('aria-busy'))
  })

  it('lets go on its own if the navigation never happens', () => {
    vi.useFakeTimers()
    try {
      render(() => <BusyLink href="/mirror">Mirror</BusyLink>)
      const link = screen.getByRole('link', { name: 'Mirror' })
      link.dispatchEvent(leftClick())
      expect(link).toHaveAttribute('aria-busy', 'true')

      vi.advanceTimersByTime(20_000)

      expect(link).not.toHaveAttribute('aria-busy')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('BusyButton', () => {
  it('waits for exactly as long as the work does', async () => {
    let release!: () => void
    const work = new Promise<void>((resolve) => {
      release = resolve
    })
    render(() => (
      <BusyButton busyLabel="Loading the intro…" onClick={() => work}>
        Replay the intro
      </BusyButton>
    ))

    const button = screen.getByRole('button', { name: /Replay the intro/ })
    fireEvent.click(button)

    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'))
    expect(button).toBeDisabled()

    release()

    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
    expect(button).not.toBeDisabled()
  })

  it('stops waiting when the work fails', async () => {
    render(() => (
      <BusyButton onClick={() => Promise.reject(new Error('offline'))}>
        Replay the intro
      </BusyButton>
    ))
    const button = screen.getByRole('button', { name: /Replay the intro/ })

    fireEvent.click(button)

    // A chunk that fails to load must not leave the control dead forever.
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
    expect(button).not.toBeDisabled()
  })

  it('refuses a second press while the first is still running', async () => {
    const onClick = vi.fn(() => new Promise<void>(() => {}))
    render(() => <BusyButton onClick={onClick}>Go</BusyButton>)
    const button = screen.getByRole('button', { name: /Go/ })

    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    button.dispatchEvent(leftClick())

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('refuses a second press that arrives in the same tick as the first', () => {
    // `disabled` only lands once the render flushes; two taps of an impatient
    // finger (or a double-click) can both be dispatched before it does. The
    // guard, not the attribute, is what makes the second press a no-op.
    const onClick = vi.fn(() => new Promise<void>(() => {}))
    render(() => <BusyButton onClick={onClick}>Go</BusyButton>)
    const button = screen.getByRole('button', { name: /Go/ })

    button.dispatchEvent(leftClick())
    button.dispatchEvent(leftClick())

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not spin for a handler with nothing to wait for', () => {
    const onClick = vi.fn()
    render(() => <BusyButton onClick={onClick}>Mute</BusyButton>)
    const button = screen.getByRole('button', { name: /Mute/ })

    // Most buttons do their work synchronously. A spinner here would flash
    // and, worse, disable the control for a beat for no reason.
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledOnce()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(button).not.toBeDisabled()
  })

  it('can be told it is busy by whoever owns the work', () => {
    render(() => <BusyButton busy>Go</BusyButton>)

    const button = screen.getByRole('button', { name: /Go/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })

  it('does not announce a spinner that duplicates its own label', () => {
    render(() => <BusyButton busy>Go</BusyButton>)

    // The default label is generic on purpose; what must never happen is an
    // aria-hidden spinner with no announcement at all on a disabled control.
    expect(screen.getByRole('status')).toHaveTextContent('Working…')
  })
})

describe('Spinner', () => {
  it('takes its diameter as a number of pixels or as a length', () => {
    render(() => <Spinner size={28} label="Loading" />)
    expect(screen.getByTestId('spinner')).toHaveStyle({
      '--spinner-size': '28px',
    })
  })

  it('passes a length through untouched', () => {
    render(() => <Spinner size="2rem" label="Loading" />)
    expect(screen.getByTestId('spinner')).toHaveStyle({
      '--spinner-size': '2rem',
    })
  })

  it('stays silent when it has nothing of its own to say', () => {
    render(() => <Spinner />)

    // Inside a control that already announces itself, a second live region
    // repeating the same thing is noise; the spinner becomes decoration.
    const spinner = screen.getByTestId('spinner')
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinner).not.toHaveAttribute('role')
    expect(screen.queryByRole('status')).toBeNull()
    expect(spinner).toHaveStyle({ '--spinner-size': '1em' })
  })
})
