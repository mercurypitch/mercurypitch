// ============================================================
// Standalone route history — reversible local-save navigation veto
// ============================================================
//
// A popstate arrives after the browser has moved its history pointer. Rewriting
// that destination destroys the entry, so standalone rooms stamp their own
// entries and traverse back to the last accepted point while a save is locked.

import { isLocalSaveNavigationLocked } from './local-save-navigation-lock'

const ROUTE_POINTS_STATE_KEY = 'mercuryPitchRoutePoints'
const handledLockedPopStates = new WeakSet<PopStateEvent>()

type HistoryMode = 'push' | 'replace'

interface RouteHistoryCoordinator {
  references: number
  currentPoint: number
  acceptedPoint: number
  acceptedLocation: string
  initialized: boolean
}

export interface StandaloneRouteHistory {
  acceptCurrent(): void
  write(href: string, mode: HistoryMode): void
  vetoLockedPopState(event: PopStateEvent): boolean
  release(): void
}

const coordinators = new Map<string, RouteHistoryCoordinator>()

function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function recordState(state: unknown): Record<string, unknown> {
  return state !== null && typeof state === 'object' && !Array.isArray(state)
    ? (state as Record<string, unknown>)
    : {}
}

function pointFor(state: unknown, routeKey: string): number | null {
  const points = recordState(state)[ROUTE_POINTS_STATE_KEY]
  if (points === null || typeof points !== 'object' || Array.isArray(points)) {
    return null
  }
  const point = (points as Record<string, unknown>)[routeKey]
  return typeof point === 'number' && Number.isSafeInteger(point) ? point : null
}

function stateAtPoint(
  routeKey: string,
  point: number,
): Record<string, unknown> {
  const current = recordState(window.history.state)
  const existingPoints = recordState(current[ROUTE_POINTS_STATE_KEY])
  return {
    ...current,
    [ROUTE_POINTS_STATE_KEY]: {
      ...existingPoints,
      [routeKey]: point,
    },
  }
}

/** Share one accepted history point across every controller mounted in a room. */
export function acquireStandaloneRouteHistory(
  routeKey: string,
): StandaloneRouteHistory {
  const existing = coordinators.get(routeKey)
  const coordinator = existing ?? {
    references: 0,
    currentPoint: pointFor(window.history.state, routeKey) ?? 0,
    acceptedPoint: pointFor(window.history.state, routeKey) ?? 0,
    acceptedLocation: currentLocation(),
    initialized: false,
  }
  coordinator.references += 1
  coordinators.set(routeKey, coordinator)

  let released = false

  const acceptCurrent = (): void => {
    const storedPoint = pointFor(window.history.state, routeKey)
    const point = storedPoint ?? coordinator.currentPoint
    if (storedPoint === null) {
      window.history.replaceState(
        stateAtPoint(routeKey, point),
        '',
        currentLocation(),
      )
    }
    coordinator.currentPoint = point
    coordinator.acceptedPoint = point
    coordinator.acceptedLocation = currentLocation()
    coordinator.initialized = true
  }

  const write = (href: string, mode: HistoryMode): void => {
    if (!coordinator.initialized) acceptCurrent()
    const point =
      mode === 'push' ? coordinator.currentPoint + 1 : coordinator.currentPoint
    const state = stateAtPoint(routeKey, point)
    if (mode === 'push') window.history.pushState(state, '', href)
    else window.history.replaceState(state, '', href)
    coordinator.currentPoint = point
    coordinator.acceptedPoint = point
    coordinator.acceptedLocation = currentLocation()
  }

  const vetoLockedPopState = (event: PopStateEvent): boolean => {
    if (!isLocalSaveNavigationLocked()) return false
    if (handledLockedPopStates.has(event)) return true
    handledLockedPopStates.add(event)

    const destinationPoint = pointFor(event.state, routeKey)
    const atAcceptedEntry =
      destinationPoint === coordinator.acceptedPoint &&
      currentLocation() === coordinator.acceptedLocation
    if (atAcceptedEntry) return true

    // Standalone-room entries are stamped, so Back and Forward both have an
    // exact inverse. An unstamped same-document entry can only be recovered
    // conservatively one step at a time without mutating that destination.
    const delta =
      destinationPoint === null
        ? 1
        : coordinator.acceptedPoint - destinationPoint
    if (delta !== 0) window.history.go(delta)
    return true
  }

  return {
    acceptCurrent,
    write,
    vetoLockedPopState,
    release() {
      if (released) return
      released = true
      coordinator.references -= 1
      if (coordinator.references === 0) coordinators.delete(routeKey)
    },
  }
}
