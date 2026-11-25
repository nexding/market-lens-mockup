# Look-and-feel mockup (milestone M5)

A static mockup for judging the design direction before anything is built on it. No build step, no network requests, no real data: every number, story and forecast is invented. There are two exceptions, both described below: the mind map's globe view loads its libraries from a CDN, and the Event Map loads its libraries from a CDN and shows real, sourced events.

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

**Mind map** (`mindmap.html`, no longer in the nav row; the "Open mind map" links on the stock page, My News and Workspace still lead here)
- It opens as a globe: events and companies sit where they are, factors and sectors float in two shells above, and links are arcs. It grows in from the first event; Replay (under More) runs it again.
- Drag to turn, scroll or pinch to zoom, Fit, `−` and `+` in the top bar. It turns slowly by itself when idle; Rotate switches that off.
- Links are green when they raise the next step and red when they lower it. Solid, dashed and dotted lines are confirmed fact, model inference and speculative; thicker is more confident; particles run from cause to effect. The Key, bottom left, folds away.
- Hover a node for its tooltip and to light its chain of causes and effects; the chain's links show + or −. Click to fly to it and open its details in the sidebar: summary, causal chain with sign and confidence per step, portfolio exposure, the ledger entry, news and every link by confidence tier. Back returns to the lists. Double-click (or the Fold button) folds a node's effects.
- The top bar shows how fresh the sample data is, the events and sources on show and whether the US market is open.
- Layer tabs over the map (Macro & rates, Earnings, Commodities & energy, FX, Geopolitics, Predictions) keep one layer's nodes and fade the rest of their chains. The holding filter keeps only the chains that reach one holding and fits the view to them. Both can be combined.
- The sidebar lists what is moving markets now and the active events, with search, status filters and three sorts. Drag its edge to resize it, or fold it to a rail. On a phone it is a sheet that opens from the bottom.
- "Your holdings" floats over the map with prices that tick, day change and a line since the close. Drag it by its title, close it, and bring it back from More.
- The timeline slider and its play button; Particles; Parallax; Table and Export image (under More).
- "60 nodes" (under More) adds invented companies. `mindmap.html?stress=1` adds a "1,000 nodes" switch (1,000 nodes, 3,000 links) to check the frame rate, shown top right.
- Keyboard: Tab to the map, Right and Left follow effects and causes, Up and Down step through alternatives, Shift with an arrow key turns the globe, Enter opens, Space folds, Escape closes, `+` `-` `0` zoom and fit.
- `mindmap.html?view=flat` shows the earlier flat map. The page also falls back to it, with a notice, if the globe cannot start.

**The globe view uses the network.** It loads globe.gl 2.46.2 and three.js 0.185.1, a night photograph of the Earth and country borders from the jsDelivr CDN, at pinned versions, and on desktops a sharper night photograph (NASA Black Marble 2016, 8.1 MB) from NASA's own site (the list is at the top of `mindmap-globe.js`). Nothing about the page or the portfolio is sent anywhere; these are plain downloads. Offline, or with the CDN blocked, the flat map is shown instead.

## Event Map

`eventmap.html` is the nav row's **Event Map**: 53 real market events from February 2020 to November 2026, joined by 80 cause-and-effect links into one connected web, each with its market reaction and sources. Unlike the rest of the mockup, these events, dates, figures and sources are real. Only the "Your holdings touched" moves are sample numbers, and they are labelled as such.

**Open it.** The page uses ES modules and loads its data with `fetch`, and browsers allow neither for a file opened straight from disk (`file://`). Serve the folder with either of these, then open the page:

```
python design/mockup/serve.py        # then http://127.0.0.1:8765/eventmap.html
npx serve design/mockup              # then the address it prints, plus /eventmap.html
```

**What to try**
- The sphere: latitude is time (2020 near the top, now near the bottom), and each of the six wedges of longitude is one category. Drag to turn it, scroll or pinch to zoom. It turns slowly by itself and stops while you use it; it starts again after 8 seconds idle. With reduced motion on (system setting or the settings panel) it does not turn and nothing animates.
- Click an event: the sphere turns it to face you. Everything that led to it lights amber, everything it set off lights cyan, and the rest dims. The panel shows the summary, the market reaction, "What led here" and "What it set off" (each one selects that event), and the sources. Solid lines are direct causes and dashed lines contributing ones; arrowheads point at the effect.
- Hover an event for its name, or a line for the mechanism that links the two events.
- Search finds events by title and forgives typos ("crdt suise" finds Credit Suisse). The category chips and the region list hide events and their links; Reset view clears everything.
- Sphere | Timeline switches to a 2D view with time across and one lane per category. Selection and filters carry over. Scroll or drag to zoom and pan along time.
- Events touching a holding in `ML.HOLD` (NVDA, SHEL.L, HSBA.L and others) show "Your holdings touched", with sample moves.
- The address follows the selection (`eventmap.html#svb-failure`), so a link opens on that event. `?view=timeline` opens the timeline.
- On a phone the panel is a sheet: drag its handle, or tap it to step between peek, half and full height. The sphere centres in the space above it.
- For keyboards and screen readers, a list of every event in time order sits just after the map. It is hidden until it has focus, then arrow keys move through it, Enter selects and Escape clears.
- `?stress=1` replaces the data with an invented 200-event, 400-link graph and shows the frame rate. `?debug=1` exposes `window.__em` for checks. If the frame rate stays under 30 fps, the sphere drops detail in steps (pixel ratio, arc segments, then minor events above 120 nodes) and says so in the corner.

