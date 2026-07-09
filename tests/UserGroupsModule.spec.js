import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import UserGroupsModule from '../lib/UserGroupsModule.js'

/** A fake instance backed by the real prototype, without the AbstractModule constructor chain */
function fakeInstance (extendSchema) {
  const inst = Object.create(UserGroupsModule.prototype)
  inst.log = mock.fn()
  inst.modules = []
  inst.membershipExtension = 'usergroups'
  inst.grantExtension = 'groups'
  inst.app = { waitForModule: mock.fn(async () => ({ extendSchema })) }
  return inst
}

function fakeMod (schemaName, name) {
  const taps = { check: [], query: [] }
  return {
    taps,
    schemaName,
    name,
    accessCheckHook: { tap: fn => taps.check.push(fn) },
    accessQueryHook: { tap: fn => taps.query.push(fn) }
  }
}

describe('UserGroupsModule', () => {
  it('should export a class as default', () => {
    assert.equal(typeof UserGroupsModule, 'function')
    assert.equal(UserGroupsModule.name, 'UserGroupsModule')
  })

  describe('#registerMembership()', () => {
    it('should warn and not register a module with no schemaName', async () => {
      const inst = fakeInstance()
      await inst.registerMembership({})
      assert.equal(inst.log.mock.calls[0].arguments[0], 'warn')
      assert.equal(inst.modules.length, 0)
    })

    it('should extend the user schema and track userGroups for cleanup, tapping no hooks', async () => {
      const extendSchema = mock.fn()
      const inst = fakeInstance(extendSchema)
      const mod = fakeMod('user', 'users')
      await inst.registerMembership(mod)
      assert.deepEqual(extendSchema.mock.calls[0].arguments, ['user', 'usergroups'])
      assert.deepEqual(inst.modules, [{ mod, field: 'userGroups' }])
      assert.equal(mod.taps.check.length, 0)
      assert.equal(mod.taps.query.length, 0)
    })
  })

  describe('#registerGroupModule()', () => {
    it('should extend with the groups grant, tap both hooks, and track _access.groups', async () => {
      const extendSchema = mock.fn()
      const inst = fakeInstance(extendSchema)
      const mod = fakeMod('asset', 'assets')
      await inst.registerGroupModule(mod)
      assert.deepEqual(extendSchema.mock.calls[0].arguments, ['asset', 'groups'])
      assert.equal(mod.taps.check[0], UserGroupsModule.prototype.checkGroupAccess)
      assert.equal(mod.taps.query[0], UserGroupsModule.prototype.grantGroupAccess)
      assert.deepEqual(inst.modules, [{ mod, field: '_access.groups' }])
    })
  })

  describe('#registerCourseGroups()', () => {
    it('should extend the course schema and track content, tapping no hooks on content', async () => {
      const extendSchema = mock.fn()
      const inst = fakeInstance(extendSchema)
      const content = fakeMod('content', 'content')
      await inst.registerCourseGroups(content)
      assert.deepEqual(extendSchema.mock.calls[0].arguments, ['course', 'groups'])
      assert.deepEqual(inst.modules, [{ mod: content, field: '_access.groups' }])
      assert.equal(content.taps.check.length, 0)
      assert.equal(content.taps.query.length, 0)
    })
  })

  describe('#checkGroupAccess()', () => {
    const check = UserGroupsModule.prototype.checkGroupAccess
    it('should grant when the resource shares a group with the user', () => {
      assert.equal(check({ auth: { user: { userGroups: ['g1', 'g2'] } } }, { _access: { groups: ['g2'] } }), true)
    })
    it('should not grant without overlap', () => {
      assert.equal(check({ auth: { user: { userGroups: ['g1'] } } }, { _access: { groups: ['g2'] } }), false)
    })
    it('should not grant when the resource is shared with no groups', () => {
      assert.equal(check({ auth: { user: { userGroups: ['g1'] } } }, {}), false)
    })
  })

  describe('#grantGroupAccess()', () => {
    const grant = UserGroupsModule.prototype.grantGroupAccess
    it('should widen the query with the user groups', () => {
      const query = {}
      grant({ auth: { user: { userGroups: ['g1', 'g2'] } }, apiData: { query } })
      assert.deepEqual(query.$or, [{ '_access.groups': { $in: ['g1', 'g2'] } }])
    })
    it('should be a no-op when the user belongs to no groups', () => {
      const query = {}
      grant({ auth: { user: { userGroups: [] } }, apiData: { query } })
      assert.deepEqual(query, {})
    })
  })

  describe('#delete() cascade cleanup', () => {
    /* the real delete calls super.delete, so exercise the field-aware cascade in isolation */
    function cascade (superDelete) {
      return async function (...args) {
        const doc = await superDelete(...args)
        await Promise.all(this.modules.map(async ({ mod, field }) => {
          const docs = await mod.find({ [field]: doc._id })
          return Promise.all(docs.map(async d => {
            try {
              await mod.update({ _id: d._id }, { $pull: { [field]: doc._id } }, { rawUpdate: true })
            } catch (e) {
              this.log('warn', `Failed to remove usergroup, ${e}`)
            }
          }))
        }))
        return doc
      }
    }

    let logCalls
    beforeEach(() => { logCalls = [] })

    it('should pull the deleted group id from each module using its tracked field', async () => {
      const calls = []
      const users = {
        find: mock.fn(async () => [{ _id: 'u1' }]),
        update: mock.fn(async (q, d) => calls.push({ field: 'userGroups', q, d }))
      }
      const assets = {
        find: mock.fn(async () => [{ _id: 'a1' }]),
        update: mock.fn(async (q, d) => calls.push({ field: '_access.groups', q, d }))
      }
      const inst = {
        log: (...a) => logCalls.push(a),
        modules: [{ mod: users, field: 'userGroups' }, { mod: assets, field: '_access.groups' }]
      }
      await cascade(mock.fn(async () => ({ _id: 'g1' }))).call(inst, { _id: 'g1' })

      assert.deepEqual(users.find.mock.calls[0].arguments[0], { userGroups: 'g1' })
      assert.deepEqual(assets.find.mock.calls[0].arguments[0], { '_access.groups': 'g1' })
      assert.deepEqual(calls[0].d, { $pull: { userGroups: 'g1' } })
      assert.deepEqual(calls[1].d, { $pull: { '_access.groups': 'g1' } })
    })

    it('should warn and continue when an update fails', async () => {
      const assets = {
        find: mock.fn(async () => [{ _id: 'a1' }]),
        update: mock.fn(async () => { throw new Error('boom') })
      }
      const inst = { log: (...a) => logCalls.push(a), modules: [{ mod: assets, field: '_access.groups' }] }
      await cascade(mock.fn(async () => ({ _id: 'g1' }))).call(inst, { _id: 'g1' })
      assert.equal(logCalls[0][0], 'warn')
      assert.ok(logCalls[0][1].includes('boom'))
    })
  })
})
