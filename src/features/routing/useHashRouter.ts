// ============================================================
// useHashRouter — binds the URL hash to app state, both directions
// ============================================================
//
// The app has no file-system router. Adding a route is two edits: the shape
// and parser in @/lib/hash-router.ts, then a handler pair here. This hook owns
// the sync loop -- hash changes drive state, and state changes rewrite the
// hash so back/forward and deep links both work. A TAB change pushes a
// history entry (it is a navigation); sub-state within a tab replaces.
//
// Deep links carry sub-state too (settings section, karaoke view, jam room),
// which is why the deps object is wider than "which tab".

import type { Accessor, Setter } from 'solid-js'
import { batch, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { UvrView } from '@/components/UvrPanel'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_COMPOSE, TAB_EXERCISES, TAB_JAM, TAB_KARAOKE, TAB_SETTINGS, } from '@/features/tabs/constants'
import type { HashRoute } from '@/lib/hash-router'
import { buildHash, parseHash, pushHash, replaceHash } from '@/lib/hash-router'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import { setSyncCodeToJoin } from '@/stores/sync-store'
import type { AdminSection, SettingsSection } from '@/stores/ui-store'
import { setDeviceLinkCode } from '@/stores/ui-store'

export interface UseHashRouterDeps {
  // Route handlers (hash → state)
  // Plain-value setter: the store wraps the raw signal setter with the
  // tab-transition cleanup hook, so it is no longer a Solid Setter.
  setActiveTab: (tab: ActiveTab) => void
  /**
   * Lets the mounted tab veto a hash-driven departure before route-specific
   * state is mutated. The callback may resolve asynchronously through an
   * in-app confirmation dialog.
   */
  requestActiveTabChange?: (
    tab: ActiveTab,
    onResolved: (accepted: boolean) => void,
  ) => void
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
  handleBillingReturn: (
    outcome: 'success' | 'cancel',
    kind: 'credits' | 'donation',
  ) => void
  /** Open Settings with a specific sub-tab (deep links + billing return). */
  openSettingsSection: (section: SettingsSection) => void
  /** Current Settings sub-tab — synced into #/settings/<slug>. */
  settingsSection: Accessor<SettingsSection>
  /** Open the owner-only Content Studio at a specific authoring section. */
  openAdminContent: (section: AdminSection) => boolean
  /** Close the Content Studio when browser navigation leaves /admin. */
  closeAdminContent: () => boolean
  /** Whether the studio is open (keeps tab→hash sync off its route). */
  showAdminContentStudio: Accessor<boolean>
  /** Current studio section, used to restore a cancelled history navigation. */
  adminContentSection: Accessor<AdminSection>
  /** Open the password-reset page (token from the emailed link, or null
   *  for the bare request-a-link form). */
  openResetPassword: (token: string | null) => void
  /** Whether that page is open (keeps the tab→hash sync off it). */
  showResetPassword: Accessor<boolean>
  /** Close reset UI whenever browser navigation leaves its route. */
  closeResetPassword: () => void
  /** Replay the First Light Map (#/map). */
  openOnboardingMap: () => void
  /** Open or close the route-backed Voice Mirror constellation surface. */
  setVoiceConstellationOpen: (open: boolean) => void
  /** Keep state-to-hash sync from erasing the constellation deep link. */
  voiceConstellationOpen: Accessor<boolean>
  /** Open or close the route-backed What's New release page. */
  setWhatsNewOpen: (open: boolean) => void
  /** Keep state-to-hash sync from erasing the What's New deep link. */
  whatsNewOpen: Accessor<boolean>

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
  let lastAcceptedHash = ''
  // The state→hash sync effects must not run until the initial route has been
  // restored from the URL on mount — otherwise the default tab (singing) would
  // overwrite the preserved hash (e.g. #/piano) before it's read, sending every
  // reload back to Singing.
  const [initialized, setInitialized] = createSignal(false)

  const routeDestinationTab = (route: HashRoute): ActiveTab | null => {
    if (route.type === 'tab') return route.tab
    if (route.type === 'share-load') {
      return route.shareType === 'melody' ? TAB_COMPOSE : TAB_EXERCISES
    }
    if (
      route.type === 'uvr-upload' ||
      route.type === 'uvr-sing' ||
      route.type === 'uvr-session' ||
      route.type === 'uvr-session-mixer' ||
      route.type === 'sync-room'
    ) {
      return TAB_KARAOKE
    }
    if (route.type === 'jam-room') return TAB_JAM
    if (route.type === 'settings-section' || route.type === 'billing-return') {
      return TAB_SETTINGS
    }
    return null
  }

