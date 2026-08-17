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

## What's Been Implemented — Session 14 (Aug 17, 2026) — Album Song Management + Responsive Desktop
- ✅ Admin: tap an album to expand and view its songs (track #, HLS status badge, source)
- ✅ Add songs **single** or **bulk** (Title | CDN URL per line); **upload from computer** (expo-document-picker → object storage) or paste **CDN URL** (incl .m3u8)
- ✅ HLS encoding status pipeline (hls_status/hls_url/encoding_source); real HLS transcoding to be handled by Bunny Stream when keys provided
- ✅ Backend: GET /api/admin/albums/{id}/songs, POST single + /bulk, DELETE /api/admin/songs/{id}, POST /api/admin/upload-audio
- ✅ Admin panel + Artist dashboard now render as **desktop layout** (docked sidebar / centered content) on ≥900px; consumer app stays mobile

## What's Been Implemented — Session 13 (Aug 17, 2026) — Control & Management + Genre Home Rows
- ✅ **Control & Management** (3 screens): Role Management (change user roles), Approvals (approve/reject pending artists/albums/songs), App Health Monitoring (service status + platform counts)
- ✅ Backend: PATCH /api/admin/users/{email}/role, GET /api/admin/approvals, POST /api/admin/approvals/{album|song}/{id}, GET /api/admin/health
- ✅ **Genre home rows**: consumer home shows browse rows per genre (Bongo Hits, Amapiano, Gospel, Afrobeat, Hip Hop, R&B); fixed /api/home category rails + assigned albums to genres
- ✅ Also this session: Settings, Advertising & Campaigns, Recommendation Engine (functional + persisted), analytics /breakdown endpoint

## What's Been Implemented — Session 11 (Aug 14, 2026) — Content Management + Categories + Data Usage + Rebrand
- ✅ **Content Management (Albums & Songs)**: search, category + monetization filters, album list with thumbnails/badges/tags, row actions (Edit, Manage Tags, Deactivate/Activate, Delete), and a rich Create/Edit Album form (name, category, geo countries, thumbnail, release date, monetization, artist, status, tags, description)
- ✅ **Categories** management with music genres: Hip Hop, R&B, Bongo Hits, Gospel, Amapiano, Taarabu, Za Kale, Afrobeat (religious categories removed)
- ✅ **Analytics "Data Usage"** sub-tab (data-used cards + per-day + listening-minutes bar charts) + highlight cards (Paid Plays/Free Listens/Conversion) + count cards
- ✅ **Rebrand (general music, non-religious)**: Choir→Artist, Bible→Books/"Vitabu", Teachings→Podcasts, Churches→Production Houses/"Studio", Religious Leaders→Aggregators, Neno la Leo removed; applied to admin sidebar, admin dashboard cards, and consumer app tabs/home
- ✅ Backend: admin album CRUD + status, categories CRUD, /api/analytics/data-usage
- ✅ Testing: 15/15 backend pytest pass; all frontend flows verified 100% (iteration_15)

## What's Been Implemented — Session 10 (Aug 14, 2026) — Reports & Analytics complete
- ✅ All 6 "Reports & Analytics" sidebar items now functional (per original repo):
  - Dashboard (overview), Analytics, Location Analytics, Revenue, Transactions, Withdrawals
- ✅ 4 new backend endpoints: GET /api/analytics/{enhanced, revenue-overview, transactions, location-overview} (admin-only)
- ✅ 4 new admin tabs faithfully rendered: Analytics (6 stat cards + top songs + category pie), Revenue (4 cards + 14-day area chart + top artists/albums), Transactions (summary + status filters + list), Location (country bars + growth dual-line)
- ✅ Top segment control now hides on drawer-only tabs; shows a Dashboard breadcrumb instead
- ✅ Testing: 14/14 backend pass; all 4 tabs verified (iteration_14)

## What's Been Implemented — Session 9 (Aug 14, 2026) — Artist Portal + Gracefy Accordion Sidebar
- ✅ Admin sidebar rebuilt as faithful accordion (from user's Gracefy screenshot): collapsible groups (Reports & Analytics, Contents, Control & Management, Settings), standalone items, Artists & Singers + Religious Leaders groups, footer with admin identity + logout
- ✅ "Choir" renamed to "Artists" throughout
- ✅ Artist Portal (separate `artists` collection, JWT typ:artist, pending-approval gate): register → login → dashboard (earnings overview, music upload, withdrawals, profile). Entry via Profile → "Artist Portal"
- ✅ Real audio uploads via Emergent Managed Object Storage (interim; swap to Bunny CDN when creds provided). Public playback route /api/artists/media/{path}
- ✅ Simulated earnings (50 TZS/play) + withdrawal request workflow (real payout gateway to be added later)
- ✅ Admin management: approve/reject/suspend artists + approve/mark-paid/reject withdrawals (admin dashboard "artists" & "withdrawals" tabs)
- ✅ Seed: demo approved artist artist@vibe.app / Artist@2026
- ✅ Testing: 20/21 backend pass; full artist portal + admin management + sidebar verified (iteration_13)

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

## Session 16 (Jun 2026, fork) — Analytics landing page finalized
- Fixed incomplete injection: declared `aPeriod` state (7/30/90 Days, 1 Year) + added missing live-banner styles (liveBar/liveLabel/liveStat/liveMuted) in app/admin/index.tsx
- Wired period chips → refetch via adminApi.enhanced(period); dedicated useEffect on [aPeriod, tab]
- api.ts: enhanced(period="30d") now passes ?period=
- backend analytics.py: /enhanced now applies real time-window filter (play_events + transactions by created_at >= now-days) instead of echoing period
- Verified: all periods return 200; Analytics tab renders LIVE banner + filter chips (screenshot), no crash

## Session 16b — Analytics sub-tabs (Gracefy parity) + Content mgmt song controls
### Content Management (admin.py + ContentManager.tsx + api.ts)
- Backend: PUT /api/admin/songs/{id} (edit title/status), PATCH /api/admin/songs/{id}/status (verified via curl 200)
- api.ts: updateSong, songStatus; uploadAudio now XHR-based with onProgress callback (real upload %)
- ContentManager: 3 add modes — Single (with progress bar), Upload Files (multi-file, per-file progress bars), Bulk CDN; per-song row now has status badge (active/hidden) + edit (rename+status) + toggle + delete
### Analytics sub-tabs (app/admin/index.tsx)
- Analytics landing now has 7 horizontal sub-tabs matching Gracefy: Overview | Users | Revenue | Content | Replays | Devices | Data Usage
- Users: total/premium/free/premium-rate cards + growth bar chart + premium-vs-free pie (data: /analytics/breakdown)
- Revenue: gross/platform/payouts/hours cards + revenue-over-time line + top earning artists (/analytics/revenue-overview)
- Content: album/song counts + top albums (/analytics/breakdown)
- Replays: most replayed songs list (/analytics/breakdown)
- Devices: device distribution pie (/analytics/breakdown; currently mostly UNKNOWN until device_type captured)
- All endpoints verified returning valid data; screenshot confirms 7 sub-tabs render + Users tab operational

## Session 16c — Content menu bug fix + Devices analytics parity (Gracefy /tmp/Gracefy2)
### CRITICAL BUG FIX (Content Management — desktop web)
- Root cause: album 3-dot dropdown (position:absolute) was overlapped by following album rows on RN-web; clicks on Edit/Bulk Add/Deactivate/Add Song landed on the row beneath → "doesn't work"
- Fix: ContentManager rowWrap gets zIndex/elevation 1000 when its menu is open (styles.rowWrapActive), elevating it above sibling rows. Verified EDIT opens modal + persists in 1440px desktop.
- This single fix restores Edit, Bulk Add (multi-upload), Activate/Deactivate, Add Song, Manage Tags, Delete
### Devices analytics — full Gracefy parity
- Backend: GET /api/analytics/device-distribution (ported from Gracefy backend/routes/analytics.py): platform_distribution(android/ios/web/unknown), manufacturer_distribution, top_device_models, location_distribution, os_version_distribution
- backend/backfill_devices.py: seeded realistic device+country data on 49 users (Samsung/Tecno/Infinix/Xiaomi/Itel/Apple + TZ/UG/KE) so charts populate
- Frontend Devices sub-tab rebuilt: 4 platform stat cards (Android/iOS/Web/Unknown %), Platform Distribution donut+legend, Device Manufacturers ranked (count+%), Top Device Models, Location Distribution. Verified.
### STILL BASIC (not yet full Gracefy parity) — next
- Content sub-tab: Gracefy has album performance TABLE (plays/minutes/hours/avg-per-play/revenue) + top songs list — ours shows counts+top albums only
- Replays sub-tab: Gracefy has day/week/month period selector + users-who-replayed + summary cards — ours shows top replayed list only
- Users sub-tab: could add navigation/section toggle from Gracefy

## Session 16d — Customers list + User Detail page + real device capture (Gracefy parity)
### Backend (routers/admin.py) — user_id = str(_id); play_events/transactions link by str(_id)
- GET /admin/users (search + membership/register_by/status filters; returns user_id, country, register_by, membership, status, last_active)
- GET /admin/users/stats/summary (total/active/premium/free/trial/suspended)
- GET /admin/users/{id} (+analytics: plays/spent/downloads/liked/txn count + device{})
- GET /admin/users/{id}/listening-history | /downloads | /transactions
- PUT /admin/users/{id} (edit name/phone/country); PATCH /admin/users/{id}/status (activate/deactivate via disabled); POST /admin/users/{id}/reset (→Free, clears counters)
### Device capture at signup
- auth.py register accepts platform/device_manufacturer/device_model/os_version; stored on user
- Frontend AuthContext.register gathers via expo-device (installed) + Platform.OS and sends; feeds Devices analytics + user Devices tab
### Frontend
- NEW src/components/admin/UsersManager.tsx: Customers list (6 stat cards, search, Type/Method/Status filters, horizontal-scroll table) + UserDetail view (header w/ Edit/Reset/Deactivate + 6 tabs: Profile/Membership/Listening History/Downloads/Transactions/Devices)
- admin/index.tsx: removed "Users" from top segment toggle (now only Dashboard|Content); App Users sidebar → UsersManager; removed dead users state
- Verified in 1440px desktop: list + detail + device tab all render
### STILL PENDING (next): Content analytics parity (album performance table), Replays parity (period selector + users-who-replayed), Users analytics section toggle

## Session 16e — Content & Replays analytics parity (Gracefy)
- Backend: GET /api/analytics/content-performance (album table: plays/minutes/hours/avg-per-play/revenue + top_songs), GET /api/analytics/replays?period=day|week|month (summary users_who_replayed/replay_minutes/replay_sessions + user_replays + top_replayed_songs)
- api.ts: contentPerformance(), replays(period)
- admin/index.tsx: Content sub-tab now shows Album Performance TABLE + Top Performing Songs; Replays sub-tab has Today/Week/Month selector + summary cards + Users Who Replayed + Most Replayed Songs; new styles (tbl*, songMeta, replayBadge)
- Verified in 1440px desktop: both render with real data; replay period switch works
- ALL requested items this thread DONE: Content parity ✅ Replays parity ✅ Real device capture ✅ Customers list + User detail ✅ removed Content Users toggle ✅

## Session 16f — Admin enrollment of subscribers (plans / free hours + bulk + audit)
- Backend admin.py: POST /admin/enroll (mode=plan|free_hours; targets via user_ids and/or bulk phones; duration_days or free_hours+free_period). Applies subscription to matched users (is_premium+subscription{granted_by,expires_at,type}); unmatched phones stored in db.pending_enrollments. POST records saved to db.enrollments (audit: admin_email, plan_name, applied/pending/total counts, targets, created_at). GET /admin/enrollments lists records.
- api.ts: enroll(body), enrollments()
- UsersManager: per-row checkboxes, header Enroll(+count)/History buttons; EnrollModal (plan vs free-hours, bulk phone textarea, duration presets Daily/3 Days/Weekly/Monthly, free hours + per day/week/month); Enrollment Records history view
- Verified backend (plan applied+pending, free_hours applied, list) and UI (modal + history render; premium count 16→17)
- NOTE: free-listening-hours entitlement is stored on user (free_listening_hours/period/expires); player-side enforcement of the hour cap is a future task

## Session 16g — Free-hours enforcement + CSV upload + enrollment detail/revoke
### Enforce Free Hours (backend routers/me.py + PlayerContext)
- NEW /api/me/free-hours (GET status: has_grant/cap/used/remaining/exhausted; lazily downgrades expired grants), POST /api/me/free-hours/consume {seconds}
- Grant model: cap = free_listening_hours*3600 total within window (expires at free_listening_expires); only for subscription.type=="free_hours"
- PlayerContext: refreshFreeHours on login/premium change; playbackStatusUpdate meters positive deltas, flushes consume() every 15s (or immediately when remaining hits 0) → on exhausted pauses player + blockReason "subscribe"; playTrack blocks start if remaining<=0; exposes freeHoursLeftMin in context
- Verified: cap 36s → 20 consumed (16 left) → +30 => remaining 0 exhausted True
### CSV Upload (UsersManager EnrollModal)
- expo-document-picker "Upload CSV" button; reads file text, regex-extracts phone numbers, dedupes into the phones textarea
### Enrollment Detail + Revoke (admin.py + UsersManager)
- POST /api/admin/enrollments/{id}/revoke → clears is_premium/subscription/free_* on all applied recipients, deletes pending, marks record revoked
- History records now tappable → detail panel (mode/duration/applied/pending + recipients list w/ status) + "Revoke Access for All Recipients"; verified revoke clears grant (has_grant False)

## Session 16h — Users: single enroll, new columns/filters, bulk actions, CSV, free-minutes analytics
### Backend (admin.py, auth.py, analytics.py)
- list_users: filters country, registered_from/to (date range); new row fields email, mobile, channel(admin/web/app via subscription.channel|register_channel|platform), country_region, subscribed_at, last_active
- GET /admin/users/countries (distinct); POST /admin/users/bulk-action {user_ids, action: activate|deactivate|delete}
- get_user_detail: adds mobile, channel, country_region, subscribed_at, last_active
- enroll subscription now stamps channel:"admin"
- auth.py register captures register_channel(web/app), country, region, latitude/longitude, ip (X-Forwarded-For)
- analytics GET /analytics/free-minutes (total_free_minutes/active_grants/users_consumed; excluded from revenue)
- backfill_devices.py now seeds country+region(city)+register_channel
### Frontend
- api: userCountries, usersBulkAction, adminApi.freeMinutes
- UsersManager: single-user Enroll button in UserDetail header (EnrollModal with [userId]); Customers table rebuilt columns (Name/Email/Mobile/Type/Channel/Country-Region/Subscribed/Last Active/Status); country chips + registration date-range filters; Export CSV (web Blob download); multi-select bulk bar Activate/Deactivate/Delete; Delete requires typing "delete N users"; UserDetail Profile tab shows Mobile/Channel/Country-Region/Date Subscribed/Last Active On (email-only)
- admin/index Overview sub-tab: amber "free minutes consumed (excluded from revenue)" banner via adminApi.freeMinutes
- Verified desktop: columns/filters/export/bulk bar/delete-confirm render; bulk activate/deactivate API ok
### NOTE / flag: precise IP->city geolocation needs a geo provider (ipinfo/MaxMind API key); currently region comes from client-provided/backfilled values. GPS capture needs location-permission flow in the consumer register screen (not yet built).

## Session 16i — Player prompt banners on mini player + ringtone prompt for paid/new users
- NEW src/components/PlayerPromptBanner.tsx (variant full|mini): free logged-in users -> "Changia kidogo kusikiliza kwa uhuru" (->/plans); premium OR just-joined (<48h) users -> "Weka Wimbo huu muito wa simu yangu" (set-as-ringtone); guests -> none
- MiniPlayer: restructured (outer View + inner navigating Pressable row) and added the thin banner strip above the row (matches attached image)
- player.tsx: replaced the contribute-only banner with <PlayerPromptBanner variant="full"/> (now premium/new users see ringtone prompt too)
- auth_utils.public_user now returns created_at (used for "just joined" detection)
- Ringtone tap shows Alert (Android/iOS) noting it applies on the installed native build (real ringtone assignment needs WRITE_SETTINGS/native build — not testable in Expo Go/web)
- Verified: registered a new user, played a song -> mini player shows "Weka Wimbo huu muito wa simu yangu" (MINI_RINGTONE True); guests show no banner

## Session 16j — Prompt alternation, full-player bottom safe-area, album thumbnails
### Alternating free-user prompts (payment vs ringtone) — admin controlled
- settings.py: new key free_prompt_ringtone_pct (default 50); billing.py /billing-status now returns it publicly
- PlayerContext exposes promptRingtonePct (from billing state)
- PlayerPromptBanner usePlayerPrompt: guests none; premium/just-joined always ringtone; FREE users alternate per song via deterministic hash(song_id)%100 < pct => ringtone else contribute (works web+native, no randomness flicker mid-song)
- SettingsManager: added "Free User Ringtone Prompt %" stepper (step 10, min 0, max 100; NUMS type gained optional max + inc clamps)
- Verified: admin PUT pct=30 reflected in public billing-status
### Full player bottom controls no longer hidden behind device nav bar
- player.tsx: useSafeAreaInsets; controls container paddingBottom = max(insets.bottom,12)+SPACING.md (fixes web+native overlap); verified controls fully visible
### Album listing thumbnails
- album/[id].tsx: dropped index prop to SongRow so it renders song/album thumbnail instead of number; thumbnail falls back to album cover; verified

## Session 16k — Player fits window + Artists home row & artist page
### Player layout fit (web + native)
- player.tsx: artWrap now flex:1 minHeight:0 (absorbs space); art aspectRatio 1 + flexShrink:1 + maxWidth 360 (shrinks on short screens); controls/meta marginTop reduced xl->md; removed duplicate art style; controls keep bottom safe-area padding. Verified controls fully visible when maximized.
### Artists on Home + consumer artist page
- home.py: adds "artists" section (type=artists) — approved artists with content (thumbnail from photo_url/image_url/avatar_url, albums/songs counts)
- artists.py: NEW public GET /api/artists/public/{artist_id} -> {artist, albums(+songs_count), songs(+thumbnail/album_title/artist_name)}
- api.ts musicApi.artistCatalog(id)
- (tabs)/index.tsx: renders artists rail (circular avatars) -> router.push(/artists/{id}); merged duplicate expo-router import; added artistCard styles
- NEW app/artists/[id].tsx: consumer artist screen (avatar, counts, bio, "Cheza Zote" Play All -> playTrack(queue), Albums rail via AlbumCard, Popular Songs via SongRow). Note: route is plural /artists/[id] to avoid clash with artist PORTAL at /artist
- Verified: home artists row + artist page + Play All + full player controls

## Session 16l — Single-user enroll auto-detects user (no CSV/phone paste)
- EnrollModal now takes optional `single={name,mobile}`; UserDetail passes it. In single mode: title "Enroll User", Targets shows auto-detected user chip ("<name> · <mobile>|no mobile on file"), CSV button + phones textarea hidden, submit ignores phones (targets the userId). Bulk enroll (Customers list) keeps CSV/phone paste. Verified in desktop.

## Session 16m — Home curated rows (Made for You/Pick of Week/Recently Added) + working Layout Manager
- home.py: new sections recommended(type recommended, top songs), pick_week(type pick_week, top albums), recently_added(type albums, newest). Home now filters+orders sections by db.app_config key "home_layout".
- admin.py: GET/PUT /admin/home-layout (HOME_ROWS default all enabled)
- api.ts: adminApi.homeLayout/setHomeLayout
- NEW LayoutManager.tsx: list rows with up/down reorder + enable/disable Switch + Save; wired to "Layout Management" sidebar (tab:"layout")
- (tabs)/index.tsx: renders type "recommended" (rounded row cards + play), "pick_week" (wide dark cover card + play), recently_added uses AlbumCard
- Verified backend: layout save reorders/hides home sections (pick_week first, trending hidden). Reset to default after test.

## Session 17 — Spotify-style Home tile sizing + typography
- (tabs)/index.tsx: adopted Spotify tile sizes/fonts per user reference image.
  - Quick grid: flush colored icon block (56x56) left + bold 13px label, overflow hidden, no border (Spotify quick tiles).
  - Made for You (recommended): compact row card 182w + square 52px thumb (30% narrower).
  - Pick of the Week: 192x96 (was 240x120, ~20% smaller).
  - Songs rows (Trending/Jump Back In): songCard 112px (was 140, ~20% smaller).
  - Albums rows: AlbumCard width={120} (was 150, 20% smaller).
  - Recently Added: NEW dedicated "recently" branch — small square tiles (recentCard 104px) with title + artist sub, navigates to /album/[id]. Previously fell through to broken songs branch.
  - Section titles: tighter (letterSpacing -0.5, marginBottom sm); artist avatars 88px.
- Verified via screenshot on 390px viewport — matches Spotify reference.
