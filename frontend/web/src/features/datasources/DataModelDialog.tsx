import clsx from 'clsx'
import { BookOpenCheck, Cpu, Database, History, Tags, type LucideIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Modal } from '../mission/Modal'
import { REAL_DATASET_ACCESSIONS } from '../../data/osdr'
import { DevicesTab } from './DevicesTab'
import { ModelCardTab } from './ModelCardTab'
import { OriginsTab } from './OriginsTab'
import { RealDatasetsTab } from './RealDatasetsTab'

type TabId = 'real' | 'devices' | 'model' | 'origins'

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon; count?: number }> = [
  { id: 'real', label: 'Real datasets', icon: History, count: REAL_DATASET_ACCESSIONS.length },
  { id: 'devices', label: 'Simulated devices', icon: Cpu },
  { id: 'model', label: 'Model card', icon: BookOpenCheck },
  { id: 'origins', label: 'Data origins', icon: Tags },
]

export default function DataModelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>('real')
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ real: null, devices: null, model: null, origins: null })

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next < 0) return
    e.preventDefault()
    const id = TABS[next]!.id
    setTab(id)
    refs.current[id]?.focus()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Data and model"
      subtitle="Where every number comes from, and what the engine can and cannot do."
      icon={<Database size={17} className="text-accent" aria-hidden />}
    >
      <div className="-mx-5 -mt-4 mb-4 border-b border-white/[0.07] bg-space-950/30 px-5">
        <div role="tablist" aria-label="Data and model sections" onKeyDown={onKey} className="flex gap-1 overflow-x-auto overflow-y-hidden">
          {TABS.map((t) => {
            const sel = t.id === tab
            const Icon = t.icon
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[t.id] = el
                }}
                type="button"
                role="tab"
                id={`dm-tab-${t.id}`}
                aria-selected={sel}
                aria-controls={`dm-panel-${t.id}`}
                tabIndex={sel ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'focus-ring relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-semibold transition-colors',
                  sel ? 'text-ink-100' : 'text-ink-500 hover:text-ink-300',
                )}
              >
                <Icon size={14} aria-hidden className={sel ? 'text-accent' : undefined} />
                {t.label}
                {t.count != null && <span className="tabular rounded bg-white/[0.06] px-1.5 text-[10px] text-ink-300">{t.count}</span>}
                {sel && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden />}
              </button>
            )
          })}
        </div>
      </div>
      <div role="tabpanel" id={`dm-panel-${tab}`} aria-labelledby={`dm-tab-${tab}`} tabIndex={0} className="min-h-[min(620px,calc(100vh-200px))] outline-none">
        {tab === 'real' && <RealDatasetsTab />}
        {tab === 'devices' && <DevicesTab />}
        {tab === 'model' && <ModelCardTab />}
        {tab === 'origins' && <OriginsTab />}
      </div>
    </Modal>
  )
}
