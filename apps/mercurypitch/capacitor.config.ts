import type { CapacitorConfig } from '@capacitor/cli'

// Mercury Pitch, the native shell.
//
// `appId` is permanent: it is the iOS bundle identifier, the Android package
// name, the key every provisioning profile and RevenueCat product hangs off,
// and neither store lets it change after the first upload. Chosen 2026-09-10
// and recorded in ~/.dotfiles/personal/mercurypitch/native-store-setup.md §1.
//
// `cleartext: false` because every request this app makes is https, and a
// WebView that will speak plain http is one that can be downgraded on a
// hostile network. `androidScheme: 'https'` keeps the WebView on a secure
// origin, which getUserMedia requires — an http origin has no microphone.
const config: CapacitorConfig = {
  appId: 'com.irchiinnuss.mercurypitch',
  appName: 'Mercury Pitch',
  webDir: 'dist',
  // The welcome opens on the night-rooms hero, so the frame behind the web
  // view matches it rather than flashing white on a cold start.
  backgroundColor: '#0b0d12',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    // Sign-in providers, and what each `false` removes from the binary.
    //
    // The plugin bundles every provider it supports unless told otherwise,
    // and two of them carry real SDKs: Facebook pulls FBSDKCoreKit and
    // FBSDKLoginKit, which is both weight against the installed-size gate
    // (warn 60 MB, fail 100 MB) and an SDK a privacy scanner will ask about
    // in an app that never offers Facebook sign-in. Twitter is plain OAuth
    // and adds nothing, but a provider that can be reached at runtime and
    // has no button is a surface with no owner.
    //
    // Apple stays true and is system APIs only (AuthenticationServices);
    // `false` would disable Sign in with Apple itself, which is the one
    // thing App Store guideline 4.8 requires beside Google.
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
    },
  },
}

export default config
