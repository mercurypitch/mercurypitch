# Voice Mirror — Legend Portraits: MidJourney Prompts (copy-paste ready)

Twelve "voice twin" portraits, one per legend. Each block below is a **complete
prompt** — paste it straight into MidJourney, nothing to append.

**How to use**

1. Paste a prompt, generate, upscale the best of the four.
2. Save it to `public/legends/<slug>.webp` (slugs in the table at the bottom).
   Target a **4:5 portrait**, ≤ ~120 KB (WebP/AVIF).
3. Point the legend at it — one line in
   `src/features/mirror/LegendCaricature.tsx`:
   ```ts
   'Elvis Presley': { epithet: '…', imageSrc: '/legends/elvis.webp', /* …vector kept as fallback */ },
   ```
   The reveal frame renders the image instead of the constellation. Done.

**Tip — keep the set consistent:** generate **Elvis** first, then in MidJourney
grab that image's style code (`/prefer suffix` or the `--sref` from its job) and
add the same `--sref <code>` to every other prompt. All twelve then share one
lighting/rendering style so they read as a family. (The prompts already share a
fixed style block, so this is optional polish.)

> These depict real public figures as caricatures. MidJourney can occasionally
> soften a named celebrity — the descriptive features in each prompt carry the
> likeness if the name is toned down. Confirm likeness/usage rights before
> shipping commercially.

---

### Elvis Presley — `elvis` (Baritone)
```
Elvis Presley in his 1968 comeback special, glossy jet-black pompadour, thick sideburns, popped-up white collar, chiselled cheekbones, sultry lopsided half-smile, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Frank Sinatra — `sinatra` (Baritone)
```
Frank Sinatra in the 1950s, grey felt fedora tilted rakishly over one bright blue eye, sharp charcoal suit with a skinny tie, confident crooner's smirk, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Freddie Mercury — `freddie` (Tenor)
```
Freddie Mercury at Live Aid 1985, thick black moustache, short dark hair, white tank top, one arm thrust triumphantly upward gripping a chrome half mic-stand, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Bruce Dickinson — `bruce-dickinson` (Tenor)
```
Bruce Dickinson, heavy-metal frontman caught mid-scream, long wild flying brown hair, fierce eyes, denim and leather, sweat catching the stage light, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Johnny Cash — `johnny-cash` (Bass)
```
Johnny Cash dressed all in black, slicked-back dark hair, deep-lined weathered face, stern unflinching gaze, an acoustic guitar slung across his chest, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Barry White — `barry-white` (Bass)
```
Barry White in the 1970s, short black afro, thick full goatee, wide-collared satin suit, heavy gold medallion, warm knowing smile, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Amy Winehouse — `amy-winehouse` (Alto)
```
Amy Winehouse, towering jet-black beehive tied with a ribbon, dramatic black winged eyeliner, red lips, little bird neck tattoo, retro-soul, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Cher — `cher` (Alto)
```
Cher, waist-length dead-straight jet-black centre-parted hair, striking sculpted cheekbones, dramatic long lashes, bold pop-diva glamour, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Adele — `adele` (Mezzo-soprano)
```
Adele, glamorous 1960s blonde bouffant updo, bold winged cat-eye eyeliner, classic red lip, poised and elegant, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Whitney Houston — `whitney-houston` (Mezzo-soprano)
```
Whitney Houston in the 1980s, voluminous big bouncy curls, luminous radiant smile, one sparkling sequined shoulder, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Mariah Carey — `mariah-carey` (Soprano)
```
Mariah Carey, long cascading honey-blonde waves, glamorous, one hand lifted reaching an impossibly high whistle note, a delicate butterfly drifting nearby, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

### Celine Dion — `celine-dion` (Soprano)
```
Celine Dion, short elegant chestnut hair, one hand pressed to her heart mid power-ballad, radiant and emotional, stylized caricature portrait with an exaggerated yet recognizable likeness, head and shoulders, three-quarter view, deep indigo-to-black cosmic nebula background (#0b1026 to #090714) dusted with faint stars, rim-lit in soft gold and periwinkle starlight, gentle glow, cinematic, richly detailed face, clean and elegant --ar 4:5 --style raw --stylize 250 --v 6.1 --no text, watermark, frame, signature
```

---

### Filenames & wiring

| Legend | Voice type | File |
|---|---|---|
| Elvis Presley | Baritone | `public/legends/elvis.webp` |
| Frank Sinatra | Baritone | `public/legends/sinatra.webp` |
| Freddie Mercury | Tenor | `public/legends/freddie.webp` |
| Bruce Dickinson | Tenor | `public/legends/bruce-dickinson.webp` |
| Johnny Cash | Bass | `public/legends/johnny-cash.webp` |
| Barry White | Bass | `public/legends/barry-white.webp` |
| Amy Winehouse | Alto | `public/legends/amy-winehouse.webp` |
| Cher | Alto | `public/legends/cher.webp` |
| Adele | Mezzo-soprano | `public/legends/adele.webp` |
| Whitney Houston | Mezzo-soprano | `public/legends/whitney-houston.webp` |
| Mariah Carey | Soprano | `public/legends/mariah-carey.webp` |
| Celine Dion | Soprano | `public/legends/celine-dion.webp` |

Once the files exist, add `imageSrc: '/legends/<slug>.webp'` to each legend in
`LegendCaricature.tsx`. The constellation art stays as the fallback for any
legend without an image yet. Integration mechanics: `voice-mirror-legend-portraits.md`.