  const applyRoute = (route: HashRoute) => {
    hashSyncing = true
    if (
      route.type !== 'admin' &&
      deps.showAdminContentStudio() &&
      !deps.closeAdminContent()
    ) {
      replaceHash({
        type: 'admin',
        section: deps.adminContentSection(),
      })
      hashSyncing = false
      return
    }
    if (route.type === 'admin' && !deps.openAdminContent(route.section)) {
      replaceHash({
        type: 'admin',
        section: deps.adminContentSection(),
      })
      hashSyncing = false
      return
    }
    // Route-owned surfaces update only after guarded Admin navigation accepts
    // the destination. A veto restores /admin with replaceState (no
    // hashchange), so opening anything before this point would stack it over
    // unsaved owner work forever.
    deps.setVoiceConstellationOpen(route.type === 'voice-constellation')
    deps.setWhatsNewOpen(route.type === 'whats-new')
    if (route.type !== 'reset-password') deps.closeResetPassword()
    if (route.type === 'tab') {
      deps.setActiveTab(route.tab)
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'uvr-upload') {
      deps.setActiveTab(TAB_KARAOKE)
      deps.setInitialUvrView('upload')
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'uvr-sing') {
      deps.setActiveTab(TAB_KARAOKE)
      deps.setInitialUvrView('shazam-listen')
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'uvr-session') {
      // One batch: UvrPanel's deep-link effect keys on the session id, and an
      // unbatched write sequence runs it against whichever view value is still
      // standing — the mixer request would be read as the previous view.
      batch(() => {
        deps.setActiveTab(TAB_KARAOKE)
        deps.setInitialUvrSessionId(route.sessionId)
        deps.setInitialUvrView('results')
        deps.setActiveUvrSessionId(route.sessionId)
      })
    } else if (route.type === 'uvr-session-mixer') {
      batch(() => {
        deps.setActiveTab(TAB_KARAOKE)
        deps.setInitialUvrSessionId(route.sessionId)
        deps.setInitialUvrView('mixer')
        deps.setActiveUvrSessionId(route.sessionId)
      })
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
    } else if (route.type === 'onboarding-map') {
      deps.dismissWelcome()
      deps.openOnboardingMap()
    } else if (route.type === 'voice-constellation') {
      // The state write above is the route action. The underlying tab remains
      // mounted so closing the portalled surface returns to the exact context.
    } else if (route.type === 'whats-new') {
      // Same shape as the constellation: the state write above IS the route
      // action, and the tab underneath stays where the reader left it.
    } else if (route.type === 'jam-room') {
      deps.dismissWelcome()
      deps.setActiveTab(TAB_JAM)
      deps.setJamRoomToJoin(route.roomId)
    } else if (route.type === 'sync-room') {
      // Scanned off the receiving device's screen. The songs live in the
      // Karaoke tab, so that is where the sender has to land.
      deps.dismissWelcome()
      deps.setActiveTab(TAB_KARAOKE)
      setSyncCodeToJoin(route.code)
    } else if (route.type === 'device-link') {
      // Scanned off a TV asking to be signed in. This only raises the
      // question; the dialog still has to be confirmed, and it will say
      // so if nobody is signed in on this phone.
      deps.dismissWelcome()
      setDeviceLinkCode(route.code)
    } else if (route.type === 'guide-start') {
      const sectionIds =
        route.sectionId === 'all' ? undefined : [route.sectionId]
      deps.startWalkthrough(sectionIds)
    } else if (route.type === 'settings-section') {
      deps.openSettingsSection(route.section)
      deps.setActiveUvrSessionId(null)
    } else if (route.type === 'admin') {
      deps.dismissWelcome()
    } else if (route.type === 'reset-password') {
      // Emailed link landing — the welcome overlay must not cover the form.
      deps.dismissWelcome()
      deps.openResetPassword(route.token)
    } else if (route.type === 'billing-return') {
      deps.dismissWelcome()
      deps.openSettingsSection('credits')
      deps.setActiveUvrSessionId(null)
      deps.handleBillingReturn(route.outcome, route.kind ?? 'credits')
      // Clean the one-shot return hash so a reload can't re-fire the toast
      // (the tab-sync effect is muted by hashSyncing here). replaceState
      // fires no hashchange, so this can't loop.
      replaceHash({ type: 'settings-section', section: 'credits' })
    }
    hashSyncing = false
  }

