/**
 * Downloads the Z-Anatomy source archive into the local cache, verifies its SHA-256 and extracts
 * Startup.blend. Nothing here is committed: the cache folder is ignored by git.
 *
 * Usage: node scripts/anatomy/fetch-source.mjs [--cache <dir>]
 * Prints the absolute path of the extracted blend on the last line.
 *
 * Only one host is ever contacted (raw.githubusercontent.com) and the file is rejected when the
 * checksum differs from the pinned one. The blend is treated as data: Blender is always started
 * with --disable-autoexec, so scripts embedded in the file never run.
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

export const SOURCE_URL = 'https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/Z-Anatomy.zip'
export const SOURCE_SHA256 = 'e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736'
export const SOURCE_BYTES = 86734957
const ALLOWED_HOST = 'raw.githubusercontent.com'
const BLEND_ENTRY = 'Z-Anatomy/Startup.blend'

const here = dirname(fileURLToPath(import.meta.url))
export const DEFAULT_CACHE = resolve(here, '..', '..', '.cache', 'anatomy')

async function sha256(path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

async function download(url, dest) {
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.hostname !== ALLOWED_HOST) throw new Error(`Refusing to download from ${u.hostname}: only ${ALLOWED_HOST} is allowed`)
  console.log(`[fetch] downloading ${url}`)
  const res = await fetch(u, { redirect: 'error', headers: { 'User-Agent': 'anatomy-asset-pipeline' } })
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`)
  const tmp = dest + '.part'
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp))
  renameSync(tmp, dest)
}

/** Minimal ZIP reader (stored and deflate entries, with ZIP64 sizes are not needed here). */
function extractEntry(zipPath, entryName, dest) {
  const buf = readFileSync(zipPath)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('ZIP end of central directory not found')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt ZIP central directory')
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    if (name === entryName) {
      if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Corrupt ZIP local header')
      const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28)
      const data = buf.subarray(start, start + compSize)
      const out = method === 0 ? data : method === 8 ? inflateRawSync(data) : null
      if (!out) throw new Error(`Unsupported ZIP compression method ${method}`)
      if (out.length !== size) throw new Error('ZIP entry size mismatch')
      writeFileSync(dest, out)
      return
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`${entryName} not found in the archive`)
}

export async function fetchSource(cacheDir = DEFAULT_CACHE) {
  const srcDir = join(cacheDir, 'source')
  mkdirSync(srcDir, { recursive: true })
  const zip = join(srcDir, 'Z-Anatomy.zip')
  const blendDir = join(srcDir, 'extracted')
  const blend = join(blendDir, 'Startup.blend')
  const stamp = join(blendDir, 'Startup.blend.sha256-of-zip')

  if (existsSync(blend) && existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === SOURCE_SHA256) {
    console.log(`[fetch] cached ${blend}`)
    return blend
  }
  if (!existsSync(zip) || statSync(zip).size !== SOURCE_BYTES) await download(SOURCE_URL, zip)
  const digest = await sha256(zip)
  if (digest !== SOURCE_SHA256) {
    rmSync(zip, { force: true })
    throw new Error(`Checksum mismatch for Z-Anatomy.zip: got ${digest}, expected ${SOURCE_SHA256}. The upstream file changed: review it and update the pinned hash (see docs/anatomy-assets.md).`)
  }
  console.log(`[fetch] sha256 ok ${digest}`)
  // the blend is extracted alone into its own empty folder (untrusted data, never executed)
  rmSync(blendDir, { recursive: true, force: true })
  mkdirSync(blendDir, { recursive: true })
  extractEntry(zip, BLEND_ENTRY, blend)
  writeFileSync(stamp, SOURCE_SHA256 + '\n')
  console.log(`[fetch] extracted ${blend} (${statSync(blend).size} bytes)`)
  return blend
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--cache')
  fetchSource(i > 0 ? resolve(process.argv[i + 1]) : DEFAULT_CACHE)
    .then((blend) => console.log(blend))
    .catch((e) => {
      console.error('[fetch] ' + e.message)
      process.exit(1)
    })
}
