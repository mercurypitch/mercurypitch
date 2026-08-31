// The manifest half of the microphone. Capacitor's BridgeWebChromeClient
// asks Android for MODIFY_AUDIO_SETTINGS *and* RECORD_AUDIO when the
// WebView requests audio capture, and grants the WebView request only if
// every permission in that batch comes back granted. A normal permission
// that is not declared can never be granted, so dropping either line here
// breaks the microphone on device while Android settings still shows it
// as allowed — a failure that looks exactly like a refused prompt and
// cannot be fixed by granting anything.
//
// There is no runtime assertion that could catch this (the app cannot
// read its own manifest), so the manifest is the test.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest runs from the app root; import.meta.url is not a file URL here.
const manifest = readFileSync(
  resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
)

const declares = (permission: string): boolean =>
  manifest.includes(`android:name="android.permission.${permission}"`)

describe('the Android manifest', () => {
  it('declares both permissions Capacitor needs for audio capture', () => {
    expect(declares('RECORD_AUDIO')).toBe(true)
    expect(declares('MODIFY_AUDIO_SETTINGS')).toBe(true)
  })

  it('keeps the microphone an optional feature, so mic-less devices install', () => {
    expect(manifest).toContain('android.hardware.microphone')
    expect(manifest).toContain('android:required="false"')
  })
})
