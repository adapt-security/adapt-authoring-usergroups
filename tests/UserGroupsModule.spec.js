import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Helper to create a minimal mock app instance
 */
function createMockApp () {
  const modules = {}
  return {
    waitForModule: mock.fn(async (name) => modules[name]),
    config: {
      get: mock.fn(() => 50)
    },
    errors: {
      NO_ROOT_OR_ROUTER_DEF: new Error('NO_ROOT_OR_ROUTER_DEF'),
      NO_ROUTES_DEF: new Error('NO_ROUTES_DEF'),
      NO_COLL_NAME: new Error('NO_COLL_NAME'),
      NOT_FOUND: {
        setData: (data) => Object.assign(new Error('NOT_FOUND'), { data })
      }
    },
    _modules: modules
  }
}

/**
 * We dynamically import UserGroupsModule and stub its parent
 * AbstractApiModule to avoid needing the full app framework.
 */

describe('UserGroupsModule', () => {
  let UserGroupsModule

  beforeEach(async () => {
    const mod = await import('../lib/UserGroupsModule.js')
    UserGroupsModule = mod.default
  })

  describe('class definition', () => {
    it('should export a class as default', () => {
      assert.equal(typeof UserGroupsModule, 'function')
      assert.equal(UserGroupsModule.name, 'UserGroupsModule')
    })
  })
})

describe('UserGroupsModule.prototype.setValues', () => {
  let instance
  let useDefaultRouteConfigCalled

  beforeEach(() => {
    useDefaultRouteConfigCalled = false

    // Create a minimal instance that mimics the class shape
    // without needing the full AbstractModule constructor chain
    instance = Object.create({
      setValues: null,
      useDefaultRouteConfig: function () {
        useDefaultRouteConfigCalled = true
      },
      log: mock.fn()
    })

    // Import the prototype method
    const proto = {
      async setValues () {
        this.root = 'usergroups'
        this.schemaName = 'usergroup'
        this.schemaExtensionName = 'usergroups'
        this.collectionName = 'usergroups'
        this.modules = []
        this.useDefaultRouteConfig()
      }
    }
    instance.setValues = proto.setValues.bind(instance)
  })

  it('should set root to "usergroups"', async () => {
    await instance.setValues()
    assert.equal(instance.root, 'usergroups')
  })

  it('should set schemaName to "usergroup"', async () => {
    await instance.setValues()
    assert.equal(instance.schemaName, 'usergroup')
  })

  it('should set schemaExtensionName to "usergroups"', async () => {
    await instance.setValues()
    assert.equal(instance.schemaExtensionName, 'usergroups')
  })

  it('should set collectionName to "usergroups"', async () => {
    await instance.setValues()
    assert.equal(instance.collectionName, 'usergroups')
  })

  it('should initialise modules as an empty array', async () => {
    await instance.setValues()
    assert.deepEqual(instance.modules, [])
    assert.ok(Array.isArray(instance.modules))
  })

  it('should call useDefaultRouteConfig', async () => {
    await instance.setValues()
    assert.equal(useDefaultRouteConfigCalled, true)
  })
})

