import type { Alert, AstronautHealth, InterventionKind, Recommendation, Status } from '../../types/domain'

/** Never let acknowledgement or completion of a suggested action clear an unresolved emergency. */
export function needsMedicalAttention(astronautId: string, health: AstronautHealth | undefined, alerts: readonly Alert[], cabinStatus?: Status): boolean {
  return health?.risk.risk_level === 'CRITICAL'
    || Object.values(health?.metrics ?? {}).some((m) => m?.status === 'CRITICAL')
    || Object.values(health?.regions ?? {}).some((r) => r?.status === 'CRITICAL')
    || cabinStatus === 'CRITICAL'
    || alerts.some((a) => a.severity === 'CRITICAL' && a.resolvedAt == null && (a.astronautId === astronautId || a.astronautId == null))
}

const STEPS: Record<InterventionKind, readonly string[]> = {
  SENSOR_CHECK: ['Check the device connection, battery and sensor fit using its approved instructions.', 'Check skin contact and repeat the reading.', 'If data remains missing or questionable, notify the crew medical officer.'],
  REST_PROTOCOL: ['Pause the current activity and follow the approved rest protocol.', 'Repeat the relevant measurement at rest and monitor the trend.', 'Ask the crew medical officer to review persistent or worsening changes.'],
  SLEEP_EXTENSION: ['Review recent sleep, light exposure and workload with the crew lead.', 'Follow the approved plan for protected sleep and recovery time.', 'Record the next check-in and review whether the trend improves.'],
  HYDRATION: ['Review recent fluid intake and the hydration log.', 'Follow the mission’s approved hydration protocol.', 'Recheck the trend and request medical review if it does not improve.'],
  EXERCISE_ADJUSTMENT: ['Review recent exercise performance and workload with the trainer.', 'Agree on load and recovery adjustments using the approved exercise plan.', 'Record the next session and review the response with the trainer.'],
  CABIN_VENTILATION: ['Notify mission control and check the affected cabin system.', 'Follow the approved cabin procedure for the issue shown above.', 'Recheck cabin readings and affected crew signals; escalate if the problem persists.'],
  MEDICAL_CONSULT: ['Contact the crew medical officer or flight surgeon for review.', 'Share current readings, symptoms and recent changes.', 'Follow their instructions and the approved crew medical procedures.'],
}

const RULE_STEPS: Record<string, readonly string[]> = {
  'R-SPO2-01': ['Notify the crew medical officer about the blood oxygen reading.', 'Check sensor fit and skin contact, then repeat the reading without delaying medical help.', 'Request flight surgeon review if the abnormal reading persists or symptoms are present.'],
  'R-ENV-CO2-01': ['Notify mission control that cabin CO₂ has risen.', 'Follow the approved procedure to check air circulation and the CO₂ scrubber.', 'Monitor cabin CO₂ and crew breathing; escalate if readings remain abnormal.'],
  'R-ENV-CO2-02': ['Notify the crew medical officer and mission control about the affected signals.', 'Follow the approved CO₂ ventilation and scrubber-check procedure.', 'Monitor CO₂, breathing and reaction-time trends and request review if they persist.'],
  'R-ENV-TEMP-01': ['Notify mission control about the cabin temperature change.', 'Check cabin thermal control using the approved procedure.', 'Repeat the cabin measurement and report any crew symptoms.'],
  'R-ENV-RH-01': ['Notify mission control about the cabin humidity change.', 'Check cabin humidity control using the approved procedure.', 'Repeat the humidity measurement and report persistent abnormalities.'],
  'R-TEMP-01': ['Review thermal comfort and clothing layers.', 'Follow the approved thermal-comfort procedure and repeat the measurement.', 'Request medical review if the change persists or symptoms develop.'],
}

export function guidanceSteps(rec: Recommendation): readonly string[] {
  if (rec.ruleId === 'R-ONBOARD-01' || rec.title.startsWith('Crew medical officer:')) {
    return ['Notify the crew medical officer now.', 'Follow the approved onboard assessment protocol and send a health packet to Earth.', 'Continue onboard medical procedures while awaiting flight surgeon guidance.']
  }
  return RULE_STEPS[rec.ruleId] ?? (rec.interventionKind ? STEPS[rec.interventionKind] : [rec.title, 'Contact the responsible crew medical officer or mission control team.', 'Follow the approved mission procedure and continue monitoring the affected readings.'])
}
