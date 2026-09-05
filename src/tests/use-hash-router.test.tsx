import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UvrView } from '@/components/UvrPanel'
import { useHashRouter } from '@/features/routing/useHashRouter'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_COMPOSE, TAB_HOME, TAB_KARAOKE, TAB_VOICE_HISTORY, } from '@/features/tabs/constants'
import { acquireLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import type { AdminSection } from '@/stores/ui-store'
import { adminContentSection, registerAdminContentCloseGuard, requestAdminContentSection, requestCloseAdminContentStudio, setAdminContentSection, setShowAdminContentStudio, showAdminContentStudio, } from '@/stores/ui-store'

function mountRouter(options: {
  closeAdminContent: () => boolean
  openAdminContent?: (section: AdminSection) => boolean
  adminContentSection?: AdminSection
  showAdminContentStudio?: boolean
  showSelection?: boolean
  selectedWalkthrough?: string | null
  activeTab?: ActiveTab
  activeUvrView?: UvrView
  activeUvrSessionId?: string | null
  requestActiveTabChange?: (
    tab: ActiveTab,
    onResolved: (accepted: boolean) => void,
  ) => void
}) {
  const setActiveTab = vi.fn()
  const requestActiveTabChange = vi.fn(
    options.requestActiveTabChange ??
      ((_tab: ActiveTab, onResolved: (accepted: boolean) => void) =>
        onResolved(true)),
  )
  const openAdminContent = vi.fn(options.openAdminContent ?? (() => true))
  const closeAdminContent = vi.fn(options.closeAdminContent)
  const closeResetPassword = vi.fn()
  const setVoiceConstellationOpen = vi.fn<(open: boolean) => void>()
  const handleShareMelody = vi.fn()
  const setInitialUvrView = vi.fn()

  const Fixture = () => {
    const [voiceConstellationOpen, setVoiceOpen] = createSignal(false)
    const [whatsNewOpen, setWhatsNewOpen] = createSignal(false)
    useHashRouter({
      setActiveTab,
      requestActiveTabChange,
      setInitialUvrView,
      setInitialUvrSessionId: vi.fn(),
      setActiveUvrSessionId: vi.fn(),
      openLearningWalkthrough: vi.fn(),
      openWalkthroughChapter: vi.fn(),
      startWalkthrough: vi.fn(),
      setShowGuideSelection: vi.fn(),
      setJamRoomToJoin: vi.fn(),
      dismissWelcome: vi.fn(),
      handleShareMelody,
      handleShareExercise: vi.fn(),
      handleShareRoutine: vi.fn(),
      handleShareFallback: vi.fn(),
      handleShareShort: vi.fn(),
      handleBillingReturn: vi.fn(),
      openSettingsSection: vi.fn(),
      settingsSection: () => 'account',
      openAdminContent,
      closeAdminContent,
      showAdminContentStudio: () => options.showAdminContentStudio ?? true,
      openResetPassword: vi.fn(),
      showResetPassword: () => false,
      closeResetPassword,
      openOnboardingMap: vi.fn(),
      setVoiceConstellationOpen: (open) => {
        setVoiceOpen(open)
        setVoiceConstellationOpen(open)
      },
      voiceConstellationOpen,
      setWhatsNewOpen,
      whatsNewOpen,
      adminContentSection: () => options.adminContentSection ?? 'exercises',
      activeTab: () => options.activeTab ?? 'singing',
      activeUvrView: () => options.activeUvrView ?? 'upload',
      activeUvrSessionId: () => options.activeUvrSessionId ?? null,
      showSelection: () => options.showSelection ?? false,
      walkthroughModalOpen: () => false,
      showGuideSelection: () => false,
      selectedWalkthrough: () => options.selectedWalkthrough ?? null,
    })
    return null
  }

  render(() => <Fixture />)
  return {
    closeAdminContent,
    openAdminContent,
    setActiveTab,
    requestActiveTabChange,
    setVoiceConstellationOpen,
    closeResetPassword,
    handleShareMelody,
    setInitialUvrView,
  }
}

describe('tab hash navigation guard', () => {
  it('restores the current tab hash when browser navigation is cancelled', async () => {
    history.replaceState(null, '', '#/voice-history')
    const router = mountRouter({
      activeTab: TAB_VOICE_HISTORY,
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(false),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_VOICE_HISTORY),
    )
    router.setActiveTab.mockClear()
    router.requestActiveTabChange.mockClear()

    history.replaceState(null, '', '#/home')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(window.location.hash).toBe('#/voice-history'))
    expect(router.requestActiveTabChange).toHaveBeenCalledWith(
      TAB_HOME,
      expect.any(Function),
    )
    expect(router.setActiveTab).not.toHaveBeenCalled()
  })

  it('travels back to the accepted entry instead of rewriting the one Back reached', async () => {
    // Rewriting the entry the browser had moved to made it a duplicate of
    // the current screen: every vetoed Back put the real previous page one
    // step further away.
    history.replaceState(null, '', '#/voice-history')
    let accept = true
    const router = mountRouter({
      activeTab: TAB_VOICE_HISTORY,
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(accept),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_VOICE_HISTORY),
    )
    // Two accepted navigations, each its own entry.
    history.pushState(null, '', '#/home')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_HOME),
    )
    history.pushState(null, '', '#/compose')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_COMPOSE),
    )
    router.setActiveTab.mockClear()
    const reached: string[] = []
    window.addEventListener('hashchange', () =>
      reached.push(window.location.hash),
    )

    // Back to Home with unsaved work: vetoed, and undone by travelling
    // forward again -- Home's entry is left as it was.
    accept = false
    history.back()
    await waitFor(() => expect(reached).toEqual(['#/home', '#/compose']))
    expect(window.location.hash).toBe('#/compose')
    expect(router.setActiveTab).not.toHaveBeenCalled()

    // With the veto lifted, one Back lands on Home, not on a copy of Compose.
    accept = true
    history.back()
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_HOME),
    )
    expect(window.location.hash).toBe('#/home')
    expect(reached).toEqual(['#/home', '#/compose', '#/home'])
  })

  it('recognises the return traversal by its stamp, not its hash', async () => {
    // A panel may rewrite the accepted entry's hash behind the router (the
    // jam panel does); dispatching that hash again on the way back would be
    // a navigation nobody made.
    history.replaceState(null, '', '#/voice-history')
    let accept = true
    const router = mountRouter({
      activeTab: TAB_VOICE_HISTORY,
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(accept),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_VOICE_HISTORY),
    )
    history.pushState(null, '', '#/home')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_HOME),
    )
    history.pushState(null, '', '#/compose')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_COMPOSE),
    )
    // The panel's rewrite: same entry, another hash.
    history.replaceState(history.state, '', '#/jam:room-1')
    router.requestActiveTabChange.mockClear()

    // Back to Home, vetoed: the router travels forward again and must not
    // take the rewritten hash it lands on for a navigation.
    accept = false
    history.back()
    await waitFor(() => expect(window.location.hash).toBe('#/jam:room-1'))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(router.requestActiveTabChange).toHaveBeenCalledTimes(1)
    expect(router.requestActiveTabChange).toHaveBeenCalledWith(
      TAB_HOME,
      expect.any(Function),
    )
  })

  it('travels back from a vetoed link push instead of rewriting it', async () => {
    history.replaceState(null, '', '#/voice-history')
    const router = mountRouter({
      activeTab: TAB_VOICE_HISTORY,
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(false),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_VOICE_HISTORY),
    )
    const reached: string[] = []
    window.addEventListener('hashchange', () =>
      reached.push(window.location.hash),
    )
    // A link: a new entry, then the hashchange the router sees.
    history.pushState(null, '', '#/home')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    // Back to the accepted entry by traversal, so the vetoed entry is not
    // rewritten into a copy of it.
    await waitFor(() => expect(reached).toContain('#/voice-history'))
    expect(window.location.hash).toBe('#/voice-history')
    expect(router.setActiveTab).toHaveBeenCalledTimes(1)
  })

  it('ignores position stamps left by another page load', async () => {
    // The entry behind carries a stamp from before the reload. Read against
    // this load's numbering it would send go() past the end of the list.
    history.replaceState(
      { routeIndex: 3, routeEpoch: 'earlier-load' },
      '',
      '#/compose',
    )
    history.pushState(null, '', '#/voice-history')
    // Listening from before the router, so the Back is seen as it arrives
    // and not after the router's synchronous rewrite.
    const reached: string[] = []
    window.addEventListener('hashchange', () =>
      reached.push(window.location.hash),
    )
    const router = mountRouter({
      activeTab: TAB_VOICE_HISTORY,
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(false),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_VOICE_HISTORY),
    )

    const entries = history.length
    history.back()
    await waitFor(() => expect(reached).toEqual(['#/compose']))
    // The old rewrite, not a traversal: the hash is back at once and stays.
    expect(window.location.hash).toBe('#/voice-history')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(reached).toEqual(['#/compose'])
    expect(history.length).toBe(entries)
  })

  it('vetoes a shared melody before importing it and restores voice history', async () => {
    const payload =
      'eyJ2IjoxLCJ0IjoibWVsb2R5IiwiZCI6eyJuIjoiVGVzdCIsImIiOjEyMCwiaSI6W119fQ'
    history.replaceState(null, '', '#/voice-history')
    const router = mountRouter({
      activeTab: TAB_VOICE_HISTORY,
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(false),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_VOICE_HISTORY),
    )
    router.setActiveTab.mockClear()
    router.requestActiveTabChange.mockClear()

    history.replaceState(null, '', `#/share/${payload}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(window.location.hash).toBe('#/voice-history'))
    expect(router.requestActiveTabChange).toHaveBeenCalledWith(
      TAB_COMPOSE,
      expect.any(Function),
    )
    expect(router.handleShareMelody).not.toHaveBeenCalled()
    expect(router.setActiveTab).not.toHaveBeenCalled()
  })

  it('restores the exact Karaoke mixer hash when same-tab navigation is cancelled', async () => {
    history.replaceState(null, '', '#/karaoke/session/song-1/mixer')
    const router = mountRouter({
      activeTab: TAB_KARAOKE,
      activeUvrView: 'mixer',
      activeUvrSessionId: 'song-1',
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      requestActiveTabChange: (_tab, onResolved) => onResolved(false),
    })
    await waitFor(() =>
      expect(router.setActiveTab).toHaveBeenCalledWith(TAB_KARAOKE),
    )
    router.setActiveTab.mockClear()
    router.setInitialUvrView.mockClear()
    router.requestActiveTabChange.mockClear()

    const releaseNavigationLock =
      acquireLocalSaveNavigationLock('karaoke test save')
    history.replaceState(null, '', '#/karaoke/upload')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    releaseNavigationLock()

    await waitFor(() =>
      expect(window.location.hash).toBe('#/karaoke/session/song-1/mixer'),
    )
    expect(router.requestActiveTabChange).toHaveBeenCalledWith(
      TAB_KARAOKE,
      expect.any(Function),
    )
    expect(router.setInitialUvrView).not.toHaveBeenCalled()
    expect(router.setActiveTab).not.toHaveBeenCalled()
  })
})

afterEach(() => {
  cleanup()
  history.replaceState(null, '', '#/singing')
  setShowAdminContentStudio(false)
  setAdminContentSection('exercises')
})

describe('Content Studio hash navigation guard', () => {
  it('restores the admin hash when browser navigation away is cancelled', async () => {
    history.replaceState(null, '', '#/admin/exercises')
    const router = mountRouter({ closeAdminContent: () => false })
    await waitFor(() =>
      expect(router.openAdminContent).toHaveBeenCalledWith('exercises'),
    )
    router.setActiveTab.mockClear()
    router.closeAdminContent.mockClear()

    history.replaceState(null, '', '#/singing')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(window.location.hash).toBe('#/admin/exercises'))
    expect(router.closeAdminContent).toHaveBeenCalledTimes(1)
    expect(router.setActiveTab).not.toHaveBeenCalled()
  })

  it('restores the current section when an admin section change is cancelled', async () => {
    history.replaceState(null, '', '#/admin/exercises')
    const router = mountRouter({
      closeAdminContent: () => true,
      openAdminContent: (section) => section === 'exercises',
    })
    await waitFor(() =>
      expect(router.openAdminContent).toHaveBeenCalledWith('exercises'),
    )
    router.openAdminContent.mockClear()

    history.replaceState(null, '', '#/admin/ascent')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(window.location.hash).toBe('#/admin/exercises'))
    expect(router.openAdminContent).toHaveBeenCalledWith('ascent')
  })
})

describe('Content Studio navigation requests', () => {
  it('keeps the open section intact when the registered guard cancels', () => {
    setAdminContentSection('exercises')
    setShowAdminContentStudio(true)
    const unregister = registerAdminContentCloseGuard(() => false)

    try {
      expect(requestAdminContentSection('ascent')).toBe(false)
      expect(requestCloseAdminContentStudio()).toBe(false)
      expect(adminContentSection()).toBe('exercises')
      expect(showAdminContentStudio()).toBe(true)
    } finally {
      unregister()
    }
    expect(requestAdminContentSection('ascent')).toBe(true)
    expect(adminContentSection()).toBe('ascent')
    expect(requestCloseAdminContentStudio()).toBe(true)
    expect(showAdminContentStudio()).toBe(false)
  })
})

describe('Voice constellation hash navigation', () => {
  it('opens on its deep link and closes when browser navigation leaves it', async () => {
    history.replaceState(null, '', '#/voice-constellation')
    const router = mountRouter({
      closeAdminContent: () => true,
      showAdminContentStudio: false,
    })

    await waitFor(() =>
      expect(router.setVoiceConstellationOpen).toHaveBeenCalledWith(true),
    )
    router.setVoiceConstellationOpen.mockClear()

    history.replaceState(null, '', '#/singing')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() =>
      expect(router.setVoiceConstellationOpen).toHaveBeenCalledWith(false),
    )
  })

  it('keeps guide state sync from replacing the constellation hash', async () => {
    history.replaceState(null, '', '#/voice-constellation')
    const router = mountRouter({
      closeAdminContent: () => true,
      showAdminContentStudio: false,
      showSelection: true,
      selectedWalkthrough: 'practice-toolbar',
    })

    await waitFor(() =>
      expect(router.setVoiceConstellationOpen).toHaveBeenCalledWith(true),
    )
    await waitFor(() =>
      expect(window.location.hash).toBe('#/voice-constellation'),
    )
  })

  it('does not open when unsaved Content Studio work vetoes the route', async () => {
    history.replaceState(null, '', '#/admin/exercises')
    const router = mountRouter({ closeAdminContent: () => false })
    await waitFor(() =>
      expect(router.openAdminContent).toHaveBeenCalledWith('exercises'),
    )
    router.setVoiceConstellationOpen.mockClear()

    history.replaceState(null, '', '#/voice-constellation')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(window.location.hash).toBe('#/admin/exercises'))
    expect(router.setVoiceConstellationOpen).not.toHaveBeenCalledWith(true)
  })

  it('closes password reset before opening the constellation route', async () => {
    history.replaceState(null, '', '#/reset-password?token=abc')
    const router = mountRouter({
      closeAdminContent: () => true,
      showAdminContentStudio: false,
    })
    await waitFor(() =>
      expect(router.setVoiceConstellationOpen).toHaveBeenCalledWith(false),
    )
    expect(router.closeResetPassword).not.toHaveBeenCalled()
    router.setVoiceConstellationOpen.mockClear()

    history.replaceState(null, '', '#/voice-constellation')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() =>
      expect(router.setVoiceConstellationOpen).toHaveBeenCalledWith(true),
    )
    expect(router.closeResetPassword).toHaveBeenCalledTimes(1)
  })
})
