import type { Setter, Signal } from 'solid-js'
import { createSignal } from 'solid-js'

export function createPersistedSignal<T>(
  key: string,
  defaultValue: T,
  options?: {
    validator?: (val: unknown) => val is T
    serializer?: (val: T) => string
    deserializer?: (val: string) => T
  },
): Signal<T> {
  const deserialize =
    options?.deserializer ??
    ((item: string): T => {
      if (typeof defaultValue === 'string') return item as unknown as T
      return JSON.parse(item) as T
    })

  const serialize =
    options?.serializer ??
    ((val: T): string => {
      if (typeof val === 'string') return val
      return JSON.stringify(val)
    })

  let initialValue = defaultValue
  try {
    const item = localStorage.getItem(key)
    if (item !== null && item !== undefined && item !== '') {
      const parsed = deserialize(item)
      if (!options?.validator || options.validator(parsed)) {
        initialValue = parsed
      }
    }
  } catch (e) {
    console.warn(`[createPersistedSignal] Failed to parse key "${key}":`, e)
  }

  const [value, setValue] = createSignal<T>(initialValue)

  // eslint-disable-next-line solid/reactivity
  const setValuePersisted = ((newValue: Parameters<Setter<T>>[0]) => {
    const nextValue =
      typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(value())
        : newValue

    setValue(() => nextValue)

    try {
      localStorage.setItem(key, serialize(nextValue))
    } catch (e) {
      console.warn(`[createPersistedSignal] Failed to save key "${key}":`, e)
    }

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
