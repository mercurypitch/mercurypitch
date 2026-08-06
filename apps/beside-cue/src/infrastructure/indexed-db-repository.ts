import type { BesideCueRepository, BesideCueStateV1, } from '@irchiinnuss/beside-cue-core'
import { assertStateIdentityInvariants } from '@irchiinnuss/beside-cue-core'

const DATABASE_NAME = 'beside-cue'
const DATABASE_VERSION = 1
const SNAPSHOT_KEY = 'current'
const SNAPSHOT_STORE = 'state'

export interface ResettableBesideCueRepository extends BesideCueRepository {
  clear(): Promise<void>
}

export interface IndexedDbBesideCueRepositoryOptions {
  readonly databaseFactory?: IDBFactory
  readonly databaseName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeState(value: unknown): BesideCueStateV1 {
  if (
    !isRecord(value) ||
    !isRecord(value.schema) ||
    value.schema.schemaVersion !== 1 ||
    !Array.isArray(value.cues) ||
    !Array.isArray(value.scheduleRules) ||
    !Array.isArray(value.occurrences) ||
    !isRecord(value.settings)
  ) {
    throw new Error('The local Beside Cue snapshot has an unknown shape.')
  }

  const state = value as unknown as BesideCueStateV1
  assertStateIdentityInvariants(state)
  return state
}

function openDatabase(
  databaseFactory: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = databaseFactory.open(databaseName, DATABASE_VERSION)

    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE)
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Could not open local storage.')),
    )
    request.addEventListener('blocked', () =>
      reject(new Error('A previous Beside Cue tab is blocking local storage.')),
    )
  })
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('Local storage was interrupted.')),
    )
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('Local storage failed.')),
    )
  })
}

function readRequest(request: IDBRequest<unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Could not read local storage.')),
    )
  })
}

export function createIndexedDbBesideCueRepository(
  options: IndexedDbBesideCueRepositoryOptions = {},
): ResettableBesideCueRepository {
  const databaseFactory = options.databaseFactory ?? window.indexedDB
  const databaseName = options.databaseName ?? DATABASE_NAME
  let mutationQueue: Promise<void> = Promise.resolve()

  function enqueueMutation(mutation: () => Promise<void>): Promise<void> {
    const result = mutationQueue.catch(() => undefined).then(mutation)
    mutationQueue = result.catch(() => undefined)
    return result
  }

  return {
    async loadState() {
      await mutationQueue
      const database = await openDatabase(databaseFactory, databaseName)
      try {
        const transaction = database.transaction(SNAPSHOT_STORE, 'readonly')
        const value = await readRequest(
          transaction.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY),
        )
        await waitForTransaction(transaction)
        return value === undefined ? null : decodeState(value)
      } finally {
        database.close()
      }
    },

    saveState(state) {
      return enqueueMutation(async () => {
        const database = await openDatabase(databaseFactory, databaseName)
        try {
          const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite')
          transaction.objectStore(SNAPSHOT_STORE).put(state, SNAPSHOT_KEY)
          await waitForTransaction(transaction)
        } finally {
          database.close()
        }
      })
    },

    clear() {
      return enqueueMutation(async () => {
        const database = await openDatabase(databaseFactory, databaseName)
        try {
          const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite')
          transaction.objectStore(SNAPSHOT_STORE).delete(SNAPSHOT_KEY)
          await waitForTransaction(transaction)
        } finally {
          database.close()
        }
      })
    },
  }
}