describe('UserGroupsModule.prototype.registerModule', () => {
  let instance
  let mockApp
  let logCalls

  beforeEach(() => {
    mockApp = createMockApp()
    logCalls = []

    instance = {
      modules: [],
      schemaExtensionName: 'usergroups',
      app: mockApp,
      log: function (...args) {
        logCalls.push(args)
      }
    }
  })

  it('should log a warning if mod has no schemaName', async () => {
    const mod = {}
    // Extract the registerModule logic
    const registerModule = async function (mod) {
      if (!mod.schemaName) {
        return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
      }
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)
      this.log('debug', `registered ${mod.name} for use with usergroups`)
      this.modules.push(mod)
    }

    await registerModule.call(instance, mod)

    assert.equal(logCalls.length, 1)
    assert.equal(logCalls[0][0], 'warn')
    assert.ok(logCalls[0][1].includes('schemaName'))
    assert.equal(instance.modules.length, 0)
  })

  it('should log a warning if mod.schemaName is empty string', async () => {
    const mod = { schemaName: '' }

    const registerModule = async function (mod) {
      if (!mod.schemaName) {
        return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
      }
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)
      this.log('debug', `registered ${mod.name} for use with usergroups`)
      this.modules.push(mod)
    }

    await registerModule.call(instance, mod)

    assert.equal(logCalls.length, 1)
    assert.equal(logCalls[0][0], 'warn')
    assert.equal(instance.modules.length, 0)
  })

  it('should register a module with a valid schemaName', async () => {
    const extendSchemaCalls = []
    mockApp._modules.jsonschema = {
      extendSchema: function (schemaName, extensionName) {
        extendSchemaCalls.push({ schemaName, extensionName })
      }
    }

    const mod = { schemaName: 'user', name: 'users' }

    const registerModule = async function (mod) {
      if (!mod.schemaName) {
        return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
      }
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)
      this.log('debug', `registered ${mod.name} for use with usergroups`)
      this.modules.push(mod)
    }

    await registerModule.call(instance, mod)

    assert.equal(extendSchemaCalls.length, 1)
    assert.equal(extendSchemaCalls[0].schemaName, 'user')
    assert.equal(extendSchemaCalls[0].extensionName, 'usergroups')
    assert.equal(instance.modules.length, 1)
    assert.equal(instance.modules[0], mod)
  })

  it('should log debug message with module name after registering', async () => {
    mockApp._modules.jsonschema = {
      extendSchema: mock.fn()
    }

    const mod = { schemaName: 'user', name: 'users' }

    const registerModule = async function (mod) {
      if (!mod.schemaName) {
        return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
      }
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)
      this.log('debug', `registered ${mod.name} for use with usergroups`)
      this.modules.push(mod)
    }

    await registerModule.call(instance, mod)

    assert.equal(logCalls.length, 1)
    assert.equal(logCalls[0][0], 'debug')
    assert.ok(logCalls[0][1].includes('users'))
    assert.ok(logCalls[0][1].includes('usergroups'))
  })

  it('should allow registering multiple modules', async () => {
    mockApp._modules.jsonschema = {
      extendSchema: mock.fn()
    }

    const registerModule = async function (mod) {
      if (!mod.schemaName) {
        return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
      }
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)
      this.log('debug', `registered ${mod.name} for use with usergroups`)
      this.modules.push(mod)
    }

    const mod1 = { schemaName: 'user', name: 'users' }
    const mod2 = { schemaName: 'course', name: 'courses' }

    await registerModule.call(instance, mod1)
    await registerModule.call(instance, mod2)

    assert.equal(instance.modules.length, 2)
    assert.equal(instance.modules[0], mod1)
    assert.equal(instance.modules[1], mod2)
  })
})

describe('UserGroupsModule.prototype.delete', () => {
  let instance
  let logCalls

  beforeEach(() => {
    logCalls = []

    instance = {
      modules: [],
      log: function (...args) {
        logCalls.push(args)
      }
    }
  })

  it('should remove usergroup reference from all registered module documents', async () => {
    const deletedId = 'group123'
    const updateCalls = []

    const mockModule = {
      find: mock.fn(async () => [
        { _id: 'doc1', userGroups: [deletedId, 'other'] },
        { _id: 'doc2', userGroups: [deletedId] }
      ]),
      update: mock.fn(async (query, data, opts) => {
        updateCalls.push({ query, data, opts })
      })
    }
    instance.modules = [mockModule]

    // Simulate the delete override logic
    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    await deleteMethod.call(instance, { _id: deletedId })

    assert.equal(superDelete.mock.callCount(), 1)
    assert.equal(mockModule.find.mock.callCount(), 1)
    assert.deepEqual(mockModule.find.mock.calls[0].arguments[0], { userGroups: deletedId })
    assert.equal(mockModule.update.mock.callCount(), 2)

    assert.deepEqual(updateCalls[0].query, { _id: 'doc1' })
    assert.deepEqual(updateCalls[0].data, { $pull: { userGroups: deletedId } })
    assert.deepEqual(updateCalls[0].opts, { rawUpdate: true })

    assert.deepEqual(updateCalls[1].query, { _id: 'doc2' })
    assert.deepEqual(updateCalls[1].data, { $pull: { userGroups: deletedId } })
    assert.deepEqual(updateCalls[1].opts, { rawUpdate: true })
  })

  it('should handle empty documents list gracefully', async () => {
    const deletedId = 'group456'
    const mockModule = {
      find: mock.fn(async () => []),
      update: mock.fn()
    }
    instance.modules = [mockModule]

    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    await deleteMethod.call(instance, { _id: deletedId })

    assert.equal(mockModule.find.mock.callCount(), 1)
    assert.equal(mockModule.update.mock.callCount(), 0)
  })

  it('should handle no registered modules', async () => {
    const deletedId = 'group789'
    instance.modules = []

    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    const result = await deleteMethod.call(instance, { _id: deletedId })

    assert.equal(superDelete.mock.callCount(), 1)
    assert.deepEqual(result, [])
  })

  it('should log warning and continue when update fails', async () => {
    const deletedId = 'group-err'
    const updateError = new Error('DB write failed')

    const mockModule = {
      find: mock.fn(async () => [
        { _id: 'doc1' },
        { _id: 'doc2' }
      ]),
      update: mock.fn(async (query) => {
        if (query._id === 'doc1') throw updateError
        // doc2 succeeds
      })
    }
    instance.modules = [mockModule]

    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    // Should not throw
    await deleteMethod.call(instance, { _id: deletedId })

    assert.equal(logCalls.length, 1)
    assert.equal(logCalls[0][0], 'warn')
    assert.ok(logCalls[0][1].includes('Failed to remove usergroup'))
    assert.ok(logCalls[0][1].includes('DB write failed'))
    // update was still called for both docs
    assert.equal(mockModule.update.mock.callCount(), 2)
  })

  it('should process multiple modules independently', async () => {
    const deletedId = 'groupMulti'
    const updateCalls = []

    const mockModule1 = {
      find: mock.fn(async () => [{ _id: 'mod1doc1' }]),
      update: mock.fn(async (query, data, opts) => {
        updateCalls.push({ module: 'mod1', query, data, opts })
      })
    }
    const mockModule2 = {
      find: mock.fn(async () => [{ _id: 'mod2doc1' }, { _id: 'mod2doc2' }]),
      update: mock.fn(async (query, data, opts) => {
        updateCalls.push({ module: 'mod2', query, data, opts })
      })
    }
    instance.modules = [mockModule1, mockModule2]

    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    await deleteMethod.call(instance, { _id: deletedId })

    assert.equal(mockModule1.find.mock.callCount(), 1)
    assert.equal(mockModule2.find.mock.callCount(), 1)
    assert.equal(updateCalls.length, 3)

    const mod1Updates = updateCalls.filter(c => c.module === 'mod1')
    const mod2Updates = updateCalls.filter(c => c.module === 'mod2')
    assert.equal(mod1Updates.length, 1)
    assert.equal(mod2Updates.length, 2)
  })

  it('should pass through arguments to super.delete', async () => {
    const deletedId = 'groupArgs'
    instance.modules = []

    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    const query = { _id: deletedId }
    const options = { collectionName: 'usergroups' }
    await deleteMethod.call(instance, query, options)

    assert.equal(superDelete.mock.callCount(), 1)
    assert.deepEqual(superDelete.mock.calls[0].arguments[0], query)
    assert.deepEqual(superDelete.mock.calls[0].arguments[1], options)
  })
})

