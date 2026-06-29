# Poker Chip Tracker — Progress & TODO

Last updated: 2026-06-29 — **🚀 Big push session: v0.11.0 → v0.14.0 LIVE.** 3 wave dispatch via subagents + 2 security audit:
- **v0.11.0** (`26d165a`): Web Push notif (HP push utk loan events, sw.js, /settings/notifications, VAPID env)
- **v0.12.0** (`7c4d76c`): Wave 1 — B6 buy_in display fix · B4 session creator cancel non-admin (migration 012a) · NEW win streak stats · I2 performance chart (recharts lazy-load) · F1 secure cookies
- **v0.13.0** (`14eaa34`): Wave 2 — B2 flip dealer matriks (neutral 2×, playing 1×) · B3 p1/p2 sessions decouple (migration 012b) · B1 phase trigger → endSession · in-app sheet only
- **v0.14.0** (`7c0b721`): Wave 3 — I1 progressive achievements (6 cat × 3 tier, 18 SVG custom, migration 015) · B5 admin rollback MVP (migration 014, snapshot table, 3x ROLLBACK confirm)
- **Security audits**: 2× clean (Wave 1 + Wave 3) — F1 fix applied, F3 confirmed intent, 2 LOW Wave 3 defensive notes acceptable
- **All migrations applied to prod by owner before each merge** (011, 012a, 012b, 014, 015)

Sebelumnya (2026-06-12): branch protection `main` aktif (admin bypass ON — verified via test push `c777e92`..`32395f2`, net diff nol). Catatan: jangan edit file UTF-8 pakai PS 5.1 `Set-Content` — ngerusak emoji (kejadian `ec0eb83`). **Fitur "Ajak Main"/rally: desain FINAL, belum diimplement** (lihat section 📣 di bawah).

## 🔔 Web Push notification — ✅ SHIPPED PROD 2026-06-29 (v0.11.0)

Push notification beneran (nongol di HP walau app tutup), owner-pilih Web Push.
Bangun infra generic + wire ke LOAN sebagai event pertama. **Butuh migration (011)
+ dep baru (`web-push`) + VAPID keys.**

- **Dep**: `web-push` + `@types/web-push`. VAPID via `pnpm gen:vapid` →
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` di `.env.local`
  (dev keys udah di-generate lokal; **prod set sendiri di Vercel**). Tanpa keys → push no-op (app tetap jalan).
- **Migration `011_push_subscriptions.sql`** (applied ke DB dev): tabel
  `push_subscriptions(player_id FK, endpoint UNIQUE, p256dh, auth, user_agent, …)`,
  1 pemain banyak device, UPSERT by endpoint.
- **Service worker** `public/sw.js` — PUSH-ONLY (ga nyentuh offline/caching, biar
  ga ngelawan alasan SW dulu di-skip). Handle `push` + `notificationclick`.
- **`lib/push.ts`** — `sendPushToPlayer(playerId, {title,body,url,tag})`. Best-effort:
  no-op kalau VAPID belum diset, never-throw (push gagal ga ngegagalin aksi inti),
  auto-prune subscription mati (404/410). Server-only (cuma di-import dari server action).
- **`lib/actions/push.ts`** — `savePushSubscription` / `deletePushSubscription` /
  `sendTestPush`, semua self-authorize (`getAuthenticatedPlayerId`).
- **UI**: `components/NotificationToggle.tsx` (deteksi support + hint iOS "Add to Home
  Screen" + tombol "Kirim notif tes"), halaman `/settings/notifications` + loading,
  link "Notifikasi" (icon Bell) di `HeaderMenu`.
- **Wire LOAN** (`lib/actions/loans.ts`, after COMMIT, best-effort): `requestLoan`→lender,
  `approveLoan`→borrower, `declineLoan`→borrower, `repayLoan`→lender. (`cancelLoan` skip.)
- **Verified**: `tsc --noEmit` clean; `pnpm build` hijau (semua route, termasuk
  `/settings/notifications`); `/sw.js` ke-serve 200; halaman render benar via
  chrome-devtools MCP (login JAGO, screenshot felt-green OK); feature-detection
  `supported:true`/`secureContext:true`/VAPID kebaca. **⚠ Belum di-tes delivery push
  end-to-end** — grant permission native + delivery ke device wajib MANUAL di HP asli
  (intrinsik Web Push: per-device, native prompt, iOS perlu PWA installed).
- **DONE**: committed `dev` (`a9266ef`, 16 file, auto-pushed origin/dev). `AGENTS.md` sengaja ga ikut.
- **BELUM (urut buat deploy prod):** (1) generate VAPID keys PROD + set 3 env di Vercel
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`) — JANGAN pakai dev keys;
  (2) **migrate DB prod `011` DULU** sebelum merge; (3) merge `dev → main` (auto-deploy);
  (4) opsional bump `lib/changelog.ts` biar dot "Baru" nyala; (5) tes delivery di HP asli.
  Belum ada e2e test push. Server action loan WAJIB Node runtime (web-push ga jalan di edge).
- **Post-review hardening (2026-06-09):** (1) **Logout/"ganti identitas" sekarang
  unsubscribe + hapus sub browser ini** (`HeaderMenu.handleLogout`) — fix bocor lintas-user
  di device sharing (pemain lama berhenti dapet notif di device yang udah ganti identitas;
  by endpoint → cuma device itu, bukan semua device-nya). (2) **4 blok push di `loans.ts`
  dibungkus `try/catch` lokal** (post-COMMIT) biar kegagalan notif ga akan pernah trigger
  ROLLBACK luar / mis-report loan sukses jadi error. tsc + build re-verified hijau.
- **Catatan env**: `pnpm dev` (Turbopack) di mesin owner panic `0xc0000142`
  (gagal spawn child proc utk CSS geist) — kena SEMUA route, bukan kode push. Workaround
  verifikasi: pakai `pnpm build && pnpm start`. Mungkin perlu clear `.next` / cek resource.

## 📣 Fitur "Ajak Main" / rally — DESAIN FINAL (2026-06-10), BELUM diimplement

Pakai infra Web Push (udah ada `sendPushToPlayer`) buat **ngumpulin grup main poker
di rumah temen**. Owner-approved, semua keputusan di bawah udah final. Lanjut: tinggal
bikin rencana implementasi (file/migration/checkpoint) lalu ngoding.

### Prinsip inti (poin owner): ajakan = TUAN RUMAH dulu, baru grup
Rally ga ada artinya tanpa tuan rumah yang available. Grup baru di-blast notif SETELAH
venue pasti — hindari "5 orang semangat ikut, taunya rumah tutup".

### Pisahin 2 konsep (KRUSIAL — availability ga boleh sticky)
- **Kapabilitas `can_host`** (statis): "rumahku bisa dipake". Di-set **self-toggle di
  settings + admin bisa set** (owner pilih dua-duanya). Ga pernah auto-reset.
- **Availability** (sementara, per-malam): host dianggap available **cuma kalau ada
  rally aktif yang dia buka/konfirmasi**. **BUKAN toggle nyangkut.** Tiap rally punya
  `expires_at` (mis. besok ~jam 5 / pas sesi kelar — mana duluan), dihitung **lazy**
  (`expires_at > now()` pas dibaca, ga butuh cron). Ganti hari → rally hangus sendiri →
  host ga lagi keliatan available. Owner khawatir host dikira "available terus" → ini
  jawabannya. Host juga bisa matiin manual ("Ga jadi").

### Keputusan owner (2026-06-10)
1. **Bisa beberapa rumah** (multi-host) → perlu picker venue.
2. **Dua jalur dibangun** (A + B).
3. **`can_host`**: self-toggle settings + admin set.
4. **RSVP**: ikut dari awal (owner "bebas, yang terbaik").

### Alur
- **Jalur A — host buka sendiri:** host pencet "Available malam ini — main di tempat gua"
  (+jam opsional) → venue langsung pasti → broadcast.
- **Jalur B — orang lain colek:** anggota pencet "Colek tuan rumah" → SEMUA pemain
  `can_host` dapet notif "ada yg mau main, available ga?" → host pencet "Available, ayo".
  Kalau >1 host jawab available → **pengaju milih rumah siapa** (bukan first-confirm).
