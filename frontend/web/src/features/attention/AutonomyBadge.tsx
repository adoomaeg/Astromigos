import { Hourglass, Rocket, Stethoscope } from 'lucide-react'
import type { Recommendation } from '../../types/domain'
import { Badge } from '../../components/ui'
import { LARGE_DELAY_SEC, roundTripText, useCommDelaySec } from '../shared/hooks'

/**
 * Who can close the loop on a recommendation.
 * ONBOARD: the crew can act now. GROUND_REVIEW: needs the flight surgeon on Earth, so with a
 * large comm delay the earliest Earth reply time is shown too.
 */
export function AutonomyBadge({ rec, size = 'sm' }: { rec: Recommendation; size?: 'sm' | 'lg' }) {
  const delay = useCommDelaySec()
  const autonomy = rec.autonomy ?? (rec.requiresHumanReview ? 'GROUND_REVIEW' : null)
  if (!autonomy) return null
  const big = size === 'lg' ? 'px-2 py-1 text-[11px]' : undefined
  if (autonomy === 'ONBOARD') {
    return (
      <Badge tone="accent" className={big} icon={<Rocket size={size === 'lg' ? 12 : 10} aria-hidden />} title="The crew can do this on board right now, no need to wait for Earth.">
        Can act on board now
      </Badge>
    )
  }
  const far = delay >= LARGE_DELAY_SEC
  return (
    <>
      <Badge tone="warn" className={big} icon={<Stethoscope size={size === 'lg' ? 12 : 10} aria-hidden />} title="A flight surgeon on Earth should review this.">
        Needs flight surgeon
      </Badge>
      {far && (
        <Badge tone="neutral" className={big} icon={<Hourglass size={size === 'lg' ? 12 : 10} aria-hidden />} title="Earliest possible answer from Earth: one-way delay there and back.">
          Earth reply in {roundTripText(delay)}+
        </Badge>
      )}
    </>
  )
}
