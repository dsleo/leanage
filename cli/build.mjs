// Bundles cli/leanage.ts (and the ../src modules it imports) into cli/dist/leanage.mjs, no runtime dependencies.
import { build } from 'esbuild'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'

// The webapp's CMU fonts, inlined as base64 so the report stays a single file.
const fonts = [['CMU Serif', 'cmu-serif'], ['CMU Sans', 'cmu-sans'], ['CMU Typewriter', 'cmu-typewriter']]
  .map(([n, f]) => `@font-face{font-family:'${n}';font-weight:400 700;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(new URL(`../public/fonts/${f}.woff2`, import.meta.url)).toString('base64')}) format('woff2')}`).join('')
const out = new URL('./dist/leanage.mjs', import.meta.url).pathname
await build({ entryPoints: [new URL('./leanage.ts', import.meta.url).pathname], bundle: true, platform: 'node', target: 'node18', format: 'esm', outfile: out, legalComments: 'none', define: { __REPORT_FONTS__: JSON.stringify(fonts), __EXTRACTOR__: JSON.stringify(readFileSync(new URL('../scripts/extract_library.lean', import.meta.url), 'utf8')) } })
const body = readFileSync(out, 'utf8').replace(/^#!.*\n/, '')
writeFileSync(out, `#!/usr/bin/env node\n${body}`)
chmodSync(out, 0o755)
