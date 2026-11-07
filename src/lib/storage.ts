import type { Setter, Signal } from 'solid-js'
import { createSignal, untrack } from 'solid-js'

// ── Cloud-sync hooks ─────────────────────────────────────────────
// Every persisted signal funnels writes through here, which gives the
// settings sync (src/db/services/settings-service.ts) a single choke
// point: it observes local writes (write-through to the cloud) and can
// push cloud values back into live signals on sign-in.

type PersistedWriteListener = (key: string, serialized: string) => void
type BeforePersistedWriteListener = (key: string) => boolean

let persistedWriteListener: PersistedWriteListener | null = null
let beforePersistedWriteListener: BeforePersistedWriteListener | null = null

/** Reconcile account state before a local update; false rejects a stale action. */
export function onBeforePersistedWrite(
  listener: BeforePersistedWriteListener | null,
): void {
  beforePersistedWriteListener = listener
}

/** Observe every persisted-signal write (key + serialized value). */
export function onPersistedWrite(
  listener: PersistedWriteListener | null,
): void {
  persistedWriteListener = listener
}

/** Live setters by key, so cloud values update mounted signals. */
const persistedSetters = new Map<string, (serialized: string) => void>()

/**
 * Apply an externally-sourced (cloud) value: updates localStorage and,
 * when the signal is alive, the signal itself. Does NOT notify the
 * write listener (no echo back to the cloud). A view-only update can hide
 * another account's value when its durable ownership transition fails.
 */
export function applyPersistedValue(
  key: string,
  serialized: string,
  options?: { persist?: boolean },
): void {
  if (options?.persist !== false) {
    try {
      localStorage.setItem(key, serialized)
    } catch (e) {
      console.warn(`[storage] Failed to apply key "${key}":`, e)
    }
  }
  persistedSetters.get(key)?.(serialized)
}

export function createPersistedSignal<T>(
  key: string,
  defaultValue: T,
  options?: {
    validator?: (val: unknown) => val is T
    serializer?: (val: T) => string
    deserializer?: (val: string) => T
    /** Reconcile non-reactive host state after a cloud/external hydration. */
    onExternalApply?: (value: T) => void
  },
): Signal<T> {
  // A string default keeps its strings bare; any other default keeps JSON,
  // strings included. Until November 2026 a string under a null default was
  // written bare and read back as JSON, which threw, so it fell back to the
  // default on every load: the Jam room never remembered the input it was
  // given (mp_jam_input_device, mp_jam_input_label).
  const bare = typeof defaultValue === 'string'
  const deserialize =
    options?.deserializer ??
    ((item: string): T => (bare ? item : JSON.parse(item)) as T)

  const serialize =
    options?.serializer ??
    ((val: T): string =>
      bare && typeof val === 'string' ? val : JSON.stringify(val))

  // The stored text as a value. One written bare by the old serializer is
  // not JSON: it is taken as it is where the validator vouches for it, so a
  // choice saved before the fix comes back. Without a validator nothing
  // vouches for it, and it fails as it always has.
  const read = (item: string): T => {
    try {
      return deserialize(item)
    } catch (e) {
      const vouch = options?.validator
      if (options?.deserializer === undefined && vouch !== undefined) {
        if (vouch(item)) return item
      }
      throw e
    }
  }

  let initialValue = defaultValue
  try {
    const item = localStorage.getItem(key)
    if (item != null && item !== '') {
      const parsed = read(item)
      if (!options?.validator || options.validator(parsed)) {
        initialValue = parsed
      }
    }
  } catch (e) {
    console.warn(`[createPersistedSignal] Failed to parse key "${key}":`, e)
  }

  const [value, setValue] = createSignal<T>(initialValue)

  persistedSetters.set(key, (serialized) => {
    try {
      const parsed = read(serialized)
      if (!options?.validator || options.validator(parsed)) {
        setValue(() => parsed)
        options?.onExternalApply?.(parsed)
      }
    } catch (e) {
      console.warn(`[createPersistedSignal] Bad synced value for "${key}":`, e)
    }
  })

  const setValuePersisted = ((newValue: Parameters<Setter<T>>[0]) => {
    // Another tab may have switched accounts since this action read its
    // inputs. Reconcile first, before even evaluating a functional update.
    // A rejected absolute value cannot safely be reassigned to the new owner.
    // Both hooks are tested against null before untrack: a build without the
    // settings sync then drops the calls whole, and with them the bytes that
    // Drum Night's first-paint budget counts (assert-drum-night-bundle.mjs).
    const before = beforePersistedWriteListener
    if (before !== null && untrack(() => before(key)) === false)
      return untrack(value)
    // Match native setter semantics: the previous value is read untracked.
    // Without this, a functional update called inside an effect subscribes
    // that effect to its own write — an unbounded reactive loop.
    const nextValue =
      typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(untrack(value))
        : newValue

    setValue(() => nextValue)

    const serialized = serialize(nextValue)
    try {
      localStorage.setItem(key, serialized)
    } catch (e) {
      console.warn(`[createPersistedSignal] Failed to save key "${key}":`, e)
    }
    const after = persistedWriteListener
    if (after !== null) untrack(() => after(key, serialized))

    return nextValue
  }) as Setter<T>

  return [value, setValuePersisted]
}

export function storageGet<T = unknown>(key: string, fallback?: T): T | null {
  try {
    const item = localStorage.getItem(key)
    if (item === null || item === undefined) return fallback ?? null
    try {
      return JSON.parse(item) as T
    } catch {
      return item as unknown as T
    }
  } catch (e) {
    console.warn(`[storage] Failed to read key "${key}":`, e)
    return fallback ?? null
  }
}

export function storageSet(key: string, value: unknown): void {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, serialized)
  } catch (e) {
    console.warn(`[storage] Failed to write key "${key}":`, e)
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn(`[storage] Failed to remove key "${key}":`, e)
  }
}
