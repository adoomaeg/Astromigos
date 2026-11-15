/** Builds a group of anatomy meshes off the main thread and transfers the typed arrays back. */
import { buildParts } from './geometry/build.ts'
import type { PartId } from './geometry/build.ts'
import type { Sex } from './geometry/rig.ts'

interface BuildRequest {
  sex: Sex
  parts: PartId[]
}

self.onmessage = (e: MessageEvent<BuildRequest>) => {
  const out = buildParts(e.data.sex, e.data.parts)
  const transfer: ArrayBuffer[] = []
  for (const m of Object.values(out)) {
    if (!m) continue
    transfer.push(m.position.buffer as ArrayBuffer, m.normal.buffer as ArrayBuffer, m.index.buffer as ArrayBuffer)
    if (m.dist) transfer.push(m.dist.buffer as ArrayBuffer)
  }
  self.postMessage(out, { transfer })
}
