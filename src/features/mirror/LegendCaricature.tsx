// ============================================================
// Voice Mirror — legend "constellation portraits".
//
// Each famous-singer match is drawn in the SAME visual language as
// the voiceprint card: an elegant nebula bust (a shared head +
// shoulders silhouette, plus each legend's signature hair / hat /
// accessory) with the signature traced as a bright gold constellation
// over an ambient starfield. Vector, tiny, and it melts into the star
// card instead of sitting on top like a pasted photo.
//
// Recognition rides on the filled silhouette (reliable) + the name;
// the gold constellation adds the cosmic sparkle. The art is
// deliberately swappable — set `imageSrc` on a legend and a richer
// raster / MidJourney portrait renders instead, no other changes.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'

interface Star {
  x: number
  y: number
  /** Radius; bright feature stars are larger. */
  r?: number
  /** Dim accent star (blue, no glow) rather than a bright gold feature star. */
  dim?: boolean
}

export interface LegendArt {
  /** One-line flourish shown under the name on reveal. */
  epithet: string
  /** Faint blue nebula shapes (hair, hats, long hair, instruments, lapels). */
  silhouette?: string[]
  /** Warm gold-lit signature marks (moustache, heart-hand, goatee). */
  accent?: string[]
  /** Bright constellation stars sparkling the signature. */
  stars: Star[]
  /** Edges (star index pairs) drawn as faint constellation lines. */
  lines?: [number, number][]
  /** Optional raster / MidJourney portrait; when set it replaces the vector art. */
  imageSrc?: string
}

// Portrait canvas is 220 × 280. A single connected bust so every legend reads
// as the same "person", varied only by hair / accessory + constellation.
const BASE_BODY =
  'M110,52 C86,52 72,72 72,98 C72,118 82,134 94,142 L94,150 ' +
  'C58,158 40,200 34,280 L186,280 C180,200 162,158 126,150 L126,142 ' +
  'C138,134 148,118 148,98 C148,72 134,52 110,52 Z'

// Deterministic ambient starfield (blends the portrait into the card sky).
const AMBIENT: Star[] = Array.from({ length: 30 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453
  const b = Math.sin(i * 78.233) * 12543.1234
  return {
    x: 6 + (a - Math.floor(a)) * 208,
    y: 6 + (b - Math.floor(b)) * 268,
    r: 0.5 + (a - Math.floor(a)) * 1.1,
    dim: true,
  }
})

