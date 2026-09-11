# Guitar recorder artwork

Owner-requested recording emblem, generated with the built-in OpenAI image
generation tool on 2026-09-07. No third-party reference image was supplied.

Runtime asset: `public/guitar-night/melody-recorder.webp`, a 384px WebP derivative
with transparency retained. Used by the free-form recorder and My melodies
gallery. The image is decorative; real buttons, status, time and notes are native
UI. The gallery stays still. The owner-approved recorder-only video composite is
documented below; the original transparent image has not been replaced.

## Generation prompt

Use case: stylized-concept. Asset type: a single collectible recording emblem for the 'My melodies' gallery in MercuryPitch Guitar Night, an intimate dark velvet rehearsal room. Primary request: an exquisitely crafted miniature analog reel-to-reel tape cartridge with two small brushed brass reels, smoked charcoal housing, and a single amber guitar pick tucked against its lower front edge. It should feel like a musician's cherished personal recording, not a corporate app icon. Three-quarter slightly overhead view, compact readable silhouette, tactile worn brass and walnut edge detail, warm ivory highlights and one subtle teal signal light. Refined realistic product illustration, warm studio light, understated craftsmanship, no excessive glow, no neon. Center the entire isolated object with breathing room, square composition, genuinely transparent background and preserved alpha. No text, lettering, logos, musical-note glyphs, watermark, UI, floor or backdrop. This will be used around 100–160px wide in a beautiful translucent charcoal guitar-room gallery.

## Recorder animation prompt — 2026-09-08

Upload-ready reference:
[opaque grey landscape PNG](assets/guitar-recorder/recorder-animation-reference-grey-16x9.png).
This is a 1672 × 941 RGB PNG with no alpha, prepared with the built-in image
editing tool from the original 1254 × 1254 transparent PNG. It is an edited
animation reference, not a pixel-exact composite or a replacement for the
approved transparent app artwork. The recorder, pick and reels remain fully
visible, with horizontal padding for a 16:9 video. Do not upload the small
384px runtime WebP or expect an opaque video to preserve transparency.

For the first attempt, select **16:9, 4 seconds, 24 fps, no audio** where the
generator offers these settings. If its duration/rate is fixed, retain those
settings and inspect/cut a loop afterward. No extra image preparation is needed.
Keep the camera and body still; begin with a constant-speed loop, not separate
start/stop clips. Use this prompt:

```text
Animate this exact brass reel-to-reel recorder. Keep the camera, perspective,
framing, housing, guitar pick, teal light and lighting completely fixed.
Only the two brass reels and visible tape transport move. Rotate the reels
rigidly and smoothly at a constant gentle speed, one full turn in four seconds.
Preserve every reel opening, hub and screw without deformation. Make a seamless
four-second loop with matching reel phase and brightness at both ends and
continuous motion through the seam. Keep the supplied grey background unchanged.
No zoom, camera movement, body movement, morphing, new parts, flicker, text,
sound, fade, pause, acceleration or slowdown.
```

If first/last image inputs are available, the same prepared image can be used
for both, but check for holds or reversal: prompting does not guarantee a loop.
Grey is an explicit backdrop to avoid ambiguous alpha handling, not an alpha
channel or a guarantee of perfect chroma keying. After approval, prefer
compositing animated reel interiors over the original transparent still. Do not
key out the black parts of the recorder housing.

Keep the still image as the reduced-motion and idle fallback. Animation is
decorative, not an audio meter; integration runs it only while
recording. Start/stop acknowledgements must never delay audio capture. A prior
owner-generated clip supplied the short reel-motion derivative below.

## Playback amp/cabinet — 2026-09-07

Generated with the built-in OpenAI image-generation tool, without a reference
image. Runtime asset: `public/guitar-night/recorder-amp-cabinet-v1.webp`,
256 × 256, 18,920 bytes, alpha preserved. One illustration represents the
playback amp selector; Current/Clean/Saved state and unavailable/loading copy
are real UI, not text baked into the image. No new audio/IR asset is bundled.

