# Design — PokerAja (Teletext)

<!-- impeccable:design world=teletext seed=2c95db6f authored-at-finish -->

The visual world is a **broadcast Teletext results service**, touch-adapted for a
phone used one-handed at the table in dim light. It replaced the previous
felt-green world on 2026-08-24 (Impeccable seed `2c95db6f`, bolder round reroll 1).
Product truth in [PRODUCT.md](PRODUCT.md). Refuses two category defaults: the
casino-felt poker dashboard and the generic dark-SaaS grid.

## Foundations

Everything is driven by CSS variables in `app/globals.css`. The legacy var
**names** were kept so every component inherited the new world; only values
changed. `--tt-*` are the canonical handles.

### Color — broadcast-8 on flat black

| Role | Token | Value | Use |
|---|---|---|---|
| Ground | `--tt-black` / `--background` | `#000000` | page + bars |
| Panel | `--card` | `#0a0a0a` | table-header strips, list fills |
| Elevated | `--bg-elevated` | `#121212` | inputs, hover, sheets |
| Body text | `--tt-white` / `--foreground` | `#eaeaea` | names, labels |
| Secondary | `--text-secondary` | `#8f9a9a` | sub-labels (tinted, never pure gray) |
| Tertiary | `--text-tertiary` | `#5f6a6a` | hints, empty states |
| **Live figure** | `--tt-cyan` / `--primary` | `#00d0d0` | **balances, active/selected, primary** |
| Cyan panel | `--tt-cyan-dim` / `--accent` | `#073a3a` | selected-row fill, avatar fill |
| **Header** | `--tt-yellow` / `--accent-warn` | `#ffe800` | double-height titles, primary CTA |
| Success / up | `--tt-green` / `--accent-success` | `#00c000` | REVEAL, positive delta, sub-headers |
| Alert / down | `--tt-red` / `--destructive` | `#ff3b30` | negatives, alerts, destructive |
| Rank / accent2 | `--tt-magenta` | `#e850c0` | ranks, page codes |
| Rule | `--tt-rule` / `--border` | `#262626` | 1px hairline cell rules |
| Rule strong | `--tt-rule-strong` / `--input` | `#3a3a3a` | input borders |

`--primary-foreground` and `--destructive-foreground` are **black** — broadcast
blocks carry black ink. Focus ring, caret, text-selection, and scrollbars are all
themed cyan (`globals.css`). Dark-mode only; there is no light theme.

### Type

- **VT323** (self-hosted via `next/font`, bound to `--font-tt`) is the app voice —
  the bitmap teletext face. It is also the numeric face (`font-mono` → VT323),
  always with `tabular-nums`. Base size is lifted to 18px; `-webkit-font-smoothing:
  none` keeps it crisp. A truer broadcast face (e.g. Bedstead) is the intended
  upgrade; VT323 is the shipped stand-in.
- **Geist Sans** (`--font-geist-sans`, Tailwind `font-read` / `.font-read`) is the
  reading face for long-form body copy (phase notices, guide paragraphs).
- Headings are UPPERCASE with `tracking` ~0.04–0.12em; yellow for page titles.
  Numbers are the hero — big, cyan, tabular.

### Shape & space

- **Every corner is square.** All Tailwind radius scales are `0`
  (`tailwind.config.ts`); no rounded pills or circular avatars.
- Cells are **touch-scaled**: rows and tap targets are ≥44px (a literal 40×24
  teletext port was the rejected failure mode). Standings rows are 52px.
- Elevation is drawn with **1px hairline rules**, not shadows.

## Components & patterns

