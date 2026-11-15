/**
 * Writes uncompressed copies of the published GLBs (meshopt and quantization removed) so tools
 * without a meshopt decoder, such as the Blender glTF importer used by render_previews.py, can
 * open exactly the geometry the web viewer receives.
 *
 * Usage: node scripts/anatomy/decode-for-preview.mjs <public/anatomy> <out dir>
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { dequantize } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const [src, out] = process.argv.slice(2).map((p) => resolve(p))
if (!src || !out) throw new Error('Usage: node decode-for-preview.mjs <atlas dir> <out dir>')
mkdirSync(out, { recursive: true })
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'))
for (const sys of manifest.systems) {
  const doc = await io.read(join(src, sys.file))
  await doc.transform(dequantize())
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose()
  await io.write(join(out, sys.file), doc)
  console.log(`[decode] ${sys.file}`)
}
