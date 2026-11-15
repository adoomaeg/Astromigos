import type { BodyRegionId, InterventionKind } from '../../types/domain'

export const INTERVENTION_LABEL: Record<InterventionKind, string> = {
  REST_PROTOCOL: 'Rest protocol',
  SLEEP_EXTENSION: 'Sleep extension',
  HYDRATION: 'Hydration',
  EXERCISE_ADJUSTMENT: 'Exercise adjustment',
  SENSOR_CHECK: 'Sensor check',
  CABIN_VENTILATION: 'Cabin ventilation',
  MEDICAL_CONSULT: 'Medical consult',
}

/** Region a logged intervention relates to (for click to focus). */
export const INTERVENTION_REGION: Record<InterventionKind, BodyRegionId | 'environment' | null> = {
  REST_PROTOCOL: 'heart',
  SLEEP_EXTENSION: 'brain',
  HYDRATION: 'kidneys',
  EXERCISE_ADJUSTMENT: 'muscles',
  SENSOR_CHECK: null,
  CABIN_VENTILATION: 'environment',
  MEDICAL_CONSULT: null,
}