### Generation prompt

Use case: product-mockup. Asset type: transparent miniature amp/cabinet artwork for the Guitar Night music application's playback-tone button. Create one beautiful unbranded electric guitar amplifier head sitting on a compact single speaker cabinet, isolated on genuinely transparent alpha background. Premium tactile near-photoreal 3D product illustration, slight three-quarter front view with entire object centered and tight comfortable padding. Dark charcoal acoustic cloth and black walnut cabinet edges, warm aged brass control plate with a few readable small knobs and one subtle amber valve/power light, ivory trim. Strong silhouette and believable single speaker grille, charming high-quality studio equipment, designed to stay readable at 48 to 64 pixels tall as a UI instrument icon. Soft upper-left studio light with restrained dimensional shadows confined to the object. No surrounding room, no floor plane, no badge or circular frame, no words, no letters, no brand logo, no watermark, no extra objects. Actual transparent background, not a checkerboard illustration. Square composition.

## Approved motion integration — 2026-09-08

The owner approved integration and then flagged changing screw counts in both
the Omni and newer Higgsfield generations. Raw four-second clips are not suitable
as whole-object loops. Keep the original master/runtime still unchanged.

Implementation plan:

- Focal moment: the existing tape-deck button's reel faces move only during
  acknowledged recording, never during preparation, saving, Live or Replay.
- Continuity: use a short early Omni segment and composite only the reel faces.
  Keep the rim, casing, pick and transparent silhouette from the original still.
  A frozen-hub annulus trial was rejected: mismatched projections cut into the
  moving openings. The shipped early faces preserve their three-screw section,
  with a short seam blend; this is decorative motion, not a perfect rigid rotor.
- Feedback: native Record/Stop, text and duration remain authoritative. Media
  loading/play permission/failure must never gate capture or monitoring.
- Budget: one small, silent, lazy-loaded native video; no audio track, new
  dependencies, per-frame JavaScript masking or audio-clock work. No gallery
  animations. Stop decoding when idle, hidden, offscreen or disposed.
- Accessibility: honor reduced motion (including changes while recording),
  preserve still-image fallback, hit target, focus and accessible button label.
- Verification: inspect actual composite/seam, verify decoded frame progression
  in a browser alongside real capture, and test reduced motion, media failure,
  route/unmount cleanup and repeated starts. Owner visual acceptance remains.

Runtime assets:

- `public/guitar-night/melody-recorder-reels-v1.mp4`: H.264, 384 × 384,
  18 frames at 24 fps / 0.75 seconds, 41,474 bytes, **no audio stream**.
- `public/guitar-night/melody-recorder-reels-mask-v1.png`: 384px alpha mask,
  4,996 bytes; two feathered reel faces, applied by CSS over the untouched still.
  An opaque video alone is not the finished artwork and must not replace the img.
- Source: owner-supplied Omni MP4, SHA-256
  `0485535f51f2b4846a56c9384cedea3a0cb10b5d41ccb963c068c001d7223ed5`.
  Source-frame ranges (zero-based) are left 5–25, right 3–23: approximately
  0.125–1.042 seconds, with three-frame tail/head blending. Later morphing frames,
  the grey backdrop and source AAC audio are not used.
- Reproduce with `node scripts/prepare-guitar-recorder-loop.mjs
/absolute/path/to/approved-omni.mp4 /absolute/empty-output-directory`.
  Requires FFmpeg and the existing Sharp dependency. Checks source hash, bounds
  decoding, refuses overwrite and emits MP4/mask. Original source stays private.

The video element exists only during acknowledged, visible, on-screen recording
with motion allowed and CSS masks supported. Failure leaves the still without a
retry loop; next room mount may retry. Idle, preparation, saving, Replay, reduced
motion and unmount release the decoder. Play is never awaited by Record/Stop.
