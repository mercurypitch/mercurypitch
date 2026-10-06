# Glassworks UI materials

One 2,632-byte WebP supplies the static C3 enamel reflection field. Responsive
SVG geometry provides the B1 facets, C3 flowing edges and H1A/H2A tiles and
H3A/H3D plaques. The generated lettering and large concept boards are not
shipped. The temple uses a live four-column SVG. Text, progress, state and input
are DOM.

Masters are preserved in the Proton creative archive at
`<creative-assets>/glass-adventure/ui-layout-audition-v1/material-kit-v1/`.
`provenance.json` records source hashes, crop bounds, derivative dimensions,
bytes and decoded RGBA budgets. Cropping/resizing/WebP encoding are packaging;
the clean opaque masters were generated with the built-in ChatGPT image tool.
The enamel field is a clean centre crop with no lettering or perimeter. The
frame measures its host and draws fixed-width bevels and corners, avoiding the
rectangular face seams of the original nine-slice trial. Opacity and gloss remain
adjustable without destructive image edits. Superseded derivatives and their
receipt are preserved in the archive, outside the source package.

The transparent-alpha refinement was rejected because extraction left coloured
fringes. It is archived for comparison and never referenced at runtime. The
production prompt asks for a precise blank straight-on 3:1 plate, no text,
icons, outside shadow or damaged edges, opaque uniform gray background, thin
champagne gold, clean aqua bevels and the selected crystal/celadon material.

The controls in `game-appearance.ts` set backing opacity, gloss, rim brightness,
gold strength, corner size, inset and note diameter. `GameUI.module.css` owns
bevel brightness, backing and semantic colours. Reduced transparency overrides
the backing, including Settings and live camera audition, without changing the
world, microphone or sound preferences. No blur, additional canvas, material
animation or scene memory budget is introduced.
