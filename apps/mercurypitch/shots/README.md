# Raw store screenshots

`pnpm shots` builds the Mercury Pitch native bundle the way the store build
presents it and captures eight screens on an iPhone, an iPad, an Android phone
and two Android tablets, and the two tablets again held sideways. It is a
local tool: PR Gate never runs it (the gate's
Playwright config is the root one, whose test directory is `src/e2e`), and a
store screenshot is judged by eye, not asserted into CI.

The captures are raw app screens. Marketing panels are composited from them
elsewhere; nothing here adds a caption, a frame or a background.

## Run

Use Node 22 and the repository's installed pnpm dependencies, Playwright
Chromium (`pnpm exec playwright install chromium`) and ImageMagick with
`magick` on PATH. From `apps/mercurypitch`:

```sh
pnpm shots                              # every device, every screen
pnpm shots --project iphone-6.9         # one device
pnpm shots --project ipad-13 -g karaoke # one screen on one device
pnpm shots --project play-tablet-10-landscape
```

A run goes to `~/agent-out/mercurypitch/<date>/shots/<timestamp>/`, one
folder per device, with `index.html` (the contact sheet) and `manifest.json`
beside them. `MERCURYPITCH_SHOTS_DIR=/absolute/empty/folder` writes somewhere
else; use a new folder so a failed capture cannot leave an older image in its
place. `MERCURYPITCH_SHOTS_PORT` overrides the port, which is otherwise
derived from the checkout path so two worktrees never answer for each other.
An occupied port fails the run instead of reusing another build.

Playwright builds the bundle into the OS temporary directory, serves it with
`vite preview`, and stops the server when the run ends. Traces of failed
captures go to `$TMPDIR/mercurypitch-shots-<port>/`.

## What the bundle is

`shots/vite.config.ts` is the app's own Vite config with three store values
forced, whatever the tracked `.env` says:

- the release channel;
- no song import in Karaoke: a store build ships the three bundled example
  songs and nothing else, so no Import row appears;
- no portable console, so no Developer tile in More and no console panel.

The bundle still names the dev worker, never production, and no request
reaches it: `shots/stand-in-api.ts` answers the account from fictional
fixtures and the worker's tables as empty, refuses everything else that would
leave the machine, and each test prints what it answered and refused.

## Whose phone it is

Everything is invented (`shots/fixtures.ts`). The clock is fixed to start at
2026-10-15 18:40 UTC and then runs at the real rate, so a take lasts as long
as it was sung.

- **Mara's phone** (screens 02 and 04 to 08): signed in to a fictional account
  (`mara@example.com`), the microphone granted before, five kept Sing takes
  over the past week, and five weeks of Ear Lab practice with two
  calibrations. That is her progress as the native rooms keep it: the take
  card reads the takes back, the Ear Lab bench reads the calibrations.
- **A fresh install** (screens 01 and 03): nothing kept and nothing granted.

The microphone is `shots/voice.ts`: a phrase synthesised into a WAV that
Chromium plays as its capture device, so the Sing room draws a real trace
from a real detector run. Nobody sang it. The Karaoke room plays its own
bundled example song, whose attribution the room shows.

## What is in each capture

1. The alley on a first run, with the welcome headline.
2. The alley with the Sing door chosen: its card and Enter.
3. The one screen before the microphone is asked for, on a first run.
4. The Sing room live, on the phrase's held top note, in tune. A frame
   taken after the note moved on is retaken on the phrase's next pass.
5. The end card of that take, against the newest take the phone kept.
6. The Ear Lab bench: the Mercury Index and its last calibration.
7. Karaoke playing, moved to a line in the middle by tapping it.
8. Settings for a signed-in phone.

**Progress is not captured.** It reads the account's history, which today
only the web app writes (Sing takes and Ear Lab stay on the phone), and it
shows scored moments as percentages, which a store frame must not carry.

## How a capture is kept honest

