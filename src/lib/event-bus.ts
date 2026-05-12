// ============================================================
// EventBus — Typed pub/sub replacing window CustomEvent dispatch
// Removes window pollution by routing cross-component events
// through a dedicated EventTarget singleton.
// ============================================================

const _target = new EventTarget()

export const eventBus = {
  /** Dispatch a typed event. */
  dispatch<T = void>(name: string, detail?: T): void {
    _target.dispatchEvent(new CustomEvent(name, { detail }))
  },

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T = void>(name: string, handler: (detail: T) => void): () => void {
    const wrapper = (e: Event) => handler((e as CustomEvent).detail as T)
    _target.addEventListener(name, wrapper)
    return () => _target.removeEventListener(name, wrapper)
  },
}
