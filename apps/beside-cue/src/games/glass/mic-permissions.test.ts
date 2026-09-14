// The native half of the microphone. Its only user is the B-side games, and a
// build without them (src/games/entry.ts) declares no microphone at all:
// an Android permission nothing asks for, or an iOS purpose string for a
// prompt that never appears, is a question from store review.
//
// When the games return, the declarations come back together, and on Android
// both permissions are needed. Capacitor's BridgeWebChromeClient asks Android
// for MODIFY_AUDIO_SETTINGS *and* RECORD_AUDIO when the WebView requests audio
// capture, and grants the WebView request only if every permission in that
// batch comes back granted. A normal permission that is not declared can never
// be granted, so dropping either line breaks the microphone on device while
// Android settings still shows it as allowed — a failure that looks exactly
// like a refused prompt and cannot be fixed by granting anything. The
// microphone stays an optional feature (android:required="false") so mic-less
// devices still install, and iOS needs NSMicrophoneUsageDescription back.
//
// There is no runtime assertion that could catch any of this (the app cannot
// read its own manifest), so the manifests are the test.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadGamesScreen } from '@/games/entry'

// vitest runs from the app root; import.meta.url is not a file URL here.
const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const manifest = read('android/app/src/main/AndroidManifest.xml')
const infoPlist = read('ios/App/App/Info.plist')

const declares = (permission: string): boolean =>
  manifest.includes(`android:name="android.permission.${permission}"`)

describe('the native microphone declarations', () => {
  it('are absent while the build carries no B-side games', () => {
    expect(loadGamesScreen).toBeUndefined()
    expect(declares('RECORD_AUDIO')).toBe(false)
    expect(declares('MODIFY_AUDIO_SETTINGS')).toBe(false)
    expect(manifest).not.toContain(
      '<uses-feature android:name="android.hardware.microphone"',
    )
    expect(infoPlist).not.toContain('NSMicrophoneUsageDescription')
  })
})