- **1 rally aktif** dalam satu waktu (grup ga bingung 2 ajakan barengan).
- **Setelah venue pasti:** blast push ke semua anggota ("Ngumpul di rumah Budi jam 8 🃏 —
  ikut?") → RSVP **[Ikut]/[Nanti]** → hitungan live di dashboard (polling 2dtk existing) →
  tinggal "Mulai sesi" (flow existing). Rally auto-hangus pas sesi kelar / besok pagi.
- **Edge:** host berubah pikiran → "Ga jadi" → rally batal + grup dikabarin "batal, tuan
  rumah ga jadi". Ga ada host available → rally ga kebuka (colek = nudge). Ganti hari → bersih.

### Sketsa data
- `players.can_host` BOOLEAN default false (self-toggle settings + admin). **Migration kecil.**
- `rallies(id, season_id, host_id, opener_id, note, status, created_at, expires_at)`.
  `status`: `pending_host` (Jalur B nunggu konfirmasi) / `open` (venue pasti, broadcast) /
  `cancelled` / `expired` / `done`.
- `rally_responses(rally_id, player_id, response['ikut'|'nanti'], responded_at)`.
- Endpoint per-user `/api/rally` (no-cache, pola `/api/loans`) buat banner + hitungan RSVP.
- Notif rally pakai tag sendiri (`rally-*`); inget `renotify:true` (udah default di sw.js).

### Phasing
- **Step 1:** schema + `can_host` toggle (settings+admin) + Jalur A + broadcast + RSVP +
  auto-expire (lazy). Udah kepake penuh.
- **Step 2:** Jalur B ("colek"→konfirmasi→pilih rumah) di atas schema yang sama.

### Anti-spam
Cooldown global (mis. ~10 mnt) + maks 1 rally aktif. Server action self-authorize (login +
anggota musim aktif), pola sama kayak loan.

## 🔒 Security follow-up — auth gate musim (2026-06-09, branch `dev`) — NEW, belum commit

Review keamanan kedua (post Fase A–F). Dua server action musim kelewat dari aturan
"setiap action self-authorize" (kelas sama kayak fix `37c2d41`, tapi buat action yang
ditambah belakangan):
- **`endSeason(seasonId)`** & **`createSeason(input)`** di [lib/actions/season.ts](lib/actions/season.ts)
  **TANPA auth check sama sekali**. `endSeason` destruktif berat (reset SEMUA saldo +
  tutup musim + settle loan). Halaman `/season/end` & `/season/new` ke-gate
  `(main)/layout.tsx`, TAPI server action invocable via POST langsung (bypass render layout).
- **Live-pentest di dev** (browser, logged-out): POST action langsung via `fetch`
  (action id dari `.next/dev/server/app/.../server-reference-manifest.json`, body = JSON
  array args, header `Next-Action`). Non-destruktif: `endSeason` UUID bogus → "Season
  tidak ditemukan"; `createSeason` (musim aktif ada) → "Sudah ada season aktif". Keduanya
  EXECUTE tanpa cookie auth → vuln confirmed.
- **Fix:** `endSeason` → wajib login + (admin ATAU member musim). `createSeason` → wajib
  login/admin kecuali tabel players kosong (bootstrap pertama). `adminForceEndSeason`
  tetep jalan (isAdmin → skip cek member).
- **Verified:** unauth→"Belum login", member(JAGO)→lolos ("Season tidak ditemukan");
  `tsc --noEmit` clean; `pnpm build` green; saldo dev DB utuh (gak ada yang ke-reset).
- **BELUM:** commit ke `dev` + merge `main` (deploy prod). Pertimbangkan re-run full E2E
  (z-m3 nyentuh endSeason via member + force-end via admin → harusnya tetep hijau).

## 🐛 Fix hint dealer netral + cooldown (2026-06-09, branch `dev`) — NEW

Owner nemu: dealer yg lagi **cooldown** trus dipilih **"cuma bagi kartu"** (netral)
di Phase 1 → hint setup bilang "gaji 1× buy-in (+chip di meja)" PADAHAL pas main ga
dapet apa-apa. **Logika game-nya BENAR** (cooldown netral → `buy_in_no_gaji_dealer`,
0 gaji); yang salah cuma **teks hint** — cabang Phase 1 netral di
[SessionSetupForm.tsx](components/SessionSetupForm.tsx) ga ngecek `cooldown_remaining`.
Fix: tambah cek cooldown → kalau cooling tampil "cooldown, gak dapat gaji" (match
`startSession`'s `dealerFreeEntry = !isPhase2 && !cooldown`). Verified via MCP (OwnerTaveve
cooldown→"gak dapat gaji"; PAN8 non-cooldown→tetep "gaji 1× buy-in"). tsc + build green.

## 🧪 Unit test math ekonomi (2026-06-09, branch `dev`) — NEW

Logika matriks dealer/buy-in (paling rumit & sensitif-duit) dulu inline di loop
`startSession`. Di-extract jadi **pure function** + di-unit-test. **No new dep**
(pakai `node:test` bawaan + `tsx` yg udah ada), **no migration**.

- `lib/economy.ts` — `deriveParticipantTreatment({isDealer, dealerPlays, dealerFreeEntry,
  balance, buyIn})` → `{deduction, action, noGaji, salaryChips, salaryBankroll}`. Single
  source of truth buat matriks dealer (mirror persis logika lama).
- `lib/actions/session.ts` — loop sekarang manggil pure fn itu (diff minimal,
  behavior-identical; dealerGotSalary/Chips/BankrollHalf di-derive dari hasilnya).
- `lib/economy.test.ts` — 10 test nge-cover seluruh matriks (non-dealer afford/capped,
  P1 playing-free 2× split, P1 free broke, P2 playing pay, P2 broke deals-only, P1/P2
  neutral, + invariant: neutral never-bankroll, bankroll-implies-chips).
- `package.json` script `test:unit` = `tsx --test lib/**/*.test.ts` (file di luar
  `tests/` → ga ke-pickup Playwright; `testDir: './tests'`).
- **Verified:** `pnpm test:unit` 10/10, `tsc --noEmit` clean, `pnpm build` green, dan
  **re-test sesi live via chrome-devtools MCP** (start P1 free-dealer → JAGO 500→600
  +100 bankroll, lain −100, persis kayak sebelum refactor → cancel via admin → saldo
  balik baseline). Behavior-preserving terkonfirmasi end-to-end.
- **Follow-up (belum):** extract + test `max_pool` derivation (createSeason) & recap
  delta (end-wizard) pakai harness yg sama; bump changelog (ga perlu — internal); merge main.

## 📱 PWA / installable (2026-06-09, branch `dev`) — NEW

App-nya mobile-first & dipakai rame-rame di HP di meja, tapi sebelumnya **ga ada
manifest/icon sama sekali** → ga bisa "Add to Home Screen". Sekarang installable +
standalone (full-screen). **No new dep, no migration.**

- `app/manifest.ts` — `MetadataRoute.Manifest` (name, short_name "PokerAja", display
  `standalone`, orientation portrait, theme/bg `#0a0a0a`, 3 icon any+maskable). Next
  auto-serve di `/manifest.webmanifest` + inject `<link rel="manifest">`.
- `app/layout.tsx` — tambah `description`, `applicationName`, `appleWebApp`
  (capable + title + status-bar `black-translucent`) biar iOS standalone.
- Icon felt-green (chip poker + spade, cream edge-spots): `app/icon.png` (favicon 512,
  auto-link), `app/apple-icon.png` (180), `public/icon-{192,512}.png` (any),
  `public/icon-maskable-512.png` (full-bleed felt, safe-zone). Di-generate via
  `scripts/gen-icons.mjs` (sharp via .pnpm path → SVG→PNG; re-run kalau artwork berubah).
- **Verified:** `/manifest.webmanifest` 200 + shape benar, head links ke-inject (manifest
  + apple meta + icon + apple-touch), `tsc --noEmit` clean, `pnpm build` green (manifest +
  icon + apple-icon ke-emit static), app render normal di Chrome (devtools MCP).
- **BELUM:** bump `lib/changelog.ts` (sengaja — biar dot "Baru" ga nyala sebelum rilis),
  merge ke `main`. Service-worker/offline sengaja di-SKIP (app butuh network/DB; installable
  + standalone udah jadi win utamanya).

### 💡 Rekomendasi pengembangan lain (dari review menyeluruh 2026-06-09)
- ✅ **Unit test math ekonomi** — DONE (lihat seksi di atas; pakai `node:test`, BUKAN vitest).
- **Isolasi test DB** (tech debt lama) — harness UDAH siap: `playwright.config.ts` baca
  `TEST_DATABASE_URL` (kalau di-set → override DATABASE/POSTGRES_URL + spin dev server
  sendiri). **Tinggal owner-action:** bikin Neon test branch lalu set `TEST_DATABASE_URL`
  di `.env.local`. Tanpa itu, suite tetap jalan di dev DB asli (warning ke-print).
- **Riwayat per-sesi / "malam ini"** — stats sekarang agregat per-musim; recap per-malam seru
  buat grup (pakai edit_log existing).
- **`/lihat` guest nampilin saldo** — beda dari niat awal ("tanpa balance"); konfirmasi intent.


## 🚀 Deployment (Vercel) — 2026-05-31

- [x] **Deployed to Vercel** — project `poker-site` (team "Deon's projects", Hobby), GitHub `deonaja/PokerSite` `main` → auto-deploy on push. Dashboard import + Next.js preset.
- [x] **Prod DB = NEW Neon** via Vercel Storage integration (`neon-champagne-umbrella`, region `sin1` Singapore, free tier). Host `ep-proud-sound-ao8lys8z`. Distinct from old dev/test DB (`ep-bold-glitter`). Integration auto-injected `DATABASE_URL` + `POSTGRES_URL` (+ PG*/UNPOOLED variants). Migrated fresh: 9 tables, `one_active_session` index verified, 0 players.
- [x] `ADMIN_KEY` env var set in Vercel (Production) — confirmed working via smoke test (`/admin?key=correct` → 307+cookie, wrong key → 404).
- [x] **LIVE** at `pokeraja.vercel.app` (verified opens in browser 2026-05-31).
- [x] **Fix A — pooled connection (commit `f142fd4`):** Neon integration injects a *pooled* `DATABASE_URL` (`-pooler` host), but `@vercel/postgres` `createClient()` only accepts a *direct* connection → broke transactions + migrate in prod. `lib/db.ts` + `db/migrate.ts` now strip `-pooler` for the transactional client (no-op for already-direct local string). Build green.
- [x] **Fix B — git commit email:** first push was blocked by Vercel ("commit email `you@example.com` could not be matched to a GitHub account"). Repo git `user.email` was the placeholder. Set repo-local `user.email = deonpwa@gmail.com`, amended + force-pushed → unblocked. (Future commits in this repo now use the matched email.)
- [x] **Fix C — redirect loop after season creation (commit `0e9bcf4`):** prod-only bug. `app/identity/page.tsx` called `redirect('/season/new')` *before* awaiting `searchParams`, so with the empty build-time DB Next prerendered `/identity` as a **static permanent redirect to /season/new** (`○ (Static)` in build output). Once a season existed this baked redirect drove a loop `/identity → /season/new → / → /identity`. Fixed with `export const dynamic = 'force-dynamic'`. Never seen in dev/tests (dev doesn't prerender). Lesson: any page doing a live-DB-state redirect must be force-dynamic, else build-time DB state gets baked in.
- [x] **Reverted `.env.local` `DATABASE_URL` back to the dev DB** (`ep-bold-glitter`) after deploy — local `pnpm dev`/`pnpm test` no longer touch prod.
- [x] **Smoke tested prod** — `scripts/smoke-prod.mjs` (`pnpm smoke <url> <key>`, commit `33d9a85`): read-only HTTP checks, 8/8 pass (`/api/poll` 200+shape, `/identity` 200 [loop fixed], `/` 307→/identity, admin 404-vs-auth, security headers). Plus manual: login + 1 full session OK on prod.
- [x] **Deployment fully verified & live.** Run `pnpm smoke` after each deploy as a sanity check. (Do NOT point the Playwright suite at prod — it seeds `[T…]` players + mutates data; keep heavy tests on the dev DB.)
- [x] **Renamed project → `pokeraja`** (free `.vercel.app` rename). Prod URL is now `pokeraja.vercel.app`; the old `poker-site-kappa.vercel.app` is dead (`DEPLOYMENT_NOT_FOUND`). Same project/DB/env — only the domain changed.
- [x] **Abuse hardening — `/api/poll` CDN cache (commit `ccc8b2c`):** was `no-store`; now `public, s-maxage=1, stale-while-revalidate=4`. Payload is global (no per-user data) so a shared edge cache is safe. Verified live: 1st req `X-Vercel-Cache: MISS`, 2nd `HIT` → repeated/abusive polls served from Vercel edge, sparing function-invocation quota + Neon. For active attacks, use Vercel **Firewall → Attack Challenge Mode** (free toggle) + block-by-IP rules.
- [x] **PIN brute-force throttle (commit `179b393`, migration 005):** per-player lockout on `/api/identity` — 5 consecutive wrong PINs → 15-min lock; correct login resets. Race-safe (`SELECT … FOR UPDATE` in a txn); locked attempts short-circuit before the PIN check. Per-player (not per-IP — home group shares one WiFi). `IdentityPicker` shows `error=locked`. e2e covers it (8/8 identity). Migrated both DBs (dev + prod); prod `/api/identity` verified 303 (no 500). **Note:** repo has a `post-commit` hook that auto-pushes → migrate prod BEFORE committing schema-dependent code next time.

## 🔒 Security review — 2026-05-31

Full sweep of auth/authz/endpoints/SQL (prod disposable, owner-authorized pentest).

- [x] **CRITICAL fixed (commit `37c2d41`):** `editBalance`, `resetPlayerPin`, `addPlayer` (lib/actions/players.ts) had NO admin check. Server action IDs ship in the public client bundle → invocable by anyone → set any balance, **reset any PIN (account takeover)**, add players. Now gated by shared `isAdmin()`.
- [x] **MEDIUM/HIGH fixed (same commit):** `rebuy`/`undoRebuy`/`startSession`/`endSession` didn't require auth → unauth caller could rewrite balances via `endSession` on an active session. Now reject when not logged in. `forceEndSession` now `isAdmin()`-gated.
- [x] Extracted shared `isAdmin()` → `lib/auth-server.ts`; deduped debug.ts + admin export route.
- [x] **Verified clean:** SQL fully parameterized (no string-concat → no SQLi); admin export route already re-verifies `isAdmin()` (404 otherwise); PIN hashing scrypt + `timingSafeEqual`; session token sha256-hashed at rest; admin wrong-key → real 404.
- [x] Build green; admin+session+identity suites pass (2 known hydration-flaky, pass on retry).
- [x] **Robustness (commit `c137d5d`):** malformed (non-UUID) `playerId` on `/api/identity` threw Postgres 22P02 → 500. Now validated up front (→ `error=invalid`) + a catch wraps the login txn (rollback + graceful redirect). Verified on prod: 500 → 303.
- [x] **LOW closed (commit `b1d06a6`):** dropped the vestigial non-httpOnly `playerId`/`playerName` cookies (never read anywhere — client uses localStorage, server uses `auth_session`→DB); logout still clears legacy ones. `makeUrl()` now honors `x-forwarded-proto` → 303 redirects use https on Vercel. CSRF on `/api/identity` left untokenized by design (login CSRF needs the victim's PIN + sameSite cookies → negligible).

## 🎨 UI redesign (branch `redesign/shadcn`)

Re-platforming the 13 custom components onto themed shadcn primitives. Felt-green
identity preserved (anti "AI-ish"); shadcn ban lifted in SPEC/CLAUDE. Magic UI /
flashy animation still banned. **Revert savepoint: git tag `v0.95-pre-redesign`.**

> **✅ MERGED TO `main` 2026-05-31** (merge commit `47f639c`, --no-ff). Re-platform
> + full felt-green visual redesign + bug fixes + test-infra fixes all live on main.
> Build green, 71/71 e2e. Next: M4 (achievement / export CSV).

- [x] **Step 1 — foundation** (no visual change): deps (cva, clsx, tailwind-merge, tailwindcss-animate, lucide), `lib/utils.ts` cn(), `components.json`, tailwind tokens + globals.css aliases → felt-green. Build green, 71/71 tests pass. (commit `19187f8`)
- [x] **Step 2 — pilot: Button + Sheet** → `components/ui/button.tsx` (shadcn cva) + `Button.tsx` adapter (legacy API preserved, 13 call-sites untouched); `Sheet.tsx` rebuilt on Radix Dialog. Build green, 71/71 pass. (commit `4025b16`)
- [x] **Step 3 — per-screen migration** (tests each checkpoint) — DONE 2026-05-30. Full e2e 71/71 green after every screen migrated.
- [x] **Visual redesign pass — "Underground Table"** (started 2026-05-30, owner-directed): bahasa visual baru di atas primitive shadcn, tetap felt-green/dark/anti-AI-ish.
  - [x] Dashboard: **redesign ke konsep PODIUM** (owner-approved setelah render konsep 1-per-1). Top-3 ditampilkan sebagai podium (juara 1 di tengah, blok felt tinggi + angka emas, avatar pemain di atas blok; pemain-login dapat ring felt). Sisanya (#4+) jadi list "PERINGKAT LAINNYA" flat sejajar (low-balance ⚠ gold, baris pemain-login di-highlight + tag KAMU). Season context line + Riwayat musim di atas; CTA chunky. `page.tsx` passing `currentPlayerId` via `getAuthenticatedPlayer()`. `PlayerCard` dihapus. (Konsep yang dilewati: hero "Saldo kamu", standings table, accent-bar felt, box, garis, season band — di-render lalu owner pilih podium.)
  - [x] Header (global `(main)` chrome): `HeaderMenu` client — avatar inisial felt + "Hi, nama" + chevron; semua aksi pindah ke bottom-sheet (Ganti PIN / Ganti identitas) biar header ga crowded. (avatar image / "ganti gambar" DITUNDA per owner). `identity.spec` diupdate (buka sheet dulu, hydration-safe retry). Build + 71/71 green.
  - [x] Roll out bahasa visual ke layar lain (1-per-1, render PNG dulu utk review):
    - [x] **Session aktif** (`SessionView`): tiap peserta card + avatar inisial; dealer card felt-green + badge ★ DEALER; pemain-login dapat ring felt + tag KAMU; low-balance saldo gold + tombol "Saldo kurang"; Rebuy/Undo. `session/page.tsx` passing `currentPlayerId`. Teks/atribut test dijaga; 31/31 session+z-m2-coverage pass.
    - [x] **Setup sesi** (`SessionSetupForm`): avatar inisial di row pemain & dealer, CTA "Mulai" chunky uppercase. Hydration-sync + atribut input dijaga; 38/38 session+z-m2 pass.
    - [x] **End-wizard** (`SessionEndWizard`): avatar inisial di recap rows + step header (avatar gede), CTA Confirm chunky uppercase. Recap delta & semua teks/regex test dijaga; 35/35 session+z-m2+z-m3 pass.
    - [x] **identity-picker**: avatar inisial (aria-hidden biar nama tombol tetap match test) + CTA "Masuk" chunky.
    - [x] **player/[id]**: avatar gede di header. **history** (`HistoryAccordion`): avatar inisial di tiap baris klasemen. **pin** (`ChangePinForm`): CTA "Simpan PIN" chunky. **season/new** (`SeasonSetup`): CTA forward "Lanjut/Mulai Season" chunky uppercase. (via subagent paralel; full e2e 71/71 pass DB-warm)
    - [x] **admin**: avatar inisial di list pemain (aria-hidden). Form & log table dibiarin themed 3e (uppercase chunky ga cocok di panel utility padat). admin.spec 15/15 pass.
  - [x] **Visual redesign pass SELESAI** — semua layar (dashboard podium, setup, session, end-wizard, identity, player, history, pin, season/new, admin) + header global konsisten felt-green/avatar/chunky-CTA. Full e2e 71/71.
- [x] **Fixed `global-teardown.ts` FK error (2026-05-30)** — teardown gagal hapus `[T…]` players karena `season_results` (M3) FK-refer mereka & ga ikut dibersihin → stray players numpuk di DB Neon asli (57 ke-akumulasi!) + `pnpm test` exit non-zero ("1 error not part of any test"). Fix: hapus `season_results` sebelum players (tracked + stray), clear `last_dealer_session_id` yang refer sesi test, dan tangani sesi di mana stray jadi dealer (bukan cuma participant). One-off cleanup: 57 stray dihapus, DB balik ke 4 player asli (JAGO/OwnerTaveve/PAN8/yontol). Verified: teardown bersih, 0 stray, exit 0.
- [x] **Chrome + loading skeletons** (2026-05-30) — `(main)/layout.tsx` header, `session/setup/page.tsx` chrome, and all loading skeletons (`(main)/loading`, `session/loading`, `session/end/loading`, `session/setup/loading`, `identity/loading`) migrated to Tailwind felt-green tokens + `animate-pulse`. Only intentional dynamic inline styles remain: admin log-badge `ACTION_COLORS` (data-driven) and skeleton `animationDelay` (per-index stagger). **Redesign migration complete.**
  - [x] 3a dashboard → Card + Badge primitives, PlayerCard/BalanceDisplay on Tailwind tokens. 71/71 pass. (commit `ca24d4d`)
  - [x] 3b session active (`SessionView`) → Card + Badge primitives, inline styles → Tailwind felt-green tokens, Button/Sheet adapters kept. DOM text preserved. Build green, session specs 18/18 pass. (2026-05-30)
  - [x] 3c end-session wizard (`SessionEndWizard`) → Card for info/recap/rake boxes, Badge for dealer chips, sticky-bottom CTA pattern, inline styles → Tailwind tokens. All handlers/refs and DOM text (input[type=number], step counter, RECAP, KALKULATOR RAKE, button labels) preserved. Build green, 35/35 wizard specs pass. (2026-05-30)
  - [x] 3d session setup (`SessionSetupForm`) → rowClass helper (felt active / neutral surface), inline styles → Tailwind tokens, accent-primary checkboxes/radios. Hydration-sync effects + input attributes (`data-player-id`, `name="dealer"`, value) and label structure preserved for e2e. Build green, session + z-m2-coverage 31/31 pass. (2026-05-30)
  - [x] 3e admin + remaining → identity (IdentityPicker + loading), admin cluster (page + AddPlayer/EditBalance/ForceEnd/ResetPin/Debug; dynamic ACTION_COLORS log badge kept as data-driven inline style), season/new (SeasonSetup 4-step), season/history (+ end + SeasonEndConfirm), player/[id], settings/pin (ChangePinForm). Inline styles → Tailwind felt-green tokens; primitives (Card/Badge/Button) where they map; all DOM text/attributes/handlers preserved. Build green, full e2e 71/71 pass. (2026-05-30; 4 screens via parallel subagents + identity by hand)

## Overall status

| Milestone | Status | Weight |
|---|---|---|
| M1 — MVP tracking | ✅ 100% | — |
| M2 — Season system | ✅ 100% | — |
| M3 — Season end + leaderboard | ✅ 100% | — |
| M4 — Polish (stats, export, achievements) | ✅ 100% | — |
| Fase A — nyawa economy | ✅ prod 2026-06-08 | — |
| Fase B — dealer netral + rake rule | ✅ prod 2026-06-08 | — |
| Fase C — season membership | ✅ prod 2026-06-08 | — |
| Fase D — LOAN antar pemain | ✅ prod 2026-06-08 | — |
| Fase E — register auth-code + join + guest | ✅ prod 2026-06-08 | — |
| Fase F — panduan / onboarding | ✅ prod 2026-06-08 | — |
| UI no-emoji (lucide SVG) | ✅ prod 2026-06-08 | — |

**Semua roadmap yang direncanain udah SHIP ke prod.** Sisa = backlog ide yang belum dijadwalin: **LATE JOIN** (gabung sesi berjalan), **item 11** (rapihin /identity picker), Telegram notif (opsional/skip), + tech debt (test-DB isolation, filename `002_*` dobel).

---

## ✅ M1 — MVP (100%)

- [x] Identity flow with PIN auth (7-day cookie session)
- [x] Dashboard with 2s polling
- [x] Session setup (player checkboxes, dealer radio, recommendation)
- [x] Active session view with rebuy / undo (race-safe via `SELECT FOR UPDATE`)
- [x] End-session wizard (per-player stack input, recap, validation)
- [x] Admin endpoint (key-gated via cookie + middleware)
- [x] Append-only edit log, paginated, filterable by action

---

## ✅ M2 — Season system (100%)

### Done

**Season creation flow** (`/season/new`)
- [x] 4-step multi-step form (players → modal/buy-in → preset → confirm), unauthenticated
- [x] `buy_in = starting_balance / 2`
- [x] BB / SB recommendation (informational)
- [x] Presets: Sprint / Quick / Standard / Marathon / Custom
- [x] New players get default PIN `1234`

**PIN self-service**
- [x] `/settings/pin` change-PIN page (verify old → set new)
- [x] Header link "ganti PIN" on `(main)` layout

**Phase system**
- [x] `seasons.current_phase` (`bootstrap` / `steady`)
- [x] Auto-transition `bootstrap → steady` when `SUM(balance) >= max_pool` at session start
- [x] Dashboard shows phase badge (BOOTSTRAP / STEADY) + season info card

**Dealer model (heavily iterated)**

Treatment is derived at session start based on phase + cooldown + balance:

| Phase | Cooldown | Balance | Behavior |
|---|---|---|---|
| 1 | no | ≥ buy_in | **Free entry — no buy-in deduction.** Receives `+buy_in` salary chips printed on table (plays with 1× buy_in stack) |
| 1 | no | < buy_in | Free entry — no deduction, play with the salary chips (1× buy_in stack) |
| 1 | yes | ≥ buy_in | Pay buy-in, no salary |
| 1 | yes | < buy_in | Deals only (`no_gaji_dealer = true`), no salary |
| 2 | n/a | ≥ buy_in | Pay buy-in, salary = rake (collected via end stack) |
| 2 | n/a | < buy_in | Deals only, no upfront salary (rake via end stack if any) |

- [x] Cooldown does NOT block selection — it only denies the Phase 1 free-entry salary
- [x] Cooldown anchor (`last_dealer_session_id`) set only when salary is actually granted
- [x] Cooldown badge shows remaining sessions on setup
- [x] Dealer recommendation prefers lowest-balance non-cooldown player
- [x] Setup hint spells out per-case behavior in plain Indonesian
- [x] Low-balance non-dealer is server-rejected (low balance can only join AS dealer)

**Session-active UX**
- [x] Each participant card shows live `Saldo: X` (polled)
- [x] Rebuy button disabled with label "Saldo kurang" when `balance < buy_in`
- [x] Rebuy server hard-rejects when balance insufficient (no more unlimited `Math.min(0, buy_in)` rebuys)
- [x] No-gaji participant shows "BAGI KARTU" badge with no rebuy controls

**End-session reconciliation**
- [x] Per-participant `contributed` summed from `edit_log` deductions (handles free dealer, deals-only, partial low-balance, dealer salary chips)
- [x] Recap shows `original_balance → new_balance (delta)` from `balance_before` of first edit-log entry — true net session result
- [x] Inputs persist to `localStorage` keyed by `sessionId` once the recap loads
- [x] Edit on a participant from the recap returns to the recap (not next player); button reads "Simpan"
- [x] Back on recap goes to `/session`; returning to `/session/end` lands directly on the recap with saved inputs
- [x] Storage entry cleared on successful Confirm

**Admin debug panel**
- [x] Reset season → wipe all seasons + sessions, numbering restarts at #1, players preserved
- [x] Set phase (bootstrap / steady) on active season
- [x] Reset balances (default = `starting_balance`, custom amount supported)
- [x] Clear cooldowns (`last_dealer_session_id = NULL` for everyone)
- [x] Nuke all data → fresh install
- [x] Each destructive action requires a second confirm click
- [x] Server-side guard re-verifies the `admin_key` cookie (not just page-level gating)

### Done (100%)

- [x] **Rake calculator UI (Phase 2 end session)** — dealer's step in end-session wizard shows "KALKULATOR RAKE" card with total chip, rake rate, and estimated rake (rounded to nearest 5). Informational only, no balance effect (Approach C).

---

## ✅ M3 — Season end + leaderboard (100%)

### Done
- [x] Auto-detect season over in `endSession` (`sessions_played >= max_sessions`)
- [x] `endSeason` action — snapshot to `season_results` (rank, sessions_played, times_dealer, total_won, total_lost), reset balances to `starting_balance`, close season
- [x] `/season/end` page — leaderboard of all players (ranked by balance, delta vs starting), two-tap "Akhiri Musim" confirm → redirects to `/season/new`
- [x] `SessionEndWizard` redirects to `/season/end?id=xxx` when `seasonOver: true`
- [x] Admin "Force end season" button in `/admin` (snapshot + reset, distinct from debug wipe)
- [x] Per-season per-player stats: sessions_played, times_dealer, total_won, total_lost stored in `season_results`

### Done (continued)
- [x] Season history view — `/season/history` with accordion cards per ended season, shows rank, final balance, delta, sessions/dealer counts
- [x] "Riwayat musim →" link on dashboard
- [x] Season 2+ pre-fill — `/season/new` now queries players from last ended season (by rank), shows hint "dari musim sebelumnya"

### Done (continued)
- [x] Per-player stats view — `/player/[id]` with overall stats (seasons, best rank, total won/lost) + per-season breakdown; PlayerCard links to it
- [x] Bug fix: `endSeason` CTE `rebuy_undo` formula was inverted (added instead of subtracted from contributed) → stats total_won/total_lost were wrong when undos exist
- [x] Bug fix: `endSeason` was overwriting `current_phase = 'bootstrap'` on the ended season (losing historical phase data)

---

## 🚧 M4 — Polish (Export CSV + Achievements done; polish open)

- [x] Per-player overall stats (cross-season) — `/player/[id]` (done in M3)
- [x] **Export CSV** (2026-05-31, merged to main `28e74df`) — admin-only `/admin/export?type=results|log|players|sessions` download endpoint (middleware-gated + re-verifies `admin_key` cookie, 404 otherwise; UTF-8 BOM for Excel). EXPORT CSV section on admin page (4 buttons). `lib/csv.ts` helper. 2 e2e tests. Full suite 73/73.
- [x] **Achievement system** (2026-05-31, merged to main `31a4822`) — stored (migration 004 `player_achievements`, awarded in `endSeason` from each player's season_results history, idempotent). 6 badges (🏆 Juara, 🥈 Podium, 🎖️ Veteran, 🃏 Raja Bandar, 💰 Sultan, 📈 Musim Untung) in `lib/achievements.ts`; PENCAPAIAN section on `/player/[id]` (earned felt / locked muted). Existing results backfilled (real players legit 0). e2e: z-m3 asserts rank-1 → juara+podium. 73/73.
- [x] **Durasi sesi + statistik waktu main (2026-06-06)** — `sessions.started_at`/`ended_at` udah ada di schema (001_init), jadi ga perlu migration; murni nampilin. Helper baru `lib/duration.ts` (`formatClock` mm:ss/h:mm:ss live, `formatDurationShort` "1j 23m" buat stats) + hook `lib/useElapsed.ts` (`useElapsedSeconds`, tick 1s, null sampe mounted biar ga hydration-mismatch). (1) **Sesi aktif** `/session`: timer hidup di header (`SessionView` terima `startedAt`, page query tambah `started_at`). (2) **Recap akhir** `SessionEndWizard`: baris "Durasi 1j 23m" di header RECAP (terima `startedAt`, end page query tambah `s.started_at`) — live krn sesi belum ended pas recap. (3) **Stats pemain** `/player/[id]`: box "Total waktu main" + "Rata-rata/sesi" dari `SUM/COUNT(EXTRACT(EPOCH FROM ended_at−started_at))` di sesi `ended` yang dia ikut (join sessions⋈session_participants, BUKAN season_results yang ga simpen waktu). Section STATISTIK muncul kalau `totalSeasons>0 || playedSessionCount>0` biar keliatan walau musim belum kelar (kasus season 1). Build green.
- [x] **Rebuy partial saat saldo < buy_in (Opsi B, 2026-06-06)** — dulu rebuy ditolak total kalau `balance < buy_in`. Owner: di praktek banyak yang mau rebuy walau saldo ga cukup. Sekarang rebuy ambil **`min(buy_in, saldo)`** (saldo ga pernah minus); cuma ditolak kalau saldo = 0 ("Saldo habis, tidak bisa rebuy"). `lib/actions/session.ts` `rebuy` (partial deduct + metadata simpan jumlah asli) & `undoRebuy` (balikin jumlah asli dari `balance_before − balance_after` entry yang di-void, BUKAN `buy_in` penuh — true reversal buat partial). `SessionView.tsx`: tombol disable cuma pas `balance <= 0` (label "Saldo habis"), sheet nunjukin nominal partial "(sisa saldo)". Tes diupdate (balance.spec partial rebuy + z-m2 reject-at-0); build green, 2/2 tes kena pass. Ga overlap sama loan (loan = luar sesi, rebuy = dalam sesi).
- [x] **Changelog "Apa yang baru" + dot notif (2026-06-06, branch `feat/changelog`)** — changelog statis di kode (no DB/migration): `lib/changelog.ts` (array entry `{version,date,changes[]}` versi 0.x terbaru-di-atas + `LATEST_VERSION` + `CHANGELOG_SEEN_KEY`). Halaman `app/(main)/changelog/page.tsx` + loading skeleton (kartu felt-green per versi: badge `v0.6.0`, tanggal tabular-nums, bullet). `HeaderMenu`: dot felt-green di avatar kalau `last-seen (localStorage) != LATEST_VERSION` (default false biar ga hydration-mismatch, listen event `changelog-seen`) + link "Apa yang baru" w/ badge "Baru". `components/MarkChangelogSeen.tsx` di halaman changelog set localStorage + dispatch event → dot ilang real-time same-tab, tetep ilang abis reload. Typecheck (`tsc --noEmit`) clean; **verified live di Chrome (devtools MCP)**: dot nyala saat login → buka changelog → dot ilang → tetep ilang balik ke dashboard. Commit `5705884` di branch `feat/changelog`, pushed ke origin. PR ke `main` belum dibuat (gh CLI ga ke-install di env) — buka manual: https://github.com/deonaja/PokerSite/pull/new/feat/changelog. PR bakal bawa 4 perubahan ke main (batalkan-sesi + rebuy partial + durasi sesi + changelog) karena main ketinggalan 3 commit dari dev.
- [ ] Additional UX polish (TBD)
  - [x] **Alert saat pergantian phase (DONE 2026-06-06, branch `feat/phase-alert`)** — diimplement pakai **deteksi di dashboard** (bukan ngubah `startSession`): `DashboardClient` simpan `phase_seen` di localStorage, kalau beda sama `season.current_phase` sekarang → munculin Sheet sekali (`PHASE_NOTICE` copy per fase: steady = dealer mulai bayar buy-in + rake; bootstrap = dealer main gratis). Pola sama kayak changelog "seen"; keuntungan: tiap device yang buka dashboard abis flip dapet notif (bukan cuma yg mulai sesi). Verified live di Chrome (simulasi via localStorage: first-visit no-alert → phase berubah → sheet muncul → acknowledge → one-time, ga muncul lagi). Build green. **Detail ide asli di bawah:**
  - [~] ~~Alert saat pergantian phase~~ — transisi `bootstrap → steady` terjadi silent di `startSession` ([lib/actions/session.ts:421-433](lib/actions/session.ts)): pas `SUM(balance) >= max_pool`, phase di-flip tanpa feedback apa-apa. Owner mau ada **alert** biar yang megang app sadar phase baru aja berganti. Catatan implementasi nanti: `startSession` perlu return flag (mis. `phaseChanged: true` / `newPhase`), lalu di client (`/session` atau dashboard) munculin alert/toast/sheet. Phase badge BOOTSTRAP/STEADY udah ada di dashboard tapi pasif — ini butuh notif aktif sekali saat momen pergantian.
- [x] **Admin: "force-end" → "Batalkan sesi" (refund + delete)** (2026-06-06) — bug: tombol admin force-end cuma `status='ended'` tanpa refund, jadi buy-in yang kepotong di `startSession` nyangkut → semua pemain rugi `buy_in` (200) padahal owner cuma mau abort sesi buat nambah pemain. Fix: `forceEndSession` → `cancelSession` (`lib/actions/session.ts`) — refund tiap pemain `SUM(balance_before − balance_after)` dari edit_log sesi (robust: free dealer net 0, rebuy_undo cancel sendiri), clear `last_dealer_session_id` yang nunjuk sesi itu, lalu **hapus total** sesi+participant+log-nya (owner pilih "vanish" biar ga ngotorin stats akhir musim & slot sesi bebas). Sisain audit `admin_session_cancel` per pemain (session_id NULL, metadata `{cancelled_session_id, refund}`). UI `ForceEndSection` → label "Batalkan sesi"/"Yakin batalkan" + hint refund; admin log `ACTION_COLORS`/`ACTION_TYPES` + `admin_session_cancel`; `admin.spec.ts` diupdate. Build green. **Belum jalanin full e2e** (DB shared/live; jalanin `pnpm test` kalau mau verifikasi penuh).

---

## ✅ DONE (Fase D, prod 2026-06-08) — Fitur LOAN antar pemain (desain historis di bawah)

Pemain dengan saldo kurang bisa minjem chip dari pemain lain biar tetep bisa main.
Owner-directed design session; semua keputusan di bawah udah disepakati owner.

### Konsep inti
- **Loan = hutang**, bukan transfer/hadiah. Punya lifecycle: `request → approve → active → repay/auto-settle`.
- **Transfer ga ngubah total pool** → transisi phase / `max_pool` aman.
- **Gate:** tombol "Minta pinjaman" cuma muncul kalau **saldo borrower < buy_in**.

### Keputusan desain (FINAL, owner-approved)
1. **Auto-settle di akhir musim** — sebelum snapshot leaderboard di `endSeason` (DAN `adminForceEndSeason`), sistem otomatis tarik balik hutang dari saldo borrower → lender. Leaderboard jujur, ga perlu repay manual sebagai syarat.
   - **Borrower bangkrut pas settle:** balance ga boleh minus. Settle `min(saldo, hutang)` — lender nerima yang ada, **sisanya diputihin + dicatat** (`loan_writeoff`). Lender "rugi" sisanya (konsekuensi minjemin ke yang sekarat).
2. **Penempatan UI = Opsi B (konteks si broke).** Banner "Saldo kamu kurang — Minta pinjaman" di dashboard/sesi, muncul cuma kalau `balance < buy_in`. Klik → pilih lender. (BUKAN klik kartu lender — fitur ini milik si broke.)
3. **GA BOLEH loan pas sesi aktif** — loan cuma di luar sesi (biar stack live ga keganggu).
4. **Loan berantai/circular DICEGAH by design:** borrower yang masih punya hutang **ga boleh jadi lender**, dan tiap pemain **cuma 1 loan aktif/waktu**. → ga ada A→B→C / A→B→A; tiap loan independen pas settle (ga ada urutan settle yang ribet).
5. **Repay = borrower yang aksi, lender auto-nerima** (ambil duit balik ga butuh izin). **Full-only** (ga nyicil).
   - **Alert "udah bisa repay"** muncul kalau **`saldo >= hutang + buy_in`** (bisa balikin TANPA bikin diri broke lagi), bukan cuma `saldo >= hutang`.
6. **Nominal pinjaman:** minimal 1 buy_in, di-cap sama saldo lender. Borrower pilih dalam range itu.
7. **Tanpa bunga** — loan flat (game temen).
8. **Flow approval (consent):** lender harus *setuju* dulu (request → pending → accept/decline). Disbursement chip lender→borrower terjadi **saat approve**, status jadi `active`.

### Integritas data (silent killer — JANGAN lupa)
- **Loan WAJIB pake action type edit_log sendiri** (`loan_out`/`loan_in`/`loan_repay`/`loan_settle`/`loan_writeoff`) dan **di-EXCLUDE dari formula stats** `total_won`/`total_lost` di `season_results` (yang dihitung dari `SUM` edit_log). Kalau ga, transfer chip keitung kayak menang/kalah sesi → leaderboard & achievement ngaco diam-diam.

### Catatan implementasi (dari cek ulang)
- **A. Notif loan ≠ `/api/poll`** — `/api/poll` di-cache edge (`s-maxage=1`) karena payload global. Notif loan itu **per-user** → bikin endpoint terpisah **`/api/loans` (no-cache, per-user)** yang di-poll bareng. Jangan campur ke poll global (nanti notif bocor antar user).
- **B. Filter kandidat lender** — pas borrower pilih target, cuma tampilin pemain `balance >= buy_in`; ga bisa minta ke diri sendiri.
- **C. Concurrency** — approval lender pake `SELECT ... FOR UPDATE` di saldo lender (2 borrower ga bisa klaim saldo lender sama bareng).
- **Tampilan indikator** di dashboard & player detail kedua pihak: borrower "🔴 ngutang ke X: 100", lender "🟢 minjemin Y: 100".
- **Re-borrow boleh** setelah loan beres (tetap 1 aktif/waktu).
- Butuh: tabel `loans` baru (id, season_id, lender_id, borrower_id, amount, status, created_at, settled_at) + migration + tambah action types ke filter admin log + 2 notif (lender: ada permintaan; borrower: udah bisa repay).

---

## ✅ SHIPPED TO PROD 2026-06-09 (follow-up) — UI tweak dot "Baru" + tooling

> **LIVE** (merge `11e7c27`, no migration, UI/docs only). (1) Dot notif changelog di header (`HeaderMenu.tsx`) sekarang **solid fill ijo terang (`#2fb074`) + outline mint (`#9fe8c4`) + offset gelap** — dulu felt-green polos kebaca rongga; owner pilih versi B (banding A vs B via chrome-devtools SS). (2) **Default tooling: screenshot/verifikasi visual → chrome-devtools MCP** (bukan Playwright spec dadakan) — dicatat di CLAUDE.md + memory `feedback_screenshots` + allowlist `mcp__chrome-devtools__*` di settings.local. Catatan: dot baru cuma keliatan kalau `changelog_seen != LATEST_VERSION`, jadi owner (udah seen 0.9.0) ga liat di prod sampe ada versi baru.

## ✅ SHIPPED TO PROD 2026-06-09 (changelog 0.9.0) — LATE JOIN + /identity member-first (item 11a)

> **LIVE di `pokeraja.vercel.app`.** Merge `dev→main` (merge commit `8086b65`, lokal `--no-ff` krn `gh` ga ada di env → push langsung ke main → auto-deploy). **ZERO migration** (late join + 11a dua-duanya pake tabel existing) → ga perlu `pnpm db:migrate` PROD. Changelog di-bump ke **0.9.0** (`71ceef9`, owner-worded). Post-deploy smoke 7/7 struktur hijau; 1 "fail" = `/admin correct key` cuma krn `.env.local` ADMIN_KEY = dev key ≠ prod key (admin gating OK, wrong-key→404 pass) — UNRELATED (diff `33d301a..main` ga nyentuh admin/auth/middleware). Verifikasi versi remote ga bisa via smoke (/changelog auth-gated) — owner konfirm dgn buka app (dot "Baru").

## ✅ DONE 2026-06-09 (branch `dev`) — Fitur LATE JOIN (desain di bawah)

> **SELESAI & TERVERIFIKASI.** Server action `joinSession` ([lib/actions/session.ts](lib/actions/session.ts)) — **no migration** (model existing support): lock sesi aktif `FOR UPDATE` (serialize sama rebuy/undo/end), tolak kalau udah peserta (+ backstop unique `(session_id, player_id)` → 23505), lock saldo joiner `FOR UPDATE`, guard membership `season_players` (server action self-authorize), tolak kalau `balance < buy_in` (low-balance cuma boleh masuk sebagai dealer pas start), potong 1× buy_in, INSERT participant (is_dealer=false, dealer_plays=true), log `action='buy_in'` + metadata `{late_join:true}` (action `buy_in` = ke-INCLUDE di stats & ke-refund di cancelSession, persis kayak buy-in normal). Rekonsiliasi end-wizard kebawa otomatis (delta dari edit_log pertama joiner = buy-in ini). UI: tombol "+ Tambah pemain" + sheet pilih kandidat (anggota musim aktif yg belum duduk & `balance >= buy_in`, dari poll member-scoped) di [SessionView.tsx](components/SessionView.tsx). E2E `tests/late-join.spec.ts` (join → participant + saldo −buy_in; low-balance member bukan kandidat) **2/2 pass**; session+identity regression **24/24 pass**. ⚠ Edge diterima (per desain): kalau ada yg lagi di recap end-wizard pas late-join kejadian, submit endSession-nya gagal "stack harus lengkap" (guard integritas) → reload /session/end ambil peserta baru. **Belum bump changelog.**

> ⚠ BEDA dari Fase E "gabung musim" (`joinActiveSeason`, udah ada): LATE JOIN = gabung ke **SESI yang lagi jalan** (masuk `session_participants`, bayar buy-in tengah sesi).


Pemain bisa gabung sesi yang **udah jalan** (orang telat dateng). Owner-approved.

### Keputusan
- **Late join YES, early cashout NO** — owner ga mau ada yang kabur tengah jalan (4-5 pemain, bubar suasananya). Nolak cashout juga bikin app tetep simpel (lihat alasan teknis di bawah).
- **Aksi "+ Tambah pemain" di `/session`** (sesi aktif, sebelum masuk tahap end) → bottom sheet pilih pemain yang belum ikut.
- Late joiner **bayar buy-in** (saldo kepotong `buy_in`) + dipajang `buy_in` chip di meja, masuk `session_participants`. Pakai `SELECT ... FOR UPDATE` (race-safe, konsisten sama rebuy). Ini cuma konversi bankroll → chip meja, sama kayak pemain normal pas start.
- **Slot dealer dikunci** (dealer ditentukan pas start) → late joiner selalu pemain biasa.
- **Reconciliation kebawa OTOMATIS** — recap ngitung delta dari `balance_before` entry pertama tiap peserta; entry pertama late joiner = buy-in pas join, jadi hasil (chip akhir − setoran) kehitung bener tanpa kode khusus. Total chip akhir juga nambah otomatis dari edit_log-nya. Model existing udah support natural.

### Edge case
- **Late joiner saldo < buy_in → ditolak** (aturan existing: non-dealer low-balance ga boleh). 🔗 **Tie-in LOAN:** yang telat & broke bisa minta pinjam dulu baru join.
- Ga bisa join kalau udah jadi peserta / sesi udah masuk tahap end.
- Phase transition cuma dicek pas start sesi → late join ga re-trigger (minor, biarin).

### Kenapa early cashout DITOLAK (alasan teknis, biar ga lupa)
App ga track stack live (cuma nyatet chip yang *masuk*: buy-in + rebuy). Cash-out tengah jalan butuh: (1) stop main + hitung chip orang itu manual saat itu juga, (2) rumus chip-conservation di end-wizard harus dikurangi stack yang udah keluar, (3) hasil dia di-finalize lebih awal + wizard harus skip dia tapi tetep ngitung chipnya. Ribet + ngerusak suasana → ditolak.

---

## 💡 Backlog — Season wizard & phase UX (2026-06-06, di-expand 2026-06-07)

7 item. Status: #1 DONE · #2 DONE · #3 belum · **#4–#7 DECIDED, siap implement** (lihat "Catatan implementasi" di bawah seksi ini).

1. ✅ **[DONE 2026-06-07] Rekomendasi setting season ga responsif ke starting balance** — bug: `PRESETS` di `components/SeasonSetup.tsx` punya `maxPool` absolut hardcode (1500/2500/3500/5000), jadi starting balance 200 vs 400 ngasih max pool SAMA. (BB/SB & buy_in udah responsif sejak awal; rakeRate=% & maxSessions=durasi sengaja ga di-scale.) Fix: preset sekarang nyimpen `poolBuyIns` (15/25/35/50) dan `maxPool = buyIn × poolBuyIns` — backward-compatible krn di buy_in=100 (starting 200) nilainya balik ke angka lama persis; di starting 400 (buy_in 200) Standard → 7000. Kartu preset di step 3 + confirm nampilin nilai ke-scale. E2E baru di `z-m2-coverage.spec.ts` ("Standard preset stores max_pool = 35 × buy_in") — pass (teardown restore season asli). tsc clean.

2. ✅ **[DONE 2026-06-06, branch `feat/phase-progress`] Progress menuju phase berikut di dashboard** — progress bar felt-green di bawah baris "Season N · PHASE" (`DashboardClient.tsx`). P1: `≈ ceil((max_pool − pool)/buy_in)` sesi ke Phase 2 (pool = SUM balance dari players yang di-poll, label pakai `≈`); P2: `max_sessions − sesi_ended` sesi ke akhir musim (count sesi ended ditambah di `app/(main)/page.tsx` → prop `sessionsPlayed`). Verified live di Chrome (Season 15 bootstrap: "≈ 11 sesi lagi ke Phase 2", 56%). tsc clean. **Detail asli ide di bawah:**
   - owner mau liat "sisa berapa sesi lagi" ke phase berikut, di KEDUA phase. Dua transisi pakai metrik beda secara internal, tapi dua-duanya bisa dinyatakan dalam sesi:
   - **Phase 2 → end game:** langsung sesi-based — `COUNT(sesi ended) >= max_sessions` (`session.ts:343`). Sisa = `max_sessions − sesi_ended`. Akurat.
   - **Phase 1 → 2 (bootstrap→steady):** internalnya pool-based — `SUM(balance) >= max_pool` (`session.ts:428`). **TAPI bisa di-ESTIMATE jadi sesi** (owner-approved approach): tiap sesi nyuntik chip baru tetap dari **gaji dealer Phase 1** (free dealer dapet `+buy_in` chip cetak baru yang masuk sistem). Jadi pool naik ~`buy_in` per sesi → **estimasi sisa sesi ke P2 = `ceil((max_pool − SUM(balance)) / buy_in)`**. Caveat: injeksi cuma kejadian kalau sesi itu ada free dealer (P1, non-cooldown); sesi tanpa free dealer (cooldown/broke deals-only) ga nambah pool → estimasi bisa undershoot. Owner oke ini cuma estimasi ("estimate aja").
   - Tempat tampil: dashboard (deket badge phase) + mungkin halaman season. Label P1 boleh "≈ sisa N sesi ke Phase 2" (kasih tanda ≈ biar jelas estimasi).

3. **[✅ DONE Fase C — prod 2026-06-08] Carry-over pemain + keanggotaan season.** Berkembang dari "checklist" jadi 2 lapis setelah owner report bug.
   - **Bug yang dialamin owner:** abis pencet **"Reset season"** (`debugResetSeason` — debug WIPE: hapus semua season + `season_results`, keep pemain+balance), bikin season baru → wizard minta ketik nama ulang (carry-over kosong) TAPI dashboard tetep nampilin pemain lama. Root cause = (a) carry-over pre-fill baca dari `season_results` musim-terakhir-ended → kehapus pas reset; (b) dashboard query GLOBAL (`SELECT … FROM players`, [app/(main)/page.tsx:8](app/(main)/page.tsx)) — ga ada konsep keanggotaan season, jadi semua pemain selalu nongol. CATATAN: tombol "Force end season" (`adminForceEndSeason`→`endSeason`) yg PROPER nulis `season_results`; owner salah pencet "Reset season". Pertimbangkan pertegas beda 2 tombol ini di admin.
   - **LAPIS A — Wizard `/season/new` jadi checklist.** Tampilin **semua pemain dari tabel `players`** (tahan banting, bukan dari `season_results`) sebagai checklist + "tambah pemain baru" di bawah. **DECIDED: default UNCHECK semua** (opt-in eksplisit, owner 2026-06-07). Ubah `components/SeasonSetup.tsx` step 1 + query di `app/season/new/page.tsx` (ganti sumber dari season_results → players).
   - **LAPIS B — Keanggotaan season** biar dashboard cuma nampilin anggota musim aktif. **DECIDED: Opsi 1 — tabel `season_players` (owner 2026-06-07).**
     - **Opsi 1 (DIPILIH):** tabel `season_players(season_id, player_id)` (PK gabungan). `createSeason` INSERT baris buat tiap pemain ke-check di wizard. JOIN ber-index di hot path (poll tiap 2dtk), tambah/keluarin anggota tengah-musim gampang (INSERT/DELETE), `edit_log` tetep audit murni. Butuh **migration kecil** (`db/migrations/00X_season_players.sql`).
     - (Opsi 2 derive-dari-log DITOLAK: query JSONB di hot path lambat + ga bisa keluarin anggota krn log append-only.)
     - ⚠ Lapis B nyentuh semua yg baca `players` global: dashboard ([app/(main)/page.tsx:8](app/(main)/page.tsx)), `/api/poll`, mungkin `/session/setup` + leaderboard → filter ke anggota musim aktif via JOIN `season_players`. Bukan perubahan kecil.

4. **[✅ DONE Fase A — prod 2026-06-08] Starting balance = 5× buy-in ("5 nyawa") + balik arah input wizard.** Owner SETUJU semua:
   - **Nyawa = 5× (default), configurable 3/4/5.** `starting_balance = buy_in × nyawa`.
   - **Balik arah input wizard:** user isi **buy_in + jumlah nyawa** (BUKAN starting balance lagi). starting_balance jadi turunan.
   - ✅ **BB/SB rebase ke `buy_in`** (bukan `starting_balance`). Rencana `bb = buy_in/10`, `sb = bb/2` (mis. buy_in 100 → BB 10 / SB 5, stack meja = 10 BB). Konfirmasi formula final pas implement.

5. **[✅ DONE Fase A — prod 2026-06-08] Phase split = tetap pool-based (Opsi A), preferensi user di wizard, dashboard P1 ganti jadi bar pool.** Keputusan owner:
   - **TETAP pakai `max_pool` / pool-based buat bedain phase** (owner: "gaseru kalo dibaginya per sesi"). Opsi B (session-based) DITOLAK.
   - **Opsi A:** `max_pool = modal_awal_total + (target_P1_sesi × gaji_dealer)` di mana `modal_awal_total = n × buy_in × nyawa` dan `gaji_dealer = laju suntikan chip/sesi free-dealer` (lihat item 6: jadi **2× buy_in**). Preferensi tempo dipilih user (lihat desain wizard di bawah). Tetap estimasi (cooldown/no-free-dealer ga nyuntik → P1 bisa molor) — diterima. **Default tempo = 🔥 Langsung serius** (owner 2026-06-07). **Mid-season join (item 9):** Phase 1 → `max_pool += starting_balance` joiner (phase-neutral); Phase 2 → max_pool moot, joiner balance 0.
   - **Dashboard Phase 1: ganti dari "≈ N sesi lagi" jadi BAR pool langsung** — tampil `SUM(balance) / max_pool` (mis. "1000 / 2500"), no "≈". Lebih jujur & ga kena masalah undershoot. **Phase 2 tetap sesi-based** (`sesi_ended / max_sessions`, eksakta). Ubah di `DashboardClient.tsx`. ⚠ Catatan: selama sesi AKTIF, SUM(balance) turun sementara (buy-in kepotong, chip meja ga keitung di balance) → bar bisa keliatan dip lalu balik pas sesi end. Ini perilaku existing (estimasi lama juga gitu); pertimbangkan freeze/label "sesi berjalan" pas ada sesi aktif.
   - ⚠ **Interaksi nyawa↔split:** nyawa 5 udah bikin modal_awal gede → P1 pendek. max_pool diturunin dari `target_P1` (ada lantai minimum), jadi aman dari P1 negatif.
   - **Poin 4 (preferensi tempo di wizard): owner minta DESAIN dulu sebelum implement** — lihat draft di "Desain wizard baru" bawah.
   - **Konteks pace nyata (CSV prod sesi.csv, Season 1):** 16 sesi/5 hari, ~30 mnt/sesi, ~3 sesi/hari (puncak 7). 40 sesi ≈ ~1.5 minggu. Owner mau Standard ≈ **1–2 minggu**.

### Desain wizard baru (draft 2026-06-07 — buat review owner, belum implement)

Flow 4 step (sama jumlahnya, isi step 2 & 3 berubah):

- **Step 1 — Pemain** (tetap; carry-over selectable = item 3 nyusul).
- **Step 2 — Buy-in & nyawa** (dulu "Modal & blind"):
  - Input: **Buy-in** (angka, mis. 100).
  - Input: **Nyawa** (segmented 3 / 4 / 5, default 5).
  - Kartu turunan: Modal awal/pemain = `buy_in × nyawa` (mis. 500) · BB = `buy_in/10` (10) · SB = `bb/2` (5) · "Stack meja = 1 buy-in = 10 BB".
  - Hint: "Tiap pemain mulai {nyawa} nyawa (bisa rebuy {nyawa−1}× sebelum habis)."
- **Step 3 — Durasi & tempo** (dulu "Durasi season"):
  - **Durasi** (preset jumlah sesi + rake) — owner mau Standard turun (40 kelamaan). **FINAL ladder: Sprint 10 / Quick 15 / Standard 24 / Marathon 36 / Custom** (owner 2026-06-07; lama 15/25/40/60). Sprint/Quick blm diutak-atik owner. (max_pool TIDAK lagi di preset — diturunin.) **Label durasi: PAKAI "~X hari"** (owner). Synergy: musim pendek + reset sering → achievement/stats lintas-musim lebih sering kepake.
  - **Tempo ekonomi** (= preferensi split phase, fitur poin 4): 3 pilihan →
    - 🔥 **Langsung serius** — Phase 1 ≈ 25% (Phase 2 dominan).
    - ⚖️ **Seimbang** — Phase 1 ≈ 40%.
    - 🐢 **Pemanasan panjang** — Phase 1 ≈ 60%.
  - Tampil turunan live: "Bootstrap ≈ X sesi · Steady ≈ Y sesi · Max pool {hitung}". **Contoh FINAL** buy_in 100, nyawa 5, n=5 (modal_awal 2500), Standard 24 sesi, gaji_dealer 2×=200: Langsung serius (25%→P1 6) → P1~6/P2~18, max_pool `2500+6×200=3700`; Seimbang (40%→P1 10) → P1~10/P2~14, max_pool 4500; Pemanasan (60%→P1 14) → P1~14/P2~10, max_pool 5300. (Rumus: `max_pool = modal_awal + target_P1 × 2×buy_in`.)
- **Step 4 — Konfirmasi** (tambah baris Nyawa, Tempo, Bootstrap/Steady estimasi).
  - Default tempo: **🔥 Langsung serius** (owner 2026-06-07).

6. **[✅ DONE Fase A — prod 2026-06-08] Gaji dealer Phase 1 naik 1× → 2× buy-in (di-SPLIT meja+saldo, lihat detail bawah).** Karena nyawa jadi 5, gaji free-dealer digedein biar dealer yang abis duitnya bisa main lagi. Kode: [session.ts:481](lib/actions/session.ts) deduction tetap 0 (dealer main GRATIS, stack meja 1× lewat `dealer_salary_chips` [session.ts:522](lib/actions/session.ts) tetap `chips: buyIn`), TAMBAH `balance += buyIn` (nyawa cadangan ke saldo). Total = 2× buy_in tapi kepisah meja+saldo (BUKAN 2× numpuk di meja).
   - **Efek domino ke phase:** laju suntikan chip/sesi free-dealer jadi 2× → pool nyampe max_pool 2× lebih cepat. Opsi A (item 5) udah pakai `gaji_dealer` sebagai laju suntikan, jadi max_pool otomatis nyesuain (`max_pool = modal_awal + target_P1 × 2×buy_in`); split phase ga berubah.
   - **BUKAN bug "total meja kembung" lama** (yg dulu: dealer bayar buy-in SEKALIGUS dapet gaji = double). Ini dealer gratis (deduction 0) + 2× gaji. Total meja P1 = `(n−1)×buy_in + 2×buy_in = (n+1)×buy_in`, konsisten; rekonsiliasi end-session udah ngitung dari `dealer_salary_chips`.
   - ⚠ **Cooldown jadi lebih krusial** — tiap free-deal worth 2 nyawa gratis → insentif farming naik. Pas implement cek window cooldown (skrg: ga dapet gaji lagi kalau jarak < 2 sesi) masih cukup ga.
   - **FINAL: gaji fix 2× buy_in, TAPI di-SPLIT** (owner 2026-06-07, dikoreksi). 2× buy_in = 2 nyawa, **kepisah**: **1× buy_in masuk MEJA** (free entry, stack main normal — biar stack dealer SAMA RATA dgn pemain lain, ga jadi 2× lipat) + **1× buy_in masuk SALDO** (nyawa cadangan/rebuy). CONTOH: dealer saldo 0 → pas start jadi **saldo 100 + stack meja 100** (total 200). Bukan numpuk 200 di meja.
   - **Mekanik implement:** free dealer P1 → `deduction = 0` (stack meja 1× gratis, lewat `dealer_salary_chips` metadata `chips: buyIn`) **PLUS `balance += buyIn`** (1× cadangan, ini balance change yg dilog). End sesi: stack meja sisa → balance + 100 cadangan yg udah di saldo. ⚠ Ini BUKAN bug "kredit balance langsung" lama (yg dilarang: bayar buy-in SEKALIGUS dapet gaji = double). Di sini ga bayar apa-apa, cuma granted 1 nyawa meja + 1 nyawa saldo.
   - ⚠ Beda dari kode existing: sekarang free dealer cuma dapet 1× di meja & balance ga berubah. Perubahan = tambah `balance += buyIn` di loop dealer ([session.ts:474-495](lib/actions/session.ts)), `dealer_salary_chips` tetap 1× buy_in (BUKAN 2× — separuh gaji udah masuk saldo). Total injeksi pool tetap 2× buy_in/sesi (100 ke saldo langsung + 100 ke meja yg konversi pas end).
   - ⚠ **Pas implement: update "Key design decisions" #3 di bawah** (yg masih nulis "1× buy_in printed chips" & "table total = n × buy_in") biar ga jadi catatan basi/kontradiksi. Jadi 2× & `(n+1)×buy_in`.

7. **[✅ DONE Fase B — prod 2026-06-08] Opsi dealer "main" vs "ambil gaji doang" (dealer netral) di session/setup.** Masalah: dealer selalu ikut main → ga netral, kalau dealer menang berasa ga enak (bandar lawan pemain). Ide owner: kalau pemain yg dipilih **> 3 (=4+)**, dealer yg kepilih dapet pilihan: **(a) ikut main** (existing) atau **(b) cuma jadi dealer, ga main**. Per-sesi (diputus pas setup), bukan per-musim. Logika 4+ pas: kalau dealer ga main butuh ≥3 yg main.
   - **FINAL gaji dealer-netral = flat 1× buy_in** (owner pilih opsi 1 "flat kecil"). Dealer main dapet stack 2× beresiko; dealer netral dapet 1× (lebih kecil). Adil & gampang dijelasin. Hindari kredit langsung ke balance tanpa resiko (mesin cetak duit) — lihat model chips-on-table di bawah.
   - **FINAL: wizard end-session dealer-netral TETEP ADA** (koreksi owner) — karena **dealer netral bisa dapet TIP** dari pemain selama main. Jadi JANGAN di-skip di `/session/end`.
   - **Model yg konsisten (saran implement):** gaji flat 1× = **chip di MEJA** (bukan kredit balance langsung), persis pola dealer main tapi 1× bukan 2×. Dealer netral ga main tangan, tapi stack-nya bisa nambah dari tip. Pas end-session dia lapor stack akhir (= gaji 1× + tip) → konversi ke balance. Ini otomatis ngehindarin bug "kredit balance langsung".
   - **Catatan teknis:** (a) **suntikan pool** jadi variabel per-sesi: dealer main inject 2×buy_in, dealer netral inject 1×buy_in. Bikin estimasi P1 makin fuzzy — TAPI ga masalah krn dashboard P1 udah pindah ke BAR pool aktual (item 5), bukan estimasi sesi. (b) **Schema: butuh MIGRATION** — tambah flag mis. `session_participants.dealer_plays` (atau `dealer_neutral`). Udah ada `is_dealer`/`no_gaji_dealer` tapi belum cukup. (c) Tip antar pemain = transfer chip (zero-sum), bukan suntikan baru.

8. **[✅ DONE Fase B — prod 2026-06-08] Rake Phase 2: dealer IKUT MAIN → NO rake; dealer NETRAL → ngambil rake.** Masalah yg diangkat owner: rake ke dealer-yg-ikut-main = edge struktural (profit dari rake lepas dari menang/kalah) + numpuk ke yg sering jadi dealer (data CSV: MEK'S 44% sesi). Rake juga berat relatif ke stack pendek (buy-in 100 = 10 BB; rake floor~5-10/cap 20 = 0.5-1 BB/hand; ~15 hand = 5-15 BB kehisap; total se-sesi ~setara gaji P1). Owner pilih solusi **bersih**: bukan tuning cap, tapi **dealer yg tanding ga narik upah sama sekali**.
   - **P2 dealer main** → bayar buy-in normal, main biasa, **rake = 0** (pemain biasa aja, zero-sum sejati).
   - **P2 dealer netral** → ga main, **ngambil rake** (= upah house, model casino yg fair krn bukan kompetitor) + tip.
   - **Upah dealer-netral BEDA per-phase, bukan ditambah:** P1 netral = flat 1× buy_in (rake belum ada di bootstrap); P2 netral = rake (BUKAN flat 1× lagi). Jangan double.
   - **Properti ekonomi:** P1 = inflasi (suntik chip), P2 = stabil (dealer main → zero-sum murni; dealer netral → rake cuma mindahin chip, ga nyetak). Beda phase makin tegas.
   - **Rake butuh 4+ pemain** (biar dealer bisa duduk netral). 2-3 pemain → dealer kepaksa main → otomatis no rake.
   - **Rake tetap Approach C** (informational/manual, dealer ngambil chip di meja, dibantu kalkulator rake — app ga enforce). Aturan rake owner: 10%, floor (10 atau 5, ngikut chip terkecil), cap 20.
   - **Teknis:** dealer netral P2 mulai 0 chip di meja, stack tumbuh dari rake+tip; end-wizard harus bolehin start 0. **FINAL rake % per preset (owner 2026-06-07): Sprint 15 / Quick 10 / Standard 10 / Marathon 8.**

### Matriks dealer FINAL (4 kasus) — acuan implement

| Phase | Mode | Bayar buy-in | Main | Dapet |
|---|---|---|---|---|
| **P1** bootstrap | Main | ❌ gratis | ✅ | **1× buy_in di MEJA** (stack normal) + **1× buy_in ke SALDO** (cadangan) = 2× total |
| **P1** | Netral | ❌ | ❌ | flat **1× buy_in** (chip meja) + tip |
| **P2** steady | Main | ✅ | ✅ | **NO rake** (pemain biasa) |
| **P2** | Netral | ❌ | ❌ | **rake** + tip |

### Catatan implementasi (hasil review 2026-06-07)

Urutan & dependensi pas implement item 4–7:

- **Migration:** item 4–6 **TIDAK butuh** kolom DB baru — `starting_balance`/`buy_in`/`max_pool`/`bb`/`sb`/`rake_rate`/`preset_name` semua udah ada; nyawa derivable (`starting_balance/buy_in`), tempo cukup "dibakar" ke `max_pool` pas create (ga perlu dipersist). **Item 7 BUTUH migration** (flag `dealer_plays`).
- **E2E bakal break & WAJIB di-update:** rombak wizard (item 4–5) ngubah placeholder & isi step 2/3 → 2 test di `z-m2-coverage.spec.ts` rusak: (1) "creates custom season…" (isi `cth. 200`, custom 4444) & (2) "Standard preset stores max_pool = 35 × buy_in" (yg gua bikin tadi — asumsi input starting-balance & 35×). Dua-duanya harus ditulis ulang ngikut input baru (buy-in + nyawa) & formula max_pool baru.
- **Rake per preset (FINAL 2026-06-07):** Sprint 15% / Quick 10% / Standard 10% / Marathon 8% (sama kayak lama, ladder sesi-nya aja yg turun).
- **Item 2 (DONE) ke-superseded sebagian:** bagian P1 dashboard ("≈ N sesi") bakal diganti BAR pool (item 5). Bagian P2 (sesi-based) tetep. Jadi item 5 = revisi `DashboardClient.tsx` yg item 2 bikin, bukan dari nol.
- **Saran urutan checkpoint:** (1) wizard input baru + BB/SB rebase + nyawa (item 4), (2) preset ladder + tempo picker + max_pool derived (item 5 bagian wizard) + label durasi, (3) gaji dealer 2× (item 6) + update "Key design decisions #3", (4) dashboard bar pool P1 (item 5 bagian dashboard), (5) update E2E, (6) item 7 (dealer netral, butuh migration) — paling akhir krn paling berdiri sendiri.

---

9. **[✅ DONE Fase E — prod 2026-06-08] Self-register pemain (auth code) + guest mode.** (Telegram bot notif sengaja di-skip; sisanya jalan.) Gap: pemain baru ga bisa gabung tanpa admin nambahin (`addPlayer`) / diketik di wizard. Owner mau ada **register** + **guest mode**.
   - **Framing (insight Claude):** ini tracker duit grup temen, BUKAN signup SaaS publik. Register terbuka-bebas bahaya (pemain sampah, impersonasi, randos ngacak). Harus ada gerbang tapi ga seketat app publik.
   - **Insight inti — pisahin "identitas" dari "keanggotaan":** berkat item 3 (`season_players`), identitas (baris `players` + nama + PIN) ≠ keanggotaan (di `season_players` musim aktif = yg muncul di dashboard). Jadi: **biarin orang self-register bikin identitas, TAPI belum jadi anggota sampe di-add lewat checklist.** Gerbangnya di KEANGGOTAAN, bukan registrasi. Bonus: pemain sampah ga ngotorin dashboard krn udah di-scope ke anggota (item 3). Sinergi.
   - **Rekomendasi register:** form nama (unik, case-insensitive — udah ada cek) + **PIN sendiri** (lebih aman dari default 1234 flow admin sekarang). Entry dari `/identity` → "+ Daftar pemain baru". Admin-add tetep ada opsional. ⚠ WAJIB rate-limit/throttle (security review: server action self-authorize, ID publik). Opsional: **kode join grup** biar cuma yg diundang bisa daftar (cocok vibe underground).
   - **Rekomendasi guest:** **read-only spectator** (liat dashboard/leaderboard tanpa identitas/PIN/balance) + CTA upgrade ke register. **HINDARI guest-yang-pegang-duit** (tracking + cleanup ribet); kalau mau "main semalam" → mending tetep register (cepet), next season ga di-add.
   - **[DECIDED round-2 2026-06-07] Gerbang = AUTH CODE (invite code per-season, rotating).** Alur: `/identity` → "daftar pemain baru" → isi nama+PIN sendiri → masukin **auth code** → akun "verified" + **auto-join season aktif** (masuk `season_players` langsung).
     - **Kode valid 2 pakai lalu rotate** (owner: "2 orang pas"). **Per-season.**
     - **Sumber kebenaran kode = admin panel** (v1). **Telegram bot = lapisan notif OPSIONAL** (app `fetch` ke Telegram API kirim kode baru pas rotate; ga load-bearing — bot mati, admin tetep jalan). JANGAN gantung fitur ke Telegram.
     - ⚠ **WAJIB: kode 6–8 char alfanumerik + throttle attempt** (kode statis di antara pemakaian → rawan brute-force). Rotasi **atomik** (transaction + `FOR UPDATE` di baris kode) biar ga dobel-pakai.
     - **"Verified" = jadi anggota season aktif yg bisa main** (efek alami lolos gerbang, bukan badge terpisah).
     - **Register cuma pas season AKTIF.** **Pemain lama ga butuh kode** (masuk lewat checklist pas bikin season, item 3 lapis A). Kode khusus akun BARU pas season jalan.
   - **[DECIDED round-2] Guest = read-only spectator** (liat dashboard/leaderboard tanpa identitas, + CTA daftar). Bukan guest-pegang-duit.
   - **[DECIDED round-2] Join MID-SEASON → penyesuaian (lihat juga item 5):**
     - **Phase 1 join:** dapet **full starting_balance** (mis. 500 = 5 nyawa). **`max_pool += starting_balance` joiner** (BUKAN max_pool/n). Alasan: sesi-ke-Phase-2 = selisih `max_pool − pool`; naikin dua-duanya sama → selisih tetap → timeline Phase 2 semua orang GA GESER. (Owner sempet usul max_pool/n ≈875→900 → itu molorin bootstrap; cuma kalau emang mau "makin rame makin lama".)
     - **Phase 2 join:** `max_pool` GA diutak-atik (moot di steady). Joiner mulai **balance 0** (jaga zero-sum, ga inflasi). **2 jalur pulih (dua-duanya jaga pool):** (a) **LOAN** dari pemain lain (lihat backlog Fitur LOAN — gate-nya `balance < buy_in`, transfer ga ngubah pool; backlog baris 243 udah antisipasi late-joiner pinjam), atau (b) jadi **dealer netral** → earn **rake**. ⚠ Dealer-netral butuh 4+ pemain (item 7); meja <4 & loan belum ada → joiner mentok "nunggu". **Loan juga BELUM dibangun → koordinasi urutan rilis** (kalau loan belum jadi, fallback cuma rake-dealer-netral).
   - Nyentuh: `/identity`, auth (`lib/auth*`), throttle, `season_players` (auto-join), `seasons.max_pool` (adjust P1 join), opsional Telegram env (bot token+chat id).
   - **🔍 Recheck 2026-06-07 (round-2) — gap/risiko yg ketemu:**
     - **[DECIDED round-3, Claude diputusin per owner "ikut saran"] Pemain LAMA non-member join TENGAH musim = via PIN, TANPA kode.** Prinsip: auth code ngegerbang aksi BELUM-terverifikasi (bikin identitas baru); pemain lama udah punya kredensial (PIN) + udah ke-vetting. Flow: `/identity` → tap nama → login PIN → muncul "Kamu belum ikut musim ini → Gabung" → auto-join `season_players` (balance phase-aware: P1 full+bump, P2 0). Pemain BARU tetep butuh kode. (UI: jalur "lama" = login biasa + tombol Gabung; jalur "baru" = "Daftar pemain baru" + kode.)
     - **Urutan rilis: Phase-2-join nyander LOAN** (yg belum dibangun). Putusin loan duluan vs terima fallback rake-only.
     - **Cluster migration:** `season_players` (3B) + `dealer_plays` (7) + `seasons.invite_code`(+uses, 9) + `loans` (loan backlog) — rencanain barengan.
     - **Register cabang per-phase + atomik:** baca phase → P1 (balance=starting_balance + bump max_pool) / P2 (balance 0); 1 transaction (buat player + season_players + update max_pool kalau P1).
     - **"Verified" = cukup baris `season_players`**, ga perlu kolom flag terpisah.

10. **[✅ DONE Fase F — prod 2026-06-08] User manual / panduan + onboarding device baru.** Owner mau ada panduan buat device yang baru buka. Doable, **no migration/library** (precedent: halaman `/changelog` + indikator "new" via localStorage — pola sama).
   - **2 lapis:** (a) **halaman `/panduan`** (atau `/help`) — konten statis ber-section, tema felt-green, akses kapan aja via ikon **"?"** di `(main)/layout`. (b) **Auto-welcome sekali per-device**: localStorage `panduan_seen` kosong → munculin **sheet sambutan** (pakai `components/Sheet.tsx`) + CTA "Lihat panduan" / "Lewati", lalu set `panduan_seen`.
   - **Deteksi device baru:** localStorage flag (mirror `phase_seen`/changelog). Per-device, bukan per-user.
   - **[DECIDED 2026-06-07] Struktur konten = overview ringkas + section expandable (accordion).** Bagian ATAS halaman = **alur main ringkas** (apa ini → pilih identitas → mulai sesi → main → end → season). Di bawahnya **section-section yang bisa dibuka** (collapsible, default tertutup) buat yang mau dalemin — biar ga jadi wall-of-text. UI accordion pakai React state atau `<details>` (no lib).
     - Section deep (buka sesuai minat): Modal & nyawa · Dealer & gaji (free P1/cooldown/dealer netral) · **Phase 1 (Bootstrap) vs Phase 2 (Steady)** + bar pool · Rake · Season (durasi/reset/leaderboard/achievement) · Admin (opsional).
   - **[DECIDED 2026-06-07] Auto-welcome:** link kecil **"Baru di sini?"** di `/identity` (buat orang paling awal) + **welcome-sheet sekali** pas dashboard pertama (localStorage `panduan_seen`). Owner approve saran ini.
   - **Teknis:** client + JSX statis (no MD renderer). Route `app/(main)/panduan/page.tsx` + ikon "?" di `(main)/layout` + welcome-sheet client component + accordion. **No DB, no migration.**
   - **Sinergi:** pasang bareng register/guest (item 9, Fase E) — orang baru/guest paling butuh; link dari flow register.

11. **[✅ DONE 2026-06-08 — opsi (a), branch `dev`] Rapihkan tampilan `/identity` picker.** Owner pilih (a) member-first sorting. Picker `app/identity/page.tsx` tetep query GLOBAL **by design** (identitas ≠ keanggotaan: pemain lama non-member harus bisa login dulu baru "Gabung musim" — scope ke member = deadlock), TAPI sekarang di-annotate `is_member` via `LEFT JOIN season_players` musim aktif + `ORDER BY is_member DESC, name ASC`. `IdentityPicker` split jadi 2 grup ("Musim ini" / "Lainnya", label cuma muncul kalau dua grup ada isinya); default-select pindah dari alfabet-pertama-global → member-pertama. Type baru `PickerPlayer`. No migration. `tsc --noEmit` clean. Test aman (test player = member via global-setup, tetep ke-render & tappable). (b)/(c) tetep open kalau (a) masih rame.
   - **(a) Member-first sorting** — anggota musim aktif di atas (mungkin sub-judul "Musim ini" vs "Lainnya"), sisanya di bawah. Paling aman, ga ngilangin siapa pun. Butuh JOIN `season_players` buat nentuin urutan, picker tetep nampilin semua.
   - **(b) Sembunyiin akun "mati"** — misal yang belum pernah jadi member musim manapun (`NOT EXISTS di season_players histori`) atau ga ada `auth_sessions` baru. ⚠ hati-hati jangan sembunyiin pemain baru/legit.
   - **(c) Admin "arsipkan pemain"** — flag `players.archived` (butuh migration kecil) + filter dari picker; admin bisa un-arsip. Paling proper buat akun beneran mati, tapi paling banyak kerjaan.
   - **Rekomendasi Claude: mulai dari (a)** — murah, ga ada migration, langsung ngerapihin tanpa risiko ngilangin akun. (b)/(c) kalau (a) masih kerasa rame. **No migration buat (a)/(b); (c) butuh migration.**

### 🛠️ RENCANA KERJA / BUILD ORDER (owner delegasiin ke Claude 2026-06-07 — "urutan rilis sesuaiin aja")

6 fase, checkpoint per item (stop & report tiap selesai, sesuai CLAUDE.md). Migration kepisah per-fase (1 file/fitur, bukan gabungan).

**PROGRESS (2026-06-07):** ✅ **Fase 0** (commit `6ba40d6`+`b0218c2`) · ✅ **A1** (input buy-in+nyawa, BB/SB rebase ke buy_in, createSeason derive starting_balance) · ✅ **A2** (gaji dealer 2× split: `balance += buyIn` + log `dealer_salary_balance`, di-exclude dari stats+rekonsiliasi; admin log ditambah) · ✅ **A3** (Opsi A max_pool derived + tempo picker default serius + ladder 10/15/24/36 + label hari + dashboard P1 bar pool) · ✅ **A4** (E2E di-rewrite: 2 wizard test + recap + free-dealer balance + dashboard pool bar; **full suite 84 pass**, 1 test alert flaky/unrelated). **FASE A SELESAI & COMMITTED** (`6ba40d6`, `9d91fbb`, `def083d`, `94d31f3`; reviewed + `pnpm build` 0 warning + hardening max_pool≥initial pool). · ✅ **FASE B SELESAI:** migration `006_dealer_plays` (applied) + type · startSession neutral-dealer (P1 netral=flat 1× salary tanpa split; P2 netral=deals-only/no_gaji=0 chip→rake; validasi 4+ pemain) · session/setup toggle "ikut main/cuma bagi kartu" (muncul ≥4 pemain) · **rake rule: gate kalkulator rake ke `no_gaji_dealer`** (non-playing dealer doang yg ambil rake; playing dealer = no rake) · E2E rake di-rewrite (dealer broke deals-only + 2 bayar → angka tetap) + test baru "playing dealer no rake". **Full suite 85 pass** (1 flaky alert unrelated). **GAP coverage:** neutral-via-UI-toggle butuh 4+ pemain — fixture cuma 3, jadi path P1-neutral-salary & validasi-4+ belum di-E2E (follow-up: tambah pemain ke-4 ke fixture). **BUGFIX 2026-06-07** (owner nemu pas tes): P1 neutral dealer lupa di-set `no_gaji=true` → ke-display kayak pemain biasa (ada rebuy) = "dianggep ikut main". Fixed: neutral dealer selalu `no_gaji=true` (deals-only display, P1+P2). Amount tetap 1× (sesuai desain). · 🚧 **FASE C — C1 (code-done, PENDING VERIFIKASI):** migration `007_season_players.sql` (tabel `season_players(season_id, player_id, joined_at)` PK gabungan + FK ON DELETE CASCADE + index `idx_season_players_season` + **backfill** semua pemain → member musim aktif). Read roster di-scope ke member musim aktif via JOIN `season_players`: dashboard ([app/(main)/page.tsx](app/(main)/page.tsx)), `/api/poll`, session page, session/setup (alias `s2` hindar collision), season/end leaderboard (scoped ke `seasonId`), `endSeason` ranking (`FOR UPDATE OF p`) + balance-reset (scoped `WHERE id IN season_players`), **pool `SUM(balance)`** di `startSession` (load-bearing transisi phase). TETAP global by design: `/identity` picker (pemain lama login dulu baru gabung — item 9), admin, export. `createSeason` INSERT `season_players` tiap pemain. `debug.ts` resetSeason+nukeAll clear `season_players`. **`tsc --noEmit` clean (exit 0).** ⚠ **BLOCKED di env ini (NO NETWORK)** — belum bisa `pnpm db:migrate` (dev Neon unreachable), `pnpm build` (next/font fetch Google Fonts gagal offline), atau E2E. Owner WAJIB jalanin di mesin ber-network: `pnpm db:migrate` → `pnpm build` → `pnpm test`. ✅ **`global-setup.ts` udah di-fix** (insert 3 test player ke `season_players` musim aktif; teardown aman via FK CASCADE) jadi suite harusnya tetep jalan abis migrate. · ✅ **C2 (code-done, PENDING VERIFIKASI):** wizard step 1 jadi checklist. `app/season/new/page.tsx` sumber pindah dari `season_results` → **`players` global** (tahan reset; fix root-cause bug carry-over item 3) + query `season_results` musim-terakhir cuma buat tag "musim lalu" (BUKAN pre-check). `SeasonSetup.tsx`: prop `existingPlayers`→`allPlayers{id,name,inLastSeason}`; state `playerNames`→`selectedIds:Set` (checklist existing, **default UNCHECK semua**) + `newNames:string[]` (tambah pemain baru, default `[]` kalau ada pemain / `['','']` kalau DB kosong). Roster submit = checked existing + filled new (urutan = creator first). Checkbox `accent-primary`, badge "musim lalu". `tsc --noEmit` clean. **NEXT C3 — E2E (BUTUH NETWORK, blind-risky):** 5 lokasi test break krena step 1 berubah (placeholder lama "Nama kamu/Pemain N" → sekarang checklist + "Pemain baru N"): `z-m2-coverage.spec.ts:586,683`, `z-m2-features.spec.ts:219`, `z-m3-features.spec.ts:241` (test prefill rank-order — premis berubah jadi checklist+tag, rewrite), + cek `admin.spec` AddPlayer (player admin-add ga jadi member → ga muncul di dashboard, mungkin adjust assertion). Rewrite: klik "+ Tambah pemain baru" lalu ketik, ATAU check existing player. · ✅ **C3 (code-done BLIND, PENDING VERIFIKASI run):** helper baru `fillNewSeasonPlayers(page, names)` di `helpers.ts` (klik "+ Tambah pemain baru" N× lalu fill `placeholder /Pemain baru/`). Rewrite 3 test wizard (`z-m2-coverage.spec.ts` ×2 → tambah 2 pemain baru, n=2, max_pool 1600/3800 tetap; `z-m2-features.spec.ts` → 2 SC players). `z-m3-features.spec.ts:241` rewrite: bukan lagi cek prefill rank-order, tapi cek prev-season players muncul di checklist `<label>` (unchecked + badge "musim lalu"). `admin.spec` AMAN (cuma cek select admin global, bukan dashboard) — ga diubah. Test baru `membership.spec.ts`: dashboard hide non-member → muncul abis di-INSERT ke `season_players`. **`tsc --noEmit` clean (tests ke-cover `**/*.ts`).** ⚠ Ditulis BLIND (no network) — owner WAJIB `pnpm db:migrate && pnpm build && pnpm test`; kalau ada selector/flake yang meleset, report ke gue buat fix cepet. **FASE C SELESAI (code) pending verifikasi run.** · ✅ **FASE F SELESAI (code-done, PENDING VERIFIKASI):** panduan/onboarding (item 10), no migration/lib. Route **publik** `app/panduan/page.tsx` (di luar `(main)` biar bisa diakses pre-auth dari /identity) — overview "Cara main singkat" (5 langkah) + 6 section accordion `<details>` (Modal & nyawa · Dealer & gaji · Phase 1 vs 2 + bar pool · Rake · Musim · Admin), felt-green, + `loading.tsx` skeleton. `lib/guide.ts` (`GUIDE_SEEN_KEY='panduan_seen'`). `components/MarkGuideSeen.tsx` (set seen pas buka /panduan). `components/WelcomeGuide.tsx` (sheet sekali per-device, default closed anti-hydration-mismatch, CTA "Lihat panduan"/"Nanti aja", listen event `guide-seen`) — di-mount di `(main)/layout.tsx`. Ikon "?" (HelpCircle, 44px) di `HeaderMenu` → /panduan. Link "Baru di sini? Lihat panduan" di `IdentityPicker`. ⚠ **Test-safety:** `setIdentity` helper sekarang set `panduan_seen='1'` di initScript biar welcome-sheet overlay ga intercept klik test (login-via-UI test berhenti di waitForURL jadi aman; /season/new di luar (main) jadi wizard aman). `tsc --noEmit` clean. **Belum bump `lib/changelog.ts`** (owner yg putusin versi pas rilis — bump LATEST_VERSION nyalain dot "Baru" buat semua). · ✅ **COMMITTED `bc05be0`** (Fase C+F) ke branch `dev`, pushed. · 🧪 **VERIFIKASI RUN owner (migrate+build+test):** build OK, test = **82 passed, 1 failed (z-m3:118), 1 flaky (dashboard:51 pre-existing/unrelated), 3 did not run (run di-stop)**. **Fix `bf3394b`:** root-cause = helper test `createActiveSeason` (z-m3) bikin season via raw SQL tanpa `season_players` → abis C1, `/session/setup` kosong + `endSeason` snapshot 0 baris (test expect 3, termasuk Charlie non-main = harus member). Fix: helper join semua `[T…]` player ke roster (mirror global-setup). Ini juga benerin 3 test "did not run" (278/363/422 pakai helper sama). · ✅ **RE-RUN OWNER: 87/87 PASSED (3.8m), 0 fail.** FASE C + F SELESAI & TERVERIFIKASI PENUH di branch `dev` (commit `bc05be0`+`bf3394b`+`8e91d12`). **BELUM di-merge ke `main`** → prod belum dapet Fase A/B/C/F. **Pas merge nanti: WAJIB `pnpm db:migrate` ke PROD DB dulu** (prod ketinggalan migration 006 dealer_plays + 007 season_players) SEBELUM kode deploy, kalau ga prod 500. **NEXT: Fase D (LOAN, `loans` migration) / E (register auth-code, depend C+D) / merge ke main.**

**PROGRESS (2026-06-08):** `.env.local` dibalikin dari PROD → **dev DB** (`ep-bold-glitter`) — sempet nunjuk prod abis migrate kemarin (gotcha [[deployment-vercel]]); prod DB ada di org Neon Vercel (ga keliatan di console Neon personal owner). PR #3 (Fase A/B/C/F) udah ke-merge ke `main`. · ✅ **FASE D (LOAN) SELESAI & TERVERIFIKASI PENUH di `dev`** (UNCOMMITTED — nunggu owner OK commit). Dikerjain checkpoint D1–D5, tiap checkpoint di-review + di-test empiris:
  - **D1 — schema:** `db/migrations/008_loans.sql` (tabel `loans` id/season_id/lender_id/borrower_id/amount/status/created_at/approved_at/settled_at; FK season ON DELETE CASCADE; CHECK `amount>0` + `lender<>borrower`; partial unique idx `one_open_loan_per_borrower` WHERE status IN pending/active = backstop double-borrow). `status` TANPA CHECK (validasi app layer, ikut konvensi). Migrated ke dev. `lib/types.ts`: `Loan`+`LoanStatus`. Admin log filter: 5 action loan + warna. Constraint di-test via txn ROLLBACK (unique 23505, CHECK 23514, re-borrow setelah repaid OK).
  - **D2 — server actions** `lib/actions/loans.ts`: `requestLoan`/`approveLoan`/`declineLoan`/`cancelLoan`/`repayLoan`. Semua FOR UPDATE (lock kedua player ordered-by-id = deadlock-safe). Aturan: gate borrower `balance<buy_in`, no-active-session (request/approve/repay), 1-open-loan/pemain either-role (anti-circular), amount ∈ [buy_in, lender.balance], **membership season_players guard** (server action publik), lender re-check balance pas approve. Disburse lender→borrower pas approve (`loan_out`/`loan_in`), borrower→lender pas repay (`loan_repay`). Edit_log session_id NULL → otomatis ke-exclude stats.
  - **D3 — auto-settle** di `endSeason` (cover `adminForceEndSeason` krn manggil endSeason): sebelum ranking, tiap loan active claw-back `min(saldo borrower, amount)` borrower→lender (`loan_settle`), kekurangan di-writeoff (`loan_writeoff`, lender rugi), pending loan → `cancelled`. Verified 4 skenario arithmetic (full/exact/partial/full-writeoff) via txn ROLLBACK. `debug.ts` resetSeason+nukeAll tambah `DELETE FROM loans`.
  - **D4 — UI+API:** `/api/loans` route (per-user, `Cache-Control: no-store`, BUKAN edge-cache kayak /api/poll) → `{canBorrow, candidates, incoming, myBorrow, myLend, sessionActive, balance, buyIn}`. Hook `lib/useLoans.ts` (poll 2dtk). `components/LoanWidget.tsx` (mount di `DashboardClient` atas podium): banner minta-pinjam + sheet pilih lender/amount, kartu incoming approve/tolak (lender), repay (borrower, disable+hint pas sesi aktif / saldo kurang), indikator 🔴 ngutang / 🟢 minjemin. `pnpm build` green.
  - **D5 — E2E** `tests/loans.spec.ts` (3 test: request→approve→repay full + balance asserts, borrow gate /api/loans, decline) + **teardown fix** (`DELETE FROM loans` sebelum hapus players, tracked+stray — loans FK players no-cascade, kelas bug sama kayak season_results). **Full suite 90/90 PASSED (4.8m), 0 fail.** Auto-settle ga di-E2E (butuh end season shared = bahaya) — di-cover verifikasi arithmetic D3.
  - **CATATAN:** belum bump `lib/changelog.ts`. **Pas merge ke main nanti: WAJIB `pnpm db:migrate` PROD dulu** (prod ketinggalan 006+007+**008_loans**) SEBELUM deploy.
· ✅ **FASE E (register auth-code) SELESAI & TERVERIFIKASI di `dev`** (committed E1–E5, tiap checkpoint review+test+commit):
  - **E1 (`315e929`)** migration `009_invite_code` (`seasons.invite_code`+`invite_code_uses`, backfill active season) · `generateInviteCode()` (8-char alfabet unambiguous) + `MAX_INVITE_CODE_USES=2` di lib/auth · createSeason generate code · `rotateInviteCode()` admin action (atomik FOR UPDATE) + section "KODE UNDANGAN" di /admin (code + uses + tombol putar).
  - **E2 (`8eaccc6`)** migration `010_register_throttle` (`register_attempts` per-IP) · `registerPlayer()` (atomik: throttle gate → verify code → create akun → auto-join roster phase-aware [P1 full starting_balance + max_pool bump phase-neutral, P2 zero] → consume/rotate invite → auto-login cookie) · `joinActiveSeason()` (pemain lama non-member, no code) · helper `applySeasonJoin` · action `season_join` + admin filter. Logika diverifikasi txn-ROLLBACK (P1 grant+bump, P2 zero-sum, rotate@limit).
  - **E3 (`9b8b0b8`)** UI: `RegisterForm` (nama+PIN+kode → register → localStorage+dashboard) di IdentityPicker via toggle "+ Daftar pemain baru" · `JoinSeasonPrompt` di dashboard buat logged-in non-member ("Gabung musim", phase-aware copy).
  - **E4 (`93147cd`)** guest spectator: route publik `/lihat` (papan skor read-only, no identity/aksi, CTA Daftar/Masuk; di luar (main) jadi ga ke-gate middleware) + link "Lihat dulu (tanpa daftar)" di /identity.
  - **E5** E2E `tests/invite.spec.ts` (register→member+balance, wrong-code→error+no-account, join mid-season, guest /lihat) — snapshot+restore invite_code season asli. **Full suite 94/94 PASSED (4.5m).**
  - **Telegram bot notif: DI-SKIP** (opsional, owner "jangan gantung fitur ke Telegram"). Throttle register = per-IP failures (catatan: home-group share WiFi, tapi cuma hitung salah-kode jadi register sukses ga ke-charge).
  - **NEXT: Fase D (LOAN) + E udah kelar → tinggal Fase D recovery untuk P2-joiner udah ada (loan/dealer-netral). Sisa: merge dev→main (WAJIB `pnpm db:migrate` PROD: 006+007+008+009+010 dulu) + bump changelog. JANGAN merge sblm owner OK.**

**✅ SHIPPED 2026-06-08 (owner) — PR #4 (`dev→main`, merge `33d301a`) LIVE di prod.** Fase D (LOAN) + E (register/invite/mid-season join/guest) + UI no-emoji (lucide) + **changelog 0.8.0** semua di prod sekarang. Prod DB udah ke-migrate sebelum deploy. Header todo ini sekarang akurat. **Sisa backlog: LATE JOIN (belum dibangun, next), item 11 (/identity picker — belum diputusin opsi a/b/c), tech debt (002_* dobel, test-DB isolation).**

| Fase | Isi | Migration | Depend |
|---|---|---|---|
| **0** | Commit item 1 (udah kelar & lulus tes, masih uncommitted di dev) — ⚠ butuh OK owner buat commit | — | — |
| **A** | Ekonomi (no migration, berurutan): **A1** input buy-in+nyawa & BB/SB rebase (it.4) → **A2** gaji dealer 2× split 1×meja+1×saldo (it.6) → **A3** Opsi A max_pool derived + tempo picker (default Langsung serius) + ladder 10/15/24/36 + rake 15/10/10/8 + label "~hari" + dashboard P1 bar pool (it.5) → **A4** rewrite 2 E2E wizard yg break + assertion baru | — | — |
| **B** | Dealer netral + rake rule (it.7 + it.8 digabung krn kopel): session/setup pilih main/netral (4+ pemain), P1 netral flat 1×, P2 netral=rake & P2 main=no rake, end-wizard netral tetep ada (tip) + E2E | `session_participants.dealer_plays` | A |
| **C** | Keanggotaan season: **C1** tabel + scope dashboard/poll/leaderboard/session-setup ke member musim aktif → **C2** wizard step1 jadi checklist dari `players` (default UNCHECK) + tambah baru (it.3) → **C3** E2E | `season_players` | A |
| **D** | Fitur LOAN (desain FINAL di backlog atas) + endpoint `/api/loans` (no-cache per-user) + action types di-exclude dari stats + E2E | `loans` | — |
| **E** | Register auth-code (it.9): form nama+PIN+kode (2-use rotating, throttle, atomik) + auto-join + join-tengah-musim (lama=PIN no-kode, baru=kode) + guest spectator + Telegram opsional (last) + E2E | `seasons.invite_code`(+uses) | A, C, D |
| **F** | Panduan/manual (it.10): halaman `/panduan` + ikon "?" + auto-welcome sheet sekali per-device | — | independen (no dep, no migration — bisa diselip kapan aja; enak digabung sama E) |

**Alasan urutan:** A3 butuh nyawa(A1)+gaji(A2) → A berurutan. B & C nempel ekonomi. E nyander keanggotaan(C) + loan(D, buat recovery P2-joiner) + balance-logic(A) → terakhir. D bisa diselip kapan aja sebelum E (independen).

---

## Key design decisions (this session)

These override the earlier `SPEC.md` text where they conflict:

1. **Rake = Approach C (no auto-credit in M2)** — Phase 2 dealer pays buy-in like everyone, collects rake into their own stack during play. App does NOT add rake to balance at session end. `rake_rate` is informational guidance. Will be revisited with the rake calculator.

2. **Cooldown is Phase 1 only and does NOT block** — it just denies the Phase 1 free-entry salary. A cooled-down dealer in P1 pays buy-in; in P2 cooldown is irrelevant. Anchor set only when salary is granted.

3. **Phase 1 salary = free entry + 1× buy_in printed chips** (updated 2026-05-29 per owner)
   - Dealer (not cooldown) plays FREE: balance is NOT deducted (the salary), and they
     receive `+buy_in` salary chips printed on the table → `1*buy_in` stack.
   - Same for has-balance and broke dealers — every seat holds exactly one buy-in, so
     table total = `n_players * buy_in` (e.g. 3 players @ 200 → 600, not 800).
   - Logged as `buy_in_dealer_free` (0 deduction) + `dealer_salary_chips` (no balance change,
     counted in chip total). System still injects `1*buy_in` new chips per session.
   - **Prior model (reverted):** has-balance dealer paid buy-in AND got salary → `2*buy_in`
     stack, table total 800. Owner flagged the inflated total as a bug.

4. **Low-balance players can only join as the dealer** — server rejects a non-dealer with `balance < buy_in`. Form disables Mulai with a clear hint.

5. **No "spectator" or "no-gaji dealer who only deals" concept anymore** — these were earlier experiments that got reverted. Now: the dealer always plays UNLESS Phase 2 + broke (or P1 cooldown + broke), in which case they're `no_gaji_dealer = true` and only deal.

6. **End-session recap delta from pre-session balance** (not post-buy-in balance) — drives the +/- column. Sourced from the `balance_before` of the player's first edit_log entry.

---

## Tech debt & known issues

- [x] `SPEC.md` synced — Phase 1 salary chips model, cooldown (no-block), Approach C rake, milestone status all updated
- [x] Bugfix mobile setup sesi: kontrol pilih pemain/dealer tidak lagi di-disable saat hydration; disable hanya saat request pending (`isPending`) atau validasi bisnis gagal
- [x] `dealer_salary` dead code removed — was a leftover IN-clause entry in `session/end/page.tsx:60`'s `original_balance` subquery from the old broke-deals-only-gets-credit flow. Never written by current code (only `dealer_salary_chips` is, at `session.ts:477`), so removing it is a no-op for current data. Cleaned 2026-05-29; build + 35 end-session tests still green.
- [x] E2E test suite verified — clean `pnpm test` run on 2026-05-29: **71 passed (3.9m), 0 failures** across admin/balance/concurrency/identity/session/z-m2-coverage/z-m2-features/z-m3-features. No drift remaining.
- [x] **E2E coverage buat fitur baru (2026-06-06, branch `test/coverage-new-features`)** — 10 test baru: `changelog.spec.ts` (halaman render versi+changes; badge "Baru" muncul pas unseen lalu ilang abis buka /changelog), `dashboard.spec.ts` (phase-progress P1 "≈ sesi ke Phase 2"+progressbar, P2 "sesi ke akhir musim"; phase-alert: first-visit no-alert, muncul pas phase_seen beda, one-time abis acknowledge), `duration.spec.ts` (timer `aria-label="Durasi sesi"` di /session, baris "Durasi" di recap, stats "Total waktu main"+"Rata-rata/sesi"=1j 30m via dedicated player+sesi 90mnt), `balance.spec.ts` (+undo partial rebuy balikin 50 bukan 100). Semua spec mutate season di-restore ke bootstrap di afterEach. Full suite hijau.
- [ ] Migration filename collision: `002_identity_auth.sql` and `002_seasons.sql` both prefixed `002_` (cosmetic — alphabetical order still works)
- [x] **Fixed flaky `identity.spec.ts:31` (2026-05-30)** — "tapping a player… redirects to /" intermittently logged in as a real player (e.g. JAGO, balance 200, sorts before `[T…] Alice`) instead of the seeded Alice. Root cause: the picker hydrates client-side and a tap before React attaches the click handler is dropped, leaving the default (alphabetically-first) selection; with real players in the shared Neon DB the default is no longer a test player. Fix: test now uses an exact-name match and retries the tap (`toPass`) until the hidden `playerId` input equals `alice.id` — deterministic regardless of hydration timing or DB contents. 2 clean runs. (Latent product note: a pre-hydration mis-tap would submit the default player, but the PIN gate makes real-world impact negligible; left as-is to avoid scope creep.)
- [ ] **Test DB is the shared/real Neon DB** — global-setup seeds `[T…]` players alongside the owner's real players (JAGO/OwnerTaveve/PAN8/yontol). Tests mutate the live DB. Consider a dedicated Neon test branch for isolation (needs owner's DB creds).
  - [x] **Fixed season-config corruption (2026-06-06, branch `fix/test-season-restore`)** — `global-setup` overwrote the owner's real active season (`max_pool→100jt`, `max_sessions→100k`, `preset→standard`) and teardown never restored it → dashboard showed "≈ 999986 sesi lagi ke Phase 2". Root cause of that 999986. Fix: setup now **snapshots** the real season config (`SeasonSnapshot`) into `.test-data.json` before overwriting (skips snapshot if it already looks like leftover test-state, sentinel `max_pool=100_000_000`), and teardown **restores** it. One-off: manually restored Season 15 (max_pool 2500/25 sesi/quick — reconstructed from the 56% observed live earlier). Verified: after a full setup+teardown cycle the config survives. Players still get isolated via the existing teardown.
  - [x] **Fixed membership wipe after test run (2026-06-08)** — post-Fase-C, the dashboard/poll scope to `season_players`. Tests wipe the base season's roster (FK cascade when deleting `[T…]` players, debug ops) and never restored real-player membership → after `pnpm test` the owner's dashboard showed "Belum ada pemain terdaftar" (0 members) + config left at test sentinel. **Two-part fix:** (1) one-off `scripts/repair-dev-season.mjs` re-added the 7 real players to Season 18 + restored a sane config (max_pool 3700/24 sesi, balances→500); (2) **hardened test infra** mirroring the season-config snapshot/restore — `global-setup` snapshots the reused season's real (non-`[T…]`) member ids into `.test-data.json` (`seasonMemberIds`), `global-teardown` re-inserts them (JOIN players guards deleted ids). Verified via snapshot→wipe→restore round-trip (7→0→7, PASS). Separately diagnosed a **logout 404** = stale Turbopack HMR (route file correct, 87/87 green, `/panduan` worked) → fixed by recompile, no code change. Both diagnosed live via chrome-devtools MCP.
- [x] Admin log filter buttons updated — added `buy_in_dealer_phase2`, `buy_in_no_gaji_dealer`, `dealer_salary_chips`, `season_start`, `season_end`, `pin_change` with colors
- [x] Mobile dev-mode hydration fix — Next.js 16's `blockCrossSiteDEV` was killing hydration on the phone (LAN IP origin not allowlisted). Added `allowedDevOrigins: ['192.168.18.*']` to `next.config.js`. Restart required after change.
- [x] **Bugfix dealer chip inflation (2026-05-29)** — Phase 1 free-entry dealer was paying buy-in AND receiving `+buy_in` salary chips → 2× buy_in stack, inflating table total (3 players @ 200 → 800). Owner flagged: dealer should play FREE (no deduction) on a single 1× buy_in salary stack → table total = `n × buy_in` (→ 600). Fixed in `session.ts` (free-entry branch now `deduction=0`, action `buy_in_dealer_free`, unchanged-balance salary log). Updated `SessionSetupForm` hint, SPEC.md, memory, and 3 tests (z-m2-coverage P1 dealer balance/action + recap, z-m3 stats). Build + 71/71 green.

---

## Suggested next steps (in order of value)

1. ~~Full `pnpm test` run~~ ✅ done 2026-05-29 — 71/71 pass, no regressions.
2. ~~`dealer_salary` dead code~~ ✅ done 2026-05-29 — dihapus dari IN-clause `session/end/page.tsx:60`.
3. **M4** — Export CSV, achievement system (bila owner mau lanjut).

---

## File pointers

- Server actions: `lib/actions/session.ts`, `lib/actions/season.ts` (incl. `endSeason`), `lib/actions/players.ts`, `lib/actions/debug.ts` (incl. `adminForceEndSeason`)
- Setup / end / session pages: `app/(main)/session/setup/page.tsx`, `app/(main)/session/end/page.tsx`, `app/(main)/session/page.tsx`
- Wizard: `components/SessionEndWizard.tsx`, setup form: `components/SessionSetupForm.tsx`, active session: `components/SessionView.tsx`
- Season end: `app/(main)/season/end/page.tsx`, `app/(main)/season/end/SeasonEndConfirm.tsx`
- Season history: `app/(main)/season/history/page.tsx`, `app/(main)/season/history/HistoryAccordion.tsx`
- Player stats: `app/(main)/player/[id]/page.tsx`
- Season setup: `app/season/new/page.tsx`, `components/SeasonSetup.tsx`
- Admin: `app/admin/page.tsx`, `app/admin/DebugSection.tsx`
- DB schema: `db/migrations/001_init.sql`, `002_identity_auth.sql`, `002_seasons.sql`, `003_session_roles.sql`
- Proxy / auth: `proxy.ts`, `lib/auth.ts`, `lib/auth-server.ts`
- Tests: `tests/*.spec.ts` (admin, balance, concurrency, identity, session, z-m2-features)
