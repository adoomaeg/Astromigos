/**
 * Real public NASA OSDR datasets (REAL_PUBLIC) imported by scripts/osdr/import.mjs.
 * Historical research data from other people. Never live telemetry, never merged into the simulated crew.
 * The JSON files are loaded on demand so they never weigh on the main bundle.
 */
import type { DatasetRecord } from '../types/domain'

export type LabPhase = 'PRE_FLIGHT' | 'IN_FLIGHT' | 'POST_FLIGHT' | 'UNKNOWN'

export interface LabTimepoint {
  /** Label exactly as in the source, e.g. "L-92" (92 days before launch) or "R+1" (1 day after return). */
  label: string
  phase: LabPhase
  days: number | null
  reference: string | null
}

export interface LabCell {
  /** Numeric value as reported; null when the source value is not a number (see raw). */
  v: number | null
  /** Lab reference range reported in the source file (not a NASA limit). */
  lo: number | null
  hi: number | null
  raw?: string
}

export interface LabAnalyte {
  key: string
  label: string
  source_names: string[]
  unit: string | null
  /** subject id -> one cell per time point (null = no row in the source file). */
  values: Record<string, Array<LabCell | null>>
  /** DERIVED: mean of subjects with a numeric value at each time point. */
  mean: Array<number | null>
  mean_n: number[]
}

export interface LabPanelDataset {
  schema: 'ahi.osdr.labpanel.v1'
  record: DatasetRecord
  study: {
    accession: string
    title: string
    description: string
    release_date: string | null
    mission: { name: string | null; start: string | null; end: string | null }
    publications: Array<{ title: string; doi: string | null }>
    related_accessions: string[]
    study_url: string
    meta_api_url: string
  }
  file: { file_name: string; url: string; size_bytes: number; sha256: string; downloaded_at: string }
  panel: { name: string; test_type: string; specimen: string; protocol: string | null }
  subjects: Array<{ id: string; sex: string | null }>
  timepoints: LabTimepoint[]
  analytes: LabAnalyte[]
  excluded: Array<{ analyte: string; reason: string }>
  quality: { cells_expected: number; cells_with_value: number; non_numeric_values: string[] }
  discrepancies: string[]
  derived_note: string
}

/** Accessions bundled with the app (see docs/data-source-inventory.md). */
export const REAL_DATASET_ACCESSIONS = ['OSD-569', 'OSD-575'] as const

export async function loadRealDatasets(): Promise<LabPanelDataset[]> {
  const mods = await Promise.all([import('./OSD-569.json'), import('./OSD-575.json')])
  return mods.map((m) => (m.default ?? m) as unknown as LabPanelDataset)
}

/** Analyte shown first for each panel. */
export const DEFAULT_ANALYTE: Record<string, string> = {
  CBC: 'WHITE BLOOD CELL COUNT',
  CMP: 'SODIUM',
}

/** Plain-language description of common lab analytes (general education, not interpretation). */
export const ANALYTE_HINT: Record<string, string> = {
  'WHITE BLOOD CELL COUNT': 'Immune cells in the blood.',
  'RED BLOOD CELL COUNT': 'Cells that carry oxygen.',
  HEMOGLOBIN: 'Oxygen carrying protein in red cells.',
  HEMATOCRIT: 'Share of blood volume made of red cells.',
  MCV: 'Average red cell size.',
  MCH: 'Average hemoglobin per red cell.',
  MCHC: 'Hemoglobin concentration in red cells.',
  RDW: 'Variation in red cell size.',
  'PLATELET COUNT': 'Cell fragments involved in clotting.',
  MPV: 'Average platelet size.',
  'ABSOLUTE NEUTROPHILS': 'Neutrophils (a white cell type), absolute count.',
  'ABSOLUTE LYMPHOCYTES': 'Lymphocytes (a white cell type), absolute count.',
  'ABSOLUTE MONOCYTES': 'Monocytes (a white cell type), absolute count.',
  'ABSOLUTE EOSINOPHILS': 'Eosinophils (a white cell type), absolute count.',
  'ABSOLUTE BASOPHILS': 'Basophils (a white cell type), absolute count.',
  NEUTROPHILS: 'Neutrophils as a share of white cells.',
  LYMPHOCYTES: 'Lymphocytes as a share of white cells.',
  MONOCYTES: 'Monocytes as a share of white cells.',
  EOSINOPHILS: 'Eosinophils as a share of white cells.',
  BASOPHILS: 'Basophils as a share of white cells.',
  GLUCOSE: 'Blood sugar. Fasting status is not stated in the source.',
  'UREA NITROGEN (BUN)': 'Waste product cleared by the kidneys.',
  CREATININE: 'Muscle waste product cleared by the kidneys.',
  'BUN/CREATININE RATIO': 'Ratio calculated by the lab (often not reported).',
  SODIUM: 'Electrolyte linked to fluid balance.',
  POTASSIUM: 'Electrolyte important for muscles and heart rhythm.',
  CHLORIDE: 'Electrolyte linked to fluid and acid base balance.',
  'CARBON DIOXIDE': 'Bicarbonate, related to acid base balance.',
  CALCIUM: 'Mineral used by bones, muscles and nerves.',
  'PROTEIN; TOTAL': 'All proteins in serum.',
  ALBUMIN: 'Main blood protein, made by the liver.',
  GLOBULIN: 'Proteins other than albumin, including antibodies.',
  'ALBUMIN/GLOBULIN RATIO': 'Ratio calculated by the lab.',
  'BILIRUBIN; TOTAL': 'Pigment from red cell breakdown.',
  'ALKALINE PHOSPHATASE': 'Enzyme from liver and bone.',
  AST: 'Enzyme found in liver and muscle.',
  ALT: 'Enzyme found mainly in the liver.',
}

export const PHASE_LABEL: Record<LabPhase, string> = {
  PRE_FLIGHT: 'Pre-flight',
  IN_FLIGHT: 'In flight',
  POST_FLIGHT: 'Post-flight',
  UNKNOWN: 'Not stated',
}

/** Plain explanation of a source time point label. */
export function describeTimepoint(t: LabTimepoint): string {
  if (t.days == null) return `${t.label}: meaning not stated in the source`
  if (t.reference === 'launch') return `${t.label}: ${Math.abs(t.days)} days before launch`
  if (t.reference === 'return') return `${t.label}: ${t.days} day${t.days === 1 ? '' : 's'} after return`
  return `${t.label}: ${t.reference} ${t.days}`
}
