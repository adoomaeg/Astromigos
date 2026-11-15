/**
 * AHI anatomy atlas: full asset build (`npm run anatomy:build`).
 *
 *   1. fetch-source.mjs   download Z-Anatomy.zip (pinned SHA-256), extract Startup.blend
 *   2. export_atlas.py    Blender, headless: group, decimate, re-orient, raw GLB per system
 *   3. build-kidneys.ts   AHI procedural kidneys (the upstream kidney model is not redistributable)
 *   4. optimize.mjs       meshopt compression, manifest.json
 *   5. validate.mjs       contract checks on the published files
 *   6. decode-for-preview.mjs + render_previews.py   optional preview sheets of the published files (--previews)
 *
 * Options (CLI or environment):
 *   --blender <path>   or BLENDER_BIN         Blender 4.5 LTS executable (required)
 *   --blend <path>     or ANATOMY_SOURCE_BLEND use an already extracted Startup.blend (skips step 1)
 *   --cache <dir>      or ANATOMY_CACHE_DIR    work folder (default: frontend/web/.cache/anatomy)
 *   --out <dir>                                output folder (default: frontend/web/public/anatomy)
 *   --skip-blender                             reuse the raw GLBs of the previous run
 *   --previews                                 also render preview sheets into <cache>/previews
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CACHE, fetchSource } from './fetch-source.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..', '..')

function parse() {
  const a = process.argv.slice(2)
  const o = { flags: new Set() }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--skip-blender' || a[i] === '--previews') o.flags.add(a[i])
    else if (a[i].startsWith('--')) o[a[i].slice(2)] = a[++i]
    else throw new Error(`Unknown argument ${a[i]}`)
  }
  return o
}

function run(title, cmd, args, opts = {}) {
  const t0 = Date.now()
  console.log(`\n=== ${title} ===`)
  const res = spawnSync(cmd, args, { stdio: opts.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', cwd: webRoot, encoding: 'utf8', maxBuffer: 1 << 28, shell: opts.shell ?? false })
  if (opts.quiet) {
    // Blender is verbose: keep only the pipeline lines and real errors
    const lines = `${res.stdout ?? ''}\n${res.stderr ?? ''}`.split(/\r?\n/)
    for (const l of lines) if (/\[(atlas|preview)\]|Traceback|Error:|^\s+File "/.test(l)) console.log(l)
  }
  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(`${title} failed with exit code ${res.status}`)
  console.log(`--- ${title}: ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}

async function main() {
  const o = parse()
  const cache = resolve(o.cache ?? process.env.ANATOMY_CACHE_DIR ?? DEFAULT_CACHE)
  const out = resolve(o.out ?? join(webRoot, 'public', 'anatomy'))
  const raw = join(cache, 'raw')
  mkdirSync(raw, { recursive: true })

  if (!o.flags.has('--skip-blender') || o.flags.has('--previews')) {
    const blender = o.blender ?? process.env.BLENDER_BIN
    if (!blender || !existsSync(blender)) {
      throw new Error('Blender not found. Pass --blender <path to blender executable> or set BLENDER_BIN (Blender 4.5 LTS).')
    }
    o.blender = blender
  }

  if (!o.flags.has('--skip-blender')) {
    const given = o.blend ?? process.env.ANATOMY_SOURCE_BLEND
    if (given && !existsSync(given)) throw new Error(`Source blend not found: ${given}`)
    console.log('\n=== 1/5 source ===')
    const blend = given ? resolve(given) : await fetchSource(cache)
    if (given) console.log(`[fetch] using ${blend}`)
    // --factory-startup and --disable-autoexec: user preferences and scripts embedded in the blend never run
    run('2/5 Blender export', o.blender, ['--background', '--factory-startup', '--disable-autoexec', blend, '--python', join(here, 'export_atlas.py'), '--', '--out', raw], { quiet: true })
  } else {
    console.log('\n=== 1/5 and 2/5 skipped: reusing ' + raw + ' ===')
    if (!existsSync(join(raw, 'atlas-meta.json'))) throw new Error('No raw export found: run once without --skip-blender')
  }

  const tsx = join(webRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  run('3/5 procedural kidneys', process.execPath, [tsx, join(here, 'build-kidneys.ts'), join(raw, 'kidneys.json')])
  run('4/5 optimize and manifest', process.execPath, [join(here, 'optimize.mjs'), '--raw', raw, '--out', out])
  run('5/5 validate', process.execPath, [join(here, 'validate.mjs'), out])

  if (o.flags.has('--previews')) {
    // previews are rendered from the published files (decoded copies), not from the raw export
    const previews = join(cache, 'previews')
    const decoded = join(cache, 'decoded')
    run('decode published files', process.execPath, [join(here, 'decode-for-preview.mjs'), out, decoded])
    run('previews', o.blender, ['--background', '--factory-startup', '--python', join(here, 'render_previews.py'), '--', '--dir', decoded, '--out', previews], { quiet: true })
    console.log(`Preview sheets: ${previews}`)
  }
  console.log(`\nAnatomy atlas written to ${out}`)
}

main().catch((e) => {
  console.error('\n[anatomy:build] ' + e.message)
  process.exit(1)
})
