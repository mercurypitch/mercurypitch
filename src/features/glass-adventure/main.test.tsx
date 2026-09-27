// Glassworks entry boundary — the document prelude can paint before the campaign chunk resolves.

import { afterEach, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => {
  return {
    renderedRoots: [] as HTMLElement[],
  }
})

vi.mock('solid-js/web', () => ({
  createComponent: () => null,
  render: (_view: () => unknown, root: HTMLElement) => {
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
