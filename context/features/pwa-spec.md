# D2 — Installable PWA

## Overview

Cortex can be installed as an app: home screen on a phone, its own window on a desktop.
**Installable only**: no offline reading (author's decision). Roadmap: `docs/roadmap-v2.md`
§ D2.

## Requirements

- Read `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` and the
  `manifest` metadata file convention first.
- `src/app/manifest.ts` (`MetadataRoute.Manifest`):
  - `name: "Cortex"`, `short_name: "Cortex"`
  - `description` from the homepage metadata (English; a manifest has no per-request language)
  - `start_url: "/dashboard"` (the proxy sends a signed-out user to sign-in), `scope: "/"`
  - `display: "standalone"`
  - `background_color` and `theme_color` set to the dark background token's hex value (taken
    from `globals.css`)
  - icons as below
- Icons in `public/icons/`:
  - `icon-192.png`, `icon-512.png`
  - `icon-maskable-512.png` (`purpose: "maskable"`, with the logo inside the safe zone)
  - Made from the existing logo, and ask the author for the source if there is no vector.
  - `src/app/apple-icon.png` (180×180) for iOS.
- `viewport.themeColor` in the root layout, if it is not set already.
- **No service worker.** Current Chromium installs without one, and leaving it out removes the
  risk of serving cached authenticated pages. If the install prompt does not appear in Chrome
  during the check, stop and report, rather than adding a worker silently.
- No custom install button in v1. The browser's own install entry is enough.

## Testing

- No unit test: there is no logic to test. `npm run build` lists `/manifest.webmanifest`.
- Browser check (Playwright script):
  - `/manifest.webmanifest` serves valid JSON with the icons.
  - Each icon URL answers 200.
  - Lighthouse-style installability: the manifest has `name`, `icons` 192 and 512,
    `start_url` and `display`.
- Manual (author): install from Chrome desktop and from Android Chrome, open it, and check that
  it starts on the dashboard in its own window.

## Notes

- Offline reading stays out. It would need a service worker and a client cache of items. Later,
  if asked.
