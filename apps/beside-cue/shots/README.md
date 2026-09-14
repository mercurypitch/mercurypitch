# Raw store screenshots

`pnpm shots` runs the current Beside Cue app and captures eight screens for
an iPhone and an Android phone. It rebuilds a production web bundle before
every run. Games are off, purchase mocks are off, and the screenshot-only Vite
config selects the release presentation so the app itself omits the build
stamp. No app controls, text, or native warnings are concealed with CSS.
The Settings version/device-info control remains in the app.

These are **Chromium captures of the shared web UI**, with touch viewports,
not captures from a native simulator or device. System bars, native safe areas,
permission dialogs, purchase sheets, and platform-specific redemption rows are
outside this harness. Review those on the actual native build before upload.
The default set therefore covers core screens and the reminder, not purchases.

## Run

Use Node 22 and the repository's installed pnpm dependencies. Install
Playwright Chromium (`pnpm exec playwright install chromium`) and ImageMagick
with `magick` available on PATH. From `apps/beside-cue`:

```sh
pnpm shots
pnpm shots --project android-phone
pnpm shots --project iphone-6.9 --grep 06-onboarding
BESIDE_CUE_SHOTS_IPAD=1 pnpm shots --project ipad-13
```

The default targets are iPhone **1320 × 2868** (440 × 956 CSS pixels at 3×) and
Android **1080 × 1920** (360 × 640 at 3×). The optional iPad 2064 × 2752 target
is a layout diagnostic; the current iOS app is iPhone-only.

A fresh timestamped run goes to
`~/agent-out/beside-cue/<date>/shots/<timestamp>/`. The console prints the
contact sheet path. `BESIDE_CUE_SHOTS_DIR=/absolute/fresh/folder` overrides it;
use a new empty directory so a failed capture cannot leave an older image in
its place. `BESIDE_CUE_SHOTS_PORT` overrides the strict checkout-specific port.
An occupied port fails instead of silently reusing a different build.

Playwright owns the local server and stops it when the run finishes; Ctrl-C
stops an interactive run. The capture configuration is separate from ordinary
browser regression tests and is not run automatically by PR Gate. Traces from
failed captures go to the OS temporary directory printed by Playwright.

## What is in each capture

1. Home with one fictional saved plan.
2. Cue moment showing that plan's Side B.
3. Pull selection.
4. Side B selection.
5. Reflection with twelve resolved turns from a fictional week.
6. The current J2 greeting movie, decoded and held at **1.25 seconds**.
7. Settings at the top.
8. The daily-reminder section reached by ordinary scrolling.

Fixtures use the core's real transitions and the app's own storage shape.
The fictional clock is fixed at 2026-09-10 18:40 UTC; no personal user data is
loaded. Screens use the app's reduced-motion preference except the greeting,
which runs with normal motion so the current movie is exercised. Playwright
finishes CSS animations for capture and hides the caret. PNG conversion only
removes alpha; there is no resizing, pixel replacement, layout restyling,
caption overlay, or device frame. The files are 8-bit RGB PNGs at their native
capture dimensions. Stable data does not guarantee byte-identical rendering
across browser versions, hosts, or media decoders.

`index.html` lists all eight expected screens and shows gaps after failures.
`manifest.json` records the source commit, dirty-tree status, fixture, harness
hashes, dimensions, and each captured PNG's SHA-256. Preserve this with the
images so later marketing work has a traceable source. Native verification
and final screenshot selection remain a separate review step.

The original PR's sixteen review PNGs are stale and removed from the current
branch. They remain available in Git history at `7c51e120`; existing approved
marketing compositions and earlier agent-out captures are not changed.

## Store dimensions

Apple lists 1320 × 2868 among its 6.9-inch iPhone dimensions and requires iPad
screenshots only when the app runs on iPad. See the [App Store screenshot
specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).
Google Play accepts JPEG or 24-bit PNG without alpha, 320–3840 pixels per
dimension, with the long dimension no more than twice the short one. The
1080 × 1920 Android target also matches its recommended 9:16 portrait format;
the taller iPhone captures should not be reused for Play. See [Google Play
preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
