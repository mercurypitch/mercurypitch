// ============================================================
// EntryFaq: the document's questions, borrowed into the room and given back
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { EntryFaq } from './EntryFaq'

/** The prelude an entry document carries after #root, as render-entry-page.ts writes it. */
function prelude(keeps: string): HTMLElement {
  const host = document.createElement('div')
  host.className = 'entry-prelude'
  host.dataset.keeps = keeps
  host.innerHTML = `
    <h1>Voice type test</h1>
    <section class="entry-prelude__faq">
      <h2>How do I find out my voice type?</h2>
      <p>Sing a comfortable siren from low to high and back down.</p>
    </section>
    <nav class="entry-prelude__legal" aria-label="Legal"></nav>`
  document.body.append(host)
  return host
}

afterEach(() => {
  cleanup()
  document.querySelector('.entry-prelude')?.remove()
})

describe('EntryFaq', () => {
  it('moves the kept questions into the room, the same node, where it stands', () => {
    const host = prelude('faq')
    const faq = host.querySelector('.entry-prelude__faq')

    render(() => (
      <main>
        <p>The room</p>
        <EntryFaq />
        <nav aria-label="Room foot" />
      </main>
    ))

    const slot = document.querySelector('.entry-faq')
    expect(slot?.firstElementChild).toBe(faq)
    expect(host.querySelector('.entry-prelude__faq')).toBeNull()
    expect(slot?.nextElementSibling).toBe(
      screen.getByRole('navigation', { name: 'Room foot' }),
    )
  })

  it('gives them back to the prelude, in their place, when it unmounts, and borrows them again', () => {
    const host = prelude('faq')
    const [shown, setShown] = createSignal(true)
    render(() => (
      <Show when={shown()}>
        <EntryFaq />
      </Show>
    ))

    setShown(false)
    const returned = [...host.children].map((child) => child.className)
    setShown(true)

    expect(returned).toEqual(['', 'entry-prelude__faq', 'entry-prelude__legal'])
    expect(
      document.querySelector('.entry-faq > .entry-prelude__faq h2')
        ?.textContent,
    ).toBe('How do I find out my voice type?')
  })

  // Every other document hides its whole prelude once the room is up.
  it.each([
    ['keeps nothing', null],
    ['keeps its h1', 'h1'],
  ])('draws nothing on a document that %s', (_, keeps) => {
    if (keeps !== null) prelude(keeps)

    const { container } = render(() => <EntryFaq />)

    expect(container.innerHTML).toBe('')
  })
})
