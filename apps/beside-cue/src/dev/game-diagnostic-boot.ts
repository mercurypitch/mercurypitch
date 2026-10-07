// Game diagnostic boots distinguish retained history, app updates and new documents.
import type { BuildInfo } from '../build-info'

const BOOT_KEY = 'beside-cue:game-diagnostic-boot:v1'

interface NativeIdentity {
  launchId: string
  version: string
  build: string
}

interface BootRecord {
  id: string
  at: number
  buildKey: string
  native?: NativeIdentity
}

export interface NativeDiagnosticEvent {
  id: string
  at: number
  launchId: string
  version: string
  build: string
  kind: 'native-launch' | 'memory-warning' | 'web-content-terminated'
}

export interface NativeDiagnosticSnapshot extends NativeIdentity {
  events: NativeDiagnosticEvent[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function smallString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

function nativeIdentity(value: unknown): NativeIdentity | undefined {
  if (!isRecord(value)) return undefined
  const { launchId, version, build } = value
  return smallString(launchId) && smallString(version) && smallString(build)
    ? { launchId, version, build }
    : undefined
}

/** Only bounded diagnostic fields cross the native bridge into copied logs. */
export function readNativeDiagnosticSnapshot(
  value: unknown,
): NativeDiagnosticSnapshot | undefined {
  const identity = nativeIdentity(value)
  if (
    identity === undefined ||
    !isRecord(value) ||
    !Array.isArray(value.events)
  )
    return undefined
  const events: NativeDiagnosticEvent[] = []
  for (const event of value.events.slice(-16)) {
    const native = nativeIdentity(event)
    if (
      !isRecord(event) ||
      native === undefined ||
      !smallString(event.id) ||
      typeof event.at !== 'number' ||
      !Number.isFinite(event.at) ||
      !['native-launch', 'memory-warning', 'web-content-terminated'].includes(
        String(event.kind),
      )
    )
      continue
    events.push({
      ...native,
      id: event.id,
      at: event.at,
      kind: event.kind as NativeDiagnosticEvent['kind'],
    })
  }
  return { ...identity, events }
}

export function beginGameDiagnosticBoot(options: {
  build: BuildInfo
  storage(): Pick<Storage, 'getItem' | 'setItem'>
  id: string
  at: number
}) {
  let previous: BootRecord | undefined
  try {
    const raw = options.storage().getItem(BOOT_KEY)
    const value: unknown = raw === null ? undefined : JSON.parse(raw)
    if (
      isRecord(value) &&
      smallString(value.id) &&
      smallString(value.buildKey) &&
      typeof value.at === 'number' &&
      Number.isFinite(value.at)
    ) {
      previous = {
        id: value.id,
        at: value.at,
        buildKey: value.buildKey,
        native: nativeIdentity(value.native),
      }
    }
  } catch {
    /* Diagnostics cannot prevent app startup when storage is denied. */
  }
  const buildKey = [
    options.build.version,
    options.build.commit,
    options.build.channel,
    options.build.dirty,
  ].join(':')
  const current: BootRecord = { id: options.id, at: options.at, buildKey }
  const persist = () => {
    try {
      options.storage().setItem(BOOT_KEY, JSON.stringify(current))
    } catch {
      /* The current boot still has an in-memory identity. */
    }
  }
  persist()
  return {
    id: current.id,
    previous:
      previous === undefined ? undefined : { id: previous.id, at: previous.at },
    buildChanged:
      previous === undefined ? undefined : previous.buildKey !== buildKey,
    attachNative(snapshot: NativeDiagnosticSnapshot): string {
      current.native = {
        launchId: snapshot.launchId,
        version: snapshot.version,
        build: snapshot.build,
      }
      persist()
      if (previous === undefined) return 'first-observed-boot'
      if (
        previous.buildKey !== buildKey ||
        (previous.native !== undefined &&
          (previous.native.build !== snapshot.build ||
            previous.native.version !== snapshot.version))
      )
        return 'app-update'
      if (previous.native === undefined)
        return 'previous-native-identity-unavailable'
      return previous.native.launchId === snapshot.launchId
        ? 'new-document-same-native-launch'
        : 'native-relaunch-same-build'
    },
  }
}
