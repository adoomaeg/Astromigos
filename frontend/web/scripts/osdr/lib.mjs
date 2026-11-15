// Shared helpers for the OSDR discovery and import scripts.
// Downloaded content is treated as untrusted data: it is only hashed and parsed as text,
// never executed or evaluated.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
export const WEB_DIR = resolve(SCRIPT_DIR, '..', '..')
export const REPO_DIR = resolve(WEB_DIR, '..', '..')
export const DATA_DIR = resolve(REPO_DIR, 'data')

export const OSDR_BASE = 'https://osdr.nasa.gov'
export const ALLOWED_HOSTS = new Set(['osdr.nasa.gov', 'visualization.osdr.nasa.gov', 'api.nasa.gov', 'science.nasa.gov', 'www.nasa.gov'])

/**
 * OSDR file downloads (osdr.nasa.gov/geode-py/ws/studies/<OSD>/download) answer with a redirect to the
 * GeneLab/ALSDA storage bucket. That host is accepted only as a redirect target issued by osdr.nasa.gov,
 * never as a starting URL.
 */
export const OSDR_REDIRECT_HOSTS = new Set(['genelab-alsda-repo-prod.s3.amazonaws.com'])

const UA = 'AHI-data-import/1.0 (hackathon research prototype)'

function assertAllowed(url, { redirectFromOsdr = false } = {}) {
  const u = new URL(url)
  const ok = u.protocol === 'https:' && (ALLOWED_HOSTS.has(u.hostname) || (redirectFromOsdr && OSDR_REDIRECT_HOSTS.has(u.hostname)))
  if (!ok) throw new Error(`Refusing to contact host: ${u.hostname}`)
}

/** GET with a timeout. Redirects are followed manually and only within the allow list. */
export async function httpGet(url, { timeoutMs = 60000 } = {}) {
  assertAllowed(url)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let current = url
    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(current, { headers: { 'User-Agent': UA }, signal: ctrl.signal, redirect: 'manual' })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location'), current).toString()
        assertAllowed(next, { redirectFromOsdr: new URL(current).hostname === 'osdr.nasa.gov' })
        current = next
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${current}`)
      return Buffer.from(await res.arrayBuffer())
    }
    throw new Error(`Too many redirects for ${url}`)
  } finally {
    clearTimeout(timer)
  }
}

export async function getJson(url) {
  return JSON.parse((await httpGet(url)).toString('utf8'))
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

export async function writeOut(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

export function json(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). Strips a UTF-8 BOM. */
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows = []
  let row = []
  let field = ''
  let i = 0
  let quoted = false
  while (i < src.length) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      quoted = true
      i++
    } else if (c === ',') {
      row.push(field)
      field = ''
      i++
    } else if (c === '\r') {
      i++
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else {
      field += c
      i++
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/** Strict numeric parse: returns null for anything that is not a plain decimal number. */
export function num(s) {
  const t = String(s ?? '').trim()
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
