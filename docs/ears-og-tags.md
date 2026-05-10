# EARS Specification — Open Graph Tags

> **EARS** = Easy Approach to Requirements Syntax  
> Version: 1.0 | Date: 2026-05-10 | Scope: OG tag metadata and dynamic melody sharing previews

---

## 1. Static OG Tags

### REQ-OG-001 — Standard Metadata
**Ubiquitous:** The application HTML shell shall include standard Open Graph and Twitter Card meta tags:
- `og:title` — page title (branded)
- `og:description` — site tagline
- `og:type` — `website`
- `og:url` — canonical URL
- `og:image` — preview image (PNG, min 1200×630)
- `og:site_name` — PitchPerfect
- `twitter:card` — `summary_large_image`
- `twitter:title`, `twitter:description`, `twitter:image`

### REQ-OG-002 — Favicon as Fallback Image
**WHEN** a dedicated OG image is not available, **THEN** the system shall use the app favicon (`favicon.png`, 512×512) as the `og:image`.

### REQ-OG-003 — Canonical URL
**Ubiquitous:** The HTML shell shall include a `<link rel="canonical">` pointing to the production URL `https://pitchperfect.clodhost.com/`.

---

## 2. Dynamic OG Tags for Melody Sharing

### REQ-OG-004 — Client-Side Meta Update on Melody Load
**WHEN** the application loads a shared melody from URL query parameters (`?n=...`), **THEN** the system shall update the document head meta tags (`og:title`, `og:description`, `og:url`) to reflect the shared content.

### REQ-OG-005 — Melody Share Title Format
**WHEN** a melody is shared, **THEN** the `og:title` shall be: `"Melody shared on PitchPerfect"`.  
**IF** a key is specified, **THEN** the title shall include it: `"Melody in <key> shared on PitchPerfect"`.

### REQ-OG-006 — Melody Share Description Format
**WHEN** a melody is shared, **THEN** the `og:description` shall include the note count, BPM, and key (if available).  
Example: `"A 15-note melody at 120 BPM in C major — practice it on PitchPerfect."`

### REQ-OG-007 — Dynamic OG URL
**WHEN** a melody is loaded from URL parameters, **THEN** the `og:url` shall be updated to the current full URL including query string so crawlers associate the correct preview.

### REQ-OG-008 — Reset on Navigation
**WHEN** the user navigates away from a shared melody (melody cleared from URL), **THEN** the OG tags shall revert to the static defaults.

---

## 3. Server-Side OG Endpoints (Future)

> **Note:** Server-side implementation deferred. These endpoints will be implemented in a subsequent phase.

### REQ-OG-009 — OG Image Endpoint
**Eventual:** `GET /og?melody=<encoded_melody>`

The server shall return a PNG image (1200×630) showing a piano-roll visualization of the encoded melody with PitchPerfect branding.

### REQ-OG-010 — OG Image Dimensions
**Eventual:** `GET /og?melody=<encoded_melody>&width=<px>&height=<px>`

Same as REQ-OG-009 with configurable output dimensions.

### REQ-OG-011 — OG Meta Endpoint
**Eventual:** `GET /og/meta?melody=<encoded_melody>`

The server shall return an HTML page containing only OG meta tags for the shared melody, allowing social media crawlers to fetch previews without loading the full SPA.

### REQ-OG-012 — Server-Side Image Caching
**Eventual:** Generated OG images shall be cached with a configurable TTL (default 24 h) keyed by melody content hash.

---

## 4. Client-Side OG Image Generation

### REQ-OG-013 — Canvas-Based OG Image
**Ubiquitous:** The system shall provide a function that renders an OG preview image (1200×630) onto an HTML Canvas, suitable for download or sharing.

The image shall include:
- PitchPerfect logo/title
- Piano roll fragment of the shared melody
- Note count, BPM, and key metadata
- Dark theme consistent with app branding (`#0d1117` background)

### REQ-OG-014 — OG Image Download
**WHEN** the user shares a melody, **THEN** they shall have the option to download the generated OG image as PNG.
