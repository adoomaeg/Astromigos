// OSDR import (PROJECT_MASTER US-008, provenance 6.5).
// Usage (inside frontend/web): node scripts/osdr/import.mjs
//
// For each configured dataset:
//   1. fetch study metadata and file listing from the public OSDR API,
//   2. download the selected tabular file into data/raw/<accession>/ (untrusted data: hashed and parsed only),
//   3. write data/manifests/<accession>.json (DatasetRecord + file hashes + quality counts),
//   4. write data/processed/<accession>.observations.json (long format, one row per source row),
//   5. write src/data/<accession>.json (compact panel for the UI).
// Nothing is invented: fields that the source does not state are null and say "not stated".
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DATA_DIR, OSDR_BASE, WEB_DIR, getJson, httpGet, json, num, parseCsv, sha256, writeOut } from './lib.mjs'

const PARSER_VERSION = 'ahi-osdr-import 1.0.0'

/** Datasets selected in docs/data-source-inventory.md. */
const DATASETS = [
  {
    accession: 'OSD-569',
    file: 'LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv',
    panel: 'Complete blood count (CBC)',
    testType: 'CBC',
    timepointColumn: 'TEST_DATE',
    assayProtocol: /complete blood count/i,
    specimen: 'Whole blood (K2 EDTA tube)',
  },
  {
    accession: 'OSD-575',
    file: 'LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv',
    panel: 'Comprehensive metabolic panel (CMP)',
    testType: 'CMP',
    timepointColumn: 'timepoint',
    assayProtocol: /comprehensive metabolic panel/i,
    specimen: 'Serum (serum separator tube)',
  },
]

/** Analytes kept in the raw file and long format output, but not shown in the compact UI file. */
const UI_EXCLUDE = [
  {
    match: /^eGFR\b/i,
    reason: 'Estimated GFR reported with race based equations (two variants). Kept in raw and long format files, not displayed.',
  },
]

function comment(study, name) {
  const c = (study.comments ?? []).find((x) => x.name === name)
  return c && String(c.value).trim() ? String(c.value).trim() : null
}

function parseTimepoint(label) {
  let m = /^L-(\d+)$/.exec(label)
  if (m) return { label, phase: 'PRE_FLIGHT', days: -Number(m[1]), reference: 'launch' }
  m = /^R\+(\d+)$/.exec(label)
  if (m) return { label, phase: 'POST_FLIGHT', days: Number(m[1]), reference: 'return' }
  m = /^FD(\d+)$/i.exec(label)
  if (m) return { label, phase: 'IN_FLIGHT', days: Number(m[1]), reference: 'flight day' }
  return { label, phase: 'UNKNOWN', days: null, reference: null }
}

const PHASE_ORDER = { PRE_FLIGHT: 0, IN_FLIGHT: 1, POST_FLIGHT: 2, UNKNOWN: 3 }

function normalizeAnalyte(name) {
  return name.replace(/\s*\((FEMALE|MALE)\)\s*$/i, '').trim()
}

const ACRONYMS = new Set(['MCV', 'MCH', 'MCHC', 'RDW', 'MPV', 'BUN', 'ALT', 'AST'])
function prettyLabel(name) {
  return name
    .replace(/;\s*/g, ', ')
    .toLowerCase()
    .replace(/\b[a-z]+\b/g, (w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w))
    .replace(/^./, (c) => c.toUpperCase())
}

