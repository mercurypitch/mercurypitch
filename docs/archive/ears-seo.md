# EARS Specification — SEO Optimizations

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-05-10 | Scope: Static SEO assets and HTML metadata

---

## 1. Robots Exclusion

### REQ-SEO-001 — robots.txt Allow All
**Ubiquitous:** The application shall serve a `robots.txt` at the site root with `Allow: /` for all user agents.

### REQ-SEO-002 — Sitemap Reference
**Ubiquitous:** The `robots.txt` shall include a `Sitemap:` directive pointing to the production sitemap URL.

---

## 2. XML Sitemap

### REQ-SEO-003 — Sitemap Generation
**Ubiquitous:** The application shall serve a `sitemap.xml` containing the canonical URL for the home page.

### REQ-SEO-004 — Sitemap Last Modified
**Ubiquitous:** The `sitemap.xml` shall include a `<lastmod>` date reflecting the most recent content update.

### REQ-SEO-005 — Sitemap Change Frequency
**Ubiquitous:** The `sitemap.xml` `<changefreq>` shall be set to `weekly` for the home page.

---

## 3. HTML Meta Tags

### REQ-SEO-006 — Page Title
**Ubiquitous:** The `<title>` tag shall include the primary keyword phrase "Vocal Pitch Training" and the brand name "MercuryPitch".

### REQ-SEO-007 — Meta Description
**Ubiquitous:** The `<meta name="description">` shall be 120-160 characters and include keywords: pitch training, vocal practice, real-time feedback, microphone, UVR, practice modes.

### REQ-SEO-008 — Meta Keywords
**Ubiquitous:** The `<meta name="keywords">` shall include: pitch training, vocal practice, ear training, singing practice, pitch detector, music education, real-time feedback.

### REQ-SEO-009 — Meta Author
**Ubiquitous:** The `<meta name="author">` shall be set to `MercuryPitch`.

### REQ-SEO-010 — Robots Meta
**Ubiquitous:** The `<meta name="robots">` shall be set to `index, follow` to allow search engine indexing.

### REQ-SEO-011 — Canonical URL
**Ubiquitous:** The `<link rel="canonical">` shall point to the production URL `https://mercurypitch.com/`.

---

## 4. Open Graph & Twitter Card

### REQ-SEO-012 — OG Meta Tags
**Ubiquitous:** The HTML shell shall include Open Graph meta tags (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`) with production URLs.

### REQ-SEO-013 — Twitter Card Meta Tags
**Ubiquitous:** The HTML shell shall include Twitter Card meta tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) with production URLs.

### REQ-SEO-014 — OG Image
**Ubiquitous:** The `og:image` and `twitter:image` shall reference `favicon.png` (512×512) at the production URL.

---

## 5. Production URLs

### REQ-SEO-015 — Production Domain
**Ubiquitous:** All absolute URLs in SEO assets (canonical, sitemap, robots.txt, OG tags, Twitter tags) shall use the production domain `https://mercurypitch.com/`.

---

## Covered Assets

| Asset | Requirements Covered |
|-------|---------------------|
| `public/robots.txt` | REQ-SEO-001, REQ-SEO-002, REQ-SEO-015 |
| `public/sitemap.xml` | REQ-SEO-003, REQ-SEO-004, REQ-SEO-005, REQ-SEO-015 |
| `index.html` | REQ-SEO-006 through REQ-SEO-015 |

---

## Testing

SEO assets are static files tested via manual review and automated link checking:

- `robots.txt` accessible at `/robots.txt` — returns 200 with correct content
- `sitemap.xml` accessible at `/sitemap.xml` — returns 200 with valid XML
- `index.html` includes all required meta tags with production URLs

No unit-testable TypeScript module; the EARS spec serves as the acceptance checklist.
