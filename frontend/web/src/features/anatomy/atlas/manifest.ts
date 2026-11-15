/** Loads and caches the anatomical atlas manifest (public/anatomy/manifest.json). No three.js here. */
import { useEffect, useState } from 'react'
import type { AtlasManifest, AtlasStructure, AtlasSystemFile, AnatomySystemId } from './types'

/** Base URL of the atlas assets, honoring the Vite base path. */
export const ATLAS_BASE_URL = `${import.meta.env.BASE_URL}anatomy/`

let cached: Promise<AtlasManifest> | null = null

function isManifest(v: unknown): v is AtlasManifest {
  const m = v as AtlasManifest
  return !!m && typeof m.version === 'number' && Array.isArray(m.systems) && Array.isArray(m.structures)
}

/** Fetches the manifest once per session. Rejects when it is missing or malformed. */
export function loadAtlasManifest(): Promise<AtlasManifest> {
  if (cached) return cached
  const p = fetch(`${ATLAS_BASE_URL}manifest.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Atlas manifest request failed (${r.status})`)
      return r.json() as Promise<unknown>
    })
    .then((json) => {
      if (!isManifest(json)) throw new Error('Atlas manifest is malformed')
      return json
    })
  cached = p
  p.catch(() => {
    if (cached === p) cached = null
  })
  return p
}

/** React access to the manifest: null while loading, error when the atlas is unavailable. */
export function useAtlasManifest(): { manifest: AtlasManifest | null; error: Error | null } {
  const [state, setState] = useState<{ manifest: AtlasManifest | null; error: Error | null }>({ manifest: null, error: null })
  useEffect(() => {
    let alive = true
    loadAtlasManifest()
      .then((manifest) => alive && setState({ manifest, error: null }))
      .catch((error: unknown) => alive && setState({ manifest: null, error: error instanceof Error ? error : new Error(String(error)) }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

export function systemFileUrl(file: AtlasSystemFile): string {
  return `${ATLAS_BASE_URL}${file.file}`
}

export function structureById(manifest: AtlasManifest, id: string | null | undefined): AtlasStructure | null {
  if (!id) return null
  return manifest.structures.find((s) => s.id === id) ?? null
}

export function structuresOfSystem(manifest: AtlasManifest, system: AnatomySystemId): AtlasStructure[] {
  return manifest.structures.filter((s) => s.system === system)
}
