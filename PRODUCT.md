# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are the owner and his circle of friends who play home-game Texas Hold'em together. They use the app **on their phones, one-handed, at the table, mid-game** — often in a dim room, passing around who is dealer, calling rebuys, and settling up at the end of the night. This is a closed, private group tool: everyone is a known regular, not an anonymous public user. There is no acquisition audience and no intent to onboard outside groups — identity is a name picked from a list (stored in localStorage) plus a PIN for sensitive actions, deliberately not real authentication.

## Product Purpose

PokerAja is the digital replacement for the scrap of paper the group used to track chips and money on. It records each player's **persistent balance** across sessions and seasons so nobody has to remember or argue about who owes what. A session is one game night: pick who's playing and who deals, deduct buy-ins, handle rebuys and undos live, then enter everyone's final stack to settle balances. Success is that at the end of a night the numbers are trusted and settling up is instant — no manual math, no disputes, no "wait, how many times did you rebuy?"

## Positioning

What makes PokerAja specific (and not a generic scorekeeper) is that it models the group's **actual house economy as a self-balancing, seasonal system** rather than just tallying points:

- **Dealer is a paid role, not just a seat.** In the bootstrap phase the dealer plays for free (their buy-in isn't deducted) and receives salary chips printed to the table — this is their pay for dealing. Broke players may only join as dealer.
- **Two-phase chip economy.** While total chips in the system are below the pool cap (bootstrap), the dealer salary mints new chips. Once the cap is hit (steady-state), no new chips are printed, the game becomes zero-sum, and the dealer collects rake into their own stack (Approach C — the app never auto-credits rake; every balance update is `balance += final_stack` for everyone).
- **Seasons with reset.** A season runs for a set number of games, then snapshots a leaderboard and per-player stats and resets everyone to the starting balance — like a competitive season, so the standings periodically start fresh.
- **Dealer cooldown** (bootstrap only) prevents the same person from farming salary chips every night.

A neighboring chip-counter app could copy the tally; it could not truthfully copy this specific house-economy ruleset, which is the product.

## Operating Context

- Used live during a poker night on phones, single-column, mobile viewport (design target 375×667 and 390×844).
- Multiple devices are open at once and must stay in sync; the app polls `GET /api/poll` every 2 seconds rather than using websockets. A change on one device must show on another within ~3 seconds.
- Two people can act on the same player at the same moment (e.g. both tap Rebuy), so every read-modify-write runs inside a Postgres transaction with row locking — correctness under concurrency is a real operating condition, not an edge case.
- Physical chips can genuinely go missing, so the end-of-night total-chip validation is a **warning the user can override**, not a hard block.
- A hidden admin surface at `/admin?key=…` exists for the owner (add players, manual balance edits with a required reason, force-end a session, view the append-only log, snapshot-based rollback). A wrong or missing key must return a real 404 — it must never reveal that an admin endpoint exists.

## Capabilities and Constraints

**Shipped capabilities:** identity picker; player dashboard with balances and podium; session setup (choose players + dealer); live session with rebuy / undo-last-rebuy; multi-step end-session stack entry with recap and total-chip validation; season creation by any player (no admin needed), presets, phase system, dealer salary/cooldown/broke handling, rake calculator; season end with leaderboard, history, per-player stats; PIN system (self-change + admin reset); web push notifications; CSV export; achievements; admin tools with snapshot-based rollback; 2-second polling sync.

**Hard constraints (binding):**
- Stack is fixed and not to be expanded without owner confirmation: Next.js App Router + TypeScript, Tailwind, `@vercel/postgres` (plain SQL, **no ORM** — no Prisma/Drizzle), `pnpm`. **No client state library** (no zustand/redux/jotai), **no data-fetching library** (no SWR/React Query — polling via `useEffect` + `setInterval`), **no websockets**.
- **Dark mode only.** No light-mode toggle.
- shadcn/ui is allowed **only as Radix-based primitives re-themed to the felt-green palette** (the felt-green tokens are the single source of truth; shadcn tokens are aliases pointing at them). No Material UI / Chakra / all-in-one kits. No Magic UI / flashy or dramatic animation — motion stays 150–200ms and understated.
- The edit log is **append-only**. Undo means marking an entry `voided = true`, never deleting. `edit_log.action` is free TEXT (validated in the app layer), never a DB CHECK constraint, so future actions don't require a migration.
- Numbers everywhere use JetBrains Mono with tabular-nums; currency shows as `100` (not `100.00`), negatives in the danger color.

**Undecided / deferred product facts (do not fabricate or hard-block):** max pool-chip cap config, multi-parallel sessions, real authentication, per-hand win/loss tracking, player rename, and a history view for regular (non-admin) players are explicitly deferred — schema leaves room (e.g. `sessions.metadata`, `sessions.season_id`) but they are not built.

## Brand Commitments

- **Name:** PokerAja (app/PWA name; page title "Poker Chip Tracker"). Live at pokeraja.vercel.app.
- **Language:** Indonesian only, and this is identity, not just localization. Copy uses casual, familiar Indonesian slang ("Lo", "biar ga ribet", "Kamu siapa?", "Mulai sesi"). New surfaces hardcode Indonesian; no i18n scaffolding, no English fallback.
- **Mood (durable):** underground / serious, deliberately *not* flashy casino and *not* generic SaaS. These two are hard anti-references for any visual world.
- **Visual world — replaced 2026-08-23 (Impeccable redesign).** The owner explicitly **released** the previous binding **felt-green** aesthetic and chose a **broadcast Teletext** world (seed `2c95db6f`, bolder round reroll 1) after reviewing a mobile mitigation mockup. The Teletext world: broadcast-8 palette on flat black (yellow double-height headers, cyan live figures, green REVEAL, red alerts, magenta ranks), a self-hosted bitmap teletext face, block-mosaic chip stacks, square cells, 1px dim rules — but **touch-adapted**: cells scaled so every tap target is ≥44px (a literal 40×24 port is the rejected failure mode). Dark-mode-only still holds (teletext is black-ground native). The felt-green tokens are being retired from `globals.css`. **DESIGN.md is authored at finish** from the built world; until then this note is the standing record. The old felt-green identity is now *anti-reference*, not something to preserve.
- **Guardrails (from the owner, binding on the redesign):** must not read as casino (neon, glossy gold chips, gambling-site glitz), must not read as generic SaaS (blue template dashboard, uniform zinc/slate cards), must not be fiddly to use mid-game (honor the ≥44px / dim-light bar), must not use loud/dramatic animation.

## Evidence on Hand

- `SPEC.md` — the authoritative product/design spec, followed letter-for-letter; on conflict with generic best practice, SPEC wins. Includes full color palette, token mapping, business rules, DB schema, screen wireframes, acceptance criteria, and the M2–M4 roadmap.
- `CLAUDE.md` — build rules, quality bar per screen, and the do/don't list.
- Working, deployed application (M1–M4 shipped and merged) with a passing E2E suite (Playwright, ~73 tests) as living evidence of intended behavior.
- No fabricated testimonials, user counts, pricing, or external customers exist — this is a private group tool; future work must not invent any.

## Product Principles

1. **The paper it replaced set the bar: trust and speed.** Numbers must be correct and settling up instant. Correctness under concurrent, multi-device use outranks everything visual.
2. **Follow SPEC.md over convention.** When the spec and a "best practice" disagree, the spec wins; deferred features stay deferred but must not be schema-blocked.
3. **The log is history, not scratch.** Append-only, undo = void, admin edits require a reason. Auditability is a product feature.
4. **Underground felt-green, never casino, never generic SaaS.** The look is part of the product's personality; preserve the identity through any refinement or redesign.
5. **Built for the table, not the boardroom.** One-handed, dim-room, mid-game phone use is the real scene every screen is judged against.

## Accessibility & Inclusion

Two bars apply together. **Practical:** usable one-handed on a phone in a dim room mid-game — ≥44×44px tap targets, strong contrast, no fiddly gestures, sticky bottom CTAs with safe-area insets, bottom sheets over center modals. **Formal:** treat **WCAG 2.2 AA** as a documented standard for future work — sufficient contrast in the dark theme, screen-reader labels on icon-only controls, sensible focus order, state conveyed by more than color, and respect for reduced-motion (already aligned with the no-flashy-animation rule).
