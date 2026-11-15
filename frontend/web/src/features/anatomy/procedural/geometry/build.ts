/** Entry point of the procedural anatomy build. Pure TS, no DOM, runs inside a Web Worker. */
import type { MeshData } from './sdf.ts'
import { makeRig } from './rig.ts'
import type { Sex } from './rig.ts'
import { buildHands, buildSkinHalf, musclePrims, skinPrims } from './body.ts'
import { polygonizeLite } from './simplify.ts'
import { buildAxialSkeleton, buildLimbSkeleton } from './skeleton.ts'
import { buildBrain, buildBronchi, buildContext, buildEyes, buildHeart, buildKidneys, buildLung, buildPickProxies } from './organs.ts'
import { buildVessels } from './vessels.ts'

export type PartId =
  | 'skinUpper'
  | 'skinUpperLo'
  | 'skinLower'
  | 'skinLowerLo'
  | 'hands'
  | 'handsLo'
  | 'muscles'
  | 'skelAxial'
  | 'skelLimbs'
  | 'brain'
  | 'eyes'
  | 'heart'
  | 'lungL'
  | 'lungR'
  | 'bronchi'
  | 'kidneys'
  | 'context'
  | 'vessels'
  | 'pickBody'
  | 'pickBrain'
  | 'pickHeart'
  | 'pickLungs'
  | 'pickKidneys'

export type AnatomyParts = Record<PartId, MeshData>

/** Work is split into groups (roughly equal cost) so several workers can build in parallel. */
export const BUILD_GROUPS: PartId[][] = [
  ['skinUpper', 'skinUpperLo'],
  ['skinLower', 'skinLowerLo'],
  ['hands', 'handsLo', 'pickBody', 'eyes', 'vessels'],
  ['skelAxial'],
  ['skelLimbs', 'kidneys', 'bronchi'],
  ['muscles'],
  ['brain', 'heart'],
  ['lungL', 'lungR', 'context', 'pickBrain', 'pickHeart', 'pickLungs', 'pickKidneys'],
]

/** Render geometries assembled from several built parts (merged on the main thread). */
export const COMPOSITES = {
  skin: ['skinUpper', 'skinLower', 'hands'],
  skinLo: ['skinUpperLo', 'skinLowerLo', 'handsLo'],
  skeleton: ['skelAxial', 'skelLimbs'],
} as const satisfies Record<string, readonly PartId[]>

export function buildParts(sex: Sex, ids: PartId[]): Partial<AnatomyParts> {
  const rig = makeRig(sex)
  const out: Partial<AnatomyParts> = {}
  const want = new Set(ids)
  for (const upper of [true, false]) {
    const [hi, lo] = upper ? (['skinUpper', 'skinUpperLo'] as const) : (['skinLower', 'skinLowerLo'] as const)
    if (!want.has(hi) && !want.has(lo)) continue
    const piece = buildSkinHalf(rig, upper)
    if (want.has(hi)) out[hi] = piece.hi
    if (want.has(lo)) out[lo] = piece.lo
  }
  if (want.has('hands') || want.has('handsLo')) {
    const piece = buildHands(rig)
    if (want.has('hands')) out.hands = piece.hi
    if (want.has('handsLo')) out.handsLo = piece.lo
  }
  if (want.has('pickBody')) out.pickBody = polygonizeLite(skinPrims(rig), 0.022, 0.004)
  if (want.has('muscles')) out.muscles = polygonizeLite(musclePrims(rig), 0.006, 0.00045, { lipschitz: 1.3 })
  if (want.has('skelAxial')) out.skelAxial = buildAxialSkeleton(rig)
  if (want.has('skelLimbs')) out.skelLimbs = buildLimbSkeleton(rig)
  if (want.has('brain')) out.brain = buildBrain()
  if (want.has('eyes')) out.eyes = buildEyes()
  if (want.has('heart')) out.heart = buildHeart()
  if (want.has('lungL')) out.lungL = buildLung(1)
  if (want.has('lungR')) out.lungR = buildLung(-1)
  if (want.has('bronchi')) out.bronchi = buildBronchi()
  if (want.has('kidneys')) out.kidneys = buildKidneys()
  if (want.has('context')) out.context = buildContext()
  if (want.has('vessels')) out.vessels = buildVessels(rig)
  if (want.has('pickBrain') || want.has('pickHeart') || want.has('pickLungs') || want.has('pickKidneys')) {
    const p = buildPickProxies()
    out.pickBrain = p.brain
    out.pickHeart = p.heart
    out.pickLungs = p.lungs
    out.pickKidneys = p.kidneys
  }
  return out
}
