import type { Accessor, Setter } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { UvrView } from '@/components/UvrPanel'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_JAM, TAB_KARAOKE } from '@/features/tabs/constants'
import type { HashRoute } from '@/lib/hash-router'
import { buildHash, parseHash, replaceHash } from '@/lib/hash-router'

export interface UseHashRouterDeps {
  // Route handlers (hash → state)
  setActiveTab: Setter<ActiveTab>
  setInitialUvrView: Setter<'upload' | 'results' | 'mixer' | null>
  setInitialUvrSessionId: Setter<string | null>
  setActiveUvrSessionId: Setter<string | null>
  openLearningWalkthrough: () => void
  openWalkthroughChapter: (id: string) => void
  startWalkthrough: (sectionIds?: string[]) => void
  setShowGuideSelection: Setter<boolean>
  setJamRoomToJoin: Setter<string | null>
  dismissWelcome: () => void

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
    }
    hashSyncing = false
  }

  const onHashChange = () => {
    dispatchRoute(parseHash(window.location.hash))
  }

  onMount(() => {
    dispatchRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
  })

  onCleanup(() => {
    window.removeEventListener('hashchange', onHashChange)
  })

  // Sync activeTab + UvrPanel state → URL hash
  createEffect(() => {
    if (hashSyncing) return
    if (
      deps.showSelection() ||
      deps.walkthroughModalOpen() ||
      deps.showGuideSelection()
    )
      return
    const tab = deps.activeTab()
    if (tab !== TAB_KARAOKE) {
      const expectedHash = `#/${tab}`
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'tab', tab })
      }
      return
    }
    const view = deps.activeUvrView()
    const sessionId = deps.activeUvrSessionId()
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
    if (hashSyncing) return
    if (deps.walkthroughModalOpen() && deps.selectedWalkthrough() !== null) {
      const id = deps.selectedWalkthrough()!
      const expectedHash = `#/learn/${id}`
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'learn-chapter', chapterId: id })
      }
    } else if (deps.showSelection()) {
      const expectedHash = '#/learn'
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'learn' })
      }
    } else if (deps.showGuideSelection()) {
      const expectedHash = '#/guide'
      if (window.location.hash !== expectedHash) {
        replaceHash({ type: 'guide' })
      }
    }
  })
}
