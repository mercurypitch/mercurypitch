Item 1 (DECISIONS 214): L.mercGate reads the root on the pass frame the renderer shows (video time =
data-media-start + t - data-start), so s13's local rootFromTag is gone. Only m-blue-s13's root x moves
(assets/merc/roots.js: frames 842 to 897, the two hops; every other chunk's x is 0 on every frame).

s13-hops-30fps.mp4 / merc-x-30fps.txt: s13 at 27.70 to 29.40 at 30 fps, as the film renders it; Merc's
body (blue pixels, y 560 to 845) frame by frame. Both carries accelerate evenly (power1.in) and land on
x 700 and 1290 (box 638-767 and 1228-1357); no frame snaps (group E's 50 px for 3 frames at hop 2's
start is gone); after each landing the box moves 2 px a frame or less.

s13-hops-60fps.mp4 / merc-x.txt: the same at 60 fps. Two single frames after hop 2 (29.283, 29.383) sit
9 px left: at 60 fps every other frame falls exactly on a pass-frame boundary (video time k/60 + 0.05),
where the renderer and the index may differ by one frame while the root eases back from 0.38 (9.6 px a
frame). At 30 fps the film's frames sit half a pass frame from any boundary, so this cannot occur.
