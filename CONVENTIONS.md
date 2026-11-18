# Mockup conventions

Read this before adding a screen. The finished pages (`home.html` + `home.js`, `stock.html` + `stock.js`, `mindmap.html` + `mindmap.js`) are the reference for look, markup and code style. Section 11 to 17 of `docs/plan.md` hold the design intent; section 14 has the layout of each screen.

## Hard rules

- Static files only. No build step, no modules (`<script src>` classic scripts, wrapped in an IIFE with `'use strict'`), no network requests, no CDN, no new dependencies, no images or brand logos (tickers use monogram tiles).
  - One agreed exception: the mind map's globe view (`mindmap-globe.js`) loads globe.gl, three.js, an Earth photograph and border data from a CDN at pinned versions, and falls back to the flat map without them. Do not copy this to other pages.
- Every number, name of a story, forecast and filing excerpt is invented sample data. Keep it plausible and internally consistent, and derive it from the seeded helpers so it is the same on every load.
- Use tokens from `tokens.css` for every colour, radius, shadow, duration and easing. No hard-coded hex colours in CSS or canvas code (canvas reads `ML.COL`).
- Dark and light themes, Comfortable and Compact density, and reduced motion must all work. Spacing comes from `--gap`, `--card-pad`, `--row-h`, `--cell-px`, `--ctl-h`.
- Numbers are tabular (inherited). Gains and losses always carry a sign and an arrow or word, never colour alone. Use the true minus sign (`ML.fmt`, `ML.fsign`, `ML.fpct` do this).
- Animation must have a purpose, use transform and opacity (or canvas), and have a reduced-motion fallback: check `ML.rm()`; `ML.tween` and `ML.springTo` already jump to the end state under reduced motion and halve durations in Compact. Entrance animations run once, never on data refresh.
- Accessibility: real buttons and links, labels on inputs, `aria-pressed` on toggles, visible focus, keyboard reach for everything, a text or table alternative for every chart (`role="img"` + `aria-label` at minimum).
- No point price predictions anywhere. Module outputs are probabilities with intervals, scenarios and ranked exposures. Analyst targets are labelled third-party.
- Plain, specific copy. Sentence case. No marketing language.
- Tickers are real, so do not attach invented facts to real people or firms: no real executives' names, no real fund managers, banks, brokers or news outlets. Use obvious placeholders ("Chief Financial Officer", "Index fund manager A", "Analyst, Firm B", "Wire service"). Company names come from `ML.I`.
- Do not edit shared files: `tokens.css`, `app.css`, `mock.js`, `home.*`, `mindmap.*`, `stock.html`, `stock.js`, `CONVENTIONS.md`, `README.md`. Put page-specific CSS and JS in the files you own. If a shared file is wrong or missing something, work around it locally and say so in your report.
- Do not use browser automation tools (one browser is shared). Check syntax with `node --check <file>.js`.

## Page skeleton

Copy the `<head>` of `home.html` exactly (title changed), then:

```html
<body>
<main class="page" id="main">
  <div class="page-h"><div><h1>Screener</h1><p class="sub">One line saying what this is.</p></div><div class="toolbar">…</div></div>
  …cards…
</main>
<script src="mock.js"></script>
<script src="screener.js"></script>
</body>
```

and in the page script, first thing: `M.shell('Screener');` using the exact nav label (Home, Markets, Screener, Compare, Calendars, My Portfolio, Watchlists, My News, Mind Maps, Tools, or `Workspace`). The shell adds the top bar, nav row, footer disclaimer, search, palette, ticker menu, hover cards and settings. Add your own stylesheet with a `<link>` after `app.css`.

## Classes in `app.css`

| Need | Use |
|---|---|
| Card | `section.card` with `header.card-h > h2` and optional `.card-a` actions. `.card.lift` for clickable cards. Add `.reveal` for the entrance |
| Layout | `.stack`, `.g2` `.g3` `.g4`, `.split` (2:1), `.split-l` (280 px rail + rest), `.layout` + `.main` + `.side` (Home), `.sec-t` section title |
| Page header | `.page-h`, `.toolbar` (`.sp` spacer) |
| Type | `.t1` `.t2` `.t3`, `.label`, `.micro`, `.data`, `.muted`, `.dim`, `.up`, `.dn`, `.bignum` |
| Buttons | `.btn`, `.btn-primary`, `.btn-quiet`, `.btn-sm`, `.btn.is-on`, `.iconbtn`, `.linkish` |
| Toggles | `.seg` with `button[data-v][aria-pressed]` + `ML.initSeg`; underline `.tabs` with `.tab[data-v]` + `ML.initTabs`; sibling `.panel[data-v]` + `ML.showPanel(container, v, dir)` |
| Chips and inputs | `.chips` `.chip[aria-pressed]`, `.select`, `.field`, `label.fld`, `input.rng` |
| Data table | `div.dt-wrap > table.dt`; numbers right-aligned by default, first column left, `.l` left, `.c` centre; `th[data-sort="num"|"text"]` + `ML.sortable(table)`; `tr.is-sel`; `tfoot` for totals |
| Statement table | `table.fin` (see `stock.js`) |
| Ticker | `ML.tk(id)` everywhere a ticker appears: it gives the link, hover card, right-click menu and drag |
| Price and change | `ML.pxHTML(id)` and `ML.chgHTML(id, {bare, abs})` (they tick live); `.chg.up` / `.chg.dn` chips for static changes |
| Rows of tickers | `ul.rows > li.row` (see `home.js`) |
| Badges and notes | `.badge`, `.badge-accent`, `.badge-sample`, `.badge-x`; `.band`, `.band.warn`, `.band.accent` (use `.band` for "Analyst consensus: third-party data, not a Market Lens forecast") |
| Key-value | `dl.kv` |
| Probability bar | `.pbar` with `--p` (0 to 1), `--lo`, `--hi`, `--b` (percent strings) and children `.fill`, `.band`, `.base`; add `.in` to animate the fill; `.pbar-l` for its caption (see the module cards in `stock.js`) |
| Range bar | `.rangebar` with `--p` + `.rangebar-l` |
| Meter | `.meter` (`.gain`, `.loss`) with `i` and `--v` |
| Charts | `.plot` (`.plot-sm`, `.plot-lg`) as the canvas host; `.lg` legend |
| Skeleton, empty | `.sk`, `.empty` |
| Side sheet | `ML.sheet(title, html, onOpen)` |
| Workspace link dots | `.ldot[data-g="a|b|c|d"]` |

