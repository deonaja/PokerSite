# Poker Chip Tracker — Progress & TODO

Last updated: 2026-05-29 (UI redesign — shadcn foundation)

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
- [ ] **Visual redesign pass — "Underground Table"** (started 2026-05-30, owner-directed): bahasa visual baru di atas primitive shadcn, tetap felt-green/dark/anti-AI-ish.
  - [x] Dashboard: **redesign ke konsep PODIUM** (owner-approved setelah render konsep 1-per-1). Top-3 ditampilkan sebagai podium (juara 1 di tengah, blok felt tinggi + angka emas, avatar pemain di atas blok; pemain-login dapat ring felt). Sisanya (#4+) jadi list "PERINGKAT LAINNYA" flat sejajar (low-balance ⚠ gold, baris pemain-login di-highlight + tag KAMU). Season context line + Riwayat musim di atas; CTA chunky. `page.tsx` passing `currentPlayerId` via `getAuthenticatedPlayer()`. `PlayerCard` dihapus. (Konsep yang dilewati: hero "Saldo kamu", standings table, accent-bar felt, box, garis, season band — di-render lalu owner pilih podium.)
  - [x] Header (global `(main)` chrome): `HeaderMenu` client — avatar inisial felt + "Hi, nama" + chevron; semua aksi pindah ke bottom-sheet (Ganti PIN / Ganti identitas) biar header ga crowded. (avatar image / "ganti gambar" DITUNDA per owner). `identity.spec` diupdate (buka sheet dulu, hydration-safe retry). Build + 71/71 green.
  - [ ] Roll out bahasa visual ke layar lain (1-per-1, render PNG dulu utk review):
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
| M1 — MVP tracking | ✅ 100% | ~40% |
| M2 — Season system | ✅ 100% | ~35% |
| M3 — Season end + leaderboard | ✅ 100% | ~15% |
| M4 — Polish (stats, export) | ❌ 0% | ~10% |

Roughly **95%** of the M1–M4 roadmap done.

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
- [ ] Additional UX polish (TBD)

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
- [ ] Migration filename collision: `002_identity_auth.sql` and `002_seasons.sql` both prefixed `002_` (cosmetic — alphabetical order still works)
- [x] **Fixed flaky `identity.spec.ts:31` (2026-05-30)** — "tapping a player… redirects to /" intermittently logged in as a real player (e.g. JAGO, balance 200, sorts before `[T…] Alice`) instead of the seeded Alice. Root cause: the picker hydrates client-side and a tap before React attaches the click handler is dropped, leaving the default (alphabetically-first) selection; with real players in the shared Neon DB the default is no longer a test player. Fix: test now uses an exact-name match and retries the tap (`toPass`) until the hidden `playerId` input equals `alice.id` — deterministic regardless of hydration timing or DB contents. 2 clean runs. (Latent product note: a pre-hydration mis-tap would submit the default player, but the PIN gate makes real-world impact negligible; left as-is to avoid scope creep.)
- [ ] **Test DB is the shared/real Neon DB** — global-setup seeds `[T…]` players alongside the owner's real players (JAGO/OwnerTaveve/PAN8/yontol). Tests mutate the live DB. Consider a dedicated Neon test branch for isolation (needs owner's DB creds).
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
