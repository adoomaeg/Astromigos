import { FileSpreadsheet, History, Info, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadRealDatasets, type LabPanelDataset } from '../../data/osdr'
import { LabPanelView } from './LabPanelView'
import { ExtLink, Field, HashValue, NotStated, OriginBadge, formatBytes, formatIsoUtc } from './shared'

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: LabPanelDataset[] } | { kind: 'error'; message: string }

export function RealDatasetsTab() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  useEffect(() => {
    let alive = true
    loadRealDatasets()
      .then((data) => alive && setState({ kind: 'ready', data }))
      .catch((e: unknown) => alive && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <div role="note" className="flex gap-3 rounded-xl bg-accent/[0.06] px-4 py-3 ring-1 ring-accent/20">
        <History size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="text-xs leading-relaxed text-ink-300">
          <p className="font-semibold text-ink-100">Historical public research data. Not live telemetry and not this crew.</p>
          <p className="mt-1">
            Clinical lab results from the four private astronauts of the 3-day SpaceX Inspiration4 mission (September 2021), published by NASA OSDR. Subject codes C001 to C004 are
            the source&apos;s own pseudonyms. These values are shown for reference and transparency; they do not feed the simulated crew, the baselines or the alerts.
          </p>
        </div>
      </div>

      {state.kind === 'loading' && (
        <div className="flex items-center gap-2 px-1 py-6 text-xs text-ink-500" role="status">
          <LoaderCircle size={14} className="animate-spin" aria-hidden /> Loading datasets
        </div>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="rounded-xl bg-white/[0.03] px-4 py-3 text-xs text-ink-300 ring-1 ring-white/10">
          The bundled datasets could not be loaded ({state.message}). No real data is shown.
        </div>
      )}
      {state.kind === 'ready' && state.data.length === 0 && (
        <div className="rounded-xl bg-white/[0.03] px-4 py-6 text-center text-xs text-ink-500 ring-1 ring-white/10">
          No real dataset imported yet. See docs/data-source-inventory.md.
        </div>
      )}
      {state.kind === 'ready' && state.data.map((ds) => <DatasetCard key={ds.record.id} ds={ds} />)}
    </div>
  )
}

function DatasetCard({ ds }: { ds: LabPanelDataset }) {
  const r = ds.record
  const missing = ds.quality.cells_expected - ds.quality.cells_with_value
  return (
    <article className="rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.08]" aria-labelledby={`ds-${r.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin="REAL_PUBLIC" />
            <span className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">{ds.panel.name}</span>
          </div>
          <h3 id={`ds-${r.id}`} className="mt-1.5 text-sm leading-snug font-semibold text-ink-100">
            {r.title}
          </h3>
        </div>
        <ExtLink href={ds.study.study_url} className="shrink-0 font-mono text-xs font-semibold">
          {r.dataset_accession}
        </ExtLink>
      </header>
      <div className="grid gap-5 px-4 py-3 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <dl className="divide-y divide-white/[0.05]">
          <Field label="Source">{r.source_name}</Field>
          <Field label="Mission">{r.mission ?? <NotStated />}</Field>
          <Field label="Population">{r.study_population ?? <NotStated />}</Field>
          <Field label="Design">{r.study_design ?? <NotStated />}</Field>
          <Field label="Collection">{r.collection_phase ?? <NotStated />}</Field>
          <Field label="Sample and assay">
            {ds.panel.specimen}
            {ds.panel.protocol && (
              <details className="mt-1 text-ink-500">
                <summary className="focus-ring w-fit cursor-pointer rounded text-[11px] text-ink-300 hover:text-ink-100">Assay protocol (from the source)</summary>
                <p className="mt-1 text-[11px] leading-relaxed">{ds.panel.protocol}</p>
              </details>
            )}
          </Field>
          <Field label="File">
            <span className="inline-flex items-start gap-1.5">
              <FileSpreadsheet size={13} className="mt-0.5 shrink-0 text-ink-500" aria-hidden />
              <ExtLink href={ds.file.url} className="font-mono text-[11px] break-all">
                {ds.file.file_name}
              </ExtLink>
            </span>
            <span className="tabular block text-ink-500">{formatBytes(ds.file.size_bytes)}</span>
          </Field>
          <Field label="SHA-256">
            <HashValue value={ds.file.sha256} />
          </Field>
          <Field label="Downloaded">
            <span className="tabular">{formatIsoUtc(ds.file.downloaded_at)}</span>
          </Field>
          <Field label="Version">{r.dataset_version ?? <NotStated />}</Field>
          <Field label="Released">{ds.study.release_date ?? <NotStated />}</Field>
          <Field label="License">{r.license ?? <NotStated />}</Field>
          <Field label="Access">{r.access_classification}</Field>
          <Field label="Parser">
            <span className="font-mono text-[11px]">{r.parser_version}</span>
          </Field>
          <Field label="Completeness">
            <span className="tabular">
              {ds.quality.cells_with_value} of {ds.quality.cells_expected} values present
            </span>
            {missing > 0 && <span className="text-ink-500"> ({missing} missing or not numeric, shown as such, never filled in)</span>}
            {ds.excluded.length > 0 && (
              <span className="block text-ink-500">
                Not displayed: {ds.excluded.map((e) => e.analyte).join(', ')}. {ds.excluded[0]!.reason}
              </span>
            )}
          </Field>
          {ds.discrepancies.length > 0 && (
            <Field label="Source note">
              <span className="inline-flex gap-1.5">
                <Info size={12} className="mt-1 shrink-0 text-ink-500" aria-hidden />
                <span>{ds.discrepancies.join(' ')}</span>
              </span>
            </Field>
          )}
          {ds.study.publications.length > 0 && (
            <Field label="Publications">
              <ul className="space-y-1">
                {ds.study.publications
                  .filter((p) => p.doi && !p.doi.includes('protocols.io'))
                  .map((p) => (
                    <li key={p.doi!}>
                      <ExtLink href={`https://doi.org/${p.doi}`} className="text-[11px] leading-snug">
                        {p.title}
                      </ExtLink>
                    </li>
                  ))}
              </ul>
            </Field>
          )}
        </dl>
        <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <LabPanelView ds={ds} />
        </div>
      </div>
    </article>
  )
}
