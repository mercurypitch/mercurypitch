import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHashRouter } from '@/features/routing/useHashRouter'
import type { AdminSection } from '@/stores/ui-store'
import { adminContentSection, registerAdminContentCloseGuard, requestAdminContentSection, requestCloseAdminContentStudio, setAdminContentSection, setShowAdminContentStudio, showAdminContentStudio, } from '@/stores/ui-store'

function mountRouter(options: {
  closeAdminContent: () => boolean
  openAdminContent?: (section: AdminSection) => boolean
  adminContentSection?: AdminSection
  showAdminContentStudio?: boolean
  showSelection?: boolean
  selectedWalkthrough?: string | null
}) {
  const setActiveTab = vi.fn()
  const openAdminContent = vi.fn(options.openAdminContent ?? (() => true))
  const closeAdminContent = vi.fn(options.closeAdminContent)
  const closeResetPassword = vi.fn()
  const setVoiceConstellationOpen = vi.fn<(open: boolean) => void>()

  const Fixture = () => {
    const [voiceConstellationOpen, setVoiceOpen] = createSignal(false)
    useHashRouter({
      setActiveTab,
      setInitialUvrView: vi.fn(),
      setInitialUvrSessionId: vi.fn(),
      setActiveUvrSessionId: vi.fn(),
      openLearningWalkthrough: vi.fn(),
      openWalkthroughChapter: vi.fn(),
      startWalkthrough: vi.fn(),
      setShowGuideSelection: vi.fn(),
      setJamRoomToJoin: vi.fn(),
      dismissWelcome: vi.fn(),
      handleShareMelody: vi.fn(),
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
      adminContentSection: () => options.adminContentSection ?? 'exercises',
      activeTab: () => 'singing',
      activeUvrView: () => 'upload',
      activeUvrSessionId: () => null,
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
    setVoiceConstellationOpen,
    closeResetPassword,
  }
}

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
