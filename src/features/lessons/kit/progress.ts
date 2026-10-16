// ============================================================
// Lesson progress — which lessons the viewer has marked done
// ============================================================
//
// One list in localStorage, shared by every lesson page: a lesson's quiz
// marks it done once every question has an answer, its explorer card
// toggles it, and the explorer repaints on every change. In a private
// window the list lasts for the visit only (see `store`).

import { store } from './dom'

const KEY = 'fyp-done'
const listeners = new Set<() => void>()

function read(): number[] {
  const stored = store.get<unknown>(KEY, [])
  return Array.isArray(stored)
    ? stored.filter((n): n is number => typeof n === 'number')
    : []
}

export const Done = {
  /** The lessons marked done, in the order they were marked. */
  list(): number[] {
    return read()
  },
  has(n: number): boolean {
    return read().includes(n)
  },
  set(n: number, done: boolean): void {
    const marked = new Set(read())
    if (done) marked.add(n)
    else marked.delete(n)
    store.set(KEY, Array.from(marked))
    listeners.forEach((fn) => fn())
  },
  /** Calls `fn` after every change (not now); returns the unsubscribe. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
