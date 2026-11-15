import { useEffect, useRef } from 'react'
import { useAppStore } from '../../state/store'
import { useUiStore } from '../../app/uiStore'

/**
 * Optional audible cue for new CRITICAL alerts (default OFF, toggled in the alerts drawer).
 * A short two-tone chime made with WebAudio; no audio files.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    return ctx
  } catch {
    return null
  }
}

/** Call from a user gesture (the toggle) so browsers allow later playback. */
export function primeAlertAudio() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

export function playAlertTone() {
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  const t0 = c.currentTime + 0.02
  const notes: [number, number][] = [
    [880, 0],
    [660, 0.2],
  ]
  for (const [freq, at] of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + at)
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.17)
    osc.connect(gain).connect(c.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + 0.2)
  }
}

/** Plays the chime once for each new unacknowledged CRITICAL alert while sound is on. */
export function useCriticalSound() {
  const soundOn = useUiStore((s) => s.soundOn)
  const alerts = useAppStore((s) => s.alerts)
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const crit = alerts.filter((a) => a.severity === 'CRITICAL' && a.acknowledgedAt == null && a.resolvedAt == null)
    const key = (a: { id: string; createdAt: number }) => `${a.id}@${a.createdAt}`
    if (!seen.current) {
      seen.current = new Set(crit.map(key))
      return
    }
    let fresh = false
    for (const a of crit) {
      const k = key(a)
      if (!seen.current.has(k)) {
        seen.current.add(k)
        fresh = true
      }
    }
    if (fresh && soundOn) playAlertTone()
  }, [alerts, soundOn])
}