## `window.ML` (from `mock.js`)

- Data: `ML.I[id]` → `{id, n (name), x (exchange), c (currency), p (price), pc (previous close), dp, sec, cty, h, mono, kind}`; `ML.LIST` (22 stocks), `ML.STRIP` (12 indexes and others), `ML.HOLD[id]` → `{q, cost}` (8 holdings), `ML.WATCH`, `ML.FX`, `ML.CCY`, `ML.pctOf(it)`, `ML.valueUSD(id)`, `ML.portfolio()` → `{total, prev, cost}`.
- Seeded randomness: `ML.rng(seed)`, `ML.hash(str)`, `ML.bridge(seedStr, n, from, to, vol)` (a random path), `ML.series(id, n, vol)` (previous close to price), `ML.resample(arr, n)`.
- Format: `ML.fmt(n, dp)`, `ML.fsign`, `ML.fpct`, `ML.fbig` (K, M, B, T), `ML.esc`, `ML.parseNum`.
- DOM: `ML.$`, `ML.$$`, `ML.el(tag, cls, html)`, `ML.icon(name, cls)` (names are the keys of `ICONS` in `mock.js`), `ML.toast(msg)`, `ML.observeReveal(scope)` (call after inserting `.reveal` nodes).
- Charts: `new ML.AreaChart(host, {label, fmt})` then `.set(data, {base, labels:[{f,t}], tip:fn, mode:'draw'})` (draws in, morphs on later `.set`, crosshair); `ML.spark(canvas, arr, {w, h, fill, base, color})`; `ML.lines(host, [{data, color, lw, dash, alpha, fill}], {fmt, labels, zero, axis})`; `ML.bars(host, values, {labels, color, signed, fmt, values})`; `ML.fitCanvas(canvas, w, h)` → 2D context scaled for the device; `ML.COL` (token colours by name, e.g. `ML.COL.accent`, `ML.COL['text-3']`, `ML.COL['data-2']`), `ML.rgba(hex, a)`. Redraw custom canvases on the `ml:paint` document event (theme or accent change) and on resize.
- Motion: `ML.rm()`, `ML.compact()`, `ML.tween(ms, fn(u), ease, done)`, `ML.springTo('snappy'|'smooth'|'gentle'|'elastic', fn(u), done)`, `ML.easeOut`.
- Live ticks: `ML.onTick(function (it, prev) {…})`; `ML.bindRoll(id, node, fmtFn)` for rolling digits.
- Events: `ml:pref` (a setting changed), `ml:paint` (colours changed), `ml:drop` (`detail {sym, zone}` when a ticker is dropped on `[data-drop="zone"]`), `ml:watch` (`detail sym`).

## Stock page tabs

`stock.js` renders Summary and Financials. Every other tab is registered from a `stock-tabs-*.js` file (already linked in `stock.html`, with a matching `.css`):

```js
ML.stockTab('holders', function (host, ctx) {
  host.innerHTML = '…';            // host is the visible, empty tab panel
  return { show: function () {} }; // optional: called every time the tab is shown (replay an entrance, resize a canvas)
});
```

Tab names: `chart`, `statistics`, `historical`, `analysis`, `holders`, `options`, `earnings`, `profile`, `deepdive`, `drawdown`, `news`, `stress`, `position`, `track`.

`ctx` gives: `id`, `it` (the instrument), `held` (`{q, cost}` or undefined), `cur` (currency symbol), `HI52`, `LO52`, `PE`, `eps`, `shares` (millions), `div` (quarterly dividend), `K` (size multiplier), `DATA.restated[key].a` (5 fiscal years, oldest first) and `.q` (8 quarters) for keys such as `rev`, `gp`, `oi`, `ni`, `eps`, `sh`, `cfo`, `fcf`, `capex`, `debt`, `cash`, `ta`, `tl`, `eq`; `STMT`, `YEARS`, `QTRS`; `ranges[range]()` → `{d, base, tip}` price paths for `1D 5D 1M 6M YTD 1Y 5Y Max`; `path(seed, n, points, vol)`, `spanTip(days, mode)`, `labels(tip)`, `nz(seed)` (seeded value in -1..1), `NOW`, `MON`, `go(tabName)`.

The sample story for every stock: it peaked in July, is down 27% from its 52-week high, and about two thirds of the fall is company-specific. Keep new tabs consistent with that and with the module cards on Summary (drawdown: 58%, 80% interval 41 to 72%, baseline 49%, labelled industry-level base rate; credibility 71%, interval 58 to 82%, 24 claims, sector 64%; three material filing changes).
