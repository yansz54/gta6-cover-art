// Neon Coast Cover Studio — the entry program (Node 22, standard library only).
//
// v3: the cover lettering is drawn by the procedural bitmap font in
// app/src/cover.js — the app ships no font files at all, so every
// counted file is written by the recorded build session.
//
// The app is plain static files under app/ beside this file. This program
// hands it in: it copies app/ and screenshots/ into the output directory
// and writes /output/dossier.json, the summary the judge reads, using the
// kit's vendored library. It runs twice in the grader and both runs must
// write the same bytes, so it copies and summarises and nothing else.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps, as the kit's own gate reads them: at most 4 screenshots
// of 256 KiB each, app/ within 993 files and 48 MiB, and the dossier text
// capped at 160 KiB. The library below enforces them while it writes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
