# Vibe — Christian Music Streaming Platform (Gracefy Clone)

## Original Problem Statement
Clone the Gracefy platform (https://github.com/glucktz1/Gracefy) as-is — native Android app, web, and admin panel including logic and algorithms — rebranded as "Vibe".

## User Choices (from requirement gathering)
- Scope: Full music streaming + Admin panel + Radio + Bible + Neno la Leo (daily devotional) + Churches
- Auth: JWT email/password (Emergent Google login noted as future add)
- Payments: Simulated billing/subscription logic (no real Azam Pay gateway)
- Content: Royalty-free seeded audio (SoundHelix) + placeholder artwork (Unsplash/Picsum)
- Language: Swahili UI (faithful to original)

## Architecture
- **Frontend**: Expo Router (React Native) — runs on Android + Web from one codebase. Blue navy theme faithful to Gracefy.
- **Backend**: FastAPI + Motor (async MongoDB), modular routers under /app/backend/routers
- **Auth**: JWT (bcrypt) with Bearer tokens via expo-secure-store; admin empty-password login supported
- **Audio**: expo-audio (createAudioPlayer) with background mode
- **Data**: seeded on startup (seed.py) — 8 albums, ~36 songs, radio, bible, neno, churches, plans

## Core Algorithms Ported (faithful to Gracefy)
- Guest limits: 5 plays / 5 skips, INDEPENDENT of billing → login prompt
- Logged-in non-premium tiered skips: 6 → +3 → +3 → disable + 15s preview mode (pattern 15,15,15,FULL)
- Recommendation engine: weighted scoring (same_album=100, genre=40, popularity=25, artist=20, recency=15) + diversity fallback (cap consecutive same-artist)
- Subscription plans: Kwa Siku 500, Kwa Wiki 2000, Kwa Mwezi 5500 TZS (simulated Azam Pay)

## What's Been Implemented — Session 8 (Aug 14, 2026) — Gracefy Dashboard 1:1 Port + Delete Account
- ✅ Ported the original Gracefy web Dashboard (Dashboard.jsx) faithfully into React Native (zinc/violet dark theme) — live streaming banner, downloads banner, 4 primary stat cards, 4 secondary stats, 4 charts (Customer Growth area, Donations Trend area, Content Performance bar, Category pie) + User Demographics (device/gender/age/location) using react-native-gifted-charts. English labels (rest of app stays Swahili).
- ✅ NEW backend router routers/analytics.py — 6 admin-only endpoints matching Dashboard.jsx: /api/analytics/{overview,trends,user-demographics,realtime,download-stats,live-listeners}
- ✅ Fixed admin drawer testID spacing (kebab-case)
- ✅ NEW DELETE /api/auth/me + "Futa Akaunti" button & confirm modal on Profile (store-compliance). Admin self-delete blocked (403).
- ✅ Testing: 21/21 backend pytest pass; full admin dashboard + delete-account flows verified (iteration_12)

## What's Been Implemented — Session 7 (Aug 14, 2026) — Admin Dashboard Redesign
- ✅ Dark side-drawer menu (hamburger) with grouped sections: Reports & Analytics, Contents, Control & Management, System
- ✅ Drawer items navigate to Overview/Content/Users; unbuilt sections show "Inakuja hivi karibuni" toast
- ✅ Summary chips card (guests · plays · payments / raised · users) on Overview
- ✅ Testing: 10/10 backend + full admin drawer/navigation verified

## What's Been Implemented — Session 6 (Aug 14, 2026) — Admin Dashboard Enrichment
- ✅ /api/admin/stats now returns radio/churches/neno/plans/transactions counts + guest vs logged plays + recent_transactions
- ✅ Admin Overview: 12 stat cards, plays breakdown bar (logged vs guest), top songs, recent payments
- ✅ Admin gate: guests get a "Ingia kama Admin" login button (no dead-end)
- ✅ Testing: 10/10 backend + full admin UI verified (iteration_10)

## What's Been Implemented — Session 5 (Aug 11, 2026) — Share Cards, Continue Listening, Downloads Manager
- ✅ Share Cards: branded gradient image card (Vibe logo, art, title, artist, tagline) via react-native-view-shot + expo-sharing; web falls back to link share (navigator.share/clipboard)
- ✅ Continue Listening: PlayerContext persists session snapshot (track+queue+index+position) to storage; restores on launch (paused) and resumes+seeks on play
- ✅ Downloads Manager: total storage used (formatBytes) + one-tap clear-all with confirm; per-download size stored (native)
- ✅ Testing: 30/30 backend pass; share/continue/downloads flows verified (iteration_5)

## What's Been Implemented — Session 4 (Aug 11, 2026) — Gestures, Queue, Bulk Actions
- ✅ Full-player Pan gestures: swipe-down to close, swipe left/right to change songs (native), controls still tappable
- ✅ Queue view (QueueSheet): see up-next, reorder (up/down), remove, and tap-to-jump; current song marked with equalizer
- ✅ PlayerContext exposes currentIndex + playAt/reorderQueue/removeFromQueue
- ✅ Album bulk: Download whole album (Premium/native; web→app prompt) + Add whole album to a playlist (multi-song)
- ✅ Playlist bulk: Download whole playlist (Premium/native; web→app prompt)
- ✅ AddToPlaylistSheet supports multi-song (songIds[]); downloads.ts has downloadMany()
- ✅ Testing: 30/30 backend pass; queue, gestures, and bulk flows verified (iteration_4)

## What's Been Implemented — Session 3 (Aug 11, 2026) — Player UX + Song Actions
- ✅ AnimatedEqualizer (reanimated) shown while playing: mini player (artwork overlay), song lists (active row), full player (next to title)
- ✅ Full player header shows "INACHEZA KUTOKA" + album title (playing-from-album)
- ✅ Full player action row: like, add-to-playlist (+), share, download
- ✅ Three-dots (...) SongActionsSheet on album & playlist rows: Add-to-playlist, Download, Like, Share (+ Remove on playlists)
- ✅ Share service (native Share + web navigator.share/clipboard) with vibe.app links
- ✅ Mini player: back / play-pause / forward controls
- ✅ Web MediaSession lock-screen/media-key controls (play/pause/next/prev + metadata); native lock-screen needs a build
- ✅ Testing: 30/30 backend pass; all equalizer/song-action/share/media-session flows verified

## What's Been Implemented — Session 2 (Aug 11, 2026) — Monetization Audit
- ✅ Guest limits enforced (5 plays / 5 skips) on manual play AND auto-advance, independent of billing
- ✅ Premium gating via `gatePremium()` for: like, add-to-playlist, create playlist, download
- ✅ Tiered skips for logged-in non-premium (6 → +3 → +3 → disable + 15s preview mode)
- ✅ Inline "Changia" payment banner on full player for non-premium (Gracefy-faithful)
- ✅ Offline downloads (expo-file-system legacy) — native only; web shows "Pakua Programu" prompt
- ✅ Downloads screen (/downloads) + Profile link; per-song download/remove on player
- ✅ Lock-screen/background pause + subscribe prompt for non-premium (native, AppState)
- ✅ Player duration bug fixed: live radio shows LIVE badge (no seek/huge timestamp); NaN/huge durations guarded
- ✅ Global MiniPlayer now persists across ALL screens (root-mounted), hides on player/auth
- ✅ Testing: 30/30 backend pass; all monetization + player flows verified

## What's Been Implemented — Session 1 (Aug 11, 2026)- ✅ JWT auth (register/login/me), admin seeding, empty-password admin login
- ✅ Music: home feed, albums + detail, songs, search, categories, play tracking
- ✅ Player: mini player + full player (seek, next/prev, preview-mode banner), auto-queue via recommendations
- ✅ Library: playlists CRUD, liked songs, add-to-playlist sheet
- ✅ Radio (live streams), Bible (books + Genesis 1 reader w/ audio), Neno la Leo (devotional cards w/ Kusoma/Tafakari), Churches (detail + schedule + announcements)
- ✅ Billing: plans, billing-status, simulated subscribe (activates premium), guest/skip enforcement
- ✅ Admin dashboard: stats, top songs, content (add album/song), users list, analytics
- ✅ Testing: 30/30 backend pytest pass; all frontend flows verified

## Key Files
- /app/backend/server.py — app + router mounting + startup seed
- /app/backend/routers/{auth,music,playlists,home,radio,bible,neno,churches,billing,admin}.py
- /app/backend/seed.py — demo content seed
- /app/frontend/src/context/PlayerContext.tsx — player + guest/skip/preview algorithms
- /app/frontend/app/(tabs)/* — Home, Search, Library, Bible, Profile
- /app/frontend/app/{album/[id],player,radio,neno,churches,plans,playlist/[id],admin/index}.tsx

## Test Credentials
- Admin: admin@vibe.app / Vibe@2026 (empty password also works)
- Test user: register any (e.g. u1@test.com / pass123)

## Backlog / Future (P1/P2)
- P1: Emergent Google social login; real payment gateway (Stripe/Razorpay) when keys provided
- P1: Offline downloads (native build required); background/lock-screen playback (native build)
- P2: HLS adaptive streaming; admin audio upload + transcoding; Neno la Leo leader portal
- P2: Bible full content + TTS voices; localized Swahili verse text; social sharing deep links

## Notes
- Payment is SIMULATED (no real Azam Pay). Background/lock-screen audio & offline downloads require a native build (not testable in Expo Go/web).
