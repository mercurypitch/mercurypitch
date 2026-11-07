// ============================================================
// The Content Studio's Features page — each switch as it really stands
// ============================================================
//
// The page's read side, whose worth is being right: one card per feature
// the API lists, what it is, what visitors in this environment get and why,
// when its switch last changed, and which environment a switch made here
// reaches. The switch routes are stubbed at `fetch` by a double that keeps
// state as the db-worker does (feature-switches/
// feature-switch-api.test-fixtures.ts). Switching is
// AdminFeaturesPage.switch.test.tsx.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminFeaturesPageProps } from './AdminFeaturesPage'
import { AdminFeaturesPage } from './AdminFeaturesPage'
import type { FakeFeatureApi } from './feature-switches/feature-switch-api.test-fixtures'
import { ADMIN_KEY, fakeFeatureApi, held, stubFeatureApi, } from './feature-switches/feature-switch-api.test-fixtures'
import { FEATURE_ABOUT } from './feature-switches/feature-switch-copy'
import { DEVELOPMENT, factOf, featureCard, featureCards, PRODUCTION, settled, } from './feature-switches/feature-switch-page.test-fixtures'

function renderPage(
  api: FakeFeatureApi = fakeFeatureApi(),
  props: Partial<AdminFeaturesPageProps> = {},
) {
  stubFeatureApi(api)
  render(() => (
    <AdminFeaturesPage
      adminKey={ADMIN_KEY}
      environment={DEVELOPMENT}
      buildDefault={false}
      {...props}
    />
  ))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('a feature on the Features page', () => {
  it('says what it is, that visitors here get it, and when it was switched on', async () => {
    renderPage(fakeFeatureApi({ switches: { studio: { enabled: true } } }))
    await settled()

    const card = featureCard('Studio')
    expect(card).toHaveTextContent(FEATURE_ABOUT.studio.about)
    expect(card).toHaveTextContent('On for visitors here')
    expect(factOf(card, 'Where')).toBe(FEATURE_ABOUT.studio.where)
    expect(factOf(card, 'Switch')).toBe('Switched on here')
    expect(factOf(card, 'Last changed')).toBe('Oct 20, 2:02 PM')
    expect(
      within(card).getByRole('button', { name: 'Studio: On' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(card).getByRole('button', { name: 'Studio: Off' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it.each([
    [false, 'Off', 'off'],
    [true, 'On', 'on'],
  ])(
    "with no switch stands on the build's default (%s), and says what that default is here",
    async (buildDefault, visitors, word) => {
      renderPage(fakeFeatureApi(), { buildDefault })
      await settled()

      const card = featureCard('Studio')
      expect(card).toHaveTextContent(`${visitors} for visitors here`)
      expect(factOf(card, 'Switch')).toBe(
        `No switch set: the build's default, ${word} here`,
      )
      expect(factOf(card, 'Last changed')).toBe('No switch is set here')
      expect(
        within(card).getByRole('button', {
          name: `Studio: Build default, ${word} here`,
        }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('admin-features')).toHaveTextContent(
        `This build's default: ${word}`,
      )
    },
  )

  it('is listed under its own name when this build does not know it, its switch still in reach', async () => {
    renderPage(fakeFeatureApi({ listed: ['studio', 'karaoke-v2'] }))
    await settled()

    const card = featureCard('karaoke-v2')
    expect(card).toHaveTextContent(
      'This build of the app does not know this feature yet',
    )
    expect(
      within(card).getByRole('button', { name: 'karaoke-v2: On' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(featureCards()).toHaveLength(2)
  })
})

describe('the Features page', () => {
  it('says that a switch reaches visitors on their next page load, and only in this environment', async () => {
    renderPage(fakeFeatureApi(), { environment: PRODUCTION })
    await settled()

    const page = screen.getByTestId('admin-features')
    expect(page).toHaveTextContent(
      'Visitors get it on their next page load, within about 30 s.',
    )
    expect(page).toHaveTextContent(
      "Each environment has its own switches, development and production alike, and the ones here are production's: they reach every visitor to mercurypitch.com. The dev site keeps its own.",
    )
    expect(screen.getByText(PRODUCTION.label)).toHaveAttribute(
      'data-tone',
      'prod',
    )
  })

  it('says a dev console never reaches production', async () => {
    renderPage()
    await settled()

    expect(screen.getByTestId('admin-features')).toHaveTextContent(
      "the ones here are the development environment's. Production (mercurypitch.com) keeps its own, and nothing set here reaches it.",
    )
    expect(screen.getByText(DEVELOPMENT.label)).toHaveAttribute(
      'data-tone',
      'other',
    )
  })

  it('says it is reading while the first read is out, then lists what it read', async () => {
    const api = fakeFeatureApi()
    const gate = held()
    api.holdNextRead = gate.promise
    renderPage(api)

    const waiting = await screen.findByText('Reading the switches…')
    expect(waiting).toHaveAttribute('role', 'status')
    expect(featureCards()).toEqual([])

    gate.release()
    await settled()
    expect(featureCard('Studio')).toHaveTextContent('Off for visitors here')
    expect(screen.queryByText('Reading the switches…')).toBeNull()
  })

  it('says why the list could not be read, and reads it again on request', async () => {
    const api = fakeFeatureApi()
    api.failNextRead = 'offline'
    renderPage(api)

    const problem = await screen.findByText(/^The switches could not be read/)
    expect(problem).toHaveTextContent(
      'The switches could not be read. The API could not be reached.',
    )
    expect(featureCards()).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    await settled()
    expect(featureCard('Studio')).toHaveTextContent('Off for visitors here')
    expect(api.reads).toBe(2)
  })

  it('says the API refused the key, and offers to change it', async () => {
    const onChangeKey = vi.fn()
    renderPage(fakeFeatureApi(), { adminKey: 'wrong-key', onChangeKey })

    const notice = await screen.findByText(/^The admin key was not accepted/)
    expect(notice).toHaveTextContent(
      'The admin key was not accepted, so this page cannot read or change the switches. Change admin key to unlock the studio again.',
    )
    expect(featureCards()).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Change admin key' }))
    expect(onChangeKey).toHaveBeenCalledTimes(1)
  })
})
