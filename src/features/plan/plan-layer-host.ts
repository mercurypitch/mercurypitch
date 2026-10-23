// ============================================================
// plan-layer-host: whether the plan layer is open, and how to open and close it
// ============================================================
//
// App's side of the plan layer: the small state machine that says whether the
// layer is up (`mode`, `isOpen`, `answered`) and the two ways to move it
// (`open`, `close`). The layer itself is PlanLayer.tsx, which App loads
// lazily; this is only the switch.
//
// A host over an importer. The plan record and the layer's mode live in
// plan-store, which the native build must not carry: a module-level
// createPersistedSignal is a side effect Rollup keeps, so a static import of
// the store, even one used only in a dead branch, would put it and what it
// pulls in in the phone's bundle. So this module holds the store only as a
// module it has been given: App passes in `importStore`, built by the same
// IS_NATIVE_BUILD ternary that picks First Light's importer, and builds this
// host only where there is a plan. What keeps this file safe to import
// statically, in the native build too, is that it has no side effect (nothing
// runs at its top level), says no word a person reads, and takes the other
// plan modules as types only (plan-layer-host.test.ts reads its source and
// holds it to each).
//
// Three things are easy to break:
//
// - The router needs the answer on the tick a route opens the layer, which on
//   a page loaded at #/plan is before the store has arrived. So a layer that
//   has been asked for and is not up yet counts as open: otherwise the router's
//   address sync would rewrite #/plan in the gap. A layer opened any other
//   way (Home's card, the takeover of an existing user) sets the store's mode,
//   which counts too.
// - The order at boot. The router's first dispatch runs in its `onMount`, and
//   for every address but #/plan it calls `close`, so a layer opened earlier
//   during the same mount is closed before anyone has seen it. An opener that
//   is not the route (a takeover, a Home card) opens after that dispatch, not
//   beside it: from an effect or a timer that runs once the router is up, never
//   from an `onMount` registered before the router's (effects run in the order
//   they were registered). useHashRouter.ts says the same where the route is
//   followed.
// - The races. A close that comes before the store lands must win over the
//   ask it follows (`wanted`); two asks before it lands are one import and one
//   opening (`loading`); a failed import clears the ask and is tried again by
//   the next one (`loading` is dropped, `asked` is cleared); and a layer that
//   another path has opened is never overwritten by an ask that was waiting.
//
// How the layer opens from an ask is by the record: an answered plan is
// reviewed, and any other is the four taps, as a skipper's.

import { createSignal, onMount, untrack } from 'solid-js'
import type * as PlanStore from './plan-store'

/** The plan store as App imports it: the one thing this host takes from the plan. */
export type PlanStoreModule = typeof PlanStore

export interface PlanLayerHost {
  /** The mode the layer is open in, or null while it is closed. */
  mode: () => PlanStore.PlanLayerMode | null
  /** Has the person answered the four questions? False until the store has arrived. */
  answered: () => boolean
  /** Is the layer up, or asked for and on its way? The router keeps the address still while it is. */
  isOpen: () => boolean
  /** Ask for the layer: up at once if the store is there, as soon as it lands if not. */
  open: () => void
  /** Withdraw the ask and shut the layer, whichever of the two it is. */
  close: () => void
}

/**
 * The host for one App. Call it inside the component that owns the app: it
 * loads the store once the app is up (so the Guide knows whether the plan is
 * answered by the time it is opened) and listens for nothing after.
 */
export function createPlanLayerHost(
  importStore: () => Promise<PlanStoreModule>,
): PlanLayerHost {
  const [store, setStore] = createSignal<PlanStoreModule | null>(null)
  const [asked, setAsked] = createSignal(false)
  let loading: Promise<PlanStoreModule> | null = null
  let wanted = false

  const load = async (): Promise<PlanStoreModule> => {
    loading ??= importStore().then(
      (loaded) => {
        setStore(loaded)
        return loaded
      },
      (error: unknown) => {
        loading = null
        throw error
      },
    )
    return loading
  }
  const mode = (): PlanStore.PlanLayerMode | null =>
    store()?.planLayerMode() ?? null

  // Up if it is wanted and nothing has opened it yet.
  const show = (loaded: PlanStoreModule): void => {
    if (wanted && untrack(loaded.planLayerMode) === null) {
      const answered = untrack(loaded.planRecord)?.status === 'answered'
      loaded.openPlanLayer(answered ? 'review' : 'skipper')
    }
    setAsked(false)
  }

  onMount(() => {
    void load().catch(() => undefined)
  })

  return {
    mode,
    answered: (): boolean => store()?.planRecord()?.status === 'answered',
    isOpen: (): boolean => asked() || mode() !== null,
    open: (): void => {
      wanted = true
      const loaded = untrack(store)
      if (loaded !== null) {
        show(loaded)
        return
      }
      setAsked(true)
      void load().then(show, () => setAsked(false))
    },
    close: (): void => {
      wanted = false
      setAsked(false)
      untrack(store)?.closePlanLayer()
    },
  }
}
