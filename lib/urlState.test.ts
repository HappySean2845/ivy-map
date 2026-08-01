import { describe, expect, it } from 'vitest'

import { DEFAULT_FILTERS } from './filters'
import { parseFilters, toQueryString } from './urlState'

describe('data mode URL state', () => {
  it('defaults to the feeder-school view', () => {
    expect(parseFilters(new URLSearchParams()).dataMode).toBe('feeders')
  })

  it('round-trips the official admissions tab', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      dataMode: 'official' as const,
      universityId: 'harvard',
      gate: { ...DEFAULT_FILTERS.gate },
    }

    const query = toQueryString(filters)
    expect(query).toContain('view=official')
    expect(parseFilters(new URLSearchParams(query))).toEqual(filters)
  })

  it('falls back to the feeder view for unknown values', () => {
    expect(parseFilters(new URLSearchParams('view=unknown')).dataMode).toBe('feeders')
  })
})
