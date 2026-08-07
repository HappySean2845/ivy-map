import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import manifest from '@/data/university-logo-sources.json'
import profiles from '@/data/raw/university-profiles.json'

const ROOT = resolve(import.meta.dirname, '../..')

describe('university logo assets', () => {
  it('covers every university profile with a unique local PNG', () => {
    expect(profiles.profiles).toHaveLength(32)
    expect(manifest.logos).toHaveLength(32)

    const byUniversity = new Map(manifest.logos.map((logo) => [logo.universityId, logo]))
    expect(byUniversity.size).toBe(32)
    for (const profile of profiles.profiles) {
      const logo = byUniversity.get(profile.universityId)
      expect(logo, profile.universityId).toBeDefined()
      expect(profile.logoPath).toBe(logo?.path)
      expect(profile.logoPath).toMatch(/^\/university-logos\/[a-z0-9-]+\.png$/)
    }
  })

  it('publishes compact, reproducible display derivatives', () => {
    let totalBytes = 0
    for (const logo of manifest.logos) {
      const buffer = readFileSync(resolve(ROOT, `public${logo.path}`))
      const hash = createHash('sha256').update(buffer).digest('hex')
      expect(buffer.subarray(0, 8).toString('hex'), logo.universityId).toBe('89504e470d0a1a0a')
      expect(hash, logo.universityId).toBe(logo.display.sha256)
      expect(logo.display.width, logo.universityId).toBeLessThanOrEqual(192)
      expect(logo.display.height, logo.universityId).toBeLessThanOrEqual(192)
      expect(logo.display.byteSize, logo.universityId).toBe(buffer.length)
      expect(logo.sourcePage).toMatch(/^https:\/\//)
      totalBytes += buffer.length
    }
    expect(totalBytes).toBeLessThan(750_000)
  })
})
