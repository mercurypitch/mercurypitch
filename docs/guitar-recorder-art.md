# Guitar recorder artwork

Owner-requested recording emblem, generated with the built-in OpenAI image
generation tool on 2026-09-07. No third-party reference image was supplied.

Runtime asset: `public/guitar-night/melody-recorder.webp`, a 384px WebP derivative
with transparency retained. Used by the free-form recorder and My melodies
gallery. The image is decorative; real buttons, status, time and notes are native
UI. No video is loaded or generated. Animated artwork is deferred until the owner
approves this design and placement.

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
decorative, not an audio meter; later integration should run it only while
recording. Start/stop acknowledgements must never delay audio capture. A prior
owner-generated video has been reviewed privately, but no video has been added
to the app yet.

## Playback amp/cabinet — 2026-09-07

Generated with the built-in OpenAI image-generation tool, without a reference
image. Runtime asset: `public/guitar-night/recorder-amp-cabinet-v1.webp`,
256 × 256, 18,920 bytes, alpha preserved. One illustration represents the
playback amp selector; Current/Clean/Saved state and unavailable/loading copy
are real UI, not text baked into the image. No new audio/IR asset is bundled.

### Generation prompt

Use case: product-mockup. Asset type: transparent miniature amp/cabinet artwork for the Guitar Night music application's playback-tone button. Create one beautiful unbranded electric guitar amplifier head sitting on a compact single speaker cabinet, isolated on genuinely transparent alpha background. Premium tactile near-photoreal 3D product illustration, slight three-quarter front view with entire object centered and tight comfortable padding. Dark charcoal acoustic cloth and black walnut cabinet edges, warm aged brass control plate with a few readable small knobs and one subtle amber valve/power light, ivory trim. Strong silhouette and believable single speaker grille, charming high-quality studio equipment, designed to stay readable at 48 to 64 pixels tall as a UI instrument icon. Soft upper-left studio light with restrained dimensional shadows confined to the object. No surrounding room, no floor plane, no badge or circular frame, no words, no letters, no brand logo, no watermark, no extra objects. Actual transparent background, not a checkerboard illustration. Square composition.
