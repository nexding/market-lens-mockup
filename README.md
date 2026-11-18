# Look-and-feel mockup (milestone M5)

A static mockup for judging the design direction before anything is built on it. No build step, no network requests, no real data: every number, story and forecast is invented. The one exception to "no network requests" is the mind map's globe view, described below.

## Open it

Run the small server in this folder and open the address it prints:

```
python design/mockup/serve.py
```

then go to http://127.0.0.1:8765/home.html. The command is the same on Windows and macOS (use `python3` on macOS if `python` is not found). The server only listens on this computer and turns browser caching off, so edits always show.

Double-clicking `home.html` also works straight from disk, with one loss: the morph from a ticker into the stock page header. Browsers only run that page transition between pages on the same origin, and files opened from disk do not count.

## What to try

**Everywhere**
- The sliders button in the top bar: theme, density (Comfortable or Compact), accent colour, up and down colours, reduced motion.
- `Ctrl+K` for the command palette; `/` for search; start typing a ticker anywhere.
- Hover a ticker for its mini quote. Right-click a ticker for its menu (or `Shift+F10` when it has focus).
- Prices tick every two seconds: cells flash softly, large numbers roll.

**Home**
- Chart range buttons morph the line. Hover the chart for the crosshair.
- "Add" in My Holdings drops a new row in, rolls the total and resizes the allocation ring.
- Drag a ticker onto the Watchlist card.
- Movers tabs, the allocation ring's Stock, Sector and Country switch, the sector heatmap shifting colour.
- Settings has "Preview empty portfolio" for the empty state.

**Stock page** (`stock.html?s=NVDA`, or any ticker in the sample set)
- Summary: chart ranges, the statistics grid, the module cards with probability bars.
- Financials: statement, period and basis switches cross-fade the numbers; chevrons open line items; click a row for its mini chart; Growth %; CSV download.
- `[` and `]` step through tabs; a tab can be linked directly, for example `stock.html?s=NVDA#drawdown`.

**The other pages** (all in the nav row)
- Markets: eight sub-pages; select a table row to chart it; the Market regime page shows the crash model with its "Not beating the baseline" badge.
- Screener: edit, add and remove filters, the column chooser, row selection and the bulk bar.
- Compare: add and remove stocks (up to six), the rebased chart, best and worst marks, the currency switch.
- Calendars: five calendars, the week strip, the holdings and watchlist filters, the time-zone switch.
- My Portfolio: edit shares or cost in place, Add holding, the six tabs, the import walk-through, CSV exports.
- Watchlists: reorder rows by dragging the handle, drop a ticker to add it, the linked chart panel.
- My News: the digest, filters, the holdings sidebar that lights up, a story arriving after a few seconds.
- Tools: event study, stress test, track record.
- Workspace: link colours, selecting a ticker to load linked panels, dragging dividers, swapping panels, the three saved layouts.

**Every stock page tab** is built: Chart (candles, indicators, compare, drawing tools), Statistics, Historical Data, Analysis, Holders, Options, Earnings (with transcripts), Profile, Deep-dive, Drawdown check (with its animated sequence and Replay), News & mind map, Stress test, My position, Track record.

**Mind map** (`mindmap.html`)
- It opens as a globe: events and companies sit where they are, factors and sectors float in two shells above, and links are arcs. It grows in from the first event; Replay runs it again.
- Drag to turn, scroll or pinch to zoom, `−` `+` and Fit in the toolbar. It turns slowly by itself when idle; Rotate switches that off.
- Hover a node for its tooltip and to light its chain of causes and effects. Click to fly to it and open the panel, where its links are grouped by confidence tier with the ledger line for each. Double-click (or the Fold button) folds a node's effects.
- Solid, dashed and dotted lines are confirmed fact, model inference and speculative; thicker is more confident; particles run from cause to effect.
- The holding filter keeps only the chains that reach that holding and fits the view to them.
- The timeline slider and its play button; Particles; Parallax; Table view; Export image.
- "60 nodes" adds invented companies. `mindmap.html?stress=1` adds a "1,000 nodes" switch (1,000 nodes, 3,000 links) to check the frame rate, shown top right.
- Keyboard: Tab to the map, Right and Left follow effects and causes, Up and Down step through alternatives, Shift with an arrow key turns the globe, Enter opens, Space folds, Escape closes, `+` `-` `0` zoom and fit.
- `mindmap.html?view=flat` shows the earlier flat map. The page also falls back to it, with a notice, if the globe cannot start.

**The globe view uses the network.** It loads globe.gl 2.46.2 and three.js 0.185.1, a night photograph of the Earth and country borders from the jsDelivr CDN, at pinned versions (the list is at the top of `mindmap-globe.js`). Nothing about the page or the portfolio is sent anywhere; these are plain downloads. Offline, or with the CDN blocked, the flat map is shown instead.

## Files

| File | Holds |
|---|---|
| `tokens.css` | Design tokens: colours for both themes, type, spacing for both densities, radii, shadows, blur, motion |
| `app.css` | Shell and components |
| `mock.js` | Sample data, simulated ticks, chart and sparkline drawing, rolling digits, palette, menus, hover cards, tabs |
| `home.js`, `stock.js`, `mindmap.js` | Page behaviour. `mindmap.js` holds the mind map's data, panel, toolbar and keyboard, and the flat Canvas renderer with its own spring physics |
| `mindmap-globe.js`, `mindmap-geo.js`, `mindmap.css` | The mind map's globe view: the renderer, the placement maths (checked by `node design/mockup/mindmap-geo.test.js`) and the page's own styles |
| `stock-tabs-a` to `-d` (`.js`, `.css`) | The stock page tabs other than Summary and Financials |
| `markets`, `screener`, `compare`, `calendars`, `portfolio`, `watchlists`, `news`, `tools`, `workspace` (`.html`, `.js`, `.css`) | One page each |
| `serve.py` | The local server |
| `CONVENTIONS.md` | Rules and the shared classes and helpers, for adding a screen |
| `fonts/` | Inter variable font and its licence (SIL Open Font License 1.1) |

## Limits of a mockup

- Nothing here talks to the Market Lens backend.
- The invented data is not consistent everywhere. The stock page gives every company the same next earnings date (29 Jan 2027) while Home and Calendars show four reporting this week; market caps for a few low-priced tickers are implausibly large; Screener and Compare shape each company's figures differently from the stock page for every ticker except AAPL.
- Every "Open mind map" link opens the same whole-portfolio map.
- Logos are monogram tiles; no brand assets are used.
- The page morph needs the local server and a browser with cross-document view transitions.
- Frame rate has only been checked in an automated browser, not on a physical display. The globe held 120 frames a second there with 26, 62 and 1,000 nodes, on an Apple M3 Max at one device pixel per CSS pixel; nothing slower has been measured.
- The globe view has not been opened straight from disk (`file://`), only through the local server and GitHub Pages.
