import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasGroupAccess } from '../lib/utils/hasGroupAccess.js'

describe('hasGroupAccess', () => {
  const cases = [
    { name: 'doc has no groups → public', doc: [], user: ['a'], expected: true },
    { name: 'doc groups undefined → public', doc: undefined, user: ['a'], expected: true },
    { name: 'doc restricted, user has no groups → denied', doc: ['a'], user: [], expected: false },
    { name: 'doc restricted, user groups undefined → denied', doc: ['a'], user: undefined, expected: false },
    { name: 'shared group → allowed', doc: ['a', 'b'], user: ['b', 'c'], expected: true },
    { name: 'no shared group → denied', doc: ['a', 'b'], user: ['c', 'd'], expected: false }
  ]
  for (const { name, doc, user, expected } of cases) {
    it(name, () => assert.equal(hasGroupAccess(doc, user), expected))
  }

  it('compares by string value (ObjectId-like objects)', () => {
    const oid = v => ({ toString: () => v })
    assert.equal(hasGroupAccess([oid('x')], [oid('x')]), true)
    assert.equal(hasGroupAccess([oid('x')], [oid('y')]), false)
  })
})
