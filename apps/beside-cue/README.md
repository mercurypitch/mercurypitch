# Beside Cue app

Standalone SolidJS application and Android/iOS Capacitor shells for Beside Cue.

## Package boundaries

- `@irchiinnuss/beside-cue-core`: pure product domain and application contracts.
- `@irchiinnuss/mobile-runtime`: reusable web/Capacitor ports and opt-in
  capability adapters. Games can import only `/capacitor/haptics`; products
  that schedule cues can separately opt into `/capacitor/local-notifications`.
- `@irchiinnuss/beside-cue-app`: Beside Cue content, persistence composition, UI, assets, and native project.

MercuryPitch remains at the repository root during the incremental monorepo transition. Break Glass can later adopt `@irchiinnuss/mobile-runtime`, but every shipped app keeps its own Capacitor config, Android/iOS project, application ID, signing, assets, permissions, and store lifecycle.

The app stores one portable daily target time. Web previews deliver it only
while the tab is open; Android delegates the same recurring wall-clock intent
to one stable local OS notification ID. This avoids alarm buildup and keeps the
chosen local time after restarts or travel. All notification copy is generic,
so private Pull and Side B text stays off the lock screen.

## Commands

```sh
pnpm beside-cue:dev
pnpm beside-cue:check
pnpm beside-cue:test
pnpm beside-cue:build
pnpm beside-cue:android
```

`com.irchiinnuss.besidecue` is registered in Play Console, so it is permanent.
Changing it now would mean a new listing.

