# gta6-cover-art
[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/yansz54/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/yansz54/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Neon Coast Cover Studio** — turn any photo into GTA 6-style multi-panel cover art, in your browser, offline, free. No upload, no watermark, no account.

## What it does

- **Six cover layouts** — Hero Strip (hero panel over a sunset title band and a three-panel strip), Vice Grid (a 3×3 grid with the title block at its centre), Full Bleed, Split Duo, Film Strip and Tilted Trio.
- **Six gradient-map grades** — Sunset, Neon Nights, Vice, Noir and Palm Gold, plus the signature grade **Vice Ink**: deep blacks, a posterised sunset gradient, halftone dots in the shadows and a neon accent.
- **Real poster lettering** — a large Anton title with a halftone-dot treatment and a warm-to-neon gradient fill, a Pacifico script subtitle, a Bebas Neue eyebrow and a Launch Week ribbon, over a sunset sky with a slatted sun and palm silhouettes.
- **Any photo, per panel** — add your own photos, or use the two built-in samples. Click a panel to select it, drag to move the photo, scroll to zoom, double-click to swap it. Sliders for zoom and position too.
- **One-click export** — PNG in 1080 × 1080, 1080 × 1350 (story) and 1920 × 1080 (wide), one size at a time or all three at once.
- **Undo / redo** — every change is on a 50-step history stack.
- **Film grain & vignette** — the print finish, toggleable.

## Run it

No build, no install. Serve the `app/` folder any static way and open it:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` straight from disk — everything (fonts, samples, scripts) is vendored, so it works offline.

## How it works

`app/src/cover.js` is the cover engine: it draws the sunset sky, grades each photo through a 256-entry gradient-map lookup table, lays the panels out, inks the halftone title block and adds grain and vignette — all on canvas 2D. `app/src/main.js` is the editor (state, history, gestures, export). `app/src/shots.js` renders fixed scenes for the screenshots. Fonts are Anton, Pacifico and Bebas Neue under the SIL Open Font License (texts beside them in `app/fonts/`). The two sample photos were made with an image model for make.fun and show no real person.

## Entry

Built for the [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) bounty on make.fun. `main.ts` (Node 22) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's library.

<sub>Entered on [make.fun](https://make.fun/?ref=djwcs0np&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
