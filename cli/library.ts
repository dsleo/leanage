import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { parseLibraryTsv } from '../src/library'
import type { LocalGraph } from '../src/localGraph'

declare const __EXTRACTOR__: string | undefined // injected by cli/build.mjs; in dev the script is read from the repo
const extractor = () => (typeof __EXTRACTOR__ !== 'undefined' ? __EXTRACTOR__ : readFileSync(new URL('../scripts/extract_library.lean', import.meta.url), 'utf8'))

const SKIP = new Set(['.lake', '.git', 'node_modules'])

function walk(dir: string, ext: string, skip: Set<string> = new Set()): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (skip.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p, ext, skip))
    else if (e.endsWith(ext)) out.push(p)
  }
  return out
}

/** Modules the project itself has built (its .olean files), so only importable modules are listed and srcDir settings do not matter. */
export function builtModules(project: string): string[] {
  for (const base of [join(project, '.lake', 'build', 'lib', 'lean'), join(project, '.lake', 'build', 'lib'), join(project, 'build', 'lib')]) {
    if (!existsSync(base)) continue
    const mods = walk(base, '.olean').map((f) => relative(base, f).slice(0, -6).split(/[\\/]/).join('.'))
    if (mods.length) return mods.sort()
  }
  return []
}

/** Source file (relative to the project) of each built module, found by path suffix; modules with no matching file are left out. */
export function moduleFiles(project: string, modules: string[]): [string, string][] {
  const files = walk(project, '.lean', SKIP).map((f) => relative(project, f).split(/[\\/]/).join('/'))
  const out: [string, string][] = []
  for (const m of modules) {
    const tail = m.split('.').join('/') + '.lean'
    const f = files.find((x) => x === tail || x.endsWith('/' + tail))
    if (f) out.push([m, f])
  }
  return out
}

/** Built modules whose source file lies under `dir` (matched by path suffix, since a Lake srcDir shortens the module path). */
export function modulesUnder(project: string, dir: string, modules: string[]): string[] {
  const files = walk(resolve(dir), '.lean', SKIP).map((f) => relative(project, f).slice(0, -5).split(/[\\/]/).join('/'))
  return modules.filter((m) => files.some((f) => f === m.split('.').join('/') || f.endsWith('/' + m.split('.').join('/'))))
}

export function manifestMathlibCommit(project: string): string | undefined {
  try {
    const m = JSON.parse(readFileSync(join(project, 'lake-manifest.json'), 'utf8')) as { packages?: { name: string; rev?: string }[] }
    return m.packages?.find((p) => p.name === 'mathlib')?.rev
  } catch { return undefined }
}

export const libraryFile = (project: string) => join(project, '.leanage', 'library.tsv')

/**
 * Runs the Lean extractor inside `project` over every module the project has built, so references between its parts always resolve.
 * `dir` only marks the modules of interest (`# focus` header): libs and report list those, the rest stays in the graph.
 */
export function indexLibrary(project: string, dir: string | undefined): { file: string; modules: number; focus?: number; err?: string } {
  const proj = resolve(project)
  if (!existsSync(join(proj, 'lakefile.toml')) && !existsSync(join(proj, 'lakefile.lean'))) return { file: '', modules: 0, err: `${proj} is not a Lake project (no lakefile.toml or lakefile.lean)\n` }
  const mods = builtModules(proj)
  if (!mods.length) return { file: '', modules: 0, err: 'No built modules found (.lake/build/lib/lean). Run lake build first.\n' }
  const focus = dir ? modulesUnder(proj, dir, mods) : undefined
  if (focus && !focus.length) return { file: '', modules: 0, err: `No built module has its source under ${dir}\n` }
  const script = join(tmpdir(), `leanage-extract-${process.pid}.lean`)
  writeFileSync(script, extractor())
  const file = libraryFile(proj)
  mkdirSync(join(proj, '.leanage'), { recursive: true })
  const raw = file + '.raw'
  const list = join(tmpdir(), `leanage-modules-${process.pid}.txt`)
  writeFileSync(list, mods.join('\n')) // `@file` keeps a big project's module list under the argument-length limit
  let modArgs = mods
  if (mods.length > 2000) { const list = join(tmpdir(), `leanage-modules-${process.pid}.txt`); writeFileSync(list, mods.join('\n')); modArgs = ['@' + list] } // a command line holds ~1 MB on macOS
  const r = spawnSync('lake', ['env', 'lean', '--run', script, raw, ...modArgs], { cwd: proj, stdio: ['ignore', 'inherit', 'inherit'] })
  if (r.error) return { file, modules: mods.length, err: `Could not run lake: ${r.error.message}. Install Lean (https://lean-lang.org/install) and build the project first.\n` }
  if (r.status !== 0) return { file, modules: mods.length, err: 'The Lean extraction failed. Build the project first (lake build) so the modules have .olean files.\n' }
  const commit = manifestMathlibCommit(proj)
  const files = moduleFiles(proj, mods).map(([m, f]) => `# file ${m} ${f}\n`).join('')
  writeFileSync(file, (commit ? `# mathlib ${commit}\n` : '') + files + (focus ? `# focus ${focus.join(',')}\n` : '') + readFileSync(raw, 'utf8'))
  return { file, modules: mods.length, focus: focus?.length }
}

/** Adds the library at `spec` (a project directory or a library.tsv) to `graph`; returns warnings for stderr. */
export function loadLibrary(graph: LocalGraph, spec: string): string[] {
  const file = spec.endsWith('.tsv') ? spec : libraryFile(spec)
  if (!existsSync(file)) throw new Error(`No library index at ${file}. Run: leanage index ${spec}`)
  const lib = parseLibraryTsv(readFileSync(file, 'utf8'))
  const warnings: string[] = []
  const base = graph.meta.mathlib_commit
  if (lib.mathlibCommit && base && !lib.mathlibCommit.startsWith(base.slice(0, 7)) && !base.startsWith(lib.mathlibCommit.slice(0, 7)))
    warnings.push(`warning: the library was built against Mathlib ${lib.mathlibCommit.slice(0, 7)} but the store is ${base.slice(0, 7)}; some references may not resolve\n`)
  graph.extend(lib.decls)
  if (lib.focus) graph.libraryFocus = new Set(lib.focus)
  graph.libraryFiles = lib.files
  graph.libraryRoot = spec.endsWith('.tsv') ? undefined : resolve(spec)
  if (graph.libraryUnresolved) warnings.push(`note: ${graph.libraryUnresolved} referenced names are not in the Mathlib store and were skipped (other packages, or another Mathlib version)\n`)
  return warnings
}
