# Ouros Life design system — dark biometric interface

This is the durable reference for the Whoop/Oura/Apple-Health-style redesign. Tokens live in
`SparkyFitnessFrontend/src/index.css`; this doc explains what they mean and the rules that keep new
UI consistent with them. See `agent-docs/fork-status-and-handoff.md`'s "PICK UP HERE" section for
live status against the phased rollout plan.

**The app is dark-only.** `.dark` is hardcoded on `<html>` in `index.html`; there is no light theme
and no toggle. `.dark` in `index.css` is the sole source of every colour token — do not add a
`:root` light block back.

## Colour tokens

Values are bare HSL triplets in CSS vars, wrapped by `hsl()` in `@theme` — this repo's existing
convention (see `SparkyFitnessFrontend/src/index.css`). Never hardcode a hex value in a component;
reference the token.

**Surfaces — elevation by lightness step, never by shadow**

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--background` | `217 29% 5%` | `#0A0D12` | Page canvas. Matte obsidian. |
| `--card` | `222 25% 10%` | `#131720` | Elevated card surface. **The only card boundary.** |
| `--surface-2` | `222 20% 14%` | `#1B2130` | Inset wells: progress tracks, input fields, chart plot areas. No border. |
| `--surface-3` | `220 18% 19%` | `#262D3D` | Hover / pressed / selected state (also `--accent`). |
| `--border` | `0 0% 100% / 0.06` | — | Hairline. The only separation device. |
| `--border-strong` | `0 0% 100% / 0.12` | — | Active/focused edges, table rules. |

**Text**

| Token | Role |
|---|---|
| `--foreground` | Metrics, primary text (~17:1 on `--card`) |
| `--muted-foreground` | Labels, units, secondary text (~6.4:1 on `--card`) |
| `--foreground-dim` | Axis ticks, disabled, decorative only (~3.2:1 — never for text that carries meaning) |

**Biometric accents — reserved strictly for data**

| Token | HSL | Hex | Domain |
|---|---|---|---|
| `--metric-recovery` | `162 100% 45%` | `#00E5A0` | Recovery, readiness, HRV, completed habits. Also `--primary` (the one CTA exception, see below). |
| `--metric-workout` | `17 100% 64%` | `#FF7A47` | Strain, tonnage, exertion |
| `--metric-sleep` | `252 100% 68%` | `#7C5CFF` | Sleep duration and stages |
| `--metric-water` | `188 86% 53%` | `#22D3EE` | Hydration |
| `--metric-fasting` | `41 96% 56%` | `#FBBF24` | Fasting windows |

`--status-optimal` / `--status-moderate` / `--status-low` reuse the recovery/fasting/destructive
hues for adherence and trend-direction indicators.

**The colour rule, stated once**: accent colour appears on a ring stroke, a track fill, a data
series, a sparkline, or a single status dot. It never appears as a card background, a section
header fill, or a decorative gradient. **The one sanctioned exception** is the mobile nav's FAB,
which uses `--primary` (mint) as the single primary CTA. If removing the colour would not lose
information, the colour should not be there.

**Gotcha**: `--border` carries its own alpha (`0 0% 100% / 0.06`). A Tailwind opacity modifier on it
(`border-border/50`) emits `hsl(0 0% 100% / 0.06 / 0.5)` — invalid CSS, fails silently with no error.
Use `--border-strong` instead of an opacity modifier.

## Typography

- **Family**: Inter Variable, self-hosted via `@fontsource-variable/inter` (no CDN — the app is
  Tailscale-only). Set as `--font-sans` in `@theme`.
- **Numerals**: the `.metric-num` utility (`font-variant-numeric: tabular-nums; letter-spacing:
  -0.02em; font-weight: 600;`) — use on every number that can change without its neighbours
  reflowing.

| Role | Spec |
|---|---|
| Card label | `text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground` — this is what `CardTitle` now renders as |
| Hero metric | `text-5xl metric-num` — one per screen, maximum |
| Primary metric | `text-3xl metric-num` |
| Card metric | `text-2xl metric-num` |
| Unit | `text-sm font-medium text-muted-foreground`, baseline-aligned beside the number |
| Row label | `text-sm font-medium text-foreground` |
| Meta / timestamp | `text-xs text-muted-foreground` |

## Elevation and nesting rules

1. **No `shadow-*` utilities.** `Card` no longer applies one.
2. **One card boundary per screen region.** A `Card` may not contain another `Card`. Group with a
   `Separator`, a spacing step, or a `--surface-2` well instead.
3. **Level-2 wells carry no border** — background step alone is the separation device.
4. **Radius**: `--radius: 0.75rem`; `--radius-xl` (16px) for cards; `--radius-sm`/`md` for chips and
   inputs (all derived from `--radius` in `@theme`, matching the existing convention).
5. **Overlay chrome** (bottom nav, sticky header, sheets): `bg-background/80 backdrop-blur-xl` with a
   single hairline edge. This is the only place blur is used.

## Iconography

`lucide-react`. Stroke width `1.5` (the library default of `2` is too heavy against hairline
borders). Icons are `text-muted-foreground` unless the icon *is* the data indicator. No emoji.

## Rollout status

Phased per `C:\Users\ICPET\.claude\plans\i-am-redesigning-my-fancy-clarke.md`. Phase 1 (this doc,
the token set, the `Card` primitive fix, and the dark-only cutover) ships alone — it touches every
one of the 111 files that import `Card` and has the highest blast radius of any phase. Phases 2-6
adopt the shared primitives (`MetricCard`, `DataRow`, `SectionCard`, `SegmentedControl`,
`GoalCascade`, `chartTheme`) page by page; each primitive is created in the same commit as its first
real caller (knip fails the build on unused exports, so none of them exist yet in isolation).
