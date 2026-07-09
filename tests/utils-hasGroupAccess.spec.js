import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasGroupAccess } from '../lib/utils/hasGroupAccess.js'

describe('hasGroupAccess()', () => {
  const cases = [
    { name: 'resource shared with no groups (undefined)', docGroups: undefined, userGroups: ['a'], expected: false },
    { name: 'resource shared with no groups (empty)', docGroups: [], userGroups: ['a'], expected: false },
    { name: 'user in no groups', docGroups: ['a'], userGroups: [], expected: false },
    { name: 'user in no groups (undefined)', docGroups: ['a'], userGroups: undefined, expected: false },
    { name: 'shared group and user overlap', docGroups: ['a', 'b'], userGroups: ['b', 'c'], expected: true },
    { name: 'no overlap', docGroups: ['a', 'b'], userGroups: ['c', 'd'], expected: false },
    { name: 'ObjectId-like values compared via toString', docGroups: [{ toString: () => 'x' }], userGroups: [{ toString: () => 'x' }], expected: true }
  ]
  for (const { name, docGroups, userGroups, expected } of cases) {
    it(`should return ${expected} when ${name}`, () => {
      assert.equal(hasGroupAccess(docGroups, userGroups), expected)
    })
  }
})
