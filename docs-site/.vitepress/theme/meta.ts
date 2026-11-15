/**
 * Shared vocabulary for the documentation components: implementation status and data origin,
 * with labels and tooltips in English and Brazilian Portuguese.
 */

export type Lang = 'en' | 'pt'

export const REPO_BLOB = 'https://github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform/blob/master/'

export const STATUSES = ['IMPLEMENTED', 'EXPERIMENTAL', 'PLANNED', 'CONCEPTUAL', 'NOT_IMPLEMENTED', 'DEPRECATED'] as const
export type DocStatus = (typeof STATUSES)[number]

export const ORIGINS = ['REAL_PUBLIC', 'DERIVED', 'SIMULATED', 'MANUAL'] as const
export type DataOrigin = (typeof ORIGINS)[number]

export const STATUS_TEXT: Record<DocStatus, Record<Lang, { label: string; title: string }>> = {
  IMPLEMENTED: {
    en: { label: 'Implemented', title: 'Implemented: present in the code and exercised by the running prototype.' },
    pt: { label: 'Implementado', title: 'Implementado: presente no código e em uso no protótipo em execução.' },
  },
  EXPERIMENTAL: {
    en: { label: 'Experimental', title: 'Experimental: implemented, but heuristic or not yet validated; behavior may change.' },
    pt: { label: 'Experimental', title: 'Experimental: implementado, mas heurístico ou ainda não validado; o comportamento pode mudar.' },
  },
  PLANNED: {
    en: { label: 'Planned', title: 'Planned: in the backlog or roadmap, not present in the code yet.' },
    pt: { label: 'Planejado', title: 'Planejado: está no backlog ou roadmap, ainda não existe no código.' },
  },
  CONCEPTUAL: {
    en: { label: 'Conceptual', title: 'Conceptual: a design proposal or target picture, not an implementation.' },
    pt: { label: 'Conceitual', title: 'Conceitual: proposta de desenho ou visão alvo, não é implementação.' },
  },
  NOT_IMPLEMENTED: {
    en: { label: 'Not implemented', title: 'Not implemented: deliberately absent from the platform; mentioned only to avoid confusion.' },
    pt: { label: 'Não implementado', title: 'Não implementado: ausente da plataforma de propósito; citado só para evitar confusão.' },
  },
  DEPRECATED: {
    en: { label: 'Deprecated', title: 'Deprecated: still present but being replaced; do not build on it.' },
    pt: { label: 'Descontinuado', title: 'Descontinuado: ainda existe, mas está sendo substituído; não construa sobre ele.' },
  },
}

export const ORIGIN_TEXT: Record<DataOrigin, Record<Lang, { label: string; title: string }>> = {
  REAL_PUBLIC: {
    en: { label: 'Real public', title: 'Real public data: taken from a public NASA source and kept with its accession and checksum.' },
    pt: { label: 'Real público', title: 'Dado real público: obtido de uma fonte pública da NASA e mantido com acesso (accession) e checksum.' },
  },
  DERIVED: {
    en: { label: 'Derived', title: 'Derived: computed by the platform from other data (baselines, scores, forecasts).' },
    pt: { label: 'Derivado', title: 'Derivado: calculado pela plataforma a partir de outros dados (linhas de base, scores, previsões).' },
  },
  SIMULATED: {
    en: { label: 'Simulated', title: 'Simulated: produced by the device simulators. Not clinical evidence.' },
    pt: { label: 'Simulado', title: 'Simulado: produzido pelos simuladores de dispositivos. Não é evidência clínica.' },
  },
  MANUAL: {
    en: { label: 'Manual', title: 'Manual: entered by a person (crew self-report or ground note).' },
    pt: { label: 'Manual', title: 'Manual: informado por uma pessoa (autorrelato da tripulação ou nota da equipe de solo).' },
  },
}

export const UI_TEXT: Record<Lang, Record<string, string>> = {
  en: {
    home: 'Home',
    breadcrumb: 'Breadcrumb',
    pageInfo: 'Page status and sources',
    status: 'Status',
    origin: 'Data origin',
    code: 'Source of truth',
    tests: 'Tests',
    verified: 'Verified on',
    verifiedTitle: 'Date the content was last checked against the code or the cited source.',
    githubTitle: 'Open on GitHub',
  },
  pt: {
    home: 'Início',
    breadcrumb: 'Trilha de navegação',
    pageInfo: 'Status e fontes da página',
    status: 'Status',
    origin: 'Origem dos dados',
    code: 'Fonte da verdade',
    tests: 'Testes',
    verified: 'Verificado em',
    verifiedTitle: 'Data em que o conteúdo foi conferido pela última vez com o código ou a fonte citada.',
    githubTitle: 'Abrir no GitHub',
  },
}

export function langOf(lang: string | undefined): Lang {
  return lang && lang.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

export function normalizeStatus(value: unknown): DocStatus | null {
  const s = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  return (STATUSES as readonly string[]).includes(s) ? (s as DocStatus) : null
}

export function parseOrigins(value: unknown): DataOrigin[] {
  const raw = Array.isArray(value) ? value.map(String) : String(value ?? '').split(',')
  return raw
    .map((v) => v.trim().toUpperCase().replace(/[\s-]+/g, '_'))
    .filter((v): v is DataOrigin => (ORIGINS as readonly string[]).includes(v))
}

export function toList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function fileName(path: string): string {
  const clean = path.replace(/[#?].*$/, '').replace(/\/+$/, '')
  return clean.split('/').pop() || path
}

export function blobUrl(path: string): string {
  return REPO_BLOB + path.replace(/^\/+/, '')
}
