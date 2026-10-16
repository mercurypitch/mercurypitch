# Build guide: scene builders for Lesson 1

Read this, `STORYBOARD.md` (your rows), `HANDOFFS.md` (your entry and exit frames), and
`assets/lib/lesson.js` + `assets/lib/lesson.css` (the shared kit) before writing a scene.
`BRIEF.md` and `FACTS.md` bound what may appear on screen.

## Your files

- You own only the scene files you were given: `compositions/<scene-id>.html`. Do not edit
  `index.html`, `assets/lib/*`, `assets/cues.js`, `assets/scenes.js`, `tools/*` or another
  builder's scene. If the shared kit lacks something, write it inside your scene file and say so in
  your report (the director may promote it into the kit).
- Lab renders and stills go in `lab/<scene-id>/` (gitignored, yours to fill).

## The scene skeleton (copy exactly; replace ID and the body)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div
      id="ID"
      data-composition-id="ID"
      data-start="0"
      data-duration="DUR"
      data-width="1920"
      data-height="1080"
    >
      <div class="scene" id="ID-scene"></div>
      <!-- Merc videos MUST be static tags here: <video id="sNN-<pass>" data-merc="<pass>" class="clip" muted playsinline></video> (+ a data-merc-refl twin); tools/merc-tags.py times them -->
      <script>
        ;(function () {
          const SID = 'ID'
          const D = L.dur(SID) // scene length in seconds
          const at = (cue, edge, off) => L.at(SID, cue, edge, off) // cue time in scene time
          const root = document.getElementById(SID + '-scene')
          const room = L.room(root, { floor: false })
          const tl = gsap.timeline({ paused: true })
          // ... build and animate ...
          window.__timelines = window.__timelines || {}
          window.__timelines[SID] = tl
        })()
      </script>
    </div>
  </body>
</html>
```

`DUR` must equal `L.dur(SID)` to 3 decimals; read it from `assets/scenes.js`. Scene time starts at
0 on your first frame. Never type a film time: always `at('b14')`, `at('b14', 'end', -0.2)`.

## Rules that cost a render when missed

- Every animated value is a function of timeline time only. No `Date.now`, `Math.random`,
  `requestAnimationFrame`, `setTimeout`, CSS animations or transitions, `repeat: -1`. Use
  `L.rng(seed)` for any scatter.
- Per-frame drawing (waves, spirals, counters): `L.clock(tl, D, (t) => { ... })`. It runs on
  every seek. Do not use `onUpdate` callbacks; the runtime may suppress them.
- Never put a CSS `transform` on an element GSAP also animates; use `fromTo`. A second `fromTo`
  on the same target and property needs `immediateRender: false`.
- Do not tween `visibility`, `display` or `autoAlpha` on a `.clip`; animate a child's opacity.
- `<video>` elements need `class="clip"`, `data-start`, `data-duration` (scene time), `muted`,
  and they must be static in the HTML: HyperFrames parses videos before scripts run, so a
  script-made video renders as nothing. For Merc, write `<video id="sNN-<pass>" data-merc="<pass>"
class="clip" muted playsinline>` (plus a `data-merc-refl` twin for the reflection), run
  `python3 tools/merc-tags.py` to time them from the cue sheet, then call `L.merc()`, which adopts
  and places them. Prove Merc with `node tools/lab.mjs <scene> --clip`: snapshots do not show
  videos inside sub-compositions.
- No `<br>` in text; set lines as separate elements. Fonts only from `lesson.css`.
- Text: essential labels at least 48 px, kickers at least 30 px, nothing essential below y = 896
  (captions sit in the bottom 17 %). Contrast at least 4.5:1: ink `#e6edf3`, ink-2 `#a8b3bf`,
  blue `#58a6ff`, aqua, violet, gold and orange `#ff7448` all pass on `#0d1117`; `#848d97` is
  only for decoration.
- On-screen words never repeat a whole narrated sentence: a key term, a number, a label.

## Motion rules (the director checks these on your stills and clip)

1. Frame 0 of your scene is a finished picture, and equals the previous scene's last frame for
   every carried object (`HANDOFFS.md`).
2. One main move leads; smaller ones overlap under it. The frame never starts and stops all at
   once. No linear easing on movement (linear only for clocks and travelling waves).
3. Things land slowly enough to read, leave fast. Typical: enter 0.5 to 0.8 s `power3.out` or
   `expo.out`, exit 0.3 to 0.45 s `power3.in`.
4. Every visual event is tied to the word that names it: start it 0.2 s before to 0.1 s after
   the cue. Use cue edges, and offsets from them, for everything.
5. Holding a diagram is fine while it is being explained, but something inside it must move
   (a travelling wave, a breathing glow, a 2 to 3 % camera drift per 10 s). No still stretch longer
   than 0.5 s.
6. Camera moves use `L.camera(tl, room, at, dur, from, to)` so far, mid and near layers parallax.
   Put diagrams in `room.mid`, dust in `room.near` (`L.dust`), and text that must not parallax in
   `room.top`.
7. Fill the frame: the lead subject takes 60 to 85 % of the frame in feature beats.
8. The gold `#ffd84d` means "fits / the answer". Blue means blue Merc's note, orange orange
   Merc's, violet a contrast case. Every coloured thing also carries a label.

## Proving a scene before you hand it back

```bash
cd output/motion/lesson-01
export HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1
npx --yes hyperframes@0.8.97 check                         # 0 errors for the whole project
node tools/lab.mjs <scene-id> 0.0,1.2,3.4                     # stills of YOUR scene at scene times
node tools/lab.mjs <scene-id> --clip                          # a draft clip of your scene (30 fps)
```

Look at your stills yourself (Read the PNGs). Fix what is ugly, empty, colliding, cut off or
illegible before you report. Report: the files you wrote, what each shot does with its cue times,
anything you could not do, and the still paths.
