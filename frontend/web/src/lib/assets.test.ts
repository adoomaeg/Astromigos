import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicAsset } from './assets'

afterEach(() => vi.unstubAllEnvs())
describe('public assets on GitHub Pages', () => {
  it('keeps crew portraits and branding inside a repository subpath', () => {
    vi.stubEnv('BASE_URL', '/astromigos/')
    expect(publicAsset('/crew/reid-wiseman.jpg')).toBe('/astromigos/crew/reid-wiseman.jpg')
    expect(publicAsset('nasa-logo.svg')).toBe('/astromigos/nasa-logo.svg')
    expect(publicAsset('astromigos-logo.jpeg')).toBe('/astromigos/astromigos-logo.jpeg')
  })
  it('retains root-hosted development paths', () => {
    vi.stubEnv('BASE_URL', '/')
    expect(publicAsset('/crew/jeremy-hansen.jpg')).toBe('/crew/jeremy-hansen.jpg')
  })
})
