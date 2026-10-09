import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import type { StoreListings } from '@/lib/store-listings'
import { STORE_PREVIEW_VIDEO_URL } from '@/lib/store-listings'
import { StoreChips } from './StoreChips'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

const NOT_LIVE: StoreListings = {
  appStore: { live: false, appleId: '' },
  googlePlay: { live: false, packageName: 'com.irchiinnuss.mercurypitch' },
}

beforeEach(() => {
  build.native = false
})
afterEach(cleanup)

describe('store chips on the voiceprint result', () => {
  it('shows both coming-soon chips on the web, each opening the video', () => {
    render(() => <StoreChips listings={NOT_LIVE} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', STORE_PREVIEW_VIDEO_URL)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      // The name says where the tap goes: a video, not a store page.
      expect(link).toHaveAccessibleName(/video/i)
      expect(link).toHaveAccessibleName(/new tab/i)
      expect(link).toHaveTextContent(/coming soon/i)
    }
    expect(links[0]).toHaveTextContent('App Store')
    expect(links[0]).toHaveAccessibleName(/^Coming soon: App Store\./)
    expect(links[1]).toHaveTextContent('Google Play')
    expect(links[1]).toHaveAccessibleName(/^Coming soon: Google Play\./)

    // No store artwork before a listing is live.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('says beside the chips what the video shows', () => {
    render(() => <StoreChips listings={NOT_LIVE} />)
    expect(screen.getByText(/android tablet/i)).toBeInTheDocument()
  })

  it('renders nothing inside the native app', () => {
    build.native = true
    const { container } = render(() => <StoreChips listings={NOT_LIVE} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/google play/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/app store/i)).not.toBeInTheDocument()
  })

  it('turns a live listing into its official badge, linked to the store', () => {
    render(() => (
      <StoreChips
        listings={{
          appStore: { live: true, appleId: '6740000000' },
          googlePlay: {
            live: false,
            packageName: 'com.irchiinnuss.mercurypitch',
          },
        }}
      />
    ))

    const badge = screen.getByRole('link', {
      name: 'Download on the App Store',
    })
    expect(badge).toHaveAttribute(
      'href',
      'https://apps.apple.com/app/id6740000000',
    )
    expect(badge).toHaveAttribute('target', '_blank')
    expect(badge.getAttribute('rel')).toContain('noopener')
    expect(
      screen.getByRole('img', { name: 'Download on the App Store' }),
    ).toHaveAttribute('src', '/stores/app-store-badge.svg')

    // The other store is still a chip pointing at the video.
    const chip = screen.getByRole('link', { name: /^Coming soon: Google Play/ })
    expect(chip).toHaveAttribute('href', STORE_PREVIEW_VIDEO_URL)
  })

  it('shows both badges, and no video caption, once both stores are live', () => {
    render(() => (
      <StoreChips
        listings={{
          appStore: { live: true, appleId: '6740000000' },
          googlePlay: {
            live: true,
            packageName: 'com.irchiinnuss.mercurypitch',
          },
        }}
      />
    ))

    expect(
      screen.getByRole('link', { name: 'Get it on Google Play' }),
    ).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.irchiinnuss.mercurypitch',
    )
    expect(
      screen.getByRole('img', { name: 'Get it on Google Play' }),
    ).toHaveAttribute('src', '/stores/google-play-badge.png')
    expect(screen.queryByText(/android tablet/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('tells the mount site which store a coming-soon chip names', () => {
    const onChipClick = vi.fn()
    render(() => <StoreChips listings={NOT_LIVE} onChipClick={onChipClick} />)

    fireEvent.click(
      screen.getByRole('link', { name: /^Coming soon: Google Play/ }),
    )
    expect(onChipClick).toHaveBeenLastCalledWith('google-play')
    fireEvent.click(
      screen.getByRole('link', { name: /^Coming soon: App Store/ }),
    )
    expect(onChipClick).toHaveBeenLastCalledWith('app-store')
    expect(onChipClick).toHaveBeenCalledTimes(2)
  })

  it('tells the mount site about a live badge the same way', () => {
    const onChipClick = vi.fn()
    render(() => (
      <StoreChips
        listings={{
          appStore: { live: true, appleId: '6740000000' },
          googlePlay: {
            live: true,
            packageName: 'com.irchiinnuss.mercurypitch',
          },
        }}
        onChipClick={onChipClick}
      />
    ))

    fireEvent.click(screen.getByRole('link', { name: 'Get it on Google Play' }))
    fireEvent.click(
      screen.getByRole('link', { name: 'Download on the App Store' }),
    )
    expect(onChipClick.mock.calls).toEqual([['google-play'], ['app-store']])
  })
})
