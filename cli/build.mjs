// Bundles cli/leanage.ts (and the ../src modules it imports) into cli/dist/leanage.mjs, no runtime dependencies.
import { build } from 'esbuild'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'

const out = new URL('./dist/leanage.mjs', import.meta.url).pathname
await build({ entryPoints: [new URL('./leanage.ts', import.meta.url).pathname], bundle: true, platform: 'node', target: 'node18', format: 'esm', outfile: out, legalComments: 'none' })
const body = readFileSync(out, 'utf8').replace(/^#!.*\n/, '')
writeFileSync(out, `#!/usr/bin/env node\n${body}`)
chmodSync(out, 0o755)