export const LEGENDS: Record<string, LegendArt> = {
  'Elvis Presley': {
    epithet: 'The King of Rock and Roll',
    imageSrc: '/legends/elvis.webp',
    silhouette: [
      // Towering pompadour swept up and back.
      'M74,66 C60,22 116,10 142,34 C154,46 152,64 142,68 C136,44 92,44 86,68 Z',
      // Sideburns.
      'M76,104 L84,104 L80,128 Z',
      'M144,104 L136,104 L140,128 Z',
      // Upturned collar.
      'M92,168 L110,150 L128,168 L120,190 L110,176 L100,190 Z',
    ],
    stars: [
      { x: 82, y: 60 },
      { x: 98, y: 34 },
      { x: 122, y: 30, r: 3.2 },
      { x: 140, y: 52 },
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 110, y: 186, r: 3 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },

  'Frank Sinatra': {
    epithet: 'Ol’ Blue Eyes',
    imageSrc: '/legends/sinatra.webp',
    silhouette: [
      // Fedora: crown + wide brim (tilted, the way he wore it).
      'M82,54 C84,28 142,32 138,58 Z',
      'M54,64 C54,54 166,50 166,58 C166,68 56,74 54,64 Z',
      // Hat band highlight.
      'M84,55 C96,49 130,47 138,53 L138,58 C128,52 96,54 84,60 Z',
    ],
    stars: [
      { x: 58, y: 62, r: 3 },
      { x: 112, y: 32 },
      { x: 162, y: 56, r: 3 },
      { x: 96, y: 110, dim: true },
      { x: 124, y: 110, dim: true },
      { x: 110, y: 152 },
    ],
    lines: [
      [0, 1],
      [1, 2],
    ],
  },

  // imageSrc portraits: Style A "mercury accents" caricatures (Higgsfield
  // Nano Banana 2, docs/plans/voice-mirror-handoff-2026-07-09.md §3) in
  // public/legends/. The vector constellation stays as the fallback for any
  // legend without an image.
  'Freddie Mercury': {
    epithet: 'Champion of the mic stand',
    imageSrc: '/legends/freddie.webp',
    silhouette: [
      // Short hair cap.
      'M76,68 C76,50 144,50 144,68 C144,58 76,58 76,68 Z',
      // Raised half mic-stand.
      'M170,58 L176,58 L176,214 L170,214 Z',
    ],
    accent: [
      // The moustache.
      'M88,120 C88,132 100,138 110,136 C120,138 132,132 132,120 ' +
        'C126,130 118,132 110,131 C102,132 94,130 88,120 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 173, y: 58, r: 3.4 }, // mic head
      { x: 173, y: 214 },
      { x: 110, y: 158 },
    ],
    lines: [[2, 3]],
  },

  'Johnny Cash': {
    epithet: 'The Man in Black',
    imageSrc: '/legends/johnny-cash.webp',
    silhouette: [
      // Side-swept hair.
      'M80,66 C80,48 140,48 140,66 C140,56 106,52 80,66 Z',
      // Acoustic guitar slung across the torso: body + neck.
      'M100,214 C86,214 80,232 90,244 C100,254 122,252 126,236 ' +
        'C130,220 116,212 104,214 Z',
      'M104,220 L58,182 L52,190 L98,228 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 110, y: 150 },
      { x: 106, y: 232, r: 3.2 }, // guitar body
      { x: 55, y: 186, r: 3 }, // headstock
    ],
    lines: [[3, 4]],
  },

  'Barry White': {
    epithet: 'The Walrus of Love',
    imageSrc: '/legends/barry-white.webp',
    silhouette: [
      // Short hair.
      'M82,66 C82,54 138,54 138,66 C138,60 82,60 82,66 Z',
      // Broad suit lapels.
      'M96,152 L74,214 L98,196 Z',
      'M124,152 L146,214 L122,196 Z',
    ],
    accent: [
      // Goatee.
      'M100,150 C100,164 120,164 120,150 C118,160 102,160 100,150 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 82, y: 210 },
      { x: 138, y: 210 },
      { x: 110, y: 178, r: 3 }, // medallion
    ],
    lines: [
      [2, 4],
      [4, 3],
    ],
  },

  'Amy Winehouse': {
    epithet: 'The beehive & the blues',
    imageSrc: '/legends/amy-winehouse.webp',
    silhouette: [
      // Towering beehive.
      'M80,66 C70,8 150,8 140,66 C152,36 150,18 110,14 C70,18 68,36 80,66 Z',
      // Fringe.
      'M84,64 C90,50 98,50 102,66 Z',
    ],
    stars: [
      { x: 82, y: 56 },
      { x: 84, y: 28 },
      { x: 110, y: 16, r: 3.2 },
      { x: 136, y: 28 },
      { x: 138, y: 56 },
      { x: 88, y: 106, r: 2.8 }, // eyeliner flick
      { x: 132, y: 106, r: 2.8 },
      { x: 110, y: 158 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },

  Cher: {
    epithet: 'The Goddess of Pop',
    imageSrc: '/legends/cher.webp',
    silhouette: [
      // Very long, straight, centre-parted hair.
      'M80,58 C72,58 66,150 70,246 L90,246 C88,150 86,86 98,60 Z',
      'M140,58 C148,58 154,150 150,246 L130,246 C132,150 134,86 122,60 Z',
      'M84,56 C84,46 106,44 110,54 C114,44 136,46 136,56 C130,50 90,50 84,56 Z',
    ],
    stars: [
      { x: 110, y: 54, r: 3 }, // centre part
      { x: 78, y: 120, dim: true },
      { x: 142, y: 120, dim: true },
      { x: 96, y: 110, dim: true },
      { x: 124, y: 110, dim: true },
      { x: 110, y: 150 },
    ],
    lines: [
      [1, 0],
      [0, 2],
    ],
  },

  Adele: {
    epithet: 'Voice like rolling thunder',
    imageSrc: '/legends/adele.webp',
    silhouette: [
      // Voluminous 60s bouffant, side-swept.
      'M74,66 C58,22 106,14 126,26 C156,42 156,66 146,70 C140,44 90,44 84,68 Z',
    ],
    stars: [
      { x: 80, y: 60 },
      { x: 84, y: 34 },
      { x: 110, y: 26, r: 3.2 },
      { x: 138, y: 40 },
      { x: 96, y: 110, dim: true },
      { x: 124, y: 110, dim: true },
      { x: 132, y: 112, r: 2.6 }, // cat-eye flick
      { x: 110, y: 158 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },

  'Whitney Houston': {
    epithet: 'The Voice',
    imageSrc: '/legends/whitney-houston.webp',
    silhouette: [
      // Big, voluminous 80s curls.
      'M70,66 C56,22 164,22 150,66 C162,40 158,16 110,12 C62,16 58,40 70,66 Z',
      'M64,60 C56,46 60,34 70,38 Z',
      'M156,60 C164,46 160,34 150,38 Z',
    ],
    stars: [
      { x: 72, y: 44 },
      { x: 92, y: 24 },
      { x: 110, y: 18, r: 3 },
      { x: 128, y: 24 },
      { x: 148, y: 44 },
      { x: 96, y: 110, dim: true },
      { x: 124, y: 110, dim: true },
      { x: 150, y: 128, r: 3 }, // raised mic
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },

  'Bruce Dickinson': {
    epithet: 'The air-raid siren',
    imageSrc: '/legends/bruce-dickinson.webp',
    silhouette: [
      // Wild long metal hair.
      'M76,64 C56,70 56,150 74,196 L92,186 C80,140 82,84 92,62 Z',
      'M144,64 C164,70 164,150 146,196 L128,186 C140,140 138,84 128,62 Z',
      'M82,58 C82,38 138,38 138,58 C130,44 118,52 110,42 C102,52 90,44 82,58 Z',
    ],
    accent: [
      // Mid-scream open mouth.
      'M102,126 C102,138 118,138 118,126 C118,120 102,120 102,126 Z',
    ],
    stars: [
      { x: 96, y: 104, dim: true },
      { x: 124, y: 104, dim: true },
      { x: 168, y: 86, r: 3 }, // raised fist
      { x: 150, y: 120 },
      { x: 110, y: 128, r: 2.6 },
    ],
    lines: [[3, 2]],
  },

  'Kurt Cobain': {
    epithet: 'The voice of a generation',
    imageSrc: '/legends/kurt-cobain.webp',
    silhouette: [
      // Chin-length curtains of messy hair framing the face.
      'M78,60 C64,70 66,120 74,150 L90,144 C82,116 84,80 94,62 Z',
      'M142,60 C156,70 154,120 146,150 L130,144 C138,116 136,80 126,62 Z',
      'M84,58 C92,46 128,46 136,58 C124,52 96,52 84,58 Z',
      // Striped-tee band across the chest.
      'M54,222 C82,208 138,208 166,222 L166,234 C138,220 82,220 54,234 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 110, y: 152 },
      { x: 146, y: 130, r: 3 }, // mic held close
      { x: 146, y: 160 },
    ],
    lines: [[3, 4]],
  },

  'David Bowie': {
    epithet: 'The Starman',
    imageSrc: '/legends/david-bowie.webp',
    silhouette: [
      // Spiky Ziggy mullet.
      'M78,62 C74,30 100,22 110,26 C120,22 146,30 142,62 C136,40 84,40 78,62 Z',
      'M88,34 L96,14 L102,32 Z',
      'M106,28 L112,8 L118,28 Z',
      'M124,32 L132,14 L138,36 Z',
    ],
    accent: [
      // The Aladdin Sane lightning bolt across the right eye.
      'M118,84 L134,84 L126,102 L136,102 L112,134 L120,110 L110,110 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 110, y: 152 },
      { x: 112, y: 10, r: 3.2 }, // the star above the starman
      { x: 152, y: 96 },
    ],
    lines: [[2, 3]],
  },

  'Mariah Carey': {
    epithet: 'Queen of the whistle note',
    imageSrc: '/legends/mariah-carey.webp',
    silhouette: [
      // Long cascading waves framing the face.
      'M78,64 C66,58 64,130 74,182 L92,176 C82,128 84,84 94,62 Z',
      'M142,64 C154,58 156,130 146,182 L128,176 C138,128 136,84 126,62 Z',
      'M86,58 C86,46 134,46 134,58 C126,50 94,50 86,58 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 110, y: 152 },
      { x: 148, y: 96 }, // soaring whistle note
      { x: 166, y: 64 },
      { x: 182, y: 36, r: 3.6 },
      { x: 174, y: 30 },
      { x: 190, y: 42 },
    ],
    lines: [
      [3, 4],
      [4, 5],
      [5, 6],
      [5, 7],
    ],
  },

  'Celine Dion': {
    epithet: 'My heart will go on',
    imageSrc: '/legends/celine-dion.webp',
    silhouette: [
      // Short, elegant hair.
      'M80,64 C80,46 140,46 140,64 C140,54 108,50 80,64 Z',
    ],
    accent: [
      // Hand-on-heart.
      'M110,182 C105,175 94,177 94,187 C94,198 110,208 110,208 ' +
        'C110,208 126,198 126,187 C126,177 115,175 110,182 Z',
    ],
    stars: [
      { x: 96, y: 108, dim: true },
      { x: 124, y: 108, dim: true },
      { x: 110, y: 150 },
      { x: 110, y: 192, r: 3.2 }, // heart
    ],
  },
}

/** Generic silhouette used until a specific legend's constellation is authored. */
const FALLBACK: LegendArt = {
  epithet: 'A voice you share the sky with',
  silhouette: ['M82,66 C82,50 138,50 138,66 C138,56 108,52 82,66 Z'],
  stars: [
    { x: 96, y: 108, dim: true },
    { x: 124, y: 108, dim: true },
    { x: 110, y: 150 },
    { x: 150, y: 100, r: 3 }, // mic
    { x: 150, y: 150 },
  ],
  lines: [[3, 4]],
}

export function legendArt(name: string): LegendArt {
  return LEGENDS[name] ?? FALLBACK
}

export const LegendCaricature: Component<{
  legend: string
  /** Extra class for sizing / animation hooks. */
  class?: string
}> = (props) => {
  const art = (): LegendArt => legendArt(props.legend)
  const starAt = (i: number): Star => art().stars[i]
  return (
    <svg
      class={`mirror-legend-svg ${props.class ?? ''}`}
      viewBox="0 0 220 280"
      role="img"
      aria-label={`${props.legend} — constellation portrait`}
    >
      <defs>
        <linearGradient id="mlg-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(150,165,255,0.22)" />
          <stop offset="100%" stop-color="rgba(120,110,220,0.08)" />
        </linearGradient>
        <filter id="mlg-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <Show
        when={art().imageSrc}
        fallback={
          <>
            {/* Ambient sky. */}
            <g fill="#8fa3ff">
              <For each={AMBIENT}>
                {(s) => <circle cx={s.x} cy={s.y} r={s.r} opacity={0.22} />}
              </For>
            </g>

            {/* Nebula silhouette: shared bust + this legend's signature shapes. */}
            <g
              fill="url(#mlg-body)"
              stroke="rgba(150,165,255,0.22)"
              stroke-width="0.6"
            >
              <path d={BASE_BODY} />
              <For each={art().silhouette ?? []}>{(d) => <path d={d} />}</For>
            </g>

            {/* Warm gold-lit signature marks. */}
            <g
              fill="rgba(255,214,130,0.4)"
              stroke="rgba(255,224,150,0.7)"
              stroke-width="0.8"
            >
              <For each={art().accent ?? []}>{(d) => <path d={d} />}</For>
            </g>

            {/* Signature constellation lines. */}
            <g
              stroke="rgba(255,225,150,0.42)"
              stroke-width="1"
              stroke-linecap="round"
            >
              <For each={art().lines ?? []}>
                {([a, b]) => (
                  <line
                    x1={starAt(a).x}
                    y1={starAt(a).y}
                    x2={starAt(b).x}
                    y2={starAt(b).y}
                  />
                )}
              </For>
            </g>

            {/* Constellation stars. */}
            <g filter="url(#mlg-glow)">
              <For each={art().stars}>
                {(s) => (
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={s.r ?? (s.dim === true ? 1.8 : 2.4)}
                    fill={s.dim === true ? '#9fb0ff' : '#ffe9a8'}
                    opacity={s.dim === true ? 0.7 : 1}
                  />
                )}
              </For>
            </g>
          </>
        }
      >
        <image
          href={art().imageSrc}
          x="0"
          y="0"
          width="220"
          height="280"
          preserveAspectRatio="xMidYMid slice"
        />
      </Show>
    </svg>
  )
}
