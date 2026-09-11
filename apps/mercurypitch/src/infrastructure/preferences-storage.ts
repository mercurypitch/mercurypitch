// ============================================================
// The identity keys, in storage the OS does not clear
// ============================================================
//
// `localStorage` inside a WebView is not durable. Capacitor's own docs say
// the system clears it, and on iOS a WKWebView's site data is explicitly
// eligible for eviction when the device is short of space. For a settings
// flag that is a shrug; for `mp:userId`, `mp:deviceSecret` and
// `mp:authToken` it is permanent account loss — the device mints a fresh id
// and secret, and the server row it used to own keeps a `deviceSecretHash`
// nothing will ever present again.
//
// `@capacitor/preferences` is the platform-backed store instead:
// `UserDefaults` on iOS, `SharedPreferences` on Android. Both are backed up,
// both survive an app update, and neither is evicted under storage pressure.
//
// This file exists in the APP rather than in `src/lib/storage-port.ts`
// because the plugin is a dependency of this package alone. The root `src/`
// tree is compiled by the web build too, and the web build must not resolve —
// let alone bundle — a Capacitor plugin. So the port is defined up there and
// installed from down here, which is the same shape every other native
// capability takes.

import type { StoragePort } from '@/lib/storage-port'

/**
 * The Preferences port. The import is dynamic and the plugin is loaded once,
 * on the first call, so a failure to load is a failure of that call rather
 * than of module evaluation — and boot continues on a device where something
 * went wrong with the bridge, rather than showing a blank screen.
 */
export function createPreferencesStoragePort(): StoragePort {
  type PreferencesApi = {
    get(options: { key: string }): Promise<{ value: string | null }>
    set(options: { key: string; value: string }): Promise<void>
    remove(options: { key: string }): Promise<void>
  }
  let api: Promise<PreferencesApi> | null = null
  const preferences = (): Promise<PreferencesApi> => {
    api ??= import('@capacitor/preferences').then((m) => m.Preferences)
    return api
  }

  return {
    async get(key) {
      const { value } = await (await preferences()).get({ key })
      return value
    },
    async set(key, value) {
      await (await preferences()).set({ key, value })
    },
    async remove(key) {
      await (await preferences()).remove({ key })
    },
  }
}
