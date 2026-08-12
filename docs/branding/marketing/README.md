# Marketing plates

Backdrops for campaign end cards. **Plates carry no text** — type is
composited by [`scripts/compose-poster.py`](../../../scripts/compose-poster.py)
so that position, size and copy are parameters rather than a re-generation.

| Plate | Used by |
|---|---|
| `cta-plate-pitch-curve.png` | Noise UGC playbook 19290, slide 4 |

## Why the split

A generative model will happily render the headline into the image, and the
first version of this card was made that way. The problem is that every
adjustment — move the text up, make it larger — re-rolls the entire image, so
the composition changes along with the thing you wanted to change. The type
also comes back subtly wrong: one variant dropped the full stop from "Find
your pitch.", another appended one to the URL, turning it into
`mercurypitch.com/mirror.`

Generating a clean plate once and drawing type over it fixes both. The
backdrop is stable across revisions, and the copy is exact because it is
never generated.

## Regenerating a plate

Plates come from an image model at 9:16. Two rules make them composable:

1. **Say no text, emphatically.** Models add captions to anything that looks
   like a poster.
2. **Reserve the empty half.** State that the lower 55% must be clean, unbroken
   background — that is where the type lands.

Output is scaled to width and centre-cropped to exactly 1080×1920. Generators
tend to emit ~9:16.1, which is close enough to look right and wrong enough to
letterbox on a phone.

## Adding type

```bash
curl -sSL -o /tmp/Outfit.ttf \
  https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf

python3 scripts/compose-poster.py \
  --backdrop docs/branding/marketing/cta-plate-pitch-curve.png \
  --font /tmp/Outfit.ttf \
  --out /tmp/poster.png \
  --top 0.62
```

`--top` is the headline cap position as a fraction of height; `--width` is the
headline's share of image width. Defaults put the type just under the curve
and leave the bottom third clear of the caption and username overlays that
social platforms draw over the frame.

Outfit is not vendored — `index.html` loads it from a CDN, so there is no
local copy to point at. Pillow is not a project dependency either; install it
into whatever environment runs the script.
