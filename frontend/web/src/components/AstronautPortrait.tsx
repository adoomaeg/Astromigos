import { useState } from 'react'
import type { Astronaut } from '../types/domain'

export function AstronautPortrait({ astronaut, className = '' }: { astronaut: Astronaut; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>()
  const initials = astronaut.callsign.split(' ').map((part) => part[0]).slice(0, 2).join('')
  return astronaut.portrait && failedSrc !== astronaut.portrait ? (
    <img src={astronaut.portrait} alt={astronaut.callsign} className={`astronaut-portrait ${className}`} onError={() => setFailedSrc(astronaut.portrait)} />
  ) : (
    <span className={`portrait-fallback ${className}`} aria-label={astronaut.callsign}>{initials}</span>
  )
}
