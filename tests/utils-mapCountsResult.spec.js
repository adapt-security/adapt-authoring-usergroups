import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapCountsResult } from '../lib/utils/mapCountsResult.js'

describe('mapCountsResult', () => {
  it('maps aggregation rows to an id → count object', () => {
    assert.deepEqual(
      mapCountsResult([{ _id: 'a', count: 3 }, { _id: 'b', count: 1 }]),
      { a: 3, b: 1 }
    )
  })

  it('returns an empty object for no results', () => {
    assert.deepEqual(mapCountsResult([]), {})
    assert.deepEqual(mapCountsResult(), {})
  })

  it('stringifies ObjectId-like keys', () => {
    const oid = { toString: () => '507f1f77bcf86cd799439011' }
    assert.deepEqual(mapCountsResult([{ _id: oid, count: 2 }]), { '507f1f77bcf86cd799439011': 2 })
  })

  it('skips null ids (e.g. unwound empty arrays)', () => {
    assert.deepEqual(mapCountsResult([{ _id: null, count: 5 }, { _id: 'a', count: 1 }]), { a: 1 })
  })
})
