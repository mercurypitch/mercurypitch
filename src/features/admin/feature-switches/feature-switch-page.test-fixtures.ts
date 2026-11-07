// ============================================================
// Features page readers — where the page's tests look, as the owner looks
// ============================================================
//
// A feature's card, one of its facts, the live region, and the moment the
// page has settled: the switches read. Shared by the page's two test files,
// so a change to the page's shape is fixed in one place.

import { screen, waitFor, within } from '@solidjs/testing-library'
import { expect } from 'vitest'
import type { AdminEnvironment } from '../admin-environment'

export const DEVELOPMENT: AdminEnvironment = {
  kind: 'development',
  label: 'Development · api-dev.mercurypitch.com',
}

export const PRODUCTION: AdminEnvironment = {
  kind: 'production',
  label: 'Production · api.mercurypitch.com',
}

/** The list of features, apart from the notes under it. */
export function featureList(): HTMLElement {
  return screen.getByRole('list', { name: 'Switches in this environment' })
}

/** The cards on the list, however many: none before the list is read. */
export function featureCards(): HTMLElement[] {
  return within(featureList()).queryAllByRole('listitem')
}

/** Feature `title`'s card, named by its heading. */
export function featureCard(title: string): HTMLElement {
  return within(featureList()).getByRole('listitem', { name: title })
}

/** The text of the fact `term` on a card, its spaces as a reader hears them. */
export function factOf(card: HTMLElement, term: string): string {
  const dt = within(card).getByText(term, { selector: 'dt' })
  return (dt.nextElementSibling?.textContent ?? '').replace(/\s+/g, ' ')
}

/** The polite live region that announces every save, once the list is read. */
export function liveRegion(): HTMLElement {
  return screen.getByRole('status')
}

/** The switches read. */
export async function settled(): Promise<void> {
  await waitFor(() => {
    expect(
      screen.queryByText(/^Switches read at/, { selector: 'span' }),
      'the switches read',
    ).not.toBeNull()
  })
}
