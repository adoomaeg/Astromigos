import clsx from 'clsx'
import { Check, ChevronDown, FlaskConical, Gauge, Pause, Play, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppStore } from '../../state/store'
import { Popover } from '../../components/ui'
import { SPEEDS, speedLabel } from '../../components/format'
import { useActions } from '../shared/hooks'

/** Shared look of the segments inside the scenario player capsule (30 px tall inside a 36 px capsule). */
const SEGMENT = 'focus-ring flex h-full shrink-0 items-center rounded-[9px] text-xs font-semibold transition-colors hover:bg-white/[0.07]'

function ScenarioPicker({ showWord, showName }: { showWord: boolean; showName: boolean }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const scenarios = useAppStore((s) => s.scenarios)
  const crew = useAppStore((s) => s.crew)
  const scenarioId = useAppStore((s) => s.clock.scenarioId)
  const { setScenario, reset } = useActions()
  const current = scenarios.find((s) => s.id === scenarioId)
  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Scenario: ${current?.name ?? scenarioId}. Choose a demo scenario`}
        className={clsx(SEGMENT, 'gap-1.5 px-2.5', open && 'bg-white/[0.07]')}
        title={`Scenario: ${current?.name ?? scenarioId}. Click to choose another demo scenario.`}
      >
        <FlaskConical size={15} className="shrink-0 text-accent" aria-hidden />
        {showWord && <span className="text-ink-500 whitespace-nowrap">Scenario</span>}
        {showName && <span className="text-ink-100 whitespace-nowrap">{current?.name ?? scenarioId}</span>}
        <ChevronDown size={13} className={clsx('shrink-0 text-ink-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Demo scenarios" align="left" className="w-[380px] p-2">
        <div className="px-2 pt-1 pb-2 text-[11px] text-ink-500">Pick a scripted situation. Simulated data, for demonstration only.</div>
        <ul role="listbox" aria-label="Scenarios" className="flex flex-col gap-1">
          {scenarios.map((sc) => {
            const sel = sc.id === scenarioId
            const target = sc.targetAstronautId ? crew.find((c) => c.id === sc.targetAstronautId) : null
            return (
              <li key={sc.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => {
                    setScenario(sc.id)
                    setOpen(false)
                  }}
                  className={clsx(
                    'focus-ring flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    sel ? 'bg-accent/[0.08] ring-1 ring-accent/30' : 'hover:bg-white/[0.05]',
                  )}
                >
                  <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1', sel ? 'bg-accent text-space-950 ring-accent' : 'ring-white/20')}>
                    {sel && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-100">
                      {sc.name}
                      <span className="text-[10px] font-medium text-ink-500">{target ? `affects ${target.callsign}` : 'affects whole crew'}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-300">{sc.description}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/[0.06] px-2 pt-2 pb-1">
          <span className="text-[11px] text-ink-500">Restart from the beginning of this scenario.</span>
          <button
            type="button"
            onClick={() => {
              reset()
              setOpen(false)
            }}
            className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-300 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-ink-100"
          >
            <RotateCcw size={13} aria-hidden /> Restart
          </button>
        </div>
      </Popover>
    </div>
  )
}

function SpeedPicker({ showIcon }: { showIcon: boolean }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const speed = useAppStore((s) => s.clock.speed)
  const { setSpeed } = useActions()
  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Simulation speed: ${speedLabel(speed)}`}
        className={clsx(SEGMENT, 'gap-1.5 px-2 text-ink-100', open && 'bg-white/[0.07]')}
        title="Simulation speed"
      >
        {showIcon && <Gauge size={14} className="text-ink-500" aria-hidden />}
        <span className="tabular min-w-[52px] text-left whitespace-nowrap">{speedLabel(speed)}</span>
        <ChevronDown size={13} className={clsx('text-ink-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} label="Simulation speed" align="left" className="w-[240px] p-1.5">
        <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Simulation speed</div>
        {SPEEDS.map((sp) => (
          <button
            key={sp.value}
            type="button"
            onClick={() => {
              setSpeed(sp.value)
              setOpen(false)
            }}
            className={clsx('focus-ring flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left', sp.value === speed ? 'bg-accent/[0.08]' : 'hover:bg-white/[0.05]')}
          >
            <span>
              <span className="block text-[13px] font-semibold text-ink-100">{sp.label}</span>
              <span className="block text-[11px] text-ink-500">{sp.hint}</span>
            </span>
            {sp.value === speed && <Check size={14} className="text-accent" />}
          </button>
        ))}
      </Popover>
    </div>
  )
}

const CapsuleDivider = () => <span className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.09]" aria-hidden />

/**
 * Scenario player capsule: scenario picker, play/pause, speed and restart in one 36 px pill.
 * The top bar decides which parts show (priority collapse); restart also lives in the scenario
 * popover and, when collapsed, in the Tools menu.
 */
export function ScenarioControl({
  showWord = true,
  showName = true,
  showSpeedIcon = true,
  showRestart = true,
}: {
  showWord?: boolean
  showName?: boolean
  showSpeedIcon?: boolean
  showRestart?: boolean
}) {
  const running = useAppStore((s) => s.clock.running)
  const { play, pause, reset } = useActions()
  const playLabel = running ? 'Pause simulation (Space)' : 'Play simulation (Space)'
  return (
    <div
      data-tour="scenario"
      role="group"
      aria-label="Scenario player"
      className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl bg-white/[0.035] p-[3px] ring-1 ring-white/[0.08]"
    >
      <ScenarioPicker showWord={showWord} showName={showName} />
      <CapsuleDivider />
      <button
        type="button"
        aria-label={playLabel}
        title={playLabel}
        onClick={() => (running ? pause() : play())}
        className={clsx(SEGMENT, 'w-[30px] justify-center', running ? 'text-ink-300 hover:text-ink-100' : 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgba(94,234,212,0.35)]')}
      >
        {running ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
      </button>
      <SpeedPicker showIcon={showSpeedIcon} />
      {showRestart && (
        <button type="button" aria-label="Restart scenario" title="Restart scenario" onClick={() => reset()} className={clsx(SEGMENT, 'w-[30px] justify-center text-ink-300 hover:text-ink-100')}>
          <RotateCcw size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