Each test walks to its screen with taps, waits for a landmark, fonts and
every on-screen image, then refuses the frame if its visible text carries a
build channel, a developer surface, a desktop user agent, an error, a
percentage, "Nothing uploaded", "practise" or "AI". Screens run at reduced
motion; the screenshot API finishes CSS animations and hides the caret. The
PNG is flattened to 8-bit RGB with no alpha, which is the only change made to
it: no resizing, no overlay, no removed UI. Its size is checked against the
device's.

Beside each PNG, `<screen>.layout.json` records where its words and controls
sit at the moment of the screenshot: every visible line of text and every
visible button, link, field, tab, slider or switch, as boxes in CSS px with
the device scale, and the box of the landmark the capture waited for. A
composition built from the PNG uses it to keep a cut or an overlap clear of
them, such as the seam where two store panels meet.

These are Chromium captures of the native bundle on touch viewports, not
captures from a simulator or a phone. The iPhone and iPad keep the device's
safe-area insets (the table below): `env(safe-area-inset-*)` answers with them
through the DevTools protocol, so the app keeps clear of where the status bar
and home indicator sit, and that strip shows the app's own background. The
bars themselves, permission sheets and purchase sheets are not drawn. The
Android captures are the web view's own area, with no insets. System fonts
are this machine's: the Ear Lab's serif is Iowan Old Style on an iPhone and
whatever the host resolves here.

## Devices and store sizes

| Project                    | Viewport    | Scale | Insets (top, bottom) | Pixels      | For                                          |
| -------------------------- | ----------- | ----- | -------------------- | ----------- | -------------------------------------------- |
| `iphone-6.9`               | 440 x 956   | 3     | 62, 34               | 1320 x 2868 | App Store, 6.9-inch iPhone                   |
| `ipad-13`                  | 1032 x 1376 | 2     | 24, 20               | 2064 x 2752 | App Store, 13-inch iPad                      |
| `play-phone`               | 390 x 780   | 2     | none                 | 780 x 1560  | Google Play phone, placed 1:1 in 1080 x 1920 |
| `play-tablet-7`            | 612 x 1088  | 2     | none                 | 1224 x 2176 | Google Play, 7-inch tablet                   |
| `play-tablet-10`           | 810 x 1440  | 2     | none                 | 1620 x 2880 | Google Play, 10-inch tablet                  |
| `play-tablet-7-landscape`  | 1088 x 612  | 2     | none                 | 2176 x 1224 | Google Play, 7-inch tablet held sideways     |
| `play-tablet-10-landscape` | 1440 x 810  | 2     | none                 | 2880 x 1620 | Google Play, 10-inch tablet held sideways    |

The app targets iPad (`TARGETED_DEVICE_FAMILY = 1,2`), so App Store Connect
asks for the iPad set. The Android manifest restricts no screen size, so Play
offers the app on tablets. Apple's sizes: the [screenshot
specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).
Google's: the [preview asset
requirements](https://support.google.com/googleplay/android-developer/answer/9866151).

## Landscape

The Android app locks no orientation (its manifest has no
`screenOrientation`), so the tablet sets are also captured sideways, at 16:9
with the short side over 1080, which is what Play's large-screen listing asks
for. A landscape screen is the same walk at a wide viewport; nothing is
rotated or recomposed.

Not every screen holds up sideways. A device's `dropped` option (in
`playwright.shots.config.ts`) names the screens it skips, each with the
reason, judged by eye from a run that captured them. The contact sheet and
`manifest.json` list them as dropped, not missing:

- `03-sing-priming`, both tablets: a phone layout stretched sideways. The
  drawing sits alone in the middle and the Continue button runs the full
  width of the screen.
- `06-ear-lab`, the 7-inch tablet: at 612 px tall the bench runs under its
  action row. The practice estimate caption is cut off after "the fainter",
  and the change since the last calibration is half hidden behind Run
  Calibration. The 10-inch tablet keeps it.

That leaves six landscape screens on the 7-inch tablet and seven on the
10-inch. Play takes up to eight screenshots per device type, portrait and
landscape together.
