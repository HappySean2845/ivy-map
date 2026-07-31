import { describe, expect, it } from 'vitest'
import { extensionFor, extractRelevantLinks, inferEditionLabel } from './html'

describe('official source link discovery', () => {
  it('finds relative CDS documents and decodes query strings', () => {
    const html = `
      <a href="../files/CDS_2024-25.pdf?download=1&amp;x=2">Common Data Set 2024–25</a>
      <a href="/about">About us</a>
    `
    expect(extractRelevantLinks(html, 'https://example.edu/data/index.html')).toEqual([
      {
        url: 'https://example.edu/files/CDS_2024-25.pdf?download=1&x=2',
        text: 'Common Data Set 2024–25',
        kind: 'document',
        editionLabel: '2024-2025',
      },
    ])
  })

  it('keeps relevant HTML pages but labels them separately', () => {
    expect(
      extractRelevantLinks(
        '<a href="/institutional-data">Institutional Data</a>',
        'https://example.edu',
      ),
    ).toEqual([
      {
        url: 'https://example.edu/institutional-data',
        text: 'Institutional Data',
        kind: 'related_page',
        editionLabel: null,
      },
    ])
  })

  it('infers years and extensions', () => {
    expect(inferEditionLabel('CDS 2023/24')).toBe('2023-2024')
    expect(extensionFor('application/pdf', 'https://example.edu/download?id=1')).toBe('pdf')
  })
})
