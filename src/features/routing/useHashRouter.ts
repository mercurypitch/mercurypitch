import type { Accessor, Setter } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { UvrView } from '@/components/UvrPanel'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_JAM, TAB_KARAOKE, TAB_SETTINGS } from '@/features/tabs/constants'
import type { HashRoute } from '@/lib/hash-router'
import { buildHash, parseHash, replaceHash } from '@/lib/hash-router'
import type { SettingsSection } from '@/stores/ui-store'

export interface UseHashRouterDeps {
  // Route handlers (hash → state)
  // Plain-value setter: the store wraps the raw signal setter with the
  // tab-transition cleanup hook, so it is no longer a Solid Setter.
  setActiveTab: (tab: ActiveTab) => void
  setInitialUvrView: Setter<UvrView | null>
  setInitialUvrSessionId: Setter<string | null>
  setActiveUvrSessionId: Setter<string | null>
  openLearningWalkthrough: () => void
  openWalkthroughChapter: (id: string) => void
  startWalkthrough: (sectionIds?: string[]) => void
  setShowGuideSelection: Setter<boolean>
  setJamRoomToJoin: Setter<string | null>
  dismissWelcome: () => void
  handleShareMelody: (payload: string) => void
  handleShareExercise: (payload: string) => void
  handleShareRoutine: (payload: string) => void
  handleShareFallback: (shareType: string, shareId: string) => void
  handleShareShort: (shortId: string) => void
  /** Return from Stripe checkout — toast + balance refresh happen here;
   *  the route itself lands on Settings -> Credits. */
  handleBillingReturn: (outcome: 'success' | 'cancel') => void
  /** Open Settings with a specific sub-tab (deep links + billing return). */
  openSettingsSection: (section: SettingsSection) => void
  /** Current Settings sub-tab — synced into #/settings/<slug>. */
  settingsSection: Accessor<SettingsSection>
  /** Open the owner-only weekly-challenge authoring overlay. */
  openAdminWeekly: () => void
  /** Whether that overlay is open (keeps the tab→hash sync off it). */
  showAdminWeekly: Accessor<boolean>

  // State signals (state → hash)
  activeTab: Accessor<ActiveTab>
  activeUvrView: Accessor<UvrView>
  activeUvrSessionId: Accessor<string | null>
  showSelection: Accessor<boolean>
  walkthroughModalOpen: Accessor<boolean>
  showGuideSelection: Accessor<boolean>
  selectedWalkthrough: Accessor<string | null>
}

