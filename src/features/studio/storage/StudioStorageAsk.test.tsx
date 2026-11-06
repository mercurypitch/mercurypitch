// Studio storage ask — the first-import question: Full quality preselected, the counts each choice fits, a remember tick, and Escape, the trap and the answer.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { createStudioStorageAsk } from './studio-storage-ask'
import { StudioStorageAsk } from './StudioStorageAsk'

afterEach(cleanup)

function mountAsk() {
  const ask = createStudioStorageAsk()
  render(() => <StudioStorageAsk ask={ask} />)
  return ask
}

const question = () =>
  screen.getByRole('alertdialog', {
    name: 'How should Studio keep your audio?',
  })
const full = () => screen.getByRole('radio', { name: /^Full quality/ })
const compact = () => screen.getByRole('radio', { name: /^Save space/ })
const remember = () =>
  screen.getByRole('checkbox', { name: 'Remember my choice' })

describe('Studio storage ask', () => {
  it('opens on a request with Full quality chosen, the counts each choice fits, and nothing remembered', async () => {
    const ask = mountAsk()
    expect(screen.queryByRole('alertdialog')).toBeNull()

    void ask.request()

    expect(question()).toHaveAttribute('aria-modal', 'true')
    expect(full()).toBeChecked()
    expect(compact()).not.toBeChecked()
    expect(remember()).not.toBeChecked()
    expect(full().closest('label')).toHaveTextContent(
      'About 3 four-minute stereo tracks fit in a song.',
    )
    expect(compact().closest('label')).toHaveTextContent(
      'About 5 four-minute stereo tracks fit in a song.',
    )
    expect(question()).toHaveTextContent(
      'You can change it later in Song options.',
    )
    // The trap puts the focus on the choice, inside the dialog.
    await Promise.resolve()
    expect(full()).toHaveFocus()
  })

  it('answers with the choice and the tick when Add audio is pressed', async () => {
    const ask = mountAsk()
    const answered = ask.request()

    fireEvent.click(compact())
    fireEvent.click(remember())
    fireEvent.click(screen.getByRole('button', { name: 'Add audio' }))

    await expect(answered).resolves.toEqual({
      quality: 'compact',
      remember: true,
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('cancels with Escape, and asks again from Full quality with nothing ticked', async () => {
    const ask = mountAsk()
    const first = ask.request()
    fireEvent.click(compact())
    fireEvent.click(remember())

    fireEvent.keyDown(question(), { key: 'Escape' })

    await expect(first).resolves.toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    void ask.request()
    expect(full()).toBeChecked()
    expect(remember()).not.toBeChecked()
  })

  it('keeps Tab inside the question', async () => {
    const ask = mountAsk()
    void ask.request()
    const add = screen.getByRole('button', { name: 'Add audio' })
    add.focus()

    fireEvent.keyDown(add, { key: 'Tab' })

    expect(full()).toHaveFocus()
  })

  it('closes unanswered when the import it holds is cancelled', async () => {
    const ask = mountAsk()
    const abort = new AbortController()
    const answered = ask.request(abort.signal)

    abort.abort()

    await expect(answered).resolves.toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