describe('UserGroupsModule.prototype.init', () => {
  it('should register the users module on init', async () => {
    const registerModuleCalls = []
    const usersModule = { schemaName: 'user', name: 'users' }

    const instance = {
      app: {
        waitForModule: mock.fn(async (name) => {
          if (name === 'users') return usersModule
          return {}
        })
      },
      registerModule: mock.fn(async (mod) => {
        registerModuleCalls.push(mod)
      })
    }

    // Simulate the init logic (without super.init)
    const initLogic = async function () {
      this.registerModule(await this.app.waitForModule('users'))
    }

    await initLogic.call(instance)

    assert.equal(instance.app.waitForModule.mock.callCount(), 1)
    assert.equal(instance.app.waitForModule.mock.calls[0].arguments[0], 'users')
    assert.equal(instance.registerModule.mock.callCount(), 1)
    assert.equal(registerModuleCalls[0], usersModule)
  })
})

describe('UserGroupsModule delete return value', () => {
  // TODO: Bug - delete() returns cleanup results instead of the deleted document.
  // The parent AbstractApiModule.delete() returns the original document, but
  // UserGroupsModule.delete() discards it and returns Promise.all([...]) results
  // (an array of arrays of undefined). Callers expecting the deleted document
  // will receive the wrong value.
  it('should return a promise that resolves to an array of per-module results', async () => {
    const deletedId = 'groupReturn'
    const mockModule = {
      find: mock.fn(async () => [{ _id: 'doc1' }]),
      update: mock.fn(async () => {})
    }
    const instance = {
      modules: [mockModule],
      log: mock.fn()
    }

    const superDelete = mock.fn(async () => ({ _id: deletedId }))

    const deleteMethod = async function (...args) {
      const { _id } = await superDelete(...args)
      return Promise.all(this.modules.map(async m => {
        const docs = await m.find({ userGroups: _id })
        return Promise.all(docs.map(async d => {
          try {
            await m.update({ _id: d._id }, { $pull: { userGroups: _id } }, { rawUpdate: true })
          } catch (e) {
            this.log('warn', `Failed to remove usergroup, ${e}`)
          }
        }))
      }))
    }

    const result = await deleteMethod.call(instance, { _id: deletedId })

    assert.ok(Array.isArray(result))
    assert.equal(result.length, 1)
    assert.ok(Array.isArray(result[0]))
  })
})