**The page uses the network.** It loads three.js 0.160.0 (as ES modules through an import map: `three.module.js`, OrbitControls, CSS2DRenderer and the fat-line addons) and, when the timeline first opens, D3 7.9.0. Both come from jsDelivr at pinned versions, with integrity hashes in the page. If WebGL is off or three.js cannot load, the page falls back to the timeline and says why. The source links in the panel go to the publishers' sites.

### Adding events and links

The data is in `data/`:

| File | Holds |
|---|---|
| `events.json` | One object per event, oldest first |
| `links.json` | One object per cause-and-effect link |
| `evidence.json` | For each event, the exact quotes from its sources that back every date and figure. The page does not load it; it is the audit trail |
| `holding-moves.sample.json` | Sample percentage moves of held tickers per event. Invented |

An event:

```jsonc
{
  "id": "svb-failure",                       // lower-case words joined by hyphens, unique
  "title": "Silicon Valley Bank fails",
  "date": "2023-03",                          // YYYY-MM; the latitude on the sphere
  "day": 10,                                  // optional, 1 to 31; orders events within a month
  "category": "Credit & Crypto",              // Geopolitical | Energy & Supply | Fiscal & Inflation | Monetary | Credit & Crypto | Tech
  "regions": ["United States", "United Kingdom"],  // from: Global, United States, Europe, United Kingdom, China, Japan,
                                              //   Russia & Ukraine, Middle East, Asia-Pacific, Switzerland
  "summary": "One or two sentences.",
  "market_reaction": { "headline": "The main move, in words", "assets": [{ "asset": "KBW Bank Index", "move": "−25%", "window": "Mar 2023" }] },
  "tickers": ["JPM", "HSBA.L"],               // use the mockup's IDs (ML.I) so holdings match
  "sources": ["https://…"]
}
```

A link: `{ "from": "fed-hikes-begin", "to": "svb-failure", "type": "direct", "mechanism": "One line on how the cause led to the effect." }`. The type is `direct` or `contributing`.

Rules for new entries:
- Every date and figure must come from a source you have read, and its exact words go in `evidence.json` as `{ "claim", "url", "quote" }`. If no source confirms a figure, leave it out: list the asset without a `move`.
- Use the true minus sign (−) and a + on gains.
- Link each new event to at least one other, and to every event it fed. The map must stay one connected web, and a cause cannot be dated after its effect.

Then run the checks:

```
node --test design/mockup/eventmap/tests/*.test.mjs        # data rules, layout, arcs, graph, search
python design/mockup/eventmap/tools/check_sources.py       # every source answers; every quote is on its page
```

The page itself also checks the data as it loads. Problems show in the browser console ("[event map data] …"): dangling ids, an effect dated before its cause, isolated events, duplicate links and more than one connected part.

The source checker reads web pages with the Python standard library; with `pypdf` installed it also reads PDFs. Some publishers refuse automated requests (BLS and CBO answer 403), and those quotes are listed as "not checked" for reading by hand. Live pages change: Wikipedia articles and the BBC live blog behind the 2026 events may reword a quote later, and the checker will then flag it.

## Files

| File | Holds |
|---|---|
| `tokens.css` | Design tokens: colours for both themes, type, spacing for both densities, radii, shadows, blur, motion |
| `app.css` | Shell and components |
| `mock.js` | Sample data, simulated ticks, chart and sparkline drawing, rolling digits, palette, menus, hover cards, tabs |
| `home.js`, `stock.js`, `mindmap.js` | Page behaviour. `mindmap.js` holds the mind map's data, panel, toolbar and keyboard, and the flat Canvas renderer with its own spring physics |
| `mindmap-globe.js`, `mindmap-geo.js`, `mindmap-dash.js`, `mindmap.css` | The mind map's globe view: the renderer, the placement maths (checked by `node design/mockup/mindmap-geo.test.js`), the dashboard around the map (status line, layer tabs, key, More menu, sidebar, holdings panel) and the page's own styles |
| `eventmap.html`, `eventmap.css`, `eventmap/` | The Event Map: page, styles and its ES modules (`main.js` wiring, `data.js` loading and checks, `graph.js`, `layout.js` placement on the sphere, `arcs.js`, `sphere.js` the three.js view, `timeline.js` the D3 view, `panel.js`, `controls.js`, `a11y.js` the event list, `holdings.js`, `fuzzy.js`, `store.js`, `stress.js`), its tests in `eventmap/tests/` and the source checker in `eventmap/tools/`. Leave `tests/` and `tools/` out of the Pages copy |
| `data/` | The Event Map's events, links, evidence quotes and sample holding moves |
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
- The Event Map's frame rate was measured only in headless Chrome on an Apple M3 Max: the 200-event, 400-link stress graph held 60 frames a second (the display's limit) at one and two device pixels per CSS pixel, and also with the processor slowed fourfold. Nothing slower has been measured, and touch has only been tried in a phone-sized emulated browser, not on a real phone.
