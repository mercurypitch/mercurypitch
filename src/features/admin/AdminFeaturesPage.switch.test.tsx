// ============================================================
// The Content Studio's Features page — switching a feature
// ============================================================
//
// What the owner does here: switch a feature on or off for this
// environment, or hand it back to the build's default, at once on the dev
// site and after a question in production. Each test drives the page as
// the owner would and reads the result where the owner reads it: the
// request the API got, the card after, the line under the switch and the
// live region. The switch routes are stubbed at `fetch` by a double that
// keeps state as the db-worker does (feature-switches/
// feature-switch-api.test-fixtures.ts). The read side is
// AdminFeaturesPage.test.tsx.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminFeaturesPageProps } from './AdminFeaturesPage'
import { AdminFeaturesPage } from './AdminFeaturesPage'
import type { FakeFeatureApi } from './feature-switches/feature-switch-api.test-fixtures'
import { ADMIN_KEY, fakeFeatureApi, held, stubFeatureApi, } from './feature-switches/feature-switch-api.test-fixtures'
import { DEVELOPMENT, factOf, featureCard, liveRegion, PRODUCTION, settled, } from './feature-switches/feature-switch-page.test-fixtures'

const REACHES = 'Visitors get it on their next page load, within about 30 s.'
const CHANGE_REACHES =
  'Visitors get the change on their next page load, within about 30 s.'

function renderPage(
  api: FakeFeatureApi,
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

/** Studio's button for `words`: "On", "Off", or "Build default, off here". */
function studioButton(words: string): HTMLElement {
  return within(featureCard('Studio')).getByRole('button', {
    name: `Studio: ${words}`,
  })
}

/** The line under Studio's switch: what its last save said. */
function studioOutcome(): HTMLElement | null {
  return featureCard('Studio').querySelector('p[data-kind]')
}

const studioOn = () =>
  fakeFeatureApi({ switches: { studio: { enabled: true } } })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('switching a feature on the dev site', () => {
  it('switches it on at once, keeping the focus on the button and saying what visitors get', async () => {
    const api = fakeFeatureApi()
    renderPage(api)
    await settled()

    const on = studioButton('On')
    on.focus()
    fireEvent.click(on)

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        `Studio is switched on here. ${REACHES}`,
      )
    })
    expect(api.saves).toEqual([
      { name: 'studio', body: { enabled: true }, key: ADMIN_KEY },
    ])
    expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(on).toHaveFocus()
    expect(featureCard('Studio')).toHaveTextContent('On for visitors here')
    expect(studioOutcome()).toHaveTextContent(
      `Studio is switched on here. ${REACHES}`,
    )
    await waitFor(() => {
      expect(factOf(featureCard('Studio'), 'Last changed')).toBe(
        'Nov 3, 9:15 AM',
      )
    })
  })

  it('switches it off, the switch the owner pressed now the pressed one', async () => {
    const api = studioOn()
    renderPage(api)
    await settled()

    fireEvent.click(studioButton('Off'))

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        `Studio is switched off here. ${CHANGE_REACHES}`,
      )
    })
    expect(api.saves.map((save) => save.body)).toEqual([{ enabled: false }])
    expect(studioButton('Off')).toHaveAttribute('aria-pressed', 'true')
    expect(studioButton('On')).toHaveAttribute('aria-pressed', 'false')
    expect(factOf(featureCard('Studio'), 'Switch')).toBe('Switched off here')
  })

  it("hands it back to the build's default, saying what that default is here", async () => {
    const api = studioOn()
    renderPage(api)
    await settled()

    fireEvent.click(studioButton('Build default, off here'))

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        `Studio is back on the build's default here: off. ${CHANGE_REACHES}`,
      )
    })
    expect(api.saves.map((save) => save.body)).toEqual([{ enabled: null }])
    expect(api.switches).toEqual({})
    expect(featureCard('Studio')).toHaveTextContent('Off for visitors here')
    expect(factOf(featureCard('Studio'), 'Switch')).toBe(
      "No switch set: the build's default, off here",
    )
  })

  it('sends nothing for the setting already stored', async () => {
    const api = studioOn()
    renderPage(api)
    await settled()

    fireEvent.click(studioButton('On'))
    await Promise.resolve()

    expect(api.saves).toEqual([])
    expect(studioOutcome()).toBeNull()
  })

  it('marks the switch busy while its save is out, and takes no second press', async () => {
    const api = studioOn()
    const gate = held()
    api.holdNextSave = gate.promise
    renderPage(api)
    await settled()

    fireEvent.click(studioButton('Off'))
    await waitFor(() => {
      expect(studioOutcome()).toHaveTextContent('Saving…')
    })
    const group = within(featureCard('Studio')).getByRole('group', {
      name: 'Studio in this environment',
    })
    expect(group).toHaveAttribute('aria-busy', 'true')
    expect(studioButton('Build default, off here')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    fireEvent.click(studioButton('Build default, off here'))
    gate.release()

    await waitFor(() => {
      expect(studioOutcome()).toHaveTextContent('Studio is switched off here.')
    })
    expect(api.saves.map((save) => save.body)).toEqual([{ enabled: false }])
    expect(group).not.toHaveAttribute('aria-busy')
  })

  it('keeps the switch as stored and says why when the API refuses the save', async () => {
    const api = studioOn()
    api.failNextSave = { status: 500, body: { error: 'D1 is unavailable' } }
    renderPage(api)
    await settled()

    fireEvent.click(studioButton('Off'))

    await waitFor(() => {
      expect(studioOutcome()).toHaveTextContent(
        'Studio was not switched: D1 is unavailable.',
      )
    })
    expect(studioOutcome()).toHaveAttribute('data-kind', 'failed')
    expect(liveRegion()).toHaveTextContent(
      'Studio was not switched: D1 is unavailable.',
    )
    expect(studioButton('On')).toHaveAttribute('aria-pressed', 'true')
    expect(studioButton('Off')).toHaveAttribute('aria-pressed', 'false')
  })

  it('says the API could not be reached when the save never lands', async () => {
    const api = fakeFeatureApi()
    api.failNextSave = 'offline'
    renderPage(api)
    await settled()

    fireEvent.click(studioButton('On'))

    await waitFor(() => {
      expect(studioOutcome()).toHaveTextContent(
        'Studio was not switched: the API could not be reached. Check the connection, then try again.',
      )
    })
    expect(studioButton('On')).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers to change the key when a save is refused for it', async () => {
    const api = fakeFeatureApi()
    api.failNextSave = { status: 403, body: { error: 'Admin key required' } }
    const onChangeKey = vi.fn()
    renderPage(api, { onChangeKey })
    await settled()

    fireEvent.click(studioButton('On'))
    await waitFor(() => {
      expect(studioOutcome()).toHaveTextContent(
        'Studio was not switched: the admin key was not accepted. Change admin key to unlock the studio again.',
      )
    })
    fireEvent.click(
      within(featureCard('Studio')).getByRole('button', {
        name: 'Change admin key',
      }),
    )

    expect(onChangeKey).toHaveBeenCalledTimes(1)
  })
})

