// Glassworks entry boundary — the document prelude can paint before the campaign chunk resolves.

import { untrack } from 'solid-js'
import type * as SolidWeb from 'solid-js/web'
import { afterEach, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => {
  return {
    renderedRoots: [] as HTMLElement[],
    unlocks: [] as boolean[],
  }
})

vi.mock('solid-js/web', async (importOriginal) => ({
  ...(await importOriginal<typeof SolidWeb>()),
  render: (view: () => unknown, root: HTMLElement) => {
    view()
    boundary.renderedRoots.push(root)
    return () => undefined
  },
}))

vi.mock('@/lib/pitch-engine-assets', () => ({}))
vi.mock('./host', () => ({
  createMercuryGlassHost: () => ({ onExit: () => undefined }),
}))

afterEach(() => {
  vi.doUnmock('@irchiinnuss/glass-game/campaign')
  vi.unstubAllEnvs()
  window.history.replaceState({}, '', '/')
  document.body.innerHTML = ''
})

it('settles the entry while the campaign chunk is still pending', async () => {
  vi.resetModules()
  boundary.renderedRoots.length = 0
  document.body.innerHTML = '<div id="root"></div>'
  const root = document.getElementById('root')!
  let campaignImportStarted = false
  let releaseCampaign!: () => void
  const campaignReady = new Promise<void>((resolve) => {
    releaseCampaign = resolve
  })
  vi.doMock('@irchiinnuss/glass-game/campaign', async () => {
    campaignImportStarted = true
    await campaignReady
    return { GlassCampaign: () => null }
  })
  const entry = import('./main')

  await vi.waitFor(() => expect(campaignImportStarted).toBe(true))
  const entrySettled = await Promise.race([
    entry.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ])

  expect(entrySettled).toBe(true)
  expect(boundary.renderedRoots).toEqual([])

  releaseCampaign()
  await vi.waitFor(() => expect(boundary.renderedRoots).toEqual([root]))
})

it('keeps the prelude navigation and offers reload when the chunk fails', async () => {
  vi.resetModules()
  boundary.renderedRoots.length = 0
  document.body.innerHTML = `
    <div id="root"></div>
    <div class="entry-prelude">
      <nav><a href="/">Home</a></nav>
    </div>
  `
  let rejectCampaign!: () => void
  const campaignFailure = new Promise<void>((resolve) => {
    rejectCampaign = resolve
  })
  vi.doMock('@irchiinnuss/glass-game/campaign', async () => {
    await campaignFailure
    throw new Error('stale campaign chunk')
  })

  await import('./main')
  rejectCampaign()

  const alert = await vi.waitFor(() => {
    const candidate = document.querySelector<HTMLElement>('[role="alert"]')
    expect(candidate).not.toBeNull()
    return candidate!
  })
  const prelude = document.querySelector('.entry-prelude')!
  expect(document.getElementById('root')).toBeEmptyDOMElement()
  expect(prelude.querySelector('nav a')).toHaveTextContent('Home')
  expect(alert).toHaveTextContent(
    'Glassworks could not finish loading. Reload and try again.',
  )
  expect(alert.querySelector('a')).toHaveAttribute('href', window.location.href)
  expect(boundary.renderedRoots).toEqual([])
})

it.each([
  { development: true, search: '', unlocked: true },
  { development: true, search: '?progression=earned', unlocked: false },
  { development: false, search: '?progression=unlocked', unlocked: false },
])(
  'uses host build policy for campaign access: $development / $search',
  async ({ development, search, unlocked }) => {
    vi.resetModules()
    boundary.unlocks.length = 0
    vi.stubEnv('DEV', development)
    window.history.replaceState({}, '', `/glass-game/${search}`)
    document.body.innerHTML = '<div id="root"></div>'
    vi.doMock('@irchiinnuss/glass-game/campaign', () => ({
      GlassCampaign: (props: { developmentUnlock: boolean }) => {
        untrack(() => boundary.unlocks.push(props.developmentUnlock))
        return null
      },
    }))
    await import('./main')
    await vi.waitFor(() => expect(boundary.unlocks).toEqual([unlocked]))
  },
)