Android builds require Java 21 and Android SDK 36. The app supports Android 8
(API 26) and newer so its discreet, non-vibrating notification channel is
available consistently. Release bundles are unsigned until the upload key
secrets are set — see [Release builds](#release-builds).

`MainActivity` uses `launchMode="singleTop"`. RevenueCat requires `standard`
or `singleTop` on the activity that starts a purchase; with `singleTask`,
backgrounding the app for payment verification can cancel the purchase.

## Purchases

Purchases run through RevenueCat, behind the `PurchasesPort` and `PaywallPort`
in `@irchiinnuss/mobile-runtime`. No screen imports the billing SDK, so the
web build has no store code on any path a browser can reach.

Nothing in the app is gated. `BeSideCue Pro` exists so people who want to
support the work can, and so a future gate is a `proAccess.isPro()` check
rather than an integration.

### Configuration

Copy `.env.example` to `.env.local` and fill in what you need. A build with no
key falls back to the RevenueCat **Test Store** key, which exercises the whole
purchase flow without Play Console or App Store Connect products. That key is
refused in release builds — the SDK aborts an app that configures one — so a
release build without `VITE_REVENUECAT_ANDROID_KEY` ships with purchases
switched off and says so in Settings instead of crashing.

`import.meta.env.DEV` is **false in every native build**: `cap sync` copies the
output of `vite build`, so a debug APK carries a production web bundle. Nothing
in the web layer can tell a debug artifact from a release one, which is why
`VITE_REVENUECAT_ALLOW_TEST_STORE=1` exists — it says so from outside. Set it
for anything you sideload; never for anything you upload to a store.

Identifiers live in one file, `src/purchases/revenuecat-config.ts`.

### Dashboard setup

1. **Entitlement** — create `BeSideCue Pro`. Renaming it means setting
   `VITE_REVENUECAT_ENTITLEMENT_ID` to match; nothing else in the code moves.
2. **Products** — `lifetime`, `yearly` and `monthly`, attached to that
   entitlement. On Play these are one non-consumable and two subscription base
   plans.
3. **Offering** — one offering holding the three products as packages. The
   adapter reads either the standard package types (`$rc_lifetime`,
   `$rc_annual`, `$rc_monthly`) or plain `lifetime` / `yearly` / `monthly`
   identifiers, so both dashboard conventions work.
4. **Paywall** — design a Paywall v2 on that offering. `presentPaywall` is
   template-driven, so pricing and copy change in the dashboard without an app
   release.
5. **Customer Center** — enable it to give subscribers cancellation, plan
   changes and refund requests without leaving the app.

### Checking the Pro loop in a browser

RevenueCat's Capacitor plugin has no web implementation, so a browser build
normally reduces the Pro surface to "Purchases need the Android or iOS app." A
development build can put a fake store behind the same ports instead:

```sh
pnpm beside-cue:dev
# then open http://localhost:5173/?mockPurchases
```

`VITE_MOCK_PURCHASES=1` does the same without the query parameter. The fake
store publishes the same three plans, and its overlay stands in for the native
paywall and Customer Center, so the whole loop is walkable: unlock, the renewal
note, turning off renewal, a billing problem, expiry, and restore. A purchase
survives a reload.

This proves the interface and the entitlement state machine. It proves nothing
about RevenueCat — only a device does that. It cannot switch on outside a
development build: the check requires `import.meta.env.DEV`, and the fake store
is absent from a production bundle.

### Verifying on a device

Sideload the `beside-cue-debug-apk` artifact from any pull request. It is built
against the Test Store, so the whole loop works on a phone with no Play products
and no Play installation: check that the paywall presents, a purchase flips Pro
on, Customer Center opens, **Restore purchases** works, and the entitlement
survives a force-quit.

A **sideloaded build cannot reach Play Billing** — Play only serves an app it
installed itself. Testing against real products therefore has to wait for an
internal testing release, which is why the debug artifact uses the Test Store
instead.

Locally, the same thing with a device attached:

```sh
VITE_REVENUECAT_ANDROID_KEY= VITE_REVENUECAT_ALLOW_TEST_STORE=1 pnpm beside-cue:android
```

The empty key matters when `.env.local` holds a real `goog_` one — otherwise the
build reaches for Play and finds nothing.

`pnpm beside-cue:android` needs `ANDROID_HOME` pointing at an SDK with
platform 36, and `JAVA_HOME` pointing at a JDK 21. A newer JDK fails in
`JdkImageTransform`, and passing `gradlew --version` does not rule that out.

## Release builds

`.github/workflows/beside-cue-mobile.yml` owns both native builds. Beside Cue
versions independently of MercuryPitch, so it uses `beside-cue-v*` tags rather
than the `v*` tags that deploy the web app.

| Trigger                       | Produces                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Pull request touching the app | `beside-cue-debug-apk`, an iOS simulator build, lint and unit test reports       |
| `beside-cue-v*` tag           | The above, plus a release AAB and APK, and an IPA when Apple secrets are present |

Artifacts are on the workflow run's summary page. `beside-cue-v0.2.0` gives
`versionName` 0.2.0; `versionCode` is the workflow run number, because Play
rejects a re-used one and only the run number is guaranteed to increase.

Signing is opt-in. Without the secrets the release builds still run and still
prove the app compiles — they are simply unsigned.

Each job builds the web assets **twice**, because the two artifacts need
opposite store configuration: the debug/simulator build takes
`VITE_REVENUECAT_ALLOW_TEST_STORE=1` so it is testable off-store, and the
release build is rebuilt with the real key from
`secrets.VITE_REVENUECAT_ANDROID_KEY` (or `VITE_REVENUECAT_IOS_KEY`). Shipping
the first configuration in a release binary would make the SDK abort on launch.

### Debug signing

Android refuses to update an installed app whose signing certificate differs,
and it reports this as "cannot install" with no reason given. A CI runner
generates a throwaway debug key per run, so without a shared one, every swap
between a PR artifact and a local build needs an uninstall — which wipes the cue
and reflection history, because both live only on the device.

So debug builds use one keystore, at `~/.android/beside-cue-debug.jks` locally
and from `BESIDE_CUE_DEBUG_KEYSTORE_BASE64` in CI. Its password is Android's
documented debug convention, `android`, on purpose: a debug key signs nothing
Play would accept, so nothing is protected by hiding it.

With no keystore at that path the build still works, falling back to the
toolchain's generated debug key. It simply cannot update an install made
anywhere else. To adopt the shared key on another machine:

```sh
base64 -d < beside-cue-debug.jks.b64 > ~/.android/beside-cue-debug.jks
```

`BESIDE_CUE_DEBUG_KEYSTORE_FILE` overrides the path.

### Android upload key

Play App Signing means Google holds the _app signing_ key and re-signs every
upload. What is created here is the _upload_ key, which only proves an upload
came from you. Losing it is recoverable through Play Console support; it is not
the key that would strand the app.

```sh
keytool -genkeypair -v \
  -keystore beside-cue-upload.jks \
  -alias beside-cue-upload \
  -storetype PKCS12 \
  -keyalg RSA -keysize 4096 -validity 10000
```

Read its fingerprints, to compare against what Play Console shows under
**Test and release → App integrity → App signing**:

```sh
keytool -list -v -keystore beside-cue-upload.jks -alias beside-cue-upload
```

If Play Console is still asking for an upload certificate, export one and
upload it there:

```sh
keytool -export -rfc -keystore beside-cue-upload.jks \
  -alias beside-cue-upload -file upload-certificate.pem
```

Then add four repository secrets under **Settings → Secrets and variables →
Actions**:

| Secret                         | Value                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| `BESIDE_CUE_KEYSTORE_BASE64`   | `base64 -w0 beside-cue-upload.jks`                                   |
| `BESIDE_CUE_KEYSTORE_PASSWORD` | The store password from `keytool`                                    |
| `BESIDE_CUE_KEY_ALIAS`         | `beside-cue-upload`                                                  |
| `BESIDE_CUE_KEY_PASSWORD`      | The key password (same as the store password unless you set another) |

Keep `beside-cue-upload.jks` and both passwords in a password manager. The
keystore must never enter Git — `.gitignore` does not know about it, so it only
stays out by living outside the repository.

### Apple signing

An Apple Developer Program membership is required for anything installable on a
device; without it the workflow still compiles the app for the simulator. None
of this needs a Mac.

1. **Register the App ID** at developer.apple.com → Certificates, Identifiers &
   Profiles → Identifiers → **+** → App IDs → App, with bundle ID
   `com.irchiinnuss.besidecue`. Enable **In-App Purchase**.
2. **Make a signing request** locally:

   ```sh
   openssl genrsa -out ios_distribution.key 2048
   openssl req -new -key ios_distribution.key -out ios_distribution.csr \
     -subj "/emailAddress=you@example.com/CN=Beside Cue/C=HR"
   ```

3. **Create the certificate** — Certificates → **+** → Apple Distribution,
   upload the `.csr`, download `distribution.cer`, then convert it:

   ```sh
   openssl x509 -inform DER -in distribution.cer -out distribution.pem
   openssl pkcs12 -export -legacy \
     -inkey ios_distribution.key -in distribution.pem \
     -out distribution.p12
   ```

   `-legacy` matters: without it OpenSSL 3 writes a bundle the macOS keychain
   refuses to import, and the CI failure does not say why.

4. **Register the test device.** For an ad-hoc build the iPhone's UDID must be
   listed under Devices. On Linux, `libimobiledevice` reads it over USB:
   `idevice_id -l`.
5. **Create the provisioning profile** — Profiles → **+** → Ad Hoc for device
   testing, or App Store for TestFlight. Pick the App ID, the certificate, and
   the devices, then download the `.mobileprovision`.

Add the secrets:

| Secret                              | Value                                             |
| ----------------------------------- | ------------------------------------------------- |
| `APPLE_CERTIFICATE_P12_BASE64`      | `base64 -w0 distribution.p12`                     |
| `APPLE_CERTIFICATE_PASSWORD`        | The export password from step 3                   |
| `APPLE_PROVISIONING_PROFILE_BASE64` | `base64 -w0 *.mobileprovision`                    |
| `APPLE_PROVISIONING_PROFILE_NAME`   | The profile's name, exactly as Apple shows it     |
| `APPLE_TEAM_ID`                     | The ten-character Team ID from Membership details |

The export method defaults to `release-testing` (what Xcode used to call
ad-hoc). Set the repository _variable_ `BESIDE_CUE_IOS_EXPORT_METHOD` to
`app-store-connect` when TestFlight becomes the route.

### iOS project

`ios/` is generated and committed. Capacitor 8 wires plugins through Swift
Package Manager rather than CocoaPods, so `cap add ios` and `cap sync ios` both
run on Linux — only compiling needs macOS, which CI provides. `Package.swift`
is regenerated by `cap sync`, so its pnpm store paths are never hand-edited.
