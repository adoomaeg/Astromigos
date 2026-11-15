import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const dist = resolve('dist')
const base = process.env.VITE_BASE_PATH || '/'
assert(base.startsWith('/') && base.endsWith('/'), 'VITE_BASE_PATH must start and end with a slash')
const html = await readFile(resolve(dist, 'index.html'), 'utf8')
const urls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((url) => !/^(?:https?:)?\/\//.test(url))
assert(urls.length > 0, 'No built asset references found')
for (const url of urls) {
  assert(url.startsWith(base), `Built reference ignores the deployment path: ${url}`)
  const file = resolve(dist, url.slice(base.length).split(/[?#]/)[0])
  assert(!relative(dist, file).startsWith('..'), 'Asset must remain inside dist')
  await access(file)
}
for (const asset of ['nasa-logo.svg', 'astromigos-logo.jpeg', 'crew/reid-wiseman.jpg', 'crew/victor-glover.jpg', 'crew/christina-koch.jpg', 'crew/jeremy-hansen.jpg', 'anatomy/LICENSE.md']) await access(resolve(dist, asset))
const manifest = JSON.parse(await readFile(resolve(dist, 'anatomy/manifest.json'), 'utf8'))
assert(manifest.systems?.length && manifest.structures?.length, 'Anatomy manifest is incomplete')
for (const system of manifest.systems) if (system.file) await access(resolve(dist, 'anatomy', system.file))
console.log(`Verified HTML assets, logos, four portraits and anatomy files under ${base}`)
