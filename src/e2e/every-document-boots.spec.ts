// ============================================================
// Every document the build emits boots
// ============================================================
//
// The chunk layout is decided by the bundler, and a mistake in it has one
// symptom: a page that never paints. A chunk that did not arrive, or two
// chunks that import each other and read a binding before it exists, throws
// before the app has mounted anything -- and no unit test, type check or
// build step sees it. Only loading the document does.
//
// Most rooms have specs of their own that would catch this. The crawlable
// doors (the vocal range test, the vocal remover, ...) mostly do not, and
// they are the pages a stranger lands on first. So this walks the same model
// the build does: a new entry page is covered the day it is added.

import { expect, test } from '@playwright/test'
import { ENTRY_PAGES } from '../seo/entry-pages'

const DOCUMENTS = [
  'index.html',
  ...ENTRY_PAGES.map((page) => `${page.slug}.html`),
]

for (const name of DOCUMENTS) {
  test(`${name}: every script arrives, nothing throws, the app mounts @smoke`, async ({
    page,
  }) => {
    const thrown: string[] = []
    const missing: string[] = []
    page.on('pageerror', (error) => thrown.push(error.message))
    page.on('response', (response) => {
      if (response.url().includes('/assets/') && response.status() >= 400) {
        missing.push(`${response.status()} ${response.url()}`)
      }
    })
    page.on('requestfailed', (request) => {
      if (request.url().includes('/assets/')) {
        missing.push(`failed ${request.url()}`)
      }
    })

    await page.goto(`/${name}`)

    // The prelude under #root is static HTML and is there either way. The
    // app having put something IN #root is what says the scripts ran.
    await expect(page.locator('#root')).not.toBeEmpty()
    expect(missing, 'a script the document asked for did not arrive').toEqual(
      [],
    )
    expect(thrown, 'the page threw while booting').toEqual([])
  })
}
