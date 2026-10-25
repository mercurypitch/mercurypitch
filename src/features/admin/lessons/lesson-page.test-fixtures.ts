// ============================================================
// Lessons page readers — where the page's tests look, as the owner looks
// ============================================================
//
// The season table by row and column, a lesson's card, the live region,
// and the moment the page has settled: the site checked and the lesson
// state read. Shared by the page's two test files, so a change to the
// page's shape is fixed in one place.

import { screen, waitFor, within } from '@solidjs/testing-library'
import { expect } from 'vitest'

/** The season table's body rows, the trailer first. */
export function seasonRows(): HTMLElement[] {
  const table = screen.getByRole('table', { name: /^Season 1/ })
  const [, body] = within(table).getAllByRole('rowgroup')
  return within(body).getAllByRole('row')
}

/**
 * Lesson `n`'s cell in column `index`: 0 is "Published here", 1 "In this
 * build", 2 "Site answers", then Sitemap, llms.txt and Film.
 */
export function cellOf(n: number, index: number): HTMLElement {
  return within(seasonRows()[n]).getAllByRole('cell')[index]
}

/** One column's text down the whole season, indexed as `cellOf`. */
export function column(index: number): string[] {
  return seasonRows().map(
    (row) => within(row).getAllByRole('cell')[index].textContent ?? '',
  )
}

/** Lesson `n`'s card. */
export function card(n: number): HTMLElement {
  // A card is a <details>, role group like the pickers inside it, so its
  // lesson number is what tells it apart.
  const found = document.querySelector<HTMLElement>(
    `details[data-lesson="${n}"]`,
  )
  if (found === null) throw new Error(`no card for lesson ${n}`)
  return found
}

/** Open lesson `n`'s card from its row, as the owner does. */
export function openCard(n: number): HTMLElement {
  const [link] = within(seasonRows()[n]).getAllByRole('button')
  link.click()
  return card(n)
}

/** The polite live region that announces every save. */
export function liveRegion(): HTMLElement {
  return screen.getByRole('status')
}

/**
 * The site checked and the lesson state read.
 *
 * Polled on the two texts that say so, a millisecond or two each. A role
 * query names every button on the page, over fifty once the state is read,
 * and a failed `getBy` prints the whole page into its error: polling with
 * those cost about a second a test. The button is then asked for by role
 * and name once, among its own row's controls.
 */
export async function settled(): Promise<void> {
  await waitFor(() => {
    expect(
      screen.queryByText('Check again', { selector: 'button' }),
      'the site checked',
    ).not.toBeNull()
    expect(
      screen.queryByText(/^Lesson state read at/, { selector: 'span' }),
      'the lesson state read',
    ).not.toBeNull()
  })
  const button = screen.getByText('Check again', { selector: 'button' })
  expect(
    within(button.parentElement ?? document.body).getByRole('button', {
      name: 'Check again',
    }),
  ).not.toHaveAttribute('aria-disabled')
}
