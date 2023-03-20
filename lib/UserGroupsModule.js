import AbstractApiModule from 'adapt-authoring-api'
/**
 * Module which handles groups of users
 * @extends {AbstractApiModule}
 */
class UserGroupsModule extends AbstractApiModule {
  /** @override */
  async setValues () {
    /** @ignore */ this.root = 'usergroups'
    /** @ignore */ this.schemaName = 'usergroup'
    /** @ignore */ this.schemaExtensionName = 'usergroups'
    /** @ignore */ this.collectionName = 'usergroups'
    /**
     * Module registered for user groups
     * @type {Array<AbstractApiModule>}
     */
    this.modules = []

    this.useDefaultRouteConfig()
  }

  /** @override */
  async init () {
    await super.init()
    this.registerModule(await this.app.waitForModule('users'))
  }

  /**
   * Registers a module for use with this plugin
   * @param {AbstractApiModule} mod
   */
  async registerModule (mod) {
    if (!mod.schemaName) {
      return this.log('warn', 'cannot register module, module doesn\'t define a schemaName')
    }
    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.extendSchema(mod.schemaName, this.schemaExtensionName)

    this.log('debug', `registered ${mod.name} for use with usergroups`)
    this.modules.push(mod)
  }

  /** @override */
  async delete (...args) {
    const { _id } = await super.delete(...args)
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
}

export default UserGroupsModule
