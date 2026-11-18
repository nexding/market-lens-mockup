# Look-and-feel mockup (milestone M5)

A static mockup for judging the design direction before anything is built on it. No build step, no network requests, no real data: every number, story and forecast is invented.

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

**Mind map**
- It grows in from the first event. Replay runs it again.
- Hover a node to light its chain of causes and effects. Click to zoom in and open the panel. Drag a node and let go. Double-click (or the Fold button) to fold a node's effects.
- The timeline slider and its play button; the holding filter; Particles; Parallax; Table view; Export image.
- "60 nodes" adds invented companies to check the frame rate, shown top right.
- Keyboard: Tab to the map, arrow keys follow links, Enter opens, Space folds, Escape closes, `+` `-` `0` zoom and fit.

## Files

| File | Holds |
|---|---|
| `tokens.css` | Design tokens: colours for both themes, type, spacing for both densities, radii, shadows, blur, motion |
| `app.css` | Shell and components |
| `mock.js` | Sample data, simulated ticks, chart and sparkline drawing, rolling digits, palette, menus, hover cards, tabs |
| `home.js`, `stock.js`, `mindmap.js` | Page behaviour. `mindmap.js` is the Canvas renderer with its own spring physics |
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
- Frame rate has only been checked in an automated browser, not on a physical display.
