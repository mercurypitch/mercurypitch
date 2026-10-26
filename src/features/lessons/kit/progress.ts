// ============================================================
// Lesson progress — which lessons the viewer has marked done
// ============================================================
//
// One list in localStorage, shared by every lesson page: a lesson's quiz
// marks it done once every question has an answer, its explorer card
// toggles it, and the explorer repaints on every change. In a private
// window the list lasts for the visit only (see `store`). The app reads the
// same list for Home's Lessons link, so its key and its parse are shared, in
// src/lib/lesson-done.ts.

import { doneLessonsFrom, LESSON_DONE_KEY } from '@/lib/lesson-done'
import { store } from './dom'

const KEY = LESSON_DONE_KEY
const listeners = new Set<() => void>()

function read(): number[] {
  return doneLessonsFrom(store.get<unknown>(KEY, []))
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
