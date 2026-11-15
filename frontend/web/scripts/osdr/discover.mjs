// OSDR data discovery (PROJECT_MASTER Etapa 0).
// Usage (inside frontend/web): node scripts/osdr/discover.mjs
// Queries the public OSDR search API for human related terms, keeps Homo sapiens studies,
// lists tabular files for a shortlist, and writes data/manifests/osdr-discovery.json.
import { resolve } from 'node:path'
import { DATA_DIR, OSDR_BASE, getJson, json, writeOut } from './lib.mjs'

const TERMS = [
  'human',
  'astronaut',
  'Inspiration4',
  'crew',
  'spaceflight',
  'physiology',
  'sleep',
  'cardiovascular',
  'immune',
  'blood',
  'Homo sapiens',
  'complete blood count',
  'metabolic panel',
  'cytokine',
]

// Studies whose file listings are inspected in detail (human, in-flight or crew related).
const SHORTLIST = ['OSD-569', 'OSD-575', 'OSD-656', 'OSD-571', 'OSD-570', 'OSD-53', 'OSD-903', 'OSD-530', 'OSD-353', 'OSD-359', 'OSD-542', 'OSD-140']

const TABULAR = /\.(csv|tsv|txt|xlsx)$/i

function str(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

async function main() {
  const startedAt = new Date().toISOString()
  const termCounts = {}
  const byAcc = new Map()
  for (const term of TERMS) {
    const url = `${OSDR_BASE}/osdr/data/search?${new URLSearchParams({ term, type: 'cgene', from: '0', size: '100' })}`
    const res = await getJson(url)
    termCounts[term] = res?.hits?.total ?? null
    for (const h of res?.hits?.hits ?? []) {
      const s = h._source ?? {}
      const acc = s.Accession
      if (!acc) continue
      const prev = byAcc.get(acc)
      if (prev) {
        prev.matched_terms.push(term)
        continue
      }
      byAcc.set(acc, {
        accession: acc,
        title: s['Study Title'] ?? null,
        organism: str(s.organism).replace(/\s+/g, ' ').trim() || null,
        mission: str(s.Mission?.Name ?? s['Flight Program']).trim() || null,
        assay_measurement_types: str(s['Study Assay Measurement Type']).replace(/\s{2,}/g, ' | ').trim() || null,
        release_date: s['Study Public Release Date'] ?? null,
        matched_terms: [term],
      })
    }
    console.log(`search "${term}": ${termCounts[term]} hits`)
  }
  const all = [...byAcc.values()]
  const human = all.filter((x) => /homo sapiens/i.test(x.organism ?? ''))

  const shortlist = []
  for (const acc of SHORTLIST) {
    const n = acc.replace('OSD-', '')
    try {
      const files = await getJson(`${OSDR_BASE}/osdr/data/osd/files/${n}`)
      const st = files?.studies?.[acc]
      shortlist.push({
        accession: acc,
        file_count: st?.file_count ?? null,
        tabular_files: (st?.study_files ?? [])
          .filter((f) => TABULAR.test(f.file_name) && !/md5sum/i.test(f.file_name))
          .map((f) => ({ file_name: f.file_name, file_size: f.file_size, category: f.category, subcategory: f.subcategory })),
      })
      console.log(`files ${acc}: ${st?.file_count ?? 0}`)
    } catch (e) {
      shortlist.push({ accession: acc, error: String(e.message ?? e) })
    }
  }

  const out = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    api: `${OSDR_BASE}/osdr/data/search (type=cgene), ${OSDR_BASE}/osdr/data/osd/files/<n>`,
    term_counts: termCounts,
    unique_studies: all.length,
    homo_sapiens_studies: human.length,
    human_candidates: human,
    shortlist_files: shortlist,
  }
  const path = resolve(DATA_DIR, 'manifests', 'osdr-discovery.json')
  await writeOut(path, json(out))
  console.log(`wrote ${path} (${human.length} Homo sapiens studies of ${all.length})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