async function importDataset(cfg, jobId) {
  const n = cfg.accession.replace('OSD-', '')
  const rawDir = resolve(DATA_DIR, 'raw', cfg.accession)
  const metaUrl = `${OSDR_BASE}/osdr/data/osd/meta/${n}`
  const filesUrl = `${OSDR_BASE}/osdr/data/osd/files/${n}`
  const studyUrl = `${OSDR_BASE}/bio/repo/data/studies/${cfg.accession}`

  // 1. Metadata and file listing (saved verbatim for provenance).
  const metaBuf = await httpGet(metaUrl)
  const filesBuf = await httpGet(filesUrl)
  const metaAt = new Date().toISOString()
  await writeOut(resolve(rawDir, 'osdr-meta.json'), metaBuf)
  await writeOut(resolve(rawDir, 'osdr-files.json'), filesBuf)
  const meta = JSON.parse(metaBuf.toString('utf8'))
  const filesList = JSON.parse(filesBuf.toString('utf8'))
  const top = meta.study[cfg.accession]
  const study = top.studies[0]

  const listed = filesList.studies[cfg.accession].study_files.find((f) => f.file_name === cfg.file)
  if (!listed) throw new Error(`${cfg.file} is not listed for ${cfg.accession}`)
  const fileUrl = new URL(listed.remote_url, OSDR_BASE).toString()

  // 2. Download the tabular file.
  const buf = await httpGet(fileUrl)
  const downloadedAt = new Date().toISOString()
  if (buf.length !== listed.file_size) console.warn(`size differs from listing: ${buf.length} vs ${listed.file_size}`)
  const rawPath = resolve(rawDir, cfg.file)
  await writeOut(rawPath, buf)
  const fileSha = sha256(buf)

  // Subjects and sex from ISA sample metadata (verified, not inferred).
  const cats = Object.fromEntries((study.characteristicCategories ?? []).map((c) => [c['@id'], c.characteristicType?.annotationValue]))
  const subjectMeta = {}
  for (const s of study.materials?.samples ?? []) {
    const subj = s.name.split('_')[0]
    subjectMeta[subj] ??= {}
    for (const c of s.characteristics ?? []) {
      const k = cats[c.category?.['@id']]
      const v = c.value?.annotationValue ?? c.value
      if (k && typeof v === 'string') subjectMeta[subj][k] = v
    }
  }
  const organisms = new Set(Object.values(subjectMeta).map((m) => m.Organism))
  if (organisms.size !== 1 || !organisms.has('Homo sapiens')) throw new Error(`${cfg.accession}: organism is not exclusively Homo sapiens`)

  // 3. Parse the CSV (data only).
  const rows = parseCsv(buf.toString('utf8'))
  const header = rows[0].map((h) => h.trim())
  const col = (name) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`${cfg.file}: missing column ${name}`)
    return i
  }
  const iA = col('ANALYTE')
  const iV = col('VALUE')
  const iLo = col('RANGE_MIN')
  const iHi = col('RANGE_MAX')
  const iU = col('UNITS')
  const iT = col('TEST_TYPE')
  const iS = col('SUBJECT_ID')
  const iX = col('SEX')
  const iTp = col(cfg.timepointColumn)

  const observations = []
  const sexInFile = {}
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const value = num(row[iV])
    const lo = num(row[iLo])
    const hi = num(row[iHi])
    sexInFile[row[iS]] = row[iX]
    observations.push({
      dataset_accession: cfg.accession,
      source_file: cfg.file,
      source_row: r + 1,
      subject_id: row[iS],
      sex: row[iX] || null,
      test_type: row[iT] || null,
      analyte: row[iA],
      unit: row[iU] || null,
      value,
      value_raw: value === null ? row[iV] : undefined,
      reference_range_low: lo,
      reference_range_high: hi,
      reference_range_raw: lo === null || hi === null ? `${row[iLo]}..${row[iHi]}` : undefined,
      timepoint: row[iTp],
      ...(({ phase, days, reference }) => ({ phase, days_relative: days, days_reference: reference }))(parseTimepoint(row[iTp])),
      data_origin: 'REAL_PUBLIC',
    })
  }
  for (const [s, sx] of Object.entries(sexInFile)) {
    const metaSex = subjectMeta[s]?.Sex
    const expected = metaSex === 'Male' ? 'M' : metaSex === 'Female' ? 'F' : null
    if (expected !== sx) throw new Error(`${cfg.accession}: sex for ${s} differs between file (${sx}) and metadata (${metaSex})`)
  }

  const subjects = [...new Set(observations.map((o) => o.subject_id))].sort().map((id) => ({ id, sex: sexInFile[id] }))
  const timepoints = [...new Set(observations.map((o) => o.timepoint))]
    .map(parseTimepoint)
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || (a.days ?? 0) - (b.days ?? 0))
  const tpIndex = Object.fromEntries(timepoints.map((t, i) => [t.label, i]))

  // 4. Compact panel: analyte -> subject -> timepoint cells. Variants like "HEMOGLOBIN (FEMALE)" merge into one analyte.
  const analytes = new Map()
  const excluded = new Map()
  const conflicts = []
  for (const o of observations) {
    const ex = UI_EXCLUDE.find((e) => e.match.test(o.analyte))
    if (ex) {
      excluded.set(o.analyte, ex.reason)
      continue
    }
    const key = normalizeAnalyte(o.analyte)
    let a = analytes.get(key)
    if (!a) {
      a = { key, label: prettyLabel(key), source_names: [], unit: o.unit, units_seen: new Set(), values: Object.fromEntries(subjects.map((s) => [s.id, timepoints.map(() => null)])) }
      analytes.set(key, a)
    }
    if (!a.source_names.includes(o.analyte)) a.source_names.push(o.analyte)
    a.units_seen.add(o.unit)
    const ti = tpIndex[o.timepoint]
    if (a.values[o.subject_id][ti]) {
      conflicts.push(`${o.subject_id} ${o.timepoint} ${o.analyte} (row ${o.source_row})`)
      continue
    }
    const cell = { v: o.value, lo: o.reference_range_low, hi: o.reference_range_high }
    if (o.value === null) cell.raw = o.value_raw
    a.values[o.subject_id][ti] = cell
  }
  const analyteList = [...analytes.values()].map((a) => {
    if (a.units_seen.size !== 1) throw new Error(`${cfg.accession}: mixed units for ${a.key}: ${[...a.units_seen].join(', ')}`)
    const mean = []
    const meanN = []
    timepoints.forEach((_, ti) => {
      const vs = subjects.map((s) => a.values[s.id][ti]?.v).filter((v) => typeof v === 'number')
      meanN.push(vs.length)
      mean.push(vs.length ? Number((vs.reduce((x, y) => x + y, 0) / vs.length).toFixed(4)) : null)
    })
    const { units_seen: _u, ...rest } = a
    return { ...rest, mean, mean_n: meanN }
  })

  const expectedCells = analyteList.length * subjects.length * timepoints.length
  const presentCells = analyteList.reduce((acc, a) => acc + Object.values(a.values).flat().filter((c) => c && c.v !== null).length, 0)
  const nonNumeric = observations.filter((o) => o.value === null).map((o) => `${o.subject_id} ${o.timepoint} ${o.analyte}: "${o.value_raw}"`)

  // Provenance record (PROJECT_MASTER 6.5 / DatasetRecord).
  const missionName = comment(study, 'Mission Name')
  const missionStart = comment(study, 'Mission Start')
  const missionEnd = comment(study, 'Mission End')
  const descr = String(study.description ?? '').replace(/\s+/g, ' ').trim()
  const crewPhrase = /(\w+ private astronauts)/i.exec(descr)?.[1] ?? null
  const sexCounts = subjects.reduce((m, s) => ((m[s.sex] = (m[s.sex] ?? 0) + 1), m), {})
  const tpLabels = (ph) => timepoints.filter((t) => t.phase === ph).map((t) => t.label)
  const factors = (study.factors ?? []).map((f) => f.factorName).filter(Boolean)
  const designDesc = (study.studyDesignDescriptors ?? []).map((d) => d.annotationValue).filter(Boolean)
  const protocol = (study.protocols ?? []).find((p) => cfg.assayProtocol.test(p.name ?? ''))
  const related = [...new Set((descr.match(/OSD-\d+/g) ?? []).filter((a) => a !== cfg.accession))]

  const record = {
    id: `osdr-${cfg.accession.toLowerCase()}-${cfg.testType.toLowerCase()}`,
    source_name: 'NASA Open Science Data Repository (OSDR)',
    source_url: studyUrl,
    dataset_accession: cfg.accession,
    dataset_version: top.version != null ? `OSDR metadata version ${top.version}` : null,
    title: study.title,
    downloaded_at: downloadedAt,
    license: null,
    access_classification: 'Public, open access (downloaded without authentication). Processed tabular data.',
    file_name: cfg.file,
    sha256: fileSha,
    parser_version: PARSER_VERSION,
    study_population:
      `${subjects.length} crew members (${subjects.map((s) => s.id).join(', ')}): ${sexCounts.F ?? 0} female, ${sexCounts.M ?? 0} male per sample metadata.` +
      (crewPhrase ? ` Study description: "${crewPhrase}".` : '') +
      ' Age: not stated.',
    mission: missionName ? `${missionName}${missionStart && missionEnd ? ` (${missionStart} to ${missionEnd})` : ''}` : null,
    study_design:
      `Repeated measures on the same ${subjects.length} subjects at ${timepoints.length} ground time points.` +
      (factors.length ? ` Study factors: ${factors.join(', ')}.` : '') +
      (designDesc.length ? ` Design descriptor: ${designDesc.join(', ')}.` : ''),
    collection_phase:
      `Pre-flight (${tpLabels('PRE_FLIGHT').join(', ') || 'none'}) and post-flight (${tpLabels('POST_FLIGHT').join(', ') || 'none'}).` +
      (tpLabels('IN_FLIGHT').length ? ` In-flight: ${tpLabels('IN_FLIGHT').join(', ')}.` : ' No in-flight samples in this file.'),
    notes:
      `${cfg.panel} from ${cfg.specimen}. L-n = n days before launch, R+n = n days after return (as labeled in the source). ` +
      'Reference ranges are the lab ranges reported in the source file, not NASA limits. License: not stated in the study metadata.',
    data_origin: 'REAL_PUBLIC',
  }

  const discrepancies = []
  const descrPost = /post-flight \(([^)]*)\)/i.exec(descr)?.[1]
  if (descrPost) {
    const missing = tpLabels('POST_FLIGHT').filter((l) => !descrPost.includes(l))
    if (missing.length) discrepancies.push(`Study description lists post-flight time points "${descrPost}" but the file also contains ${missing.join(', ')}.`)
  }
  if (conflicts.length) discrepancies.push(`Duplicate cells ignored (first kept): ${conflicts.join('; ')}`)

  const files = [
    { role: 'data', file_name: cfg.file, url: fileUrl, size_bytes: buf.length, listed_size_bytes: listed.file_size, sha256: fileSha, downloaded_at: downloadedAt, raw_path: `data/raw/${cfg.accession}/${cfg.file}` },
    { role: 'metadata', file_name: 'osdr-meta.json', url: metaUrl, size_bytes: metaBuf.length, sha256: sha256(metaBuf), downloaded_at: metaAt, raw_path: `data/raw/${cfg.accession}/osdr-meta.json` },
    { role: 'file listing', file_name: 'osdr-files.json', url: filesUrl, size_bytes: filesBuf.length, sha256: sha256(filesBuf), downloaded_at: metaAt, raw_path: `data/raw/${cfg.accession}/osdr-files.json` },
  ]

  const quality = {
    source_rows: observations.length,
    numeric_values: observations.length - nonNumeric.length,
    non_numeric_values: nonNumeric,
    ui_analytes: analyteList.length,
    ui_cells_expected: expectedCells,
    ui_cells_with_value: presentCells,
    ui_cells_missing: expectedCells - presentCells,
    excluded_from_ui: [...excluded.entries()].map(([analyte, reason]) => ({ analyte, reason })),
  }

  const manifest = {
    import_job_id: jobId,
    record,
    files,
    api: { meta: metaUrl, files: filesUrl, biodata: `https://visualization.osdr.nasa.gov/biodata/api/v2/dataset/${cfg.accession}/` },
    assay: { panel: cfg.panel, specimen: cfg.specimen, protocol_name: protocol?.name ?? null, protocol_description: protocol?.description?.trim() ?? null },
    study: { release_date: study.publicReleaseDate ?? null, submission_date: study.submissionDate ?? null, related_accessions: related },
    quality,
    discrepancies,
  }

  const panel = {
    schema: 'ahi.osdr.labpanel.v1',
    record,
    study: {
      accession: cfg.accession,
      title: study.title,
      description: descr,
      release_date: study.publicReleaseDate ?? null,
      mission: { name: missionName, start: missionStart, end: missionEnd },
      publications: (study.publications ?? []).map((p) => ({ title: p.title, doi: p.doi || null })),
      related_accessions: related,
      study_url: studyUrl,
      meta_api_url: metaUrl,
    },
    file: { file_name: cfg.file, url: fileUrl, size_bytes: buf.length, sha256: fileSha, downloaded_at: downloadedAt },
    panel: { name: cfg.panel, test_type: cfg.testType, specimen: cfg.specimen, protocol: protocol?.description?.replace(/\s+/g, ' ').trim() ?? null },
    subjects,
    timepoints,
    analytes: analyteList,
    excluded: quality.excluded_from_ui,
    quality: { cells_expected: expectedCells, cells_with_value: presentCells, non_numeric_values: nonNumeric },
    discrepancies,
    derived_note: 'mean and mean_n are DERIVED: arithmetic mean of the subjects with a numeric value at that time point (sexes pooled).',
  }

  await writeOut(resolve(DATA_DIR, 'manifests', `${cfg.accession}.json`), json(manifest))
  await writeOut(resolve(DATA_DIR, 'processed', `${cfg.accession}.observations.json`), json({ dataset_accession: cfg.accession, import_job_id: jobId, parser_version: PARSER_VERSION, rows: observations }))
  const uiPath = resolve(WEB_DIR, 'src', 'data', `${cfg.accession}.json`)
  await writeOut(uiPath, JSON.stringify(panel) + '\n')
  const size = (await readFile(uiPath)).length
  console.log(`${cfg.accession}: ${observations.length} rows, ${analyteList.length} analytes, ${subjects.length} subjects, ${timepoints.length} time points, sha256 ${fileSha.slice(0, 12)}, ui json ${(size / 1024).toFixed(1)} KB`)
  return { accession: cfg.accession, file: cfg.file, sha256: fileSha }
}

async function main() {
  const jobId = `osdr-import-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const results = []
  for (const cfg of DATASETS) results.push(await importDataset(cfg, jobId))
  await writeOut(resolve(DATA_DIR, 'manifests', 'import-log.json'), json({ import_job_id: jobId, finished_at: new Date().toISOString(), parser_version: PARSER_VERSION, results }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
