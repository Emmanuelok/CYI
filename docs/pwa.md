# CYI installed app

The installation page is `/install`. The footer and mobile navigation link to it, and its QR code opens the production installation URL on another device. Supporting browsers expose their native installation prompt after the visitor chooses Install; other browsers get specific instructions. Safari on iPhone and iPad uses Share → Add to Home Screen. Installation never requests location or notification permission.

## Offline behavior

The service worker prepares a self-contained reading room at `/offline.html`, including the 21 imported Precious Moments devotionals. It also keeps selected public pages, fonts and application assets, with bounded caches for additional public pages and images. Preparation requires one successful online visit; browser storage can be evicted by the device. The installation page reports offline readiness and the count of stored public pages.

The public-page cache uses anonymous requests. APIs, private collections, authorization-bearing requests, React Server Component payloads, mutations and third-party video/audio streams are excluded. My CYI saved items and reflections still need the server-side PostgreSQL connection described in the README. Offline access does not imply that private saving works without a connection.

## Updates

`NEXT_PUBLIC_APP_VERSION` is derived from the Vercel Git commit SHA during build. The worker URL includes this version so later deployments are detected. The service worker script is served without an HTTP cache. Waiting updates are announced to visitors; applying one does not reload the page. Visitors choose when to reload after finishing their work.

## Identity and link previews

The app manifest supplies standalone display, the CYI name, icons, maskable Android artwork, theme colors and shortcuts to branches, devotionals and experiences. The Apple touch icon retains the official CYI emblem. `/og/cyi-share.jpg` is the 1200 × 630 Open Graph and Twitter/X preview image. Page-specific titles and canonical paths are supplied through `lib/site-metadata.ts`. `NEXT_PUBLIC_SITE_URL` can override the production origin if the site moves to a custom domain; update the install QR destination at the same time.

## Verification

Run the production build, the existing page/navigation/collection checks, and the PWA verification script. After deployment, verify the install page, manifest, service worker headers, icon responses and social metadata on the production origin. Native OS installation and offline behavior should also be checked on representative physical iPhone/iPad and Android devices; a server build alone cannot establish those device-specific outcomes.
