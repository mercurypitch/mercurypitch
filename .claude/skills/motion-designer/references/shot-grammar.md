# Shot grammar

Every shot gets a precise name, is chosen for what it says, is built so its
signature is visible on screen, and, when generated rather than built, is
prompted by its geometry rather than by a mood.

The technique taxonomy and the "wrong cousin" idea (each technique has a
look-alike that builders and generators drift into, and a visible tell that
separates them) come from the
[Melies cinematic techniques catalogue](https://melies.co/cinematic-techniques),
424 techniques with film grammar and prompts. This file rewrites the ones that
matter for code-built brand and product films; § 5 says how to look up the rest.

## 1. The shot line

Every row of `STORYBOARD.md` carries one shot line:

`size · angle · lens · move · light · composition · time · out`

Example: `MCU · eye level, three-quarter · 50 mm · slow push in, 4 % over 2.4 s
· soft key left, aqua rim · subject on left third, lead room right · real time ·
graphic match: droplet becomes pitch dot`

- Choose a technique for what it says (the "says" lines below), not for how it
  looks.
- Change size or angle from one beat to the next. Two neighbouring beats with
  the same size and angle need a reason (an axial cut, a jump cut).
- A signature technique (dolly zoom, crash zoom, freeze frame, camera roll,
  earth zoom) appears at most once in a film. Repeated, it becomes a trick.
- Motivate every move by the beat, a subject's motion or the music. A drift with
  no motive is noise.
- In this pipeline a "static" shot still has life inside the frame (a UI state
  changing, particles, one live element), because the quality bar allows no
  still stretch longer than about half a second.

## 2. Vocabulary

Each entry: what it says; how to build it; its wrong cousin and the tell; the
HyperFrames registry item that already does it, if any. Search the registry
before hand-building any named look:
`npx --yes hyperframes@0.8.97 catalog --query "<what the beat should do>"`.

### Camera movement

In a layered 2D scene, depth is a number per layer. A camera that translates
moves each layer on screen in proportion to `1/depth`; a camera that only
zooms or rotates moves every layer together. That one fact separates most of
the pairs below.

- **Push in / dolly in.** Says: a thought lands; attention closes in. Build: in
  3D move the camera along its view axis; in 2D scale each layer by
  `depth / (depth - travel)` so near layers grow faster. Cousin: a zoom or a
  crop; tell: no parallax, the frame enlarges as one card. Registry:
  `parallax-device-dive` (a push through a phone screen into layered UI),
  `camera-rig-depth-stack`. HyperFrames' `push-in` scales the whole stage, so
  despite its name it is a slow zoom: right for flat type, wrong for depth.
- **Pull out / dolly out.** Says: the context around a feeling arrives. Build:
  the same, reversed. Cousin: a zoom out; tell: no new overlap between near and
  far. Registry: `pull-back-reveal`, `parallax-unzoom`.
- **Slow zoom in or out.** Says: pressure without approach; the world stays
  put. Build: scale the whole stage uniformly, or change the 3D field of view.
  Cousin: a dolly; tell: a near object slides against the background.
  Registry: `push-in`.
- **Crash zoom.** Says: punctuation, a sting; the artificiality is the point.
  Build: a scale snap in under 0.3 s with radial blur, then a hold that still
  breathes. Cousin: a fast dolly or a whip pan; tell: parallax, or horizontal
  streaks instead of radial ones. Registry: `cinematic-zoom`.
- **Dolly zoom.** Says: the subject holds while the world becomes unreliable.
  Build: in 3D, move the camera and keep `distance × tan(fov / 2)` constant
  (from 10 units at 30 degrees: 7 units needs 41.9 degrees, 5 units 56.4).
  Once per film. Cousin: a zoom, or a stretch in post; tell: the subject changes
  size, or the background warps with no travel. Registry: `camera-dolly-zoom`.
- **Pan and tilt.** Says: two facts in one place, connected by a look. Build:
  rotate about the lens; in 2D move every layer by the same amount. Cousin: a
  truck or a crane; tell: near layers slide against far ones.
- **Whip pan.** Says: energy moves between spaces; it is a transition. Build: a
  0.15 to 0.3 s lateral move with horizontal blur only (an SVG
  `feGaussianBlur stdDeviation="40 0"`, or the `motion-blur` component), the
  next scene entering in the same direction at matched speed. Cousin: a fast pan
  with no blur, or a crash zoom; tell: readable detail mid-whip, radial blur, or
  blur directions that disagree across the join. Registry: `whip-pan-cut`,
  `whip-pan`.
- **Truck, slider, tracking.** Says: the world has layers; a slider is a small,
  precise move for a product or UI detail. Build: name near, mid and far layers
  and give them clearly different speeds (for example 1, 0.5 and 0.2). Cousin: a
  pan or a zoom; tell: everything moves as one card. Registry:
  `camera-rig-depth-stack`.
- **Crane up, down, over.** Says: leave or arrive at human scale; a crane over
  turns a scene into a diagram. Build: raise or lower the camera while easing it
  back and pitching to keep the subject framed; a crane over ends looking down.
  Cousin: a tilt; tell: the viewpoint never changes height, and nothing slides
  vertically.
- **Arc and orbit.** Says: change who owns the background; show another side.
  Build: the camera on a circle around the subject, always looking at it; an
  arc stops at about a quarter turn, an orbit keeps a constant radius. Cousin:
  a turntable, or a pan; tell: the background does not slide.
- **Turntable (lazy susan).** Says: inspect an object like merchandise. Build:
  the object rotates; camera and background stay still. Cousin: an orbit; tell:
  the background slides. Registry: `product-turntable` (a block in the
  HyperFrames repository that is not yet in the published catalogue).
- **Through an object, pass through, zoom through.** Says: change rooms without
  a cut, through a named threshold. This is the kit's foreground fly-through and
  logo-as-portal. Cousin: a cut on a dark frame; tell: a pop with no thickness.
  Registry: `zoom-through-transition`.
- **Earth zoom.** Says: introduce something as a point inside a larger world,
  for example the whole pitch canvas, then one note, then its waveform. Build:
  nested layers scaling along one axis around a fixed centre. Cousin: a generic
  pull out; tell: the scale levels do not nest, or the subject at the end is a
  different thing.
- **Programmed move (robo arm, hero cam).** Says: precision and inevitability,
  commercial polish. Natural in code, where every value is a function of time.
  Cousin: human sway where none was wanted.
- **Handheld.** Says: presence, urgency. Build: a seeded procedural shake,
  never `Math.random()`. Registry: `camera-shake` (measured profiles, seek-safe).
- **Static.** Says: trust the composition and its duration. Life comes from
  inside the frame. Cousin: an accidental sub-pixel drift.
- **Camera roll, Dutch angle.** Says: gravity is broken; unease. Rare in brand
  work; a Dutch angle is a still cant, a roll rotates during the shot.

### Shot size

Size is a statement. Change it on purpose.

- **Extreme close-up and macro.** The scene is this fragment: a cents readout, a
  droplet, a fingertip on a key. Macro means real magnification and a thin focus
  plane, not a cropped wide.
- **Close-up, medium close-up.** A face or a device screen read as a whole
  thing, detail over room.
- **Medium.** Face and gesture together: a singer with a phone in hand.
- **Wide, establishing.** Place, time and context. An establishing shot has a
  job in the sequence (where and when), not just a pretty view.
- **Insert.** A story-relevant detail at real scale: the note landing, the
  button that is pressed. Not a decorative cutaway.
- **Product hero.** The object treated like a portrait: a designed angle,
  designed speculars, no room clutter.
- **Over the shoulder.** A near shoulder or a near device edge, far subject
  sharp. In UI films: over the singer's shoulder onto the screen.

### Angle

- **Eye level.** Equal, honest. Generators drift it into a mild low angle.
- **Low angle.** Monument, hero; verticals converge. Name the look-up.
- **High angle.** Observation, smallness. Generators snap it into straight
  top-down.
- **Top-down (overhead).** A plan or diagram: a UI flow, a table of options.
  In 3D, avoid top-down on large textured surfaces (the kit's slab warning).
- **Three-quarter.** The default for faces and devices: both eyes or both
  edges, real depth.
- **Point of view, object point of view.** The world from the singer, or from
  the phone or microphone, which stays fixed in frame while the world moves.

### Lens

In Three.js set `camera.filmGauge = 36` and call `camera.setFocalLength(mm)`.
Vertical field of view that gives, in degrees:

| Focal length | 16:9 | 9:16  | Use                                           |
| ------------ | ---- | ----- | --------------------------------------------- |
| 14 mm        | 71.7 | 104.3 | Spaces that loom; rare                        |
| 24 mm        | 45.7 | 73.7  | A body in its environment                     |
| 35 mm        | 32.3 | 54.4  | The storytelling wide-normal                  |
| 50 mm        | 22.9 | 39.6  | Looking, without stretch or stacking          |
| 85 mm        | 13.6 | 23.9  | Isolation; a face or object from further back |
| 135 mm       | 8.6  | 15.2  | Compression: the background presses forward   |

- Telephoto compression needs distance: move the camera far back and narrow the
  field of view. A long lens close up does not compress.
- Anamorphic means oval bokeh and horizontal streak flares, not black bars.
  Registry: `vfx-anamorphic-flare`.
- Tilt-shift is a rotated plane of focus that makes real scale read as a model,
  not a blurred strip.

### Light

For 3D scenes and for generated footage; HTML type and UI are lit by the
palette, not by lamps.

- **Three-point.** Name each job: key (source and side), fill (how much
  softer), back or rim (a thin edge that separates the subject from the field).
- **Rim light.** A thread of light from behind, not a neon outline drawn round
  the subject. MercuryPitch's spectrum rim is this.
- **Motivated.** Every source could exist in the world of the shot: justify each
  beam.
- **High key and low key.** Contrast ratios, not exposure settings. High key is
  low contrast with protected whites; low key is pools of light and withheld
  black, with a clear key direction.
- **Soft and hard.** The size of the source: soft wraps with gradient shadows;
  hard gives razor edges.
- **Volumetric.** Needs a source and a medium (haze, dust). Painted rays that
  ignore the source are the cousin.
- **Silhouette.** Expose the background, starve the subject.
- **Chrome and glass.** Reflections are the light: use an environment map and
  broad soft boxes (`kit/business-motion-film/references/product-hero-realism.md`).

### Composition

- **Thirds or centre.** Name the axis. Centre is ceremony, thirds is a
  relationship; a lazy almost-centre is neither.
- **Symmetry.** Demand the mirror, or it reads as a mistake.
- **Leading lines.** Name the vector and where it lands: rails and contours
  that point at the call to action.
- **Negative space.** Absence as a mass, used when emptiness is the message.
  Feature beats still fill 60 to 85 per cent of the frame (the kit's rule).
- **Foreground interest, layered depth.** Give each plane a job.
- **Lead room and look space.** Space in front of the motion or the gaze, not
  behind it.
- **Visual weight.** One winner per frame; even, polite brightness everywhere
  is a catalogue page.
- **Figure and ground.** Separate the subject from its field by value, hue or
  focus. Chrome on Obsidian needs a rim or a value step to read.
- **Clean frame.** Nothing accidental at the edges.
- **Screen within a screen.** A device showing real UI. The inner picture must
  be readable, so it is a real capture or HTML, never generated.

### Colour

- **Palette as law.** Name the allowed hues (the brand tokens) and ban the rest.
- **Natural grade.** Faithful and restrained; no hidden teal-and-orange split.
- **Split toning.** One hue owns the shadows, another the highlights; name both.
- **Desaturation.** Pull chroma, keep the accents.

### Time and motion

- **Speed ramp.** A temporal close-up: real-time approach, a stretched beat,
  recovery. Build it as a piecewise progress curve whose speed matches at each
  joint, so no pose jumps. Cousin: slow motion that never returns to real time.
- **Slow motion.** In code, a slower progress curve that reveals mechanics:
  the droplet's surface, a needle settling on the note.
- **Freeze frame.** Zero frame change, so it counts against frozen time. Use it
  only as the final call to action, or dress it so something still moves.
  Registry: `freeze-frame-dressing`, `beat-freeze-cut`.
- **Motion blur.** Commit to streaks on fast moves. Build it by accumulating
  sub-frame samples over a shutter angle. Registry: `motion-blur`.
- **Loop.** The end state equals the start state, so the join vanishes; a
  boomerang plays forward then back, and both directions must read.
- **Stutter.** Dropped or repeated frames inside one setup. Registry:
  `stop-motion-cadence`.

### Optical and in-camera effects

- **Rack focus.** Name both planes and the duration; attention moves without a
  cut. Tell: which plane is sharp changes. Registry: `rack-focus`,
  `focus-rack`.
- **Shallow focus and bokeh.** A sharp mark and a soft field, with disc
  highlights; a cut-out with sticker edges is the cousin.
- **Lens flare.** Follows its source and dims when the source is blocked; a
  fixed overlay is the cousin.
- **Halation.** Bloom on highlight edges, not haze over the whole frame.
- **Vignette.** Lens falloff, not a hard oval. Registry: `vignette`.
- **Chromatic aberration.** Fringes on high-contrast edges, stronger towards the
  frame edge; never three copies of the subject. Registry:
  `chromatic-aberration-wipe`.
- **Film grain.** Different on every frame and inside the image; a static
  overlay is the cousin. Registry: `grain-overlay`, `grain-field`.
- **Light leak.** A wash that wounds the frame edge, not a ring round a lamp.
  Registry: `light-leak`.
- **Double exposure.** Two images sharing density, additive; a dissolve is the
  cousin.
- **Masking and iris.** A shaped window that points. Registry: `iris-reveal`,
  `sdf-iris`.
- **Morphing.** A shared contour with a designed midpoint; a crossfade is the
  cousin.
- **Typography in the world.** Words as objects with scale, parallax and
  occlusion; a caption glued to the frame is the cousin.
- **Floating UI.** Interface planes in 3D space beside the subject, positioned
  from projected anchors every frame (`kit/business-motion-film/templates/projected-overlays.js`).
  Registry: `ui-3d-reveal`, `device-frame-stage`.
- **Particles.** Countable specks from a seeded generator, not a fog layer.
- **Slit-scan.** Ordered geometry in time, not a random tunnel. Registry:
  `slit-scan-reveal`.
- **Oscilloscope trace.** Not a film technique, but MercuryPitch's own motif: a
  beam drawing a waveform with phosphor persistence. Registry:
  `oscilloscope-trace`, `svg-stroke-trace` for a pitch contour drawing on.

### Transitions and editing

Ranked for code-built brand films; the kit's motion grammar comes first.

1. **Carried object, match cut, graphic match.** The same shape at the same
   screen position and size on both sides of the cut (compare frames either
   side; within about 2 per cent). Registry: `match-cut`, `type-match-cut`,
   `text-match-cut`.
2. **Match motion.** Direction and speed continue across the cut. Measure the
   pixels moved per frame on both sides.
3. **Foreground fly-through and zoom-through.** The kit's rule 1.
4. **Whip pan cut.** Blur in one direction on both sides, matched speed.
5. **Axial cut.** The same axis, a snap in scale, no lens breathing.
6. **Smash cut.** An earned state, then its contradiction: a jump in
   brightness, scale and sound together.
7. **Invisible cut.** An occluder fills the frame for one to three frames and
   hides the seam.
8. **Wipe and iris.** A visible moving edge in one direction per sequence; the
   outgoing title leaves before the wipe (kit). Registry: `directional-wipe`,
   `iris-reveal`.
9. **Dissolve.** Two images visible at the midpoint, for time passing; never the
   default joiner. A fade passes through black instead.

Sound can lead or trail the picture across a cut (a J-cut or an L-cut): a whoosh
that starts a few frames before the picture changes reads as cause.

Rhythm: quick cuts need an accelerating curve, not equal lengths; a montage
makes a claim through order; a split screen shows simultaneity.

### Atmosphere

- **Haze.** Far planes paler and cooler: aerial perspective as depth. In
  Three.js, fog in the stage colour, measured until the background matches the
  brand token.
- **Dust motes.** A shaft of light with countable specks.

## 3. Prompting generated footage

For a generated supporting shot (a plate, a macro, an environment), never for
UI or type. Write the geometry, not a mood or a film title.

```text
One continuous [N]-second [shot size] of [subject], [lens] at [camera height and pitch].
[Camera move: what travels or rotates, in which direction, how far, how fast, and what stays fixed.]
[Light: the source, its side and quality, the rim or back light.]
[Composition: where the subject sits, what fills the rest, and the near, mid and far layers.]
[Time: real time, slow motion, or a ramp and where it lands.]
[Palette: the allowed hues; everything else neutral.]
Stable geometry, no cut, no text, no logos, no watermark, [the wrong cousin, banned by name].
```

- One shot per prompt, one move per shot, with its duration.
- Say what must not change: the subject's size in a dolly zoom, the horizon in a
  pan, the product's exact shape.
- Ban the wrong cousin by name: "no zoom" for a dolly, "the object does not
  rotate" for an orbit, "no morphing" for anything rigid.
- Expect generators to drift: portraits towards long-lens close-ups, eye level
  towards a low angle, a high angle towards top-down, a dolly towards a zoom, a
  rim light towards a neon outline, and any UI or lettering towards melted
  shapes. Keep UI and type out of generated shots and composite them in HTML.
- Leave clean negative space where type will land
  (`docs/branding/marketing/README.md` in MercuryPitch).
- Generate several candidates, run `scripts/reference_pass.py` on each, look at
  the dense sheets, and reject any that warp, cut or drift.

Example, a MercuryPitch supporting plate:

```text
One continuous five-second macro shot of a single droplet of liquid mercury resting on black glass,
100 mm macro lens level with the droplet. The camera slides 8 centimetres to the left on a slider;
the droplet stays centred and keeps its exact shape while the reflection of a blue-to-violet light
strip travels across its surface. Soft key from the left, thin rim from behind. The droplet fills
the left third; the right two thirds are clean obsidian background for type. Real time. Palette:
chrome, Signal Blue #58a6ff and Violet #bc8cff only. Stable geometry, no cut, no text, no logos,
no watermark, no zoom, no ripples.
```

## 4. Does the technique read as itself?

What a builder or critic checks on the dense sheets:

| Intended      | Look for                                             | Wrong cousin if instead               |
| ------------- | ---------------------------------------------------- | ------------------------------------- |
| Dolly or push | Near and far elements change overlap (parallax)      | Uniform scale: a zoom                 |
| Pan or tilt   | Everything shifts together                           | Near layers slide: a truck or crane   |
| Orbit or arc  | The background slides behind the subject             | Static background: a turntable        |
| Rack focus    | The sharp plane changes between named planes         | Both sharp, or neither                |
| Whip pan      | Horizontal streaks, unreadable middle, one direction | Readable middle, radial or mixed blur |
| Match cut     | The same contour at the same place on both sides     | A crossfade or a morph                |
| Match motion  | Speed and direction continue across the cut          | A reset or a stop at the cut          |
| Speed ramp    | Returns to real time, no pose jump at the joints     | Slow motion throughout                |
| Dissolve      | Two images at the midpoint                           | Black at the midpoint: a fade         |
| Freeze frame  | Zero change, deliberate, final or dressed            | An accidental hold                    |

## 5. Looking up anything else

The full catalogue is at <https://melies.co/cinematic-techniques>. Each
technique has a page at
`https://melies.co/cinematic-techniques/<category>/<slug>`, where the category
is one of `camera-movement`, `framing`, `camera-angles`, `lighting`,
`composition`, `lenses`, `color`, `time-and-motion`, `effects`, `editing`,
`atmosphere`, `genre-looks` or `viral-looks`
(for example `camera-movement/dolly-zoom`). Each page covers the narrative
function, how it works, when to use it, look-alikes, examples from films, a
prompt and what usually goes wrong. Read the page before using a technique this
file does not cover, then add it here.