  const acceptRoute = (route: HashRoute): void => {
    applyRoute(route)
    lastAcceptedHash = window.location.hash
  }

  const restoreAcceptedHash = (): void => {
    if (lastAcceptedHash !== '') {
      window.history.replaceState(window.history.state, '', lastAcceptedHash)
      return
    }
    replaceHash({ type: 'tab', tab: deps.activeTab() })
  }

  const dispatchRoute = (route: HashRoute) => {
    const routeDestination = routeDestinationTab(route)
    const destination = routeDestination ?? deps.activeTab()
    if (
      route.type !== 'unknown' &&
      deps.requestActiveTabChange !== undefined &&
      (isLocalSaveNavigationLocked() ||
        (routeDestination !== null && routeDestination !== deps.activeTab()))
    ) {
      // Hold state-to-hash syncing while an in-app leave confirmation is open.
      // Nothing route-specific is mutated until the mounted surface accepts.
      hashSyncing = true
      deps.requestActiveTabChange(destination, (accepted) => {
        if (!accepted) {
          restoreAcceptedHash()
          hashSyncing = false
          return
        }
        acceptRoute(route)
      })
      return
    }
    acceptRoute(route)
  }

  const onHashChange = () => {
    dispatchRoute(parseHash(window.location.hash))
  }

  onMount(() => {
    lastAcceptedHash = window.location.hash
    dispatchRoute(parseHash(window.location.hash))
    setInitialized(true)
    window.addEventListener('hashchange', onHashChange)
  })

  onCleanup(() => {
    window.removeEventListener('hashchange', onHashChange)
  })

  /**
   * The tab the URL was last synced to.
   *
   * Every sync used replaceHash, which OVERWRITES the current history
   * entry — so ten tab changes left one entry and Back walked straight
   * off the site instead of returning to the previous tab. Changing tab
   * is a navigation and gets its own entry; changing sub-state within a
   * tab (a UVR view, a settings section) keeps replacing, so Back does
   * not have to be pressed five times to leave one screen.
   */
  let lastSyncedTab: string | null = null

  const syncHash = (route: HashRoute, tab: string): void => {
    const expectedHash = `#${buildHash(route)}`
    if (window.location.hash !== expectedHash) {
      if (lastSyncedTab !== null && lastSyncedTab !== tab) {
        pushHash(route)
      } else {
        replaceHash(route)
      }
    }
    lastAcceptedHash = window.location.hash
    lastSyncedTab = tab
  }

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
      deps.showAdminContentStudio() ||
      deps.showResetPassword() ||
      deps.voiceConstellationOpen() ||
      deps.whatsNewOpen()
    if (!initialized() || hashSyncing) return
    if (surfaceOpen) return
    if (tab === TAB_SETTINGS) {
      // Settings carries its sub-tab in the URL (#/settings/<slug>) so each
      // section is deep-linkable.
      const route: HashRoute = {
        type: 'settings-section',
        section: settingsSection,
      }
      syncHash(route, tab)
      return
    }
    if (tab !== TAB_KARAOKE) {
      syncHash({ type: 'tab', tab }, tab)
      return
    }
    let route: HashRoute
    if (view === 'results' && sessionId !== null) {
      route = { type: 'uvr-session', sessionId }
    } else if (view === 'mixer' && sessionId !== null) {
      route = { type: 'uvr-session-mixer', sessionId }
    } else if (view === 'shazam-listen') {
      // Deep-linkable so "shazam sing" can be spoken from anywhere, and so
      // the listener survives a reload instead of dropping back to Upload.
      route = { type: 'uvr-sing' }
    } else {
      route = { type: 'uvr-upload' }
    }
    syncHash(route, tab)
  })

  // Sync walkthrough/guide state → URL hash
  createEffect(() => {
    // Same read-before-bail rule as above.
    const modalOpen = deps.walkthroughModalOpen()
    const walkthroughId = deps.selectedWalkthrough()
    const selectionOpen = deps.showSelection()
    const guideOpen = deps.showGuideSelection()
    const constellationOpen = deps.voiceConstellationOpen()
    if (!initialized() || hashSyncing || constellationOpen) return
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
