# Merc — Mascot Look-Dev

AI look-development concepts for the MercuryPitch hero mascot, **Merc**. These are
*ideation references only* — the shipped mascot is rebuilt as original, hand-authored
vector (see [`../BRAND.md`](../BRAND.md) §7 and [`../MASCOT.md`](../MASCOT.md)).

Interactive lookbook (all six concepts + the animated SVG direction studies):
<https://claude.ai/code/artifact/c558e216-b889-4477-abe0-ae7903cdd597>

## Decision (2026-07-13)

**Direction A — "Lumen droplet" is Merc.** A soft luminous droplet, violet `#bc8cff` →
teal `#2dd4bf` spectrum body with a mirror-chrome rim, on obsidian `#0d1117`.

- **Canonical base identity:** [`concepts/direction-a-lumen-2.png`](./concepts/direction-a-lumen-2.png)
  — big expressive eyes, friendliest silhouette, best base for emoting across states.
- **Serene / sleep expression:** [`concepts/direction-a-lumen-1.png`](./concepts/direction-a-lumen-1.png)
  — eyes closed, calm; keep the A1 chrome rim as a brand cue on the A2 body.
- **Archived for other uses** (marketing key art, pitch-deck, socials, alternate motifs):
  Direction **B — Quicksilver chrome** and Direction **C — The performer**. Not the app mascot.

## Provenance

| File | Direction | Higgsfield job id |
| --- | --- | --- |
| `concepts/direction-a-lumen-1.png` | A · Lumen droplet — serene | `1238e8a6-d12d-4845-b0c4-27c6a15d9774` |
| `concepts/direction-a-lumen-2.png` | A · Lumen droplet — big eyes (**Merc base**) | `0a5162ef-309b-47f3-baf0-7f74fed5ec1c` |
| `concepts/direction-b-chrome-1.png` | B · Quicksilver chrome — grin | `f2373ae3-fef6-41f2-be17-1ae573a1323f` |
| `concepts/direction-b-chrome-2.png` | B · Quicksilver chrome — arms out | `50f994db-bd2e-4de7-8d5e-34cb6dc30d0a` |
| `concepts/direction-c-performer-1.png` | C · The performer — eyes closed | `eafd0bb1-6124-4369-9008-01a1dd5f974a` |
| `concepts/direction-c-performer-2.png` | C · The performer — eyes open | `2d82d3fb-59da-4705-845f-f181c1d42d29` |

- **Tool:** Higgsfield → Nano Banana Pro (server model `nano_banana_2`)
- **Params:** aspect `1:1`, resolution `1k`, `count: 2` per direction — 6 credits total
- **Date:** 2026-07-13

### Prompts

**A — Lumen droplet**

```
friendly abstract mascot character, a soft rounded droplet of luminous liquid, smooth
gradient body violet #bc8cff to teal #2dd4bf, subtle mirror-chrome rim light, simple
serene face, small floating music notes, deep obsidian #0d1117 background, flat-3D
hybrid, clean vector-friendly shapes, centered, full body, app mascot design, clean
concept art, no text, no watermark
```

**B — Quicksilver chrome**

```
cute mascot character, a droplet of liquid mercury with mirror-chrome HDR surface, big
friendly white oval eyes, cheerful smile, glowing pitch sine-wave rippling across its
belly in blue #58a6ff teal #2dd4bf violet #bc8cff, playful squash-and-stretch bounce
pose, tiny reflective droplets floating, obsidian #0d1117 background, premium 3D render,
studio lighting, centered, full body, clean concept art, no text, no watermark
```

**C — The performer**

```
cute mascot character, a liquid-metal droplet singing joyfully, sound as a glowing ribbon
waveform spiraling from its mouth in blue #58a6ff teal #2dd4bf violet #bc8cff, tiny chrome
headphones, dark chrome body with violet-teal iridescence, obsidian #0d1117 background,
flat-3D hybrid, warm encouraging expression, centered, full body, clean concept art, no
text, no watermark
```

## Legal (BRAND.md §7)

- AI output = ideation only. The mascot that **ships is human-authored vector**
  (copyrightable, tiny, crisp), rebuilt from these references — not traced or exported.
- Reverse-image-search the locked frame before committing the final design.
- Keep this prompt/seed log; add Merc to the trademark scope alongside the mark.

## Next

1. Lock the **expression sheet** (idle / listening / celebrate / encouraging / singing)
   from the Merc base, referenced to `direction-a-lumen-2.png` for identity consistency.
2. Rebuild as original vector; ship `<Mascot state energy />` (SVG + CSS) wired to the
   live accuracy bands. See [`../MASCOT.md`](../MASCOT.md) Phase 1.
3. Marketing loops from the locked sheet (Higgsfield video); B/C concepts feed alternate
   key art.