export function useHashRouter(deps: UseHashRouterDeps): void {
  let hashSyncing = false
  // The state→hash sync effects must not run until the initial route has been
  // restored from the URL on mount — otherwise the default tab (singing) would
  // overwrite the preserved hash (e.g. #/piano) before it's read, sending every
  // reload back to Singing.
  const [initialized, setInitialized] = createSignal(false)

  const dispatchRoute = (route: HashRoute) => {
    hashSyncing = true
    if (route.type === 'tab') {
      deps.setActiveTab(route.tab)
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'uvr-upload') {
      deps.setActiveTab(TAB_KARAOKE)
      deps.setInitialUvrView('upload')
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'uvr-session') {
      deps.setActiveTab(TAB_KARAOKE)
      deps.setInitialUvrSessionId(route.sessionId)
      deps.setInitialUvrView('results')
      deps.setActiveUvrSessionId(route.sessionId)
    } else if (route.type === 'uvr-session-mixer') {
      deps.setActiveTab(TAB_KARAOKE)
      deps.setInitialUvrSessionId(route.sessionId)
      deps.setInitialUvrView('mixer')
      deps.setActiveUvrSessionId(route.sessionId)
    } else if (route.type === 'share-load') {
      if (route.shareType === 'melody') deps.handleShareMelody(route.payload)
      else if (route.shareType === 'exercise')
        deps.handleShareExercise(route.payload)
      else if (route.shareType === 'routine')
        deps.handleShareRoutine(route.payload)
    } else if (route.type === 'share-short') {
      deps.handleShareShort(route.shortId)
    } else if (route.type === 'share-fallback') {
      deps.handleShareFallback(route.shareType, route.shareId)
    } else if (route.type === 'learn') {
      deps.openLearningWalkthrough()
    } else if (route.type === 'learn-chapter') {
      deps.openWalkthroughChapter(route.chapterId)
    } else if (route.type === 'guide') {
      deps.setShowGuideSelection(true)
    } else if (route.type === 'jam-room') {
      deps.dismissWelcome()
      deps.setActiveTab(TAB_JAM)
      deps.setJamRoomToJoin(route.roomId)
    } else if (route.type === 'guide-start') {
      const sectionIds =
        route.sectionId === 'all' ? undefined : [route.sectionId]
      deps.startWalkthrough(sectionIds)
    } else if (route.type === 'settings-section') {
      deps.openSettingsSection(route.section)
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'admin-weekly') {
      deps.dismissWelcome()
      deps.openAdminWeekly()
    } else if (route.type === 'billing-return') {
      deps.dismissWelcome()
      deps.openSettingsSection('credits')
      deps.setActiveUvrSessionId(null)
      deps.handleBillingReturn(route.outcome)
      // Clean the one-shot return hash so a reload can't re-fire the toast
      // (the tab-sync effect is muted by hashSyncing here). replaceState
      // fires no hashchange, so this can't loop.
      replaceHash({ type: 'settings-section', section: 'credits' })
    }
    hashSyncing = false
  }

  const onHashChange = () => {
    dispatchRoute(parseHash(window.location.hash))
  }

  onMount(() => {
    dispatchRoute(parseHash(window.location.hash))
    setInitialized(true)
    window.addEventListener('hashchange', onHashChange)
  })

  onCleanup(() => {
    window.removeEventListener('hashchange', onHashChange)
  })

  // Sync activeTab + UvrPanel state → URL hash
  createEffect(() => {
    // Read every tracked signal BEFORE any early return: Solid re-collects
    // dependencies per run, so bailing out first (e.g. while hashSyncing is
    // set during a dispatch) would drop the activeTab subscription and leave
    // the effect dormant — the URL then goes stale on the next tab change
    // (seen with the App Mode guard redirecting away from a deep link).
    const tab = deps.activeTab()
    const view = deps.activeUvrView()
    const sessionId = deps.activeUvrSessionId()
    const settingsSection = deps.settingsSection()
    const surfaceOpen =
      deps.showSelection() ||
      deps.walkthroughModalOpen() ||
      deps.showGuideSelection() ||
      deps.showAdminWeekly()
    if (!initialized() || hashSyncing) return
    if (surfaceOpen) return
    if (tab === TAB_SETTINGS) {
      // Settings carries its sub-tab in the URL (#/settings/<slug>) so each
      // section is deep-linkable.
      const route: HashRoute = {
        type: 'settings-section',
        section: settingsSection,
      }
      const expectedHash = `#${buildHash(route)}`
      if (window.location.hash !== expectedHash) {
        replaceHash(route)
      }
      return
    }
    if (tab !== TAB_KARAOKE) {
      const expectedHash = `#/${tab}`
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'tab', tab })
      }
      return
    }
    let route: HashRoute
    if (view === 'results' && sessionId !== null) {
      route = { type: 'uvr-session', sessionId }
    } else if (view === 'mixer' && sessionId !== null) {
      route = { type: 'uvr-session-mixer', sessionId }
    } else {
      route = { type: 'uvr-upload' }
    }
    const expectedHash = `#${buildHash(route)}`
    if (window.location.hash !== expectedHash) {
      replaceHash(route)
    }
  })

  // Sync walkthrough/guide state → URL hash
  createEffect(() => {
    // Same read-before-bail rule as above.
    const modalOpen = deps.walkthroughModalOpen()
    const walkthroughId = deps.selectedWalkthrough()
    const selectionOpen = deps.showSelection()
    const guideOpen = deps.showGuideSelection()
    if (!initialized() || hashSyncing) return
    if (modalOpen && walkthroughId !== null) {
      const expectedHash = `#/learn/${walkthroughId}`
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'learn-chapter', chapterId: walkthroughId })
      }
    } else if (selectionOpen) {
      const expectedHash = '#/learn'
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'learn' })
      }
    } else if (guideOpen) {
      const expectedHash = '#/guide'
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'guide' })
      }
    }
  })
}
