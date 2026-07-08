# Voice Mirror — Legend "Voice Twin" Portraits

The results card hides the famous-singer match until the singer taps it (the
reveal). The back / overlay shows the legend as art. Two art tiers:

1. **Constellation portraits (shipping now).** Pure SVG in
   `src/features/mirror/LegendCaricature.tsx` — a shared nebula bust + each
   legend's signature (Elvis pompadour, Sinatra fedora, Amy beehive, Celine's
   heart-hand, Mariah's whistle-note …) traced as a gold constellation over an
   ambient starfield. Tiny, vector-crisp, and drawn in the *same* visual
   language as the voiceprint card so it blends instead of sitting on top.

2. **Richer raster portraits (optional upgrade).** Generate per-legend art in
   MidJourney and drop it into the exact same frame — no code changes beyond
   pointing a legend at its image.

## How to swap a richer image in

`LegendArt` already supports `imageSrc`. Once you have an image:

```ts
// src/features/mirror/LegendCaricature.tsx
'Elvis Presley': {
  epithet: 'The King of Rock and Roll',
  imageSrc: '/legends/elvis.webp', // ← renders the image instead of the vector
  silhouette: [...], stars: [...],  // kept as the fallback
},
```

- Put files in `public/legends/<slug>.webp` (served from root, **not** bundled,
  so the mirror bundle stays lean). Only the revealed legend's image loads.
- Target a **4:5 portrait** (the frame is `220 × 280`); `preserveAspectRatio`
  is `slice`, so it fills and centre-crops.
- Prefer WebP/AVIF, ≤ ~120 KB each. A dark, cosmic background that matches the
  card (`#0b1026 → #090714`) blends best; a transparent PNG also works and lets
  the card's own gradient show through.

## MidJourney prompts

Keep one **shared style suffix** on every legend so the twelve read as a set.
Vary only the subject line. (MidJourney can be strict about real public
figures; if a name is refused, keep the descriptive feature line — the era +
signature look usually carries the likeness. Review likeness/usage rights
before shipping real-person portraits commercially.)

**Shared suffix** (append to each subject line):

```
, stylized caricature portrait, head and shoulders, three-quarter view,
deep indigo-to-black cosmic nebula background (#0b1026 to #090714), rim-lit in
soft gold and periwinkle starlight, faint scattered constellation stars,
elegant, minimal, clean painterly shapes, subtle glow, centered, no text
--ar 4:5 --style raw --stylize 250
```

**Subjects** (voice type in parentheses = which range maps to them):

| Legend | Prompt subject line |
|---|---|
| **Elvis Presley** (Baritone) | `Elvis Presley, 1968, glossy black pompadour, sideburns, upturned white collar, sultry half-smile` |
| **Frank Sinatra** (Baritone) | `Frank Sinatra, 1950s crooner, grey fedora tilted low, sharp suit and skinny tie, bright blue eyes` |
| **Freddie Mercury** (Tenor) | `Freddie Mercury, 1986, black moustache, white tank top, arm raised gripping a half mic-stand` |
| **Bruce Dickinson** (Tenor) | `Bruce Dickinson, heavy-metal frontman, long wild brown hair mid-headbang, mouth open in a scream` |
| **Johnny Cash** (Bass) | `Johnny Cash, all in black, slicked dark hair, acoustic guitar slung across chest, weathered stare` |
| **Barry White** (Bass) | `Barry White, 1970s, short afro, thick goatee, wide-collar suit, gold medallion, warm smile` |
| **Amy Winehouse** (Alto) | `Amy Winehouse, towering black beehive, heavy winged eyeliner, retro 60s soul look` |
| **Cher** (Alto) | `Cher, very long straight jet-black centre-parted hair, bold glamour, striking cheekbones` |
| **Adele** (Mezzo-soprano) | `Adele, 1960s bouffant updo, dramatic winged cat-eye liner, elegant and poised` |
| **Whitney Houston** (Mezzo-soprano) | `Whitney Houston, radiant 1980s big curls, luminous smile, sequined shoulder` |
| **Mariah Carey** (Soprano) | `Mariah Carey, long honey-blonde waves, one hand raised reaching a whistle note, butterfly motif` |
| **Celine Dion** (Soprano) | `Celine Dion, short elegant hair, hand pressed to heart mid-belt, emotive` |

Slugs for filenames: `elvis, sinatra, freddie, bruce-dickinson, johnny-cash,
barry-white, amy-winehouse, cher, adele, whitney-houston, mariah-carey,
celine-dion`.

The legend → voice-type mapping lives in `src/lib/mirror/singer-match.ts`
(two legends per type, chosen deterministically from the detected range).
