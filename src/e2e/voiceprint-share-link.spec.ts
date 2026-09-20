// ============================================================
// A voiceprint that arrived by link — end-to-end
// ============================================================
//
// The share card is generated hundreds of times a month and used to send
// its recipient to the generic Mirror, where a stranger found an empty
// instrument asking them to sing. Shared sessions averaged three seconds.
//
// These tests hold the fix in place: the link carries the voiceprint, and
// the recipient sees it before they are asked for anything. See
// docs/plans/voiceprint-share-link.md.

import { expect, test } from '@playwright/test'

/** { v:1, t:'voiceprint', d:{ lo:48, hi:74, st:26, ac:12, sd:9, tw:'Freddie Mercury' } } */
const PAYLOAD =
  'eyJ2IjoxLCJ0Ijoidm9pY2VwcmludCIsImQiOnsibG8iOjQ4LCJoaSI6NzQsInN0IjoyNiwiYWMiOjEyLCJzZCI6OSwidHciOiJGcmVkZGllIE1lcmN1cnkifX0'

/** The same take with no twin named — the card cannot be drawn from it. */
const PAYLOAD_NO_TWIN =
  'eyJ2IjoxLCJ0Ijoidm9pY2VwcmludCIsImQiOnsibG8iOjQ4LCJoaSI6NzQsInN0IjoyNiwiYWMiOjEyLCJzZCI6OX19'

const LANDING_CTA = /Find my voice twin/i

test.describe('a voiceprint that arrived by link', () => {
  test('opens on the card that was sent, not on an invitation to sing', async ({
    page,
  }) => {
    await page.goto(
      `/mirror?v=${PAYLOAD}&utm_source=voiceprint&utm_medium=share`,
    )

    await expect(page.getByText('Someone sent you this')).toBeVisible()
    await expect(page.locator('.shared-vp-figure canvas')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Meet your voice' }),
    ).toBeVisible()

    // The ordinary landing must stand down while someone else's card is up.
    await expect(page.getByRole('button', { name: LANDING_CTA })).toHaveCount(0)
  })

  test("draws the sender's actual card, not a written summary of it", async ({
    page,
  }) => {
    await page.goto(`/mirror?v=${PAYLOAD}`)
    await expect(page.locator('.shared-vp-figure canvas')).toBeVisible()

    // The card draws the range, the span, the twin and both metrics. Saying
    // them again underneath is the same information twice on one screen.
    //
    // Scoped to this section: "Accuracy" and the note names also occur in the
    // Mirror's own copy elsewhere in the document, so a page-wide locator
    // fails on text that has nothing to do with the shared card.
    const shared = page.locator('.shared-vp')
    await expect(shared.locator('.shared-vp-card')).toHaveCount(0)
    await expect(shared.getByText('C3 – D5')).toHaveCount(0)
    await expect(shared.getByText('2 octaves + 2 semitones')).toHaveCount(0)
    await expect(shared.getByText('Accuracy')).toHaveCount(0)
  })

  test('falls back to the written numbers when no twin was named', async ({
    page,
  }) => {
    await page.goto(`/mirror?v=${PAYLOAD_NO_TWIN}`)

    const shared = page.locator('.shared-vp')
    await expect(page.getByText('Someone sent you this')).toBeVisible()
    await expect(shared.getByText('C3 – D5')).toBeVisible()
    // No drawable card, and no broken frame where one would go.
    await expect(shared.locator('.shared-vp-figure')).toHaveCount(0)
  })

  test('hands off to the recipient and drops the payload from the address bar', async ({
    page,
  }) => {
    await page.goto(`/mirror?v=${PAYLOAD}`)
    await page.getByRole('button', { name: 'Meet your voice' }).click()

    await expect(page.getByText('Someone sent you this')).toHaveCount(0)
    // A reload or a back-navigation must not replay the sender's card.
    expect(new URL(page.url()).searchParams.get('v')).toBeNull()
  })

  test('falls back to the ordinary Mirror when the payload is malformed', async ({
    page,
  }) => {
    await page.goto('/mirror?v=not-a-real-payload')

    await expect(page.getByText('Someone sent you this')).toHaveCount(0)
    await expect(page.getByRole('button', { name: LANDING_CTA })).toBeVisible()
  })

  test('refuses a share payload that is not a voiceprint', async ({ page }) => {
    // A valid melody share link. Rendering it as somebody's voice would be
    // worse than ignoring it.
    const melody =
      'eyJ2IjoxLCJ0IjoibWVsb2R5IiwiZCI6eyJuIjoiWCIsImIiOjEyMCwiaSI6W119fQ'
    await page.goto(`/mirror?v=${melody}`)

    await expect(page.getByText('Someone sent you this')).toHaveCount(0)
    await expect(page.getByRole('button', { name: LANDING_CTA })).toBeVisible()
  })
})
