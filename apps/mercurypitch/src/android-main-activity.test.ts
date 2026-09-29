// ============================================================
// The activity Google sign-in needs on Android
// ============================================================
//
// `@capgo/capacitor-social-login` rejects every Google login that names
// scopes unless MainActivity implements its marker interface — "You CANNOT
// use scopes without modifying the main activity" — and native-sign-in.ts
// names two. The stock BridgeActivity that `cap add android` writes fails
// that check before any sheet opens: Android signed nobody in with Google,
// and the panel called it `unavailable`.
//
// The marker is only half of it. The plugin opens Google's consent sheet
// with startIntentSenderForResult under request codes it declares to nobody,
// so Capacitor's Bridge hands the answer to no plugin, and without the
// activity passing it on the login waits forever.
//
// Nothing in CI signs in on a phone, so the rule is read off the sources:
// ours, and the one name in the plugin's that the compiler cannot check.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** A Java source with its comments dropped, so prose cannot satisfy a rule. */
function javaSource(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '')
}

const ACTIVITY = javaSource(
  '../android/app/src/main/java/com/irchiinnuss/mercurypitch/MainActivity.java',
)

const PLUGIN =
  '../node_modules/@capgo/capacitor-social-login/android/src/main/java/ee/forgr/capacitor/social/login/'

describe('MainActivity', () => {
  it('carries the marker the plugin checks before any Google login', () => {
    expect(ACTIVITY).toMatch(
      /class MainActivity\s+extends BridgeActivity\s+implements\s+[^{]*\bModifiedMainActivityForSocialLoginPlugin\b/u,
    )
  })

  it("hands Google's consent result back to the plugin, and nothing else", () => {
    // The range as the plugin allocates it: from MIN, below MAX. Inverted,
    // the consent result is dropped and sign-in hangs again.
    expect(ACTIVITY).toMatch(
      /boolean isGoogleConsent\(int requestCode\)\s*\{\s*return\s+requestCode\s*>=\s*GoogleProvider\.REQUEST_AUTHORIZE_GOOGLE_MIN\s*&&\s*requestCode\s*<\s*GoogleProvider\.REQUEST_AUTHORIZE_GOOGLE_MAX\s*;\s*\}/u,
    )
    expect(ACTIVITY).toMatch(
      /if\s*\(\s*!isGoogleConsent\(requestCode\)\s*\)\s*\{\s*return;\s*\}/u,
    )
    expect(ACTIVITY).toContain('.handleGoogleLoginIntent(requestCode, data)')
  })

  it('leaves every other result to Capacitor, as BridgeActivity routes it', () => {
    // Plugins that claim a request code, then Cordova, then AndroidX. And
    // ComponentActivity marks the method @CallSuper, which lint enforces.
    expect(ACTIVITY).toContain(
      'super.onActivityResult(requestCode, resultCode, data)',
    )
  })
})

describe('the plugin', () => {
  it('is registered under the name the activity looks it up by', () => {
    // A string, so no compiler checks it. A wrong one finds no plugin, and
    // the consent result is dropped as surely as it was before.
    const name = /@CapacitorPlugin\(\s*name\s*=\s*"([^"]+)"/u.exec(
      javaSource(`${PLUGIN}SocialLoginPlugin.java`),
    )?.[1]
    expect(name).toBeDefined()
    expect(ACTIVITY).toContain(`getPlugin("${name}")`)
  })
})
