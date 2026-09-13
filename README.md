# CYI — Christ for Youth International

A full React/TypeScript redevelopment of connectcyi.org, created 13 September 2026.

## What is included

- 113 page views covering the home page, mission and values, ten individual programme pages, 38 branch listings and dedicated branch pages, leadership, five resource channels, 21 complete archived devotionals, stories, a gallery, ministries, two community projects, giving, contact and My CYI.
- Original CYI logo, photographs, graphics, devotional artwork, Vimeo/YouTube videos, project videos, podcast episodes and external giving links.
- Search, branch region/country filters, programme matching, gallery lightbox and filters, adjustable devotional reading text, sharing links, continuous audio playback across page navigation, database-backed saved items and reflections, and collection export.
- Responsive layouts, keyboard-accessible dialogs/tabs/selects, reduced-motion support and a custom local font.

## Run locally

This GitHub edition runs on **Next.js 16, React 19 and Node.js 24**. It preserves the complete CYI experience, original assets and the full-viewport Vimeo landing film. The former Cloudflare build tools are not required.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set DATABASE_URL in .env.local, then initialize the private collection schema:
pnpm db:migrate
pnpm dev
```

`pnpm build` creates the production Next.js app. `pnpm start` serves that build. `pnpm verify` checks all 113 page views, internal links, navigation behavior and collection API rules.

## Deploy from this GitHub repository to Vercel

1. In the Vercel team **emmanuelok's projects**, import **Emmanuelok/CYI** with the repository root as the root directory. The framework, build and installation settings are supplied in `vercel.json`.
2. Connect a managed PostgreSQL database and set its pooled connection string as the **server-only** `DATABASE_URL` environment variable for production (and a separate database for previews if used). Never commit database credentials or put them in `NEXT_PUBLIC_` variables.
3. When `DATABASE_URL` is configured, Vercel runs the database migration automatically before each build. The migration in `db/postgres.sql` is idempotent and uses a private `cyi` schema; existing collections are preserved. For local setup, run `pnpm db:migrate`.
4. Deploy branch **main**. With Vercel's Git integration connected, later pushes to main create production deployments automatically.
5. Check `/`, a branch detail page, `/gallery`, `/my-cyi` and `/api/collection`; verify that saving a bookmark and reflection survives a reload.

The public website can build and deploy without a database. Vercel uses `db:migrate --if-configured`, which reports a warning and skips migration only when `DATABASE_URL` is absent. **My CYI saved items and reflections still require a real PostgreSQL connection**; without it, the collection endpoint returns a temporary-unavailability response and does not claim to save visitor data. Connect the database, add its pooled PostgreSQL connection string as `DATABASE_URL` in Vercel's production environment, and redeploy to initialize the schema and enable saving. This value is a database connection string, not the website's HTTPS address. Explicit `pnpm db:migrate` remains strict, and configured-but-unreachable databases still fail migration. The app never substitutes an ephemeral server filesystem for persistent storage.

Anonymous collections are linked to a secure cookie on their own website origin. Existing cookies and saved records on the previous host do not automatically transfer to the new Vercel domain. Visitors can use the existing collection export.

## Hosting migration

The GitHub edition replaces Cloudflare D1 with a bound-query PostgreSQL adapter in `db/raw.ts`. The session cookie, item allowlist, request-origin validation, journal bounds and collection response shape remain the same. `drizzle/0000_common_talos.sql` is retained as the original schema fixture for API regression checks, not as the PostgreSQL migration.

No database credentials, visitor records, generated builds, package caches or previous hosting credentials are included in this repository. The existing hosted CYI app remains available during the migration.

## Review points before launching on the original domain

- Confirm current branch contacts and leadership with CYI. The original branch page was last modified in 2021 and the leadership page in 2024.
- S2S 26 is shown as a past event: its original poster says 15 August 2026. No future dates, ticket availability or registration confirmations were invented.
- The 21 Precious Moments articles retain their actual 2020–2021 dates. Eight podcast episodes are a verified feed snapshot, not a live sync service.
- The introduction form prepares text for visitors to copy; it does not submit an application or send messages to CYI. Public contact channels are linked.
- Payments are completed on the original CYI Paystack pages. No payment details are collected by this site.
- My CYI uses a secure, HttpOnly, random browser session cookie and database-backed records when DATABASE_URL is configured. There is no cross-device account sign-in. Clearing cookies loses the browser link; export is available. This is a review environment, and CYI must confirm its final privacy contact and retention policy before a public member launch.
- Embedded media and external channels require internet access. The site provides original-provider links alongside videos and podcast links as fallbacks.
- The existing connectcyi.org site and its hosting have not been changed.

## Validation history

- TypeScript checks passed.
- Production build passed.
- Server-rendered all 113 page views without missing titles or invalid image sources.
- Sixteen API integration checks passed using the actual endpoint code and SQLite: saving, read-back, journal persistence, session isolation, canonical item data, duplicate handling, deletion, CSRF and input limits.
- An initial browser check verified an immediate new navigation transition. The browser subsequently blocked refreshes of the managed preview. The hosted desktop capture was visually reviewed; full desktop interaction and device checks remain incomplete. The production design stylesheet, font, mobile breakpoints and all image references were verified in the build. Optional WebMCP registration is guarded against synchronous and asynchronous errors.

## September redesign and repair

- Direct in-app navigation preserves the audio player while updating routes and query parameters immediately, with ordinary anchor fallback before JavaScript loads. Checks cover modifier clicks, external links, new tabs, download links, cancellation and legacy URLs. Run `node scripts/verify-navigation.cjs`.
- Redesigned the homepage, shared navigation, responsive breakpoints and page layouts with original CYI photos, a local Barlow Condensed display font, black/lime/lilac surfaces and photo-led page introductions.
- Restored 20 source pages and historical form records, all Mission House list items, the complete missions gallery and current-source branch locations without inventing contact details. Added Explore and Archive directories.
- The WordPress page audit in `docs/content-coverage.json` accounts for all 46 published source pages, excluding empty shop/account/template scaffolding. Original official forms handle submissions; the rebuilt pages provide their content and preparation workflows.

## Content provenance

Content was carried over from CYI’s public pages with the contracted developer’s authorization. `public/asset-sources.json` records original image sources. `app/content.json` keeps article and project source URLs and full imported content. The design uses authentic CYI imagery; no generated people or invented testimonials were added.

## Electric Purpose visual edition

The September 2026 creative overhaul introduces a midnight-violet and coral identity, original chrome-ribbon artwork, authentic CYI photographic collage, expressive rose typography, arched experience cards, a redesigned media room and colourful story panels. All inner page covers, directories, content cards, forms and shared navigation use the same system.

The original CYI film fills the opening viewport with muted autoplay, looping and small corner controls. The marquee follows video playback; reduced-motion preferences prevent autoplay and disable animation. Layouts adapt at 1200, 1000, 760, 560 and 360 pixels. The new abstract artwork is listed in the asset provenance manifest; it contains no fabricated documentary scenes.

## Landing-page film

The original **CYI – Together** film at https://vimeo.com/1210826257 fills the entire opening viewport behind the transparent navigation, headline and actions. This uses Vimeo’s background mode, hides the provider interface and crops the film to cover desktop and phone screens without letterboxing. The original homepage’s 45-second loop is retained. Small corner controls pause playback or enable sound; there is no framed player, card, timeline or central play overlay.

The official Player SDK respects reduced motion and handles autoplay restrictions. A full-screen CYI photograph remains until playback begins. Retry and an original-provider link appear only on failure. The background pauses out of view, on a hidden tab or when other page audio begins. No signed media URLs or downloaded Vimeo streams are used.
