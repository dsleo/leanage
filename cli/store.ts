import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { LocalGraph, type FlagsLegend, type StoreMeta } from '../src/localGraph'

export const DEFAULT_STORE = 'https://huggingface.co/datasets/dsleo/leanage-mathlib-store/resolve/a8434c821ffa646e896e1f9b7b7f37ca71acb339'
const FILES = ['names.txt', 'modules.txt', 'node_module.u32', 'degrees.vbyte', 'targets.vbyte', 'meta.json']

const unzip = (b: Buffer): Buffer => (b.length > 1 && b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b)

async function cacheDir(url: string): Promise<string> {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')
  const dir = join(base, 'leanage', createHash('sha256').update(url).digest('hex').slice(0, 16))
  await mkdir(dir, { recursive: true })
  return dir
}

// Returns the raw (possibly gzipped) bytes of one store file, from a directory or the URL cache.
async function readStoreFile(spec: string, file: string, dir?: string): Promise<Buffer> {
  if (!/^https?:\/\//.test(spec)) {
    for (const f of [`${file}.gz`, file]) if (existsSync(join(spec, f))) return readFile(join(spec, f))
    throw new Error(`Store file ${file}(.gz) not found in ${spec}`)
  }
  const cached = join(dir!, `${file}.gz`)
  if (existsSync(cached)) return readFile(cached)
  const url = `${spec.replace(/\/+$/, '')}/${file}.gz`
  process.stderr.write(`Downloading ${file}.gz ...\n`)
  let res = await fetch(url)
  if (res.status === 404) res = await fetch(url.slice(0, -3)) // meta.json is published uncompressed
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  await writeFile(cached + '.part', bytes)
  await (await import('node:fs/promises')).rename(cached + '.part', cached)
  return bytes
}

export async function loadStore(spec: string): Promise<LocalGraph> {
  const dir = /^https?:\/\//.test(spec) ? await cacheDir(spec) : undefined
  const [names, modules, nodeModule, degrees, targets, meta] = await Promise.all(FILES.map(async (f) => unzip(await readStoreFile(spec, f, dir))))
  const text = (b: Buffer) => b.toString('utf8')
  const graph = new LocalGraph({
    names: text(names), modules: text(modules),
    nodeModule: new Uint8Array(nodeModule), degrees: new Uint8Array(degrees), targets: new Uint8Array(targets),
    meta: JSON.parse(text(meta)) as StoreMeta,
  })
  try { // optional: stores without flags.* cannot hide instances and coercions
    const [bytes, legend] = await Promise.all(['flags.u8', 'flags.json'].map(async (f) => unzip(await readStoreFile(spec, f, dir))))
    graph.setFlags(new Uint8Array(bytes), JSON.parse(text(legend)) as FlagsLegend)
  } catch { /* no flags */ }
  return graph
}