describe('switching a feature in production', () => {
  it('asks first, saying whom it reaches, and stores nothing on Cancel', async () => {
    const api = fakeFeatureApi()
    renderPage(api, { environment: PRODUCTION })
    await settled()

    fireEvent.click(studioButton('On'))

    const dialog = screen.getByRole('alertdialog', {
      name: 'Switch Studio on in production?',
    })
    expect(dialog).toHaveTextContent(
      'Every visitor to mercurypitch.com gets Studio on their next page load, within about 30 s. The phone app keeps its own default.',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(api.saves).toEqual([])
    expect(studioButton('On')).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches once the owner confirms', async () => {
    const api = fakeFeatureApi()
    renderPage(api, { environment: PRODUCTION })
    await settled()

    fireEvent.click(studioButton('On'))
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Switch on',
      }),
    )

    await waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        `Studio is switched on here. ${REACHES}`,
      )
    })
    expect(api.saves).toEqual([
      { name: 'studio', body: { enabled: true }, key: ADMIN_KEY },
    ])
    expect(studioButton('On')).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    [
      'Off',
      'Switch Studio off in production?',
      "Studio leaves the app for every visitor to mercurypitch.com on their next page load, within about 30 s. A browser that loads offline, or too slowly to hear it, gets it on a later load. Switched off, the tab and its address go; the songs stay in each singer's browser, there again once it is back on.",
      'Switch off',
    ],
    [
      'Build default, off here',
      "Hand Studio back to the build's default in production?",
      "The build's default here is off, so Studio is off for every visitor to mercurypitch.com on their next page load, within about 30 s.",
      'Use build default',
    ],
  ])(
    'asks before %s, in words that say what visitors get',
    async (words, title, message, confirmLabel) => {
      renderPage(studioOn(), { environment: PRODUCTION })
      await settled()

      fireEvent.click(studioButton(words))

      const dialog = screen.getByRole('alertdialog', { name: title })
      expect(dialog).toHaveTextContent(message)
      expect(
        within(dialog).getByRole('button', { name: confirmLabel }),
      ).toHaveAttribute('type', 'button')
    },
  )
})

describe('switching a feature where the console cannot place the address', () => {
  const UNPLACED = { kind: 'unknown', label: 'api.example.test' } as const

  it('asks first, naming the address, since it could be production', async () => {
    const api = fakeFeatureApi()
    renderPage(api, { environment: UNPLACED })
    await settled()

    fireEvent.click(studioButton('On'))

    const dialog = screen.getByRole('alertdialog', {
      name: 'Switch Studio on for api.example.test?',
    })
    expect(dialog).toHaveTextContent(
      'Every visitor to this environment gets Studio on their next page load',
    )
    expect(api.saves).toEqual([])
  })
})

describe('the build default the page names', () => {
  it.each([
    ['production', PRODUCTION, 'off'],
    ['development', DEVELOPMENT, 'on'],
  ] as const)(
    'is the %s environment default, whatever this console bundle defaults to',
    async (_name, environment, word) => {
      // No buildDefault prop at all: renderPage's would win, as Solid's
      // props keep a set value over a later undefined.
      stubFeatureApi(fakeFeatureApi())
      render(() => (
        <AdminFeaturesPage adminKey={ADMIN_KEY} environment={environment} />
      ))
      await settled()

      expect(screen.getByText(/^Build default here:/)).toHaveTextContent(
        `Build default here: ${word}`,
      )
    },
  )
})
