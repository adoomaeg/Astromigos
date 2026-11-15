import { FlaskConical, Gauge, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import evaluationJson from '../../engine/evaluation.json'
import { useAppStore } from '../../state/store'
import type { EngineEvaluation } from '../../types/domain'
import { StatusPill } from '../../components/Status'
import { SectionLabel } from '../../components/ui'
import { formatIsoUtc } from './shared'

const evaluation = evaluationJson as unknown as EngineEvaluation

function minutes(v: number | null): string {
  if (v == null) return 'not reached'
  if (v < 60) return `${Math.round(v)} min`
  const h = v / 60
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/[0.07]">
      <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{label}</div>
      <div className="tabular mt-1 text-lg font-semibold text-ink-100">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  )
}

export function ModelCardTab() {
  const scenarios = useAppStore((s) => s.scenarios)
  const crew = useAppStore((s) => s.crew)
  const placeholder = evaluation.engineVersion === 'placeholder'
  const scenarioName = (id: string) => scenarios.find((s) => s.id === id)?.name ?? id
  const target = (id: string | null) => {
    if (!id) return 'Whole cabin'
    const a = crew.find((c) => c.id === id)
    return a ? `${a.callsign} (${a.id})` : id
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Section title="Evaluation on simulated data">
          {placeholder ? (
            <div className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center">
              <Gauge size={20} className="mx-auto text-ink-500" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-ink-100">Evaluation not generated yet</p>
              <p className="mt-1 text-xs text-ink-500">
                Run <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[11px] text-ink-300">npm run evaluate</code> to replay the scenarios and write{' '}
                <span className="font-mono text-[11px]">src/engine/evaluation.json</span>.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="False alerts" value={evaluation.nominal.falseAlertsPerCrewDay.toFixed(2)} sub="per crew day, nominal run" />
                <Tile label="Simulated" value={`${Math.round(evaluation.nominal.simulatedHours)} h`} sub="nominal scenario" />
                <Tile label="Crew hours" value={Math.round(evaluation.nominal.crewHours)} sub="monitored, nominal" />
                <Tile label="Worst level" value={<StatusPill status={evaluation.nominal.maxLevel} variant="technical" size="sm" />} sub="nominal run" />
              </div>
              <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.07]">
                <table className="tabular w-full min-w-[560px] border-collapse text-[11px]">
                  <caption className="sr-only">Time to detection per scenario on simulated data</caption>
                  <thead>
                    <tr className="bg-white/[0.03] text-left text-ink-500">
                      <th scope="col" className="px-3 py-1.5 font-semibold">Scenario</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Target</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">First alert</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">HIGH</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">CRITICAL</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Peak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.scenarios.map((s) => (
                      <tr key={s.scenarioId} className="border-t border-white/[0.05]">
                        <th scope="row" className="px-3 py-1.5 text-left font-medium text-ink-100">
                          {scenarioName(s.scenarioId)}
                        </th>
                        <td className="px-3 py-1.5 text-ink-300">{s.target ? target(s.target) : 'None'}</td>
                        <td className="px-3 py-1.5 text-right text-ink-100">{minutes(s.timeToFirstAlertMin)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-100">{minutes(s.timeToHighMin)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-100">{minutes(s.timeToCriticalMin)}</td>
                        <td className="px-3 py-1.5">
                          <StatusPill status={s.peakLevel} variant="technical" size="sm" />
                        </td>
                      </tr>
                    ))}
                    {evaluation.scenarios.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-ink-500">
                          No scenario results in this evaluation.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-ink-500">
                Engine {evaluation.engineVersion} · generated {formatIsoUtc(evaluation.generatedAt)}. Times are simulated minutes from scenario start.
              </p>
            </>
          )}
          {evaluation.notes.length > 0 && !placeholder && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-ink-300 marker:text-ink-500">
              {evaluation.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-ink-500">
            <FlaskConical size={12} className="mt-0.5 shrink-0 text-violet-200" aria-hidden />
            These numbers measure the engine against its own simulator. They are not clinical validation and say nothing about real astronaut data.
          </p>
        </Section>

        <Section title="Method">
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-300">
            <li>
              <span className="font-semibold text-ink-100">Personal baseline.</span> Median and robust spread (MAD) per person, metric and context (sleep, rest, work,
              exercise). Normal band is the median plus or minus 2 robust standard deviations.
            </li>
            <li>
              <span className="font-semibold text-ink-100">Anomaly detection.</span> Robust z score for sudden changes, EWMA drift for slow ones, persistence rules for daily
              metrics, and data quality rules that turn missing data into NO DATA instead of normal.
            </li>
            <li>
              <span className="font-semibold text-ink-100">Risk.</span> Transparent rule weights combined into a 0 to 100 score with a confidence that drops when key
              signals are missing.
            </li>
            <li>
              <span className="font-semibold text-ink-100">Forecast.</span> Damped Holt projection with an 80% interval, used only to say when a value may leave the
              personal band.
            </li>
            <li>
              <span className="font-semibold text-ink-100">Recommendations.</span> Versioned rule catalog with plain-language reasons and a stated owner
              (crew on board or ground).
            </li>
          </ul>
        </Section>
      </div>

      <aside className="space-y-6">
        <Section title="Intended use">
          <p className="text-xs leading-relaxed text-ink-300">
            Decision support for crew and ground teams: spot changes against each person&apos;s own normal, explain them in plain language and suggest who should look.
            A flight surgeon or authorized clinician makes every health decision.
          </p>
        </Section>
        <Section title="Limitations">
          <ul className="space-y-2 text-xs leading-relaxed text-ink-300">
            {[
              'Not a medical device. No diagnosis, no medication, no treatment advice.',
              'Physiology, devices and scenarios are simulated. Results have not been validated on real astronaut data.',
              'Fixed thresholds in config.ts are demo configuration, not official NASA limits.',
              'The real OSDR datasets are historical reference only and are not used to train or tune the engine.',
              'Correlation is not causation: combined rules show co-occurrence, not proof of cause.',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <ShieldAlert size={13} className="mt-0.5 shrink-0 text-ink-500" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Section>
      </aside>
    </div>
  )
}
