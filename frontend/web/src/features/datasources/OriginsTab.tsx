import type { DataOrigin } from '../../types/domain'
import { ORIGIN_META, OriginBadge } from './shared'

const ORDER: DataOrigin[] = ['REAL_PUBLIC', 'DERIVED', 'SIMULATED', 'MANUAL']

export function OriginsTab() {
  return (
    <div className="space-y-4">
      <p className="max-w-[760px] text-xs leading-relaxed text-ink-300">
        Every record in Astromigos carries a <span className="font-mono text-[11px] text-ink-100">data_origin</span> label from the moment it is created. Categories are never
        mixed without keeping the label, so any value on screen can be traced back to where it came from.
      </p>
      <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.07]">
        <table className="w-full min-w-[620px] border-collapse text-left text-xs">
          <caption className="sr-only">Data origin categories</caption>
          <thead>
            <tr className="bg-white/[0.03] text-[11px] text-ink-500">
              <th scope="col" className="px-3 py-2 font-semibold">
                Label
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Meaning
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Where you see it in Astromigos
              </th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((o) => (
              <tr key={o} className="border-t border-white/[0.05] align-top">
                <th scope="row" className="px-3 py-2.5 font-normal">
                  <OriginBadge origin={o} />
                </th>
                <td className="px-3 py-2.5 leading-relaxed text-ink-300">{ORIGIN_META[o].meaning}</td>
                <td className="px-3 py-2.5 leading-relaxed text-ink-500">{ORIGIN_META[o].inAhi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1.5 text-[11px] leading-relaxed text-ink-500">
        <li>Missing data is never treated as normal: it shows as NO DATA or stale data, never as a filled in value.</li>
        <li>Public data is never presented as live telemetry, and data from other people is never merged into the crew shown on the dashboard.</li>
        <li>Animal, cell culture and ground analog studies are not treated as astronaut data.</li>
      </ul>
    </div>
  )
}
