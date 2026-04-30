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
