// Local musical memory storage — one explicitly saved Blob per gallery, isolated by host.
import type { MusicalMemoryStore } from '../core/musical-memory'
import { isMusicalMemory } from '../core/musical-memory'

const STORE = 'takes'
const STORAGE_TIMEOUT_MS = 5000

export function createBrowserMemoryStore(
  namespace: string,
): MusicalMemoryStore {
  function transact<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let database: IDBDatabase | undefined
      let transaction: IDBTransaction | undefined
      let settled = false
      const finish = (error?: unknown, result?: T): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        database?.close()
        if (error !== undefined) reject(error)
        else resolve(result as T)
      }
      const timer = setTimeout(() => {
        try {
          transaction?.abort()
        } catch {
          /* Already complete. */
        }
        finish(new Error('Local recording storage did not respond.'))
      }, STORAGE_TIMEOUT_MS)
      try {
        const request = globalThis.indexedDB.open(
          `glass-musical-memories:${namespace}`,
          1,
        )
        request.onupgradeneeded = () => {
          if (settled) {
            request.transaction?.abort()
            return
          }
          request.result.createObjectStore(STORE, { keyPath: 'levelId' })
        }
        request.onerror = () =>
          finish(
            request.error ??
              new Error('Local recording storage is unavailable.'),
          )
        request.onblocked = () =>
          finish(new Error('Close other gallery tabs, then try saving again.'))
        request.onsuccess = () => {
          database = request.result
          if (settled) {
            database.close()
            return
          }
          try {
            transaction = database.transaction(STORE, mode)
            const query = operation(transaction.objectStore(STORE))
            transaction.oncomplete = () => finish(undefined, query.result)
            transaction.onabort = () =>
              finish(
                transaction?.error ??
                  query.error ??
                  new Error('The recording could not be saved.'),
              )
            transaction.onerror = () => {
              /* onabort reports the final transaction result. */
            }
          } catch (error) {
            finish(error)
          }
        }
      } catch (error) {
        finish(error)
      }
    })
  }
  return {
    async get(levelId) {
      const value: unknown = await transact('readonly', (store) =>
        store.get(levelId),
      )
      return isMusicalMemory(value) && value.levelId === levelId ? value : null
    },
    async put(memory) {
      if (!isMusicalMemory(memory))
        throw new Error(
          'This recording is empty, interrupted or too long to save.',
        )
      await transact('readwrite', (store) => store.put(memory))
    },
    async remove(levelId) {
      await transact('readwrite', (store) => store.delete(levelId))
    },
  }
}
