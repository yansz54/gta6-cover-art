# gta6-cover-art
[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/yansz54/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/yansz54/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Neon Coast Cover Studio** — turn any photo into GTA 6-style multi-panel cover art, in your browser, offline, free. No upload, no watermark, no account.

## What it does

- **Six cover layouts** — Hero Strip (a hero panel over a three-panel strip), Vice Grid (a 2×2 grid), Full Bleed, Split Duo, Film Strip (five narrow frames) and Tilted Trio (three panels at a slight tilt).
- **Six colour grades** — Sunset, Neon Nights, Vice, Noir and Palm Gold, plus the signature grade **Vice Ink**: deep blacks, a posterised sunset gradient, heavy halftone dots in the shadows and a neon accent.
- **Procedural poster lettering** — every letter on a cover is drawn by the studio's own hand-authored 5×7 pixel alphabet in `app/src/cover.js`: a large gradient title with a dark outline and drop shadow over a halftone-dot backing, a wide-tracked eyebrow, a slanted subtitle and a Launch Week ribbon. No font files, no downloads, no Rockstar material.
- **Any photo, per panel** — add your own photos, or use the two built-in samples. Drag a panel to pan its photo, scroll over it to zoom, double-click two panels to swap them.
- **One-click export** — PNG in 1080 × 1080, 1080 × 1350 (story) and 1920 × 1080 (wide).
- **Shuffle, undo / redo** — a Shuffle button for a fresh random cover, and every change on a 50-step history stack.
- **Film grain & vignette** — the print finish, toggleable.

## Run it

No build, no install. Serve the `app/` folder any static way and open it:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` straight from disk — everything (samples, scripts) is vendored, so it works offline.

## How it works

`app/src/cover.js` is the cover engine: it draws the sunset sky with a slatted synthwave sun, a skyline with lit windows and palm silhouettes, grades each photo through the grade palette, lays the panels out, inks the halftone title block with the procedural bitmap font and adds grain and vignette — all on canvas 2D. `app/src/main.js` is the editor (state, history, gestures, export). `app/src/shots.js` renders fixed scenes for the screenshots. The two sample photos were made with an image model for make.fun and show no real person.

## Entry

Built for the [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) bounty on make.fun. `main.ts` (Node 22) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's library.

<sub>Entered on [make.fun](https://make.fun/?ref=djwcs0np&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
