import { TriangleAlert } from 'lucide-react'
import { useAppStore } from '../../state/store'
import type { Recommendation } from '../../types/domain'
import { guidanceSteps, needsMedicalAttention } from './actionGuidance'

export function useNeedsMedicalAttention(astronautId: string) {
  return useAppStore((s) => needsMedicalAttention(astronautId, s.health[astronautId], s.alerts, s.environment.status))
}

/** Shared by ground, system-detail and crew views. No dismiss or “fixed” control. */
export function MedicalEscalation({ astronautId }: { astronautId: string }) {
  const urgent = useNeedsMedicalAttention(astronautId)
  if (!urgent) return null
  return (
    <div role="alert" className="mb-4 rounded-xl border-2 border-critical bg-critical/10 p-4">
      <div className="flex items-start gap-2 text-critical">
        <TriangleAlert className="mt-0.5 shrink-0" size={20} aria-hidden />
        <h3 className="text-base font-bold leading-snug">Seek medical attention ASAP</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-100">Critical condition detected. No verified self-care fix is available in this app. Contact the crew medical officer immediately and request flight surgeon support. Follow approved emergency procedures; do not wait for the app or an Earth reply before seeking onboard help.</p>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-300">Suggested steps are supportive actions, not a confirmed treatment. Logging an action does not mean the problem is resolved.</p>
    </div>
  )
}

export function RecommendationSteps({ rec }: { rec: Recommendation }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <h4 className="text-xs font-semibold text-ink-100">Suggested next steps</h4>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-ink-300">
        {guidanceSteps(rec).map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  )
}