- **Status bar** (`HeaderMenu`, page headers): black bar, 2px bottom rule, yellow
  `POKERAJA` / page title on the left, actions on the right. Every screen's title is
  prefixed by a **block-mosaic pixel icon** (`PixelIcon`, 5×5 SVG in cyan) naming the
  section — chip=Saldo, person=Profil/Pemain/Identitas, cards=Sesi, flag=End,
  clock=Riwayat, calendar=Musim, trophy=Leaderboard, plus=Season baru, bell=Notif,
  star=Changelog, shield=Admin. This replaced the earlier numeric teletext page codes
  (P100/P200/…): on a touch app the codes were non-functional decoration, so the
  authentic teletext *graphic* (block-mosaic, which real teletext pages were built
  from) carries section identity instead. Icons always sit beside their label.
- **Page tabs** (dashboard): full-width ≥56px cells, pixel icon over label; active
  tab is a solid cyan block with black ink. Tabs are Saldo · Profil (→ the player's
  own `/player/[id]` stats) · Riwayat — session start lives on the sticky CTA and the
  live-session band, so it needs no tab.
- **Standings / results table**: rank (magenta for top-3, tertiary otherwise) ·
  block-mosaic chip stack · UPPERCASE name · cyan balance (red if negative). This
  replaced the old 3-D podium on the dashboard; the season-end climax keeps its
  stepped podium but re-hued to broadcast-8 (yellow/cyan/magenta) with a one-shot
  cyan glow.
- **Block-mosaic**: four cyan bars whose lit count ∝ value — the teletext sixel
  primitive, used for chip stacks and the phase-progress bar (20 cells).
- **Buttons** (`ui/button`): square, UPPERCASE, `tracking-0.08em`. Primary = cyan
  block; the top-level CTA (Mulai Sesi / Masuk / Confirm) is the **yellow** action.
- **Avatars** (`Avatar`): a pixel-art poker chip — 11×11 blocky ring with white
  edge spots and the initial in the teletext face. Colour is derived
  deterministically from the name (broadcast-8 palette), so each player reads as a
  distinct chip. Used everywhere a player appears (header, identity, session, end,
  leaderboard, riwayat, player page).
- **Achievements** (`AchievementIcon` + `AchievementsGrid`): detailed teletext
  block-mosaic glyphs (12×12), one per category (bandar/juara/podium/veteran/
  sultan/untung); tier drives colour, not shape — locked dark → silver → cyan →
  gold-with-glow. The profile shows a compact 3-tier grid per category; tapping a
  category opens a bottom-sheet with each tier's name, short requirement, and
  status (pixel check / progress count / pixel lock) — descriptions live in the
  popup, not inline, since touch has no hover.
- **Icons**: the pixel `PixelIcon` set is the primary icon language (section
  headers, dealer star, warnings, chevrons). Lucide remains for a few simple
  functional glyphs (back arrow, close, account-sheet, preset icons) as a clean
  monoline secondary set.
- **Inputs**: flat elevated fill, strong-rule border, cyan value, cyan focus
  border. The end-session stack input is jumbo cyan.
- **Sheets** (`Sheet`, Radix): bottom sheet, square, slide-up 200ms.
- **Multi-step marker** (end-session, season setup): a numbered step strip — done
  cells cyan, current cell **yellow**, upcoming dim (origami step discipline).
- **Alerts**: red 2px-ruled band with a black-ink or red-on-tint message; the live
  "SESI BERJALAN" band pulses a single red cell (`steps(2)`, not a lebay flash).

## Motion

One authored moment per surface, 150–200ms, understated. Entrance reveals (season
podium) run once, never loop. `prefers-reduced-motion` collapses all animation to
near-zero globally (`globals.css`).

## Accessibility

Dim-light one-handed use is the bar, plus documented WCAG 2.2 AA. Tap targets
≥44px; state is conveyed by color **and** shape/label (tags, rules, markers), never
color alone; browser surfaces (caret, selection, focus, scrollbar) are themed;
cyan-on-black and yellow-on-black clear AA for the sizes used. Icon-only controls
carry `aria-label`; the direction contract is an HTML comment, not read content.

## Direction contract

The full contract is an HTML comment emitted at the top of `<body>` in
`app/layout.tsx` (greppable by seed `2c95db6f`).
