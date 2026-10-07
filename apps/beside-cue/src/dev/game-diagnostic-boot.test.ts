// Boot diagnostics preserve causal boundaries without treating every reload as a crash.
import { beforeEach, expect, it } from 'vitest'
import { beginGameDiagnosticBoot, readNativeDiagnosticSnapshot, } from './game-diagnostic-boot'

const build = {
  version: '0.1.0',
  commit: 'daa0d22',
  channel: 'ci' as const,
  dirty: false,
}
const native = {
  version: '0.1.0',
  build: '850',
  launchId: 'launch-a',
  events: [],
}
const saved = new Map<string, string>()
const storage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
}
const boot = (id: string, commit = build.commit) =>
  beginGameDiagnosticBoot({
    build: { ...build, commit },
    storage: () => storage,
    id,
    at: 100,
  })
beforeEach(() => saved.clear())

it('distinguishes a same-process reload, native relaunch and binary update at the same commit', () => {
  expect(boot('a').attachNative(native)).toBe('first-observed-boot')
  const reloaded = boot('b')
  expect(reloaded.previous).toEqual({ id: 'a', at: 100 })
  expect(reloaded.buildChanged).toBe(false)
  expect(reloaded.attachNative(native)).toBe('new-document-same-native-launch')
  expect(boot('c').attachNative({ ...native, launchId: 'launch-b' })).toBe(
    'native-relaunch-same-build',
  )
  expect(
    boot('d').attachNative({ ...native, launchId: 'launch-c', build: '851' }),
  ).toBe('app-update')
})

it('labels a changed web build and does not invent a prior native identity', () => {
  boot('a')
  expect(boot('b').attachNative(native)).toBe(
    'previous-native-identity-unavailable',
  )
  const updated = boot('c', 'nextsha')
  expect(updated.buildChanged).toBe(true)
  expect(updated.attachNative(native)).toBe('app-update')
})

it('starts despite corrupt or unavailable storage', () => {
  storage.setItem('beside-cue:game-diagnostic-boot:v1', '{bad')
  expect(boot('a').previous).toBeUndefined()
  const denied = beginGameDiagnosticBoot({
    build,
    storage: () => {
      throw new Error('denied')
    },
    id: 'b',
    at: 200,
  })
  expect(denied.attachNative(native)).toBe('first-observed-boot')
})

it('bounds native history and drops unknown fields instead of inferring an OOM cause', () => {
  const event = {
    ...native,
    id: 'event',
    at: 1,
    kind: 'web-content-terminated',
    cause: 'OOM',
    path: 'private',
  }
  const snapshot = readNativeDiagnosticSnapshot({
    ...native,
    events: Array.from({ length: 30 }, (_, i) => ({ ...event, id: String(i) })),
  })
  expect(snapshot?.events).toHaveLength(16)
  expect(snapshot?.events[0]?.id).toBe('14')
  expect(snapshot?.events[0]).not.toHaveProperty('cause')
  expect(snapshot?.events[0]).not.toHaveProperty('path')
  expect(
    readNativeDiagnosticSnapshot({
      ...native,
      events: [{ ...event, kind: 'unknown' }],
    })?.events,
  ).toEqual([])
  expect(readNativeDiagnosticSnapshot({ events: [] })).toBeUndefined()
})
