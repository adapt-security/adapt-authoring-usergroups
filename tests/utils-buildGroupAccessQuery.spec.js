import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildGroupAccessQuery } from '../lib/utils/buildGroupAccessQuery.js'

describe('buildGroupAccessQuery()', () => {
  it('should always allow public docs (no groups) plus the user\'s groups', () => {
    assert.deepEqual(buildGroupAccessQuery(['a', 'b']), {
      $or: [
        { userGroups: { $exists: false } },
        { userGroups: { $size: 0 } },
        { userGroups: { $in: ['a', 'b'] } }
      ]
    })
  })

  it('should still expose public docs when the user has no groups', () => {
    const clause = buildGroupAccessQuery([])
    // the $in matches nothing, but the public clauses remain
    assert.deepEqual(clause.$or.slice(0, 2), [
      { userGroups: { $exists: false } },
      { userGroups: { $size: 0 } }
    ])
    assert.deepEqual(clause.$or[2], { userGroups: { $in: [] } })
  })

  it('should treat a missing user-groups argument as no groups', () => {
    assert.deepEqual(buildGroupAccessQuery(), {
      $or: [
        { userGroups: { $exists: false } },
        { userGroups: { $size: 0 } },
        { userGroups: { $in: [] } }
      ]
    })
  })
})
